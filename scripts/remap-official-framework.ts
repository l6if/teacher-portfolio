// ═══ remap-official-framework — إعادة ربط آمنة عند تصحيح النص الرسمي ══
// سياق: نُفّذ إصدار سابق من البناء الرسمي (32 فرعيًا) بأسماء غير
// مطابقة للوثيقة الرسمية قبل التحقق من المصدر. بعد اعتماد النص
// الرسمي (39 فرعيًا) تتزاحم بعض الأكواد بمعانٍ مختلفة.
//
// هذا السكربت (يُشغَّل مرة واحدة عند الترقية — Idempotent):
//   1) يلتقط صورة لروابط الإنجازات الحالية بأسمائها القديمة
//   2) يضمن البناء الرسمي الجديد (upsert — لا حذف إطلاقًا)
//   3) يعيد ربط كل إنجاز دلالته القديمة بالكود الرسمي الصحيح
//      (جدول LEGACY_SUB_REMAP — مفتاحه النص القديم فلا يخطئ)
//   4) يتحقق: الأعداد الإجمالية قبل = بعد (لا فقد أي بيانات)
//
// الضمانات:
//   • ⛔ لا deleteMany ولا حذف — تحديث روابط فقط
//   • ⛔ لا يمس حقل field (legacyCategory) ولا الشواهد ولا المخصص
//   • نسخة احتياطية منطقية قبل أي تعديل
//   • آمن للإنتاج: على قاعدة جديدة بلا روابط قديمة = لا يفعل شيئًا
//
// الاستخدام: bun scripts/remap-official-framework.ts [--dry-run]
import { PrismaClient } from '@prisma/client'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import {
  ensureOfficialFramework,
  LEGACY_SUB_REMAP,
  OFFICIAL_DOMAINS,
  OFFICIAL_SUBCRITERIA_TOTAL,
  OFFICIAL_SOURCE,
} from '../src/lib/official-framework'

const db = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  console.log('═', OFFICIAL_SOURCE.document)
  console.log('═', `${OFFICIAL_SOURCE.authority} — ${OFFICIAL_SOURCE.edition}`)
  console.log(`═ إجمالي المعايير الفرعية الرسمية: ${OFFICIAL_SUBCRITERIA_TOTAL}\n`)

  // ─── 1) صورة الروابط الحالية (قبل أي تعديل) ─────────────────────
  const before = {
    achievements: await db.achievement.count(),
    attachments: await db.attachment.count(),
    evidenceLinks: await db.evidenceLink.count(),
    linkedSubs: await db.achievement.count({ where: { subCriterionId: { not: null } } }),
  }

  const linked = await db.achievement.findMany({
    where: { subCriterionId: { not: null } },
    select: {
      id: true,
      title: true,
      subCriterionId: true,
      subCriterion: { select: { officialCode: true, name: true, isOfficial: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // خطة إعادة الربط: النص القديم → الكود الرسمي الصحيح
  const plan = linked
    .filter((a) => a.subCriterion?.isOfficial && LEGACY_SUB_REMAP[a.subCriterion.name.trim()])
    .map((a) => ({
      id: a.id,
      title: a.title,
      fromCode: a.subCriterion!.officialCode,
      fromName: a.subCriterion!.name,
      toCode: LEGACY_SUB_REMAP[a.subCriterion!.name.trim()],
    }))

  console.log(`روابط رسمية حالية: ${linked.length} — منها تحتاج إعادة ربط: ${plan.length}`)
  for (const p of plan) {
    console.log(`  ${p.fromCode} «${p.fromName}» → ${p.toCode} — ${p.title.slice(0, 48)}`)
  }

  // نسخة احتياطية منطقية
  const backupDir = resolve(process.cwd(), 'db', 'backups')
  mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = resolve(backupDir, `official-remap-backup-${stamp}.json`)
  writeFileSync(backupPath, JSON.stringify({ takenAt: new Date().toISOString(), before, plan }, null, 2))
  console.log(`✓ نسخة احتياطية منطقية: ${backupPath}\n`)

  if (DRY_RUN) {
    console.log('🔁 --dry-run: لم يُكتب أي تغيير (بما في ذلك ensure)')
    return
  }

  // ─── 2) ضمان البناء الرسمي الجديد (كل الأكواد الجديدة تصبح موجودة) ───
  const res = await ensureOfficialFramework(db)
  console.log(`✓ البناء الرسمي: ${res.totals.domains}/${OFFICIAL_DOMAINS.length} مجالات — ${res.totals.criteria}/10 معايير — ${res.totals.subCriteria}/${OFFICIAL_SUBCRITERIA_TOTAL} فرعية`)
  if (res.totals.subCriteria !== OFFICIAL_SUBCRITERIA_TOTAL || res.totals.criteria !== 10 || res.totals.domains !== 3) {
    console.error('⛔ عدم اكتمال البناء الرسمي — توقف بأمان قبل أي إعادة ربط')
    process.exit(1)
  }

  // ─── 3) تنفيذ إعادة الربط وفق الخطة (الأنساب من الفرعي الجديد) ───
  if (plan.length > 0) {
    const newSubs = await db.subCriterion.findMany({
      where: { isOfficial: true },
      select: { id: true, officialCode: true, criterionId: true, criterion: { select: { domainId: true } } },
    })
    const byCode = new Map(newSubs.map((s) => [s.officialCode, s]))

    const updates: ReturnType<typeof db.achievement.update>[] = []
    for (const p of plan) {
      const target = byCode.get(p.toCode)
      if (!target) {
        console.error(`⛔ الكود الهدف ${p.toCode} غير موجود بعد ensure — توقف`)
        process.exit(1)
      }
      updates.push(
        db.achievement.update({
          where: { id: p.id },
          data: {
            domainId: target.criterion.domainId,
            criterionId: target.criterionId,
            subCriterionId: target.id,
          },
        }),
      )
    }
    await db.$transaction(updates)
    console.log(`✓ أعيد ربط ${updates.length} إنجازًا بالأكواد الرسمية الصحيحة`)
  } else {
    console.log('ℹ لا روابط تحتاج إعادة ربط — لا شيء تغيّر')
  }

  // ─── 4) تحقق صارم بعد العملية ────────────────────────────────────
  const after = {
    achievements: await db.achievement.count(),
    attachments: await db.attachment.count(),
    evidenceLinks: await db.evidenceLink.count(),
    linkedSubs: await db.achievement.count({ where: { subCriterionId: { not: null } } }),
  }
  const same =
    before.achievements === after.achievements &&
    before.attachments === after.attachments &&
    before.evidenceLinks === after.evidenceLinks &&
    before.linkedSubs === after.linkedSubs
  if (!same) {
    console.error(`⛔ خلل في الأعداد! قبل ${JSON.stringify(before)} بعد ${JSON.stringify(after)} — راجع النسخة الاحتياطية`)
    process.exit(1)
  }
  console.log(`✓ الأعداد كما هي تمامًا: إنجازات ${after.achievements} / شواهد ${after.attachments} / روابط ${after.evidenceLinks} / مرتبطة ${after.linkedSubs}`)
}

const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => db.$disconnect())
}
