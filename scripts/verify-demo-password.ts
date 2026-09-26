// فحص مباشر: هل تطابق كلمات المرور المرشحة الـ hash المخزّن؟ (لا يطبع الـ hash)
import { PrismaClient } from '@prisma/client'
import { verifyPassword } from '../src/lib/auth'

const db = new PrismaClient()

async function main() {
  const u = await db.user.findUnique({ where: { email: 'demo@madrasati.sa' } })
  if (!u) { console.log('DEMO USER NOT FOUND'); return }
  const candidates = (process.env.CANDIDATES ?? '').split('||').filter(Boolean)
  if (candidates.length === 0) { console.log('no candidates provided'); return }
  for (const c of candidates) {
    const ok = verifyPassword(c, u.passwordHash)
    // نطبع فقط أول حرفين من كلمة المرور + الطول لتجنب تسريبها كاملة في اللوج
    console.log(`candidate[len=${c.length}, starts=${c.slice(0, 2)}***] match=${ok}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
