// ═══ Production Bootstrap — إنشاء أول حساب إداري/مستخدم في بيئة إنتاج نظيفة ═══
// هذه هي الأداة الرسمية لتهيئة أول حساب في الإنتاج (بدل seed التخريبي الممنوع هناك).
// الاستخدام: bun scripts/create-user.ts <email> <password> <اسم> [TEACHER|MANAGER] [المدرسة] [التخصص]
// مثال: bun scripts/create-user.ts admin@school.sa 'Str0ng!Pass' 'نورة القحطاني' MANAGER 'متوسطة الملك عبدالعزيز'
// ⛔ الاستيراد من ملف آخر لا ينفّذ شيئًا — التنفيذ فقط بتشغيل مباشر (حماية إلزامية).
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'

const db = new PrismaClient()

async function main() {
  const [email, password, name, roleArg, school, subject] = process.argv.slice(2)
  if (!email || !password || !name) {
    console.error('الاستخدام: bun scripts/create-user.ts <email> <password> <اسم> [TEACHER|MANAGER] [المدرسة] [التخصص]')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    process.exit(1)
  }
  const role = roleArg === 'MANAGER' ? 'MANAGER' : 'TEACHER'
  const exists = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (exists) {
    console.error('هذا البريد مستخدم بالفعل:', email)
    process.exit(1)
  }
  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      name,
      role,
      school: school || null,
      subject: subject || null,
    },
  })
  console.log(`تم إنشاء المستخدم: ${user.name} <${user.email}> بدور ${role}`)
}

// التنفيذ فقط عند التشغيل المباشر — الاستيراد لا ينفّذ شيئًا أبدًا.
const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => db.$disconnect())
}
