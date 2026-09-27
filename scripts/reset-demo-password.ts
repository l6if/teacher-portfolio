/**
 * إعادة تعيين كلمة مرور الحساب التجريبي إلى قيمة معروفة (قابلة للمشاركة في المعاينة).
 * الحساب الأصلي أُنشئ بكلمة مرور عشوائية طُبعت عند الإنشاء فقط.
 * هذا السكربت مستهدف ومحدد: يعدّل مستخدمًا واحدًا بالبريد — لا يمس أي بيانات أخرى.
 *
 * الاستخدام: DEMO_PASSWORD='...' bun scripts/reset-demo-password.ts
 */
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'
import { validatePassword } from '../src/lib/validation'

const db = new PrismaClient()

const DEMO_EMAIL = (process.env.DEMO_EMAIL ?? 'demo@madrasati.sa').trim().toLowerCase()
// لا افتراضي لكلمة المرور أبدًا — من البيئة فقط (منع أي كلمة مرور معروفة في الكود)
const NEW_PASSWORD = (process.env.DEMO_PASSWORD ?? '').trim()
if (!NEW_PASSWORD) {
  console.error('اضبط DEMO_PASSWORD في البيئة أولًا (بلا افتراضيات).')
  process.exit(1)
}

async function main() {
  const err = validatePassword(NEW_PASSWORD)
  if (err) {
    console.error(`كلمة المرور المطلوبة مرفوضة بالسياسة: ${err}`)
    process.exit(1)
  }
  const user = await db.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true, name: true, isDemo: true } })
  if (!user) {
    console.error(`لا يوجد حساب بهذا البريد: ${DEMO_EMAIL}`)
    process.exit(1)
  }
  // رفع epoch يبطل أي جلسات قديمة للحساب التجريبي
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(NEW_PASSWORD), sessionEpoch: { increment: 1 } },
  })
  console.log(`تم تعيين كلمة مرور جديدة للحساب التجريبي: <${DEMO_EMAIL}> (${user.name})`)
}

// حماية الاستيراد: تنفيذ فقط عند التشغيل المباشر
if (import.meta.main) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => db.$disconnect())
}
