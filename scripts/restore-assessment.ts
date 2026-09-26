// استعادة الإنجاز الذي حُذف بالخطأ أثناء التدقيق + رابط شاهده الأصلي
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

async function main() {
  const sultan = await db.user.findUnique({ where: { email: 'sultan@madrasati.sa' } })
  if (!sultan) throw new Error('seed user not found')
  const y1448 = await db.academicYear.findFirst({ where: { userId: sultan.id, label: '1448هـ', archived: false } })
  if (!y1448) throw new Error('year not found')
  const goal1 = await db.goal.findFirst({ where: { userId: sultan.id, yearId: y1448.id } })
  const chartReading = await db.attachment.findFirst({ where: { fileName: { contains: 'chart-reading' } } })
  console.log('goal1:', goal1?.title, '| chartReading:', chartReading?.id)

  // تحقق من عدم وجوده مسبقًا
  const existing = await db.achievement.findFirst({ where: { title: 'الاختبار التشخيصي لمهارة القراءة وتحليل النتائج' } })
  if (existing) { console.log('موجود بالفعل — لا حاجة للاستعادة'); return }

  const restored = await db.achievement.create({
    data: {
      type: 'ASSESSMENT',
      title: 'الاختبار التشخيصي لمهارة القراءة وتحليل النتائج',
      field: 'القياس والتقويم',
      date: daysAgo(29),
      description: 'بناء اختبار تشخيصي رقمي وتحليل نتائجه لتحديد الفئات.',
      goalText: 'تحديد مستوى كل طالب قبل بدء الخطة العلاجية.',
      execution: 'اختبار رقمي 20 فقرة + تحليل إكسل للنتائج + قائمة أسماء الفئات.',
      beneficiaries: 'طلاب الصف السابع',
      studentsCount: 86,
      preScore: 58,
      results: 'تحديد 18 طالبًا للخطة العلاجية.',
      impact: 'بناء تدخل مبني على بيانات دقيقة.',
      keywords: 'تشخيص، تحليل نتائج، قراءة',
      status: 'COMPLETED',
      goalId: goal1?.id ?? null,
      userId: sultan.id,
      yearId: y1448.id,
    },
  })
  if (chartReading) {
    await db.evidenceLink.create({ data: { attachmentId: chartReading.id, achievementId: restored.id } })
  }
  console.log('تمت الاستعادة:', restored.id, '| الرابط أُنشئ:', Boolean(chartReading))
  const count = await db.achievement.count({ where: { userId: sultan.id, yearId: y1448.id } })
  console.log('إجمالي إنجازات 1448 لسلطان الآن:', count)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
