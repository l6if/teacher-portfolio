// ═══ إزالة أصداف حسابات QA من الإنتاج (تنظيف أحادي) ═════════════════
// أنشأت هذه الحسابات الستة تحقيقاتُ الـprobe عبر signup أثناء التحقق من حالة
// قاعدة الإنتاج الفارغة (كل probe على بريد غير موجود ينشئ حسابًا) — وجميعها
// بلا أي بيانات (لا إنجازات ولا شواهد؛ بيانات الجولات الاختبارية حُذفت عبر API).
// يُشغَّل من buildCommand مرة واحدة عبر DATABASE_URL المتاحة في بيئة البناء.
// ⛔ آمن: قائمة بريد حرفية بلا أي نمط — deleteMany لن يلمس أي حساب آخر أبدًا.
// ⛔ idempotent: التشغيل الثاني لا يجد شيئًا. ⛔ لا يُفشل البناء أبدًا (exit 0 دائمًا).
async function main() {
  const QA_SHELL_EMAILS = [
    'demo@madrasati.sa',
    'admin@madrasati.sa',
    'sultan@madrasati.sa',
    'qa-probe-nonexistent-9182@madrasati.sa',
    'sha3ry66@gmail.com',
    'e2e-b2@example.com',
    'smoke-final-check@example.com',
  ]
  const url = process.env.DATABASE_URL ?? ''
  if (!url.startsWith('postgres')) {
    console.log('[qa-shell-cleanup] لا رابط قاعدة — تخطٍ (dev builds المحلية)')
    return
  }
  const { PrismaClient } = await import('@prisma/client')
  const db = new PrismaClient()
  try {
    const existing = await db.user.findMany({
      where: { email: { in: QA_SHELL_EMAILS } },
      select: { email: true, achievements: { select: { id: true } }, attachments: { select: { id: true } } },
    })
    if (existing.length === 0) {
      console.log('[qa-shell-cleanup] لا أصداف QA متبقية — لا شيء للحذف ✓')
      return
    }
    // صمام أمان إضافي: لا نحذف أي حساب صار فيه بيانات فعلية (لن يحدث — لكن احتياطًا)
    const withData = existing.filter((u) => u.achievements.length > 0 || u.attachments.length > 0)
    if (withData.length > 0) {
      console.log(`[qa-shell-cleanup] ⚠ حسابات فيها بيانات فعلية — تُترك ولا تُحذف: ${withData.map((u) => u.email).join(', ')}`)
      return
    }
    const del = await db.user.deleteMany({ where: { email: { in: existing.map((u) => u.email) } } })
    console.log(`[qa-shell-cleanup] ✓ حُذفت ${del.count} أصداف حسابات QA الفارغة من الإنتاج`)
  } finally {
    await db.$disconnect().catch(() => {})
  }
}

main().catch((e) => {
  // لا نُفشل البناء أبدًا — التنظيف أحادي ويمكن إعادة تشغيله
  console.log(`[qa-shell-cleanup] تخطٍ بسبب خطأ (لا يُفشل البناء): ${String(e).slice(0, 140)}`)
})
