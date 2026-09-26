import { PrismaClient } from '@prisma/client'
import { verifyPassword } from '../src/lib/auth'
const db = new PrismaClient()
const tests: Array<[string, string]> = [
  ['admin@madrasati.sa', '***REMOVED-DEV-SECRET***'],
  ['admin@madrasati.sa', '***REMOVED-DEV-SECRET***'],
  ['sultan@madrasati.sa', '***REMOVED-DEV-SECRET***'],
  ['noura@madrasati.sa', '***REMOVED-DEV-SECRET***'],
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
