// ═══ ensure-official-framework — تثبيت البناء الرسمي (Idempotent) ═════
// الوظيفة الوحيدة: إضافة/تحديث عناصر الإطار المهني الرسمي فقط.
//
// الضمانات:
//   • Idempotent — التشغيل المتكرر لا يكرر ولا يغيّر شيئًا (upsert بـ officialCode).
//   • ⛔ لا deleteMany ولا حذف من أي جدول — إطلاقًا.
//   • ⛔ لا يمس بيانات المستخدمين أو الإنجازات أو الشواهد أو العناصر المخصصة.
//   • آمن في الإنتاج (تحديث النص الرسمي فقط عند صدور إصدار مرجعي محدَّث).
//
// الاستخدام: bun scripts/ensure-official-framework.ts   (أو npx tsx ...)
// الخروج: نجاح = 0 مع تقرير الأعداد؛ أي فشل = 1.
import { PrismaClient } from '@prisma/client'
import {
  ensureOfficialFramework,
  OFFICIAL_DOMAINS,
  OFFICIAL_SUBCRITERIA_TOTAL,
  OFFICIAL_SOURCE,
} from '../src/lib/official-framework'

const db = new PrismaClient()

async function main() {
  console.log('═', OFFICIAL_SOURCE.document)
  console.log('═', `${OFFICIAL_SOURCE.authority} — ${OFFICIAL_SOURCE.edition}`)

  const before = {
    domains: await db.domain.count({ where: { isOfficial: true } }),
    criteria: await db.criterion.count({ where: { isOfficial: true } }),
    subCriteria: await db.subCriterion.count({ where: { isOfficial: true } }),
  }
  console.log('قبل التثبيت:', JSON.stringify(before))

  const res = await ensureOfficialFramework(db)

  console.log('التقرير:')
  console.log(`  مجالات:   ${res.totals.domains}/${OFFICIAL_DOMAINS.length}`)
  console.log(`  معايير:   ${res.totals.criteria}/${OFFICIAL_DOMAINS.reduce((s, d) => s + d.criteria.length, 0)}`)
  console.log(`  فرعية:    ${res.totals.subCriteria}/${OFFICIAL_SUBCRITERIA_TOTAL}`)
  console.log(`  أنشئ الآن: ${res.created.domains}D/${res.created.criteria}C/${res.created.subCriteria}S — حدّث: ${res.updated.domains}D/${res.updated.criteria}C/${res.updated.subCriteria}S`)

  // تحقق صارم من الاكتمال الرسمي — فشل التحقق = فشل السكربت
  const expected = {
    domains: OFFICIAL_DOMAINS.length,
    criteria: OFFICIAL_DOMAINS.reduce((s, d) => s + d.criteria.length, 0),
    subCriteria: OFFICIAL_SUBCRITERIA_TOTAL,
  }
  const ok =
    res.totals.domains === expected.domains &&
    res.totals.criteria === expected.criteria &&
    res.totals.subCriteria === expected.subCriteria
  if (!ok) {
    console.error(`⛔ عدم تطابق: المتوقع ${JSON.stringify(expected)} الفعلي ${JSON.stringify(res.totals)}`)
    process.exit(1)
  }

  // تحقق إضافي: لا توجد عناصر رسمية يتيمة خارج الأكواد المعتمدة
  const orphanCriteria = await db.criterion.count({
    where: { isOfficial: true, officialCode: { notIn: OFFICIAL_DOMAINS.flatMap((d) => d.criteria.map((c) => c.code)) } },
  })
  if (orphanCriteria > 0) {
    console.error(`⛔ وُجد ${orphanCriteria} معيار رسمي خارج الأكواد المعتمدة — راجع يدويًا`)
    process.exit(1)
  }

  console.log('✓ البناء الرسمي مثبت ومكتمل — لا حذف ولا مساس بأي بيانات مستخدم')
}

const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => db.$disconnect())
}
