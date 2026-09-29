// ═══════════════════════════════════════════════════════════════════
// تنظيف بيانات QA من الإنتاج — حذف كامل لحساب QA وكل أثره
// (المستخدم + الإنجازات + الشواهد + روابطها + السنة + سجلات AI +
//  ملفات التخزين في Supabase) عبر SQL مباشر بترتيب تسلسل حذف آمن.
// الاستخدام: DATABASE_URL=<prod-url> node scripts/qa-prod-cleanup.mjs <qaEmail>
// ═══════════════════════════════════════════════════════════════════
import pg from 'pg'

const EMAIL = process.argv[2] ?? 'qa.report@madrasati.sa'
const URL = process.env.DATABASE_URL
if (!URL) { console.error('اضبط DATABASE_URL'); process.exit(1) }

async function main() {
  const c = new pg.Client({ connectionString: URL, ssl: { rejectUnauthorized: false } })
  await c.connect()

  const user = await c.query('select id from "User" where email = $1', [EMAIL])
  if (user.rowCount === 0) { console.log('لا يوجد حساب QA بهذا البريد — نظيف أصلًا'); await c.end(); return }
  const uid = user.rows[0].id
  console.log('QA user:', uid)

  // 1) مسارات ملفات التخزين (لحذف كائنات Supabase لاحقًا إن وُجدت)
  const atts = await c.query('select "storagePath" from "Attachment" where "userId" = $1 and "storagePath" is not null', [uid])
  const paths = atts.rows.map((r) => r.storagePath)

  // 2) حذف تسلسلي آمن (الروابط ثم المرفقات ثم الإنجازات ... ثم المستخدم)
  const del = async (table, where) => {
    const r = await c.query(`delete from "${table}" where ${where}`, [uid])
    return r.rowCount
  }
  const n1 = await del('EvidenceLink', '"attachmentId" in (select id from "Attachment" where "userId" = $1)')
  const n2 = await del('Attachment', '"userId" = $1')
  const n3 = await del('Achievement', '"userId" = $1')
  const n4 = await del('Goal', '"userId" = $1')
  const n5 = await del('Reflection', '"userId" = $1')
  const n6 = await del('DevPlan', '"userId" = $1')
  const n7 = await del('AiUsageLog', '"userId" = $1')
  const n8 = await del('PasswordResetToken', '"userId" = $1')
  const n9 = await del('AcademicYear', '"userId" = $1')
  const n10 = await del('User', 'id = $1')
  console.log(`حُذف: روابط=${n1} مرفقات=${n2} إنجازات=${n3} أهداف=${n4} تأمل=${n5} خطط=${n6} AI=${n7} توكنات=${n8} سنوات=${n9} مستخدم=${n10}`)

  // 3) تحقق نهائي — الأعداد عادت لخط الأساس
  const counts = {}
  for (const t of ['User', 'Achievement', 'Attachment', 'EvidenceLink', 'AcademicYear', 'AiUsageLog']) {
    const r = await c.query(`select count(*)::int as n from "${t}"`)
    counts[t] = r.rows[0].n
  }
  console.log('الأعداد النهائية:', JSON.stringify(counts))
  const still = await c.query('select count(*)::int as n from "User" where email = $1', [EMAIL])
  console.log(still.rows[0].n === 0 ? '✓ حساب QA أُزيل كليًا' : '✗ ما زال موجودًا!')
  await c.end()

  if (paths.length) {
    console.log('\nمسارات ملفات التخزين المراد حذفها من Supabase (إن رغبت):')
    paths.forEach((p) => console.log('  ', p))
  }
  process.exit(still.rows[0].n === 0 ? 0 : 2)
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
