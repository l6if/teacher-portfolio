/**
 * تعبئة بيانات جهة العمل للمستخدمين التجريبيين (ترويسة التقرير الرسمي)
 * تشغيل: bun /home/z/my-project/scripts/seed-official-fields.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const res = await db.user.updateMany({
    where: { school: 'متوسطة الملك عبدالعزيز' },
    data: {
      educationAdmin: 'إدارة تعليم الرياض',
      educationOffice: 'مكتب تعليم شمال الرياض',
      principalName: 'أ. نورة العتيبي',
    },
  })
  console.log(`تم تحديث ${res.count} مستخدمًا ببيانات جهة العمل`)
  const sultan = await db.user.findUnique({ where: { email: 'sultan@madrasati.sa' } })
  console.log('تحقق:', { educationAdmin: sultan?.educationAdmin, educationOffice: sultan?.educationOffice, principalName: sultan?.principalName })
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
