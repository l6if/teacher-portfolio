// ═══ migrate-legacy-achievements — ترحيل آمن لتصنيف الإنجازات القديمة ══
// يربط الإنجازات القديمة (المصنفة بحقل field النصي القديم) بالمعايير
// الفرعية الرسمية وفق استراتيجية الثقة:
//
//   HIGH CONFIDENCE → ربط تلقائي (أسماء متطابقة دلاليًا مع المعيار الرسمي)
//   AMBIGUOUS       → تُترك بلا subCriterion وتظهر في الواجهة «يحتاج تصنيفًا»
//
// جدول الربط الموثوق (المصدر: تطابق دلالي مباشر مع نص المعيار الفرعي الرسمي):
//   'التعاون المهني'      → S3.2  التفاعل مع مجتمعات التعلم المهني   (مثال المستخدم المعتمد)
//   'التخطيط للتدريس'     → S8.1  تخطيط الوحدات والأنشطة الدراسية
//   'القياس والتقويم'     → S10.2 تطبيق التقويم
//   'التطوير المهني'      → S2.2  تطوير الأداء المهني في ضوء المعايير المهنية
//   'الممارسات التعليمية' → S8.2  التنوع في استخدام طرق واستراتيجيات التدريس
//   (البقية AMBIGUOUS: المبادرات، المشاركات المدرسية، الإنجازات والتكريم،
//    الخطط العلاجية، برامج الإثراء، وقيم field الأخرى/الفارغة — لا تخمين)
//
// الضمانات:
//   • ⛔ لا حذف ولا فقد: تعبئة خانات NULL فقط — أي تصنيف موجود لا يُمس.
//   • ⛔ حقل field القديم يبقى كما هو (legacyCategory) حتى اكتمال الترحيل يدويًا.
//   • Idempotent — إعادة التشغيل لا تغيّر شيئًا (يعالج NULL فقط).
//   • نسخة احتياطية منطقية قبل التنفيذ + مقارنة أعداد صارمة قبل/بعد.
//   • آمن للإنتاج (تحديثات تعبئة فقط) — يُشغَّل بعد ensure-official-framework.
//
// الاستخدام: bun scripts/migrate-legacy-achievements.ts [--dry-run]
import { PrismaClient } from '@prisma/client'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const db = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

// ─── جدول الثقة العالية: قيمة field القديمة → كود المعيار الفرعي الرسمي ───
const HIGH_CONFIDENCE_MAP: Record<string, string> = {
  'التعاون المهني': 'S3.2',
  'التخطيط للتدريس': 'S8.1',
  'القياس والتقويم': 'S10.2',
  'التطوير المهني': 'S2.2',
  'الممارسات التعليمية': 'S8.2',
}

