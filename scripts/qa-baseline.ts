// خط الأساس قبل أي QA — قراءة فقط (Task 8: سجل baseline)
// Usage: (unset DATABASE_URL DIRECT_URL; bun scripts/qa-baseline.ts)
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const [users, achievements, attachments, evidenceLinks, domains, criteria, subCriteria, customDomains, customCriteria, customSubs] = await Promise.all([
    db.user.count(),
    db.achievement.count(),
    db.attachment.count(),
    db.evidenceLink.count(),
    db.domain.count(),
    db.criterion.count(),
    db.subCriterion.count(),
    db.domain.count({ where: { isOfficial: false } }),
    db.criterion.count({ where: { isOfficial: false } }),
    db.subCriterion.count({ where: { isOfficial: false } }),
  ])
  const reportSizes = await db.attachment.groupBy({ by: ['reportDisplaySize'], _count: true })
  console.log(JSON.stringify({
    at: new Date().toISOString(),
    users, achievements, attachments, evidenceLinks,
    framework: { domains, criteria, subCriteria, customDomains, customCriteria, customSubs },
    reportDisplaySize: reportSizes.map((r) => ({ size: r.reportDisplaySize ?? '(null)', count: r._count })),
  }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
