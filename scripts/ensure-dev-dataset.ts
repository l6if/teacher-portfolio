// ═══ ensure-dev-dataset — بيانات التطوير القياسية على PostgreSQL المحلي ═══
// يعيد استخدام populateDevDataset من prisma/seed.ts (نفس المنطق بلا تكرار)
// لكن يستهدف قاعدة التطوير المحلية الحصرية (127.0.0.1:5433/teacherfolio).
//
// الضمانات (نفس فلسفة أمان seed):
//   1) ⛔ يُرفض قاطعًا في NODE_ENV=production.
//   2) ⛔ يُرفض لأي رابط ليس loopback محليًا (127.0.0.1/localhost) — الإنتاج/Supabase ممنوع.
//   3) لا يمس قاعدة فيها بيانات أصلًا: إن وُجد مستخدمون فعليون يتوقف
//      ما لم يُمرَّ --fresh صريحًا (المسح المتعمد لقاعدة التطوير فقط).
//   4) الاستيراد من ملف آخر لا ينفّذ شيئًا — تشغيل مباشر فقط.
//
// الاستخدام: bun scripts/ensure-dev-dataset.ts [--fresh]
// يُتبع عادة بـ: ensure-super-admin + ensure-demo-account + seed-official-fields
import { PrismaClient } from '@prisma/client'
import { populateDevDataset } from '../prisma/seed'

const db = new PrismaClient()

function refuse(msg: string, hint: string): never {
  console.error('⛔ ' + msg)
  console.error('   ' + hint)
  process.exit(1)
}

/** رابط loopback محلي فقط — postgres://...@127.0.0.1:PORT/db أو ...@localhost:PORT/db */
function isLocalLoopbackPg(url: string | undefined): boolean {
  if (!url) return false
  const u = url.trim().toLowerCase()
  if (!u.startsWith('postgres://') && !u.startsWith('postgresql://')) return false
  try {
    const parsed = new URL(u)
    const host = parsed.hostname
    return host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1'
  } catch {
    return false
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    refuse(
      'NODE_ENV=production — مشغّل بيانات التطوير ممنوع في الإنتاج نهائيًا.',
      'الإنتاج يستخدم: create-user.ts + ensure-official-framework.ts فقط.',
    )
  }
  if (!isLocalLoopbackPg(process.env.DATABASE_URL)) {
    refuse(
      'DATABASE_URL ليس قاعدة PostgreSQL محلية (loopback) — مشغّل بيانات التطوير لقاعدة التطوير المحلية حصرًا.',
      'المتوقع: postgresql://postgres@127.0.0.1:5433/teacherfolio — أي خادم بعيد (Supabase/إنتاج) ممنوع.',
    )
  }

  const existingUsers = await db.user.count()
  if (existingUsers > 0 && !process.argv.includes('--fresh')) {
    refuse(
      `القاعدة تحتوي ${existingUsers} مستخدمًا — لن تُمس بيانات قائمة دون طلب صريح.`,
      'لإعادة تعبئة قاعدة التطوير المحلية عمدًا: bun scripts/ensure-dev-dataset.ts --fresh',
    )
  }

  if (existingUsers > 0) {
    console.warn(`⚠️ --fresh: سيتم مسح بيانات قاعدة التطوير المحلية (${existingUsers} مستخدمًا) وإعادة تعبئتها...`)
    await db.$transaction([
      db.evidenceLink.deleteMany(),
      db.attachment.deleteMany(),
      db.achievement.deleteMany(),
      db.reflection.deleteMany(),
      db.devPlan.deleteMany(),
      db.goal.deleteMany(),
      db.academicYear.deleteMany(),
      db.user.deleteMany(),
      db.subCriterion.deleteMany({ where: { isOfficial: false } }),
      db.criterion.deleteMany({ where: { isOfficial: false } }),
      db.domain.deleteMany({ where: { isOfficial: false } }),
    ])
  }

  await populateDevDataset(db)

  const counts = {
    users: await db.user.count(),
    achievements: await db.achievement.count(),
    attachments: await db.attachment.count(),
    links: await db.evidenceLink.count(),
  }
  console.log('✓ بيانات التطوير القياسية جاهزة على PostgreSQL المحلي:', counts)
}

const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => db.$disconnect())
}
