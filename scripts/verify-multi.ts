import { PrismaClient } from '@prisma/client'
import { verifyPassword } from '../src/lib/auth'
const db = new PrismaClient()
// كلمات المرور من البيئة فقط — لا أسرار في الكود
// الاستخدام: ADMIN_PASSWORD='...' TEACHER_PASSWORD='...' bun scripts/verify-multi.ts
const adminPw = process.env.ADMIN_PASSWORD ?? ''
const teacherPw = process.env.TEACHER_PASSWORD ?? ''
const tests: Array<[string, string]> = [
  ['admin@madrasati.sa', adminPw],
  ['admin@madrasati.sa', '***REMOVED-DEV-SECRET***'],
  ['sultan@madrasati.sa', teacherPw],
  ['noura@madrasati.sa', teacherPw],
]
async function main() {
  for (const [email, pw] of tests) {
    const u = await db.user.findUnique({ where: { email } })
    if (!u) { console.log(`${email}: NOT FOUND`); continue }
    const ok = verifyPassword(pw, u.passwordHash)
    console.log(`${email.padEnd(22)} pw[len=${pw.length}] match=${ok}`)
  }
}
main().finally(() => db.$disconnect())
