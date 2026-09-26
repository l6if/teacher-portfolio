/**
 * تشخيص مباشر لحساب الديمو في قاعدة البيانات الفعلية التي يستخدمها خادم المعاينة.
 * لا يطبع passwordHash ولا أي سر — فقط وجوده كقيمة منطقية.
 * الاستخدام: bun scripts/diagnose-demo.ts [password-to-test]
 */
import { PrismaClient } from '@prisma/client'
import { verifyPassword } from '../src/lib/auth'
import { normalizeEmail } from '../src/lib/validation'

const db = new PrismaClient()
const EMAIL = 'demo@madrasati.sa'
const candidate = process.argv[2] ?? ''

async function main() {
  console.log('═══ قاعدة البيانات الفعلية ═══')
  console.log('DATABASE_URL host/db:', (process.env.DATABASE_URL ?? '(from .env via Next)')
    .replace(/:[^:@/]*@/, ':***@').replace(/.*@/, '…@').split('/').pop(), '(provider: postgresql)')

  console.log('\n═══ البحث عن مستخدم الديمو (بعد التطبيع) ═══')
  const user = await db.user.findUnique({
    where: { email: normalizeEmail(EMAIL) },
    select: {
      id: true, email: true, name: true, role: true, status: true,
      isDemo: true, school: true, sessionEpoch: true,
      passwordHash: true, createdAt: true, updatedAt: true, lastLoginAt: true,
    },
  })

  if (!user) {
    console.log('❌ المستخدم غير موجود!')
    process.exit(1)
  }

  // طباعة الحقول الآمنة فقط — الهاش لا يُطبع أبدًا
  const { passwordHash, ...safe } = user
  console.log(JSON.stringify({
    ...safe,
    schoolId: user.school ?? '(school كنص — لا يوجد schoolId منفصل في المخطط)',
    passwordHashExists: typeof passwordHash === 'string' && passwordHash.startsWith('scrypt$'),
    passwordHashFormat: passwordHash?.split('$')[0] ?? '(فارغ)',
  }, null, 2))

  console.log('\n═══ تطبيع البريد ═══')
  console.log('normalizeEmail("  DEMO@Madrasati.SA ") =', JSON.stringify(normalizeEmail('  DEMO@Madrasati.SA ')))
  console.log('مطابق للمخزن:', normalizeEmail('  DEMO@Madrasati.SA ') === user.email)

  console.log('\n═══ التحقق المباشر من كلمة المرور ═══')
  if (!candidate) {
    console.log('(لم تُمرَّر كلمة مرور للاختبار — bun scripts/diagnose-demo.ts <password>)')
  } else {
    const ok = verifyPassword(candidate, passwordHash)
    console.log(`verifyPassword(candidate, storedHash) = ${ok ? '✓ مطابقة' : '✗ غير مطابقة'}`)
    process.exitCode = ok ? 0 : 2
  }

  console.log('\n═══ الحسابات الجاهزة للمعاينة (حقول آمنة فقط) ═══')
  const all = await db.user.findMany({
    select: { email: true, role: true, status: true, isDemo: true },
    orderBy: { createdAt: 'asc' },
  })
  console.log(JSON.stringify(all, null, 1))
}

if (import.meta.main) {
  main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
}
