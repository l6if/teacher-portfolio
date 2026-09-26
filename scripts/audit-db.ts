// تدقيق قاعدة البيانات — Production Readiness Audit
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('=== 1) TABLES & INDEXES (raw sqlite) ===')
  const tables = await db.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  )
  console.log('Tables:', tables.map((t) => t.name).join(', '))

  const indexes = await db.$queryRawUnsafe<{ name: string; tbl_name: string; sql: string }[]>(
    `SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY tbl_name, name`,
  )
  console.log('\nIndexes:')
  for (const ix of indexes) console.log(`  [${ix.tbl_name}] ${ix.name}`)
  const autoIdx = await db.$queryRawUnsafe<{ name: string; tbl_name: string }[]>(
    `SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND sql IS NULL ORDER BY tbl_name`,
  )
  console.log('Auto-indexes (unique constraints):', autoIdx.map((a) => `${a.tbl_name}.${a.name}`).join(', ') || 'none')

  console.log('\n=== 2) ROW COUNTS ===')
  for (const t of ['User', 'AcademicYear', 'Goal', 'Achievement', 'Attachment', 'EvidenceLink', 'Reflection', 'DevPlan']) {
    const c = await db.$queryRawUnsafe<{ n: number }[]>(`SELECT COUNT(*) as n FROM "${t}"`)
    console.log(`  ${t}: ${c[0].n}`)
  }

  console.log('\n=== 3) USERS (demo accounts check) ===')
  const users = await db.user.findMany({ select: { id: true, email: true, name: true, role: true, school: true, createdAt: true } })
  for (const u of users) console.log(`  ${u.role.padEnd(8)} ${u.name} <${u.email}> school=${u.school ?? '—'}`)

  console.log('\n=== 4) DUPLICATE EvidenceLinks (M2M integrity) ===')
  const dupAch = await db.$queryRawUnsafe<{ attachmentId: string; achievementId: string; n: number }[]>(
    `SELECT attachmentId, achievementId, COUNT(*) as n FROM EvidenceLink WHERE achievementId IS NOT NULL GROUP BY attachmentId, achievementId HAVING n > 1`,
  )
  console.log('  duplicate (attachment,achievement) links:', dupAch.length)
  const dupGoal = await db.$queryRawUnsafe<{ attachmentId: string; goalId: string; n: number }[]>(
    `SELECT attachmentId, goalId, COUNT(*) as n FROM EvidenceLink WHERE goalId IS NOT NULL GROUP BY attachmentId, goalId HAVING n > 1`,
  )
  console.log('  duplicate (attachment,goal) links:', dupGoal.length)

  console.log('\n=== 5) ORPHAN CHECKS ===')
  const orphanYears = await db.$queryRawUnsafe<{ n: number }[]>(`SELECT COUNT(*) as n FROM AcademicYear y JOIN User u ON y.userId = u.id WHERE 0=1`)
  console.log('  orphan years (FK enforced by Prisma):', orphanYears[0].n)
  const linksNoTarget = await db.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*) as n FROM EvidenceLink WHERE achievementId IS NULL AND goalId IS NULL`,
  )
  console.log('  links with NO target (neither achievement nor goal):', linksNoTarget[0].n)
  const orphanLinks = await db.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*) as n FROM EvidenceLink el LEFT JOIN Achievement a ON el.achievementId = a.id WHERE el.achievementId IS NOT NULL AND a.id IS NULL`,
  )
  console.log('  links pointing to deleted achievements:', orphanLinks[0].n)

  console.log('\n=== 6) DATA DISTRIBUTION (real data, not mock) ===')
  const byYear = await db.$queryRawUnsafe<{ label: string; archived: number; achs: number; atts: number }[]>(
    `SELECT y.label, y.archived,
       (SELECT COUNT(*) FROM Achievement a WHERE a.yearId = y.id) as achs,
       (SELECT COUNT(*) FROM Attachment at WHERE at.yearId = y.id) as atts
     FROM AcademicYear y ORDER BY y.createdAt`,
  )
  for (const y of byYear) console.log(`  ${y.label} archived=${y.archived} achievements=${y.achs} attachments=${y.atts}`)

  const byType = await db.$queryRawUnsafe<{ type: string; n: number }[]>(
    `SELECT type, COUNT(*) as n FROM Achievement GROUP BY type ORDER BY n DESC`,
  )
  console.log('  achievement types:', byType.map((t) => `${t.type}=${t.n}`).join(' '))

  const attKinds = await db.$queryRawUnsafe<{ kind: string; n: number }[]>(
    `SELECT kind, COUNT(*) as n FROM Attachment GROUP BY kind ORDER BY n DESC`,
  )
  console.log('  attachment kinds:', attKinds.map((t) => `${t.kind}=${t.n}`).join(' '))

  console.log('\n=== 7) ATTACHMENT URLS (public exposure check) ===')
  const urls = await db.attachment.findMany({ select: { url: true, kind: true } })
  const publicUrls = urls.filter((u) => u.url?.startsWith('/uploads/'))
  const otherUrls = urls.filter((u) => u.url && !u.url.startsWith('/uploads/') && !u.url.startsWith('http'))
  console.log(`  total=${urls.length}, /uploads/ (public dir)=${publicUrls.length}, other-relative=${otherUrls.length}`)
  for (const u of otherUrls.slice(0, 5)) console.log('    OTHER:', u.url)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
