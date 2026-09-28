// ═══ تنظيف جراحي لبيانات QA — يحذف فقط ما أنشأه فريق QA ═══
// يحذف كل بيانات مستخدم QA (qa-shorten@school.sa): إنجازاته وروابطه وشواهده وحسابه،
// من أي عدد من جولات التشغيل — لا يلمس أي سجل أصلي لأي مستخدم آخر.
// ثم يثبت أن العدادات عادت لخط الأساس.
export {}

/** bun runtime global — غير معرّف في tsc بدون @types/bun (سكربت تشغيل فقط) */
declare const Bun: { write(path: string, data: string): Promise<number> }

const BASE = process.env.BASE_URL || 'http://localhost:3100'
const EMAIL = 'qa-shorten@school.sa'
const STATE_FILE = new URL('qa-state.json', import.meta.url).pathname

async function main() {
  const { PrismaClient } = await import('@prisma/client')
  const db = new PrismaClient()

  const user = await db.user.findUnique({ where: { email: EMAIL } })
  if (!user) {
    console.log('(مستخدم QA غير موجود — لا شيء للتنظيف)')
  } else {
    const [achCount, attCount, linkCount] = await Promise.all([
      db.achievement.count({ where: { userId: user.id } }),
      db.attachment.count({ where: { userId: user.id } }),
      db.evidenceLink.count({ where: { attachment: { userId: user.id } } }),
    ])
    console.log(`بيانات QA الموجودة: ${achCount} إنجازًا / ${attCount} شاهدًا / ${linkCount} رابطًا`)
    // حذف المستخدم يتالي: إنجازاته وروابطه وشواهده وسنواته (لا مسار API لحذف الحساب — Prisma مباشرة)
    await db.user.delete({ where: { id: user.id } })
    console.log(`✓ حُذف مستخدم QA وكل بياناته (${EMAIL})`)
  }

  // إزالة ملف الحالة المؤقت إن وُجد
  await Bun.write(STATE_FILE, JSON.stringify({ cleaned: true })).catch(() => {})

  // إثبات العدادات (خط الأساس الموثق — يشمل مستخدمًا حقيقيًا سجل عبر رابط المعاينة العامة)
  // خط الأساس الأصلي قبل تسجيله: 7/48/16/19 — المستخدم sha3ry66@gmail.com (حقيقي، 18:35 2026-09-28)
  // أضاف مستخدمًا وإنجازين ⇒ خط الأساس الحالي: 8/50/16/19 — يُحافَظ على بياناته ولا تُمس أبدًا.
  const [users, achievements, attachments, evidenceLinks] = await Promise.all([
    db.user.count(), db.achievement.count(), db.attachment.count(), db.evidenceLink.count(),
  ])
  console.log('\n═══ العدادات بعد التنظيف ═══')
  console.log(JSON.stringify({ users, achievements, attachments, evidenceLinks }, null, 2))
  const expected = { users: 8, achievements: 50, attachments: 16, evidenceLinks: 19 }
  const ok = users === expected.users && achievements === expected.achievements && attachments === expected.attachments && evidenceLinks === expected.evidenceLinks
  console.log(ok ? '✓✓ عادت العدادات لخط الأساس (8/50/16/19 — يشمل بيانات المستخدم الحقيقي)' : '✗ انحراف عن خط الأساس!')
  await db.$disconnect()
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