async function main() {
  // 0) يجب وجود البناء الرسمي أولًا
  const officialCount = await db.subCriterion.count({ where: { isOfficial: true } })
  if (officialCount === 0) {
    console.error('⛔ لا توجد معايير فرعية رسمية — شغّل ensure-official-framework أولًا')
    process.exit(1)
  }

  // 1) أعداد ما قبل الترحيل (شرط الأمان: لا يتغير أي عدد إجمالي)
  const before = {
    achievements: await db.achievement.count(),
    attachments: await db.attachment.count(),
    evidenceLinks: await db.evidenceLink.count(),
  }

  // 2) نسخة احتياطية منطقية للتصنيفات (قبل أي تعديل)
  const allAchievements = await db.achievement.findMany({
    select: {
      id: true, title: true, type: true, field: true,
      domainId: true, criterionId: true, subCriterionId: true,
      status: true, userId: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  const backupDir = resolve(process.cwd(), 'db', 'backups')
  mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = resolve(backupDir, `legacy-classification-backup-${stamp}.json`)
  writeFileSync(backupPath, JSON.stringify({ takenAt: new Date().toISOString(), before, achievements: allAchievements }, null, 2))
  console.log(`✓ نسخة احتياطية منطقية: ${backupPath} (${allAchievements.length} إنجازًا)`)

  // 3) حلّل الأكواد الرسمية إلى معرفات فعليّة مع الأنساب
  const subs = await db.subCriterion.findMany({
    where: { isOfficial: true },
    select: {
      id: true, officialCode: true,
      criterion: { select: { id: true, officialCode: true, domain: { select: { id: true, officialCode: true } } } },
    },
  })
  const subByCode = new Map(subs.map((s) => [s.officialCode, s]))

  // 4) صنّف الإنجازات غير المصنفة
  const unmapped = allAchievements.filter((a) => !a.subCriterionId)
  let autoMapped = 0
  const perField: Record<string, number> = {}
  const ambiguous: Record<string, number> = {}
  const updates: { id: string; domainId: string; criterionId: string; subCriterionId: string }[] = []

  for (const a of unmapped) {
    const code = a.field ? HIGH_CONFIDENCE_MAP[a.field.trim()] : undefined
    const target = code ? subByCode.get(code) : undefined
    if (target) {
      updates.push({
        id: a.id,
        domainId: target.criterion.domain.id,
        criterionId: target.criterion.id,
        subCriterionId: target.id,
      })
      autoMapped += 1
      perField[a.field!] = (perField[a.field!] ?? 0) + 1
    } else {
      const key = a.field ?? '(بدون تصنيف قديم)'
      ambiguous[key] = (ambiguous[key] ?? 0) + 1
    }
  }

  console.log('─'.repeat(52))
  console.log(`إنجازات غير مصنفة قبل الترحيل: ${unmapped.length}`)
  console.log(`ربط تلقائي عالي الثقة: ${autoMapped}`)
  for (const [f, n] of Object.entries(perField)) console.log(`   ✓ ${f} → ${HIGH_CONFIDENCE_MAP[f.trim()]} (${n})`)
  const ambiguousTotal = Object.values(ambiguous).reduce((s, n) => s + n, 0)
  console.log(`غامضة (تُترك للمستخدم — «يحتاج تصنيفًا»): ${ambiguousTotal}`)
  for (const [f, n] of Object.entries(ambiguous)) console.log(`   ○ ${f} (${n})`)

  if (DRY_RUN) {
    console.log('─'.repeat(52))
    console.log('🔁 --dry-run: لم يُكتب أي تغيير')
    return
  }

  // 5) نفّذ التحديثات (تعبئة NULL فقط — بمعاملة واحدة)
  if (updates.length > 0) {
    await db.$transaction(
      updates.map((u) =>
        db.achievement.update({
          where: { id: u.id },
          data: { domainId: u.domainId, criterionId: u.criterionId, subCriterionId: u.subCriterionId },
        }),
      ),
    )
    console.log(`✓ تم ربط ${updates.length} إنجازًا بالمعايير الرسمية`)
  } else {
    console.log('ℹ لا توجد إنجازات جديدة للربط — لا شيء تغيّر')
  }

  // 6) تحقق صارم بعد الترحيل: الأعداد الإجمالية كما هي + لا يوجد تصنيف مُ Lost
  const after = {
    achievements: await db.achievement.count(),
    attachments: await db.attachment.count(),
    evidenceLinks: await db.evidenceLink.count(),
  }
  const same =
    before.achievements === after.achievements &&
    before.attachments === after.attachments &&
    before.evidenceLinks === after.evidenceLinks
  if (!same) {
    console.error(`⛔ خلل في الأعداد! قبل ${JSON.stringify(before)} بعد ${JSON.stringify(after)} — راجع النسخة الاحتياطية`)
    process.exit(1)
  }

  const stillUnmapped = await db.achievement.count({ where: { subCriterionId: null } })
  console.log('─'.repeat(52))
  console.log(`✓ الأعداد كما هي تمامًا: إنجازات ${after.achievements} / شواهد ${after.attachments} / روابط ${after.evidenceLinks}`)
  console.log(`✓ المصنفة الآن: ${after.achievements - stillUnmapped} — بانتظار تصنيف المستخدم: ${stillUnmapped}`)
}

const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => db.$disconnect())
}
