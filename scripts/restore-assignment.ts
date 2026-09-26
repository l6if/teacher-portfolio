// استعادة بيانات التكليف التي مسحها الاختبار قبل إصلاح التحديث الجزئي
// ⛔ الاستيراد من ملف آخر لا ينفّذ شيئًا — التنفيذ فقط بتشغيل مباشر (حماية إلزامية).
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  await db.user.update({
    where: { email: 'sultan@madrasati.sa' },
    data: {
      subject: 'اللغة العربية',
      weeklyLoad: 24,
      schedule: JSON.stringify([
        { day: 'الأحد', grade: 'ثالث متوسط', periods: 'الحصص 1 — 3' },
        { day: 'الاثنين', grade: 'أول متوسط', periods: 'الحصص 1 — 4' },
        { day: 'الثلاثاء', grade: 'ثاني متوسط', periods: 'الحصص 2 — 5' },
        { day: 'الأربعاء', grade: 'ثالث متوسط', periods: 'الحصص 1 — 4' },
        { day: 'الخميس', grade: 'أول متوسط + نشاط', periods: 'الحصص 1 — 3' },
      ]),
      committees: JSON.stringify([
        { name: 'لجنة النشاط الطلابي', role: 'رئيس اللجنة' },
        { name: 'لجنة الإعلام التعليمي', role: 'عضو' },
        { name: 'مجلس المعلمين', role: 'عضو' },
      ]),
      extraDuties: JSON.stringify([
        'الإشراف على ركن القراءة الصفي',
        'ريادة الفصول الافتراضية على منصة مدرستي',
        'تنسيق برنامج القراءة المدرسي',
      ]),
    },
  })
  // حذف عام 1449 التجريبي المُؤرشف من اختبار الأرشفة
  const y1449 = await db.academicYear.findFirst({ where: { label: '1449هـ' } })
  if (y1449) {
    await db.evidenceLink.deleteMany({ where: { achievement: { yearId: y1449.id } } })
    await db.achievement.deleteMany({ where: { yearId: y1449.id } })
    await db.goal.deleteMany({ where: { yearId: y1449.id } })
    await db.attachment.deleteMany({ where: { yearId: y1449.id } })
    await db.academicYear.delete({ where: { id: y1449.id } })
  }
  console.log('✓ تمت الاستعادة')
}

// التنفيذ فقط عند التشغيل المباشر — الاستيراد لا ينفّذ شيئًا أبدًا.
const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
}
