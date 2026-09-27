// ═══ اختبار اتصال قاعدة Supabase الإنتاجية عبر الـ Poolers ═══════════
// يقرأ كلمة المرور من .env.supabase-token (محجوب من Git) — لا أسرار في الكود.
// يحدد أي مجموعة pooler (aws-0/aws-1) تخدم المشروع فعليًا.
import { readFileSync } from 'fs'

const lines = readFileSync('.env.supabase-token', 'utf8').split('\n')
const get = (k: string) =>
  lines.find((l) => l.startsWith(k + '='))?.split('=').slice(1).join('=')?.trim() ?? ''

const REF = 'rgrkdqsjfmukudrvpweu'
const PASS = get('DB_PASSWORD')

if (!PASS) {
  console.error('DB_PASSWORD غير موجودة في .env.supabase-token')
  process.exit(1)
}

const hosts = [
  'aws-0-eu-central-1.pooler.supabase.com',
  'aws-1-eu-central-1.pooler.supabase.com',
]

for (const host of hosts) {
  for (const port of [5432, 6543] as const) {
    const mode = port === 5432 ? 'session' : 'transaction'
    try {
      const sql = new Bun.SQL(
        `postgresql://postgres.${REF}:${PASS}@${host}:${port}/postgres`,
      )
      const r = await sql`select version() as v, current_database() as db`
      console.log(`OK   ${host}:${port} (${mode}) → PG ${r[0].v.split(' ')[1]} | db=${r[0].db}`)
      await sql.end()
    } catch (e: any) {
      console.log(`FAIL ${host}:${port} (${mode}) → ${String(e?.message ?? e).slice(0, 100)}`)
    }
  }
}
