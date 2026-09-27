// ═══ Super Admin Bootstrap — إنشاء/ضمان مسؤول المنصة الأول ══════════════
// Idempotent: موجود → يضمن الدور والحالة فقط؛ غير موجود → ينشئه.
// ⛔ لا يعمل بمجرد import (حماية إلزامية) — التنفيذ بالتشغيل المباشر فقط.
// ⛔ ليس جزءًا من seed العامة — بيانات الحساب تمر عبر متغيرات البيئة لا Git.
//
// الاستخدام:
//   SUPER_ADMIN_EMAIL=admin@madrasati.sa SUPER_ADMIN_PASSWORD='Str0ng!Pass' \
//     bun scripts/ensure-super-admin.ts
//
//   (أو بدون SUPER_ADMIN_PASSWORD — يُولَّد مفتاح قوي ويُطبع مرة واحدة)
//   --reset-password : يعين كلمة مرور جديدة للمسؤول القائم (يرفع epoch فيبطل جلساته)
//
// ⛔ ممنوع في الإنتاج تخزين كلمة المرور في Git أو ملفات البيئة المتبعة.
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'crypto'
import { hashPassword } from '../src/lib/auth'

const db = new PrismaClient()

function generateStrongPassword(): string {
  // 20 حرفًا من أبجدية آمنة للعرض والنسخ
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = randomBytes(20)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

async function main() {
  const resetPassword = process.argv.includes('--reset-password')

  const email = (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.error('اضبط SUPER_ADMIN_EMAIL (بريد صالح) في متغيرات البيئة أولًا.')
    process.exit(1)
  }

  const providedPassword = (process.env.SUPER_ADMIN_PASSWORD ?? '').trim()
  if (providedPassword && providedPassword.length < 8) {
    console.error('SUPER_ADMIN_PASSWORD يجب أن تكون 8 أحرف على الأقل.')
    process.exit(1)
  }

  // حماية إنتاجية: لا تشغيل تخريبي — الأداة لا تحذف شيئًا أبدًا
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SUPER_ADMIN_BOOTSTRAP) {
    console.error('في الإنتاج أضف ALLOW_SUPER_ADMIN_BOOTSTRAP=1 تأكيدًا صريحًا لهذه الخطوة.')
    process.exit(1)
  }

  const existing = await db.user.findUnique({ where: { email } })

  if (existing) {
    // Idempotent: لا تكرار ولا إعادة إنشاء — ضمان الدور والحالة فقط
    const data: Record<string, unknown> = {}
    if (existing.role !== 'SUPER_ADMIN') data.role = 'SUPER_ADMIN'
    if (existing.status !== 'ACTIVE') data.status = 'ACTIVE'
    if (resetPassword) {
      const password = providedPassword || generateStrongPassword()
      data.passwordHash = hashPassword(password)
      data.sessionEpoch = { increment: 1 } // إبطال جلساته القديمة
      if (!providedPassword) {
        console.log(`\nكلمة مرور جديدة لمسؤول المنصة (تُطبع مرة واحدة): ${password}\n`)
      }
    }
    if (!Object.keys(data).length) {
      console.log(`مسؤول المنصة موجود فعلًا ونشط: ${existing.name} <${existing.email}>`)
      return
    }
    const updated = await db.user.update({ where: { id: existing.id }, data })
    console.log(`تم ضمان مسؤول المنصة: ${updated.name} <${updated.email}> (تحديث: ${Object.keys(data).join(', ')})`)
    return
  }

  const password = providedPassword || generateStrongPassword()
  const user = await db.user.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      name: 'مسؤول المنصة',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      gender: null,
    },
  })
  console.log(`تم إنشاء مسؤول المنصة: <${user.email}>`)
  if (!providedPassword) {
    console.log(`كلمة المرور (تُطبع مرة واحدة — انسخها الآن ولن تظهر مجددًا): ${password}`)
  }
}

// التنفيذ فقط عند التشغيل المباشر — الاستيراد لا ينفّذ شيئًا أبدًا.
const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => db.$disconnect())
}
