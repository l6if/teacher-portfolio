// ═══ اختبار انحدار أمني: لا أسرار تغادر الخادم عبر أي API ═══════════════
// يمنع عودة ثغرة passwordHash في GET /api/me (اكتُشفت 2026-09-27 وأُصلحت
// بطبقتين: SAFE_USER_SELECT في الاستعلام + sanitizeInternal عند التسلسل).
//
// الاستخدام:
//   bun scripts/test-secret-leak.ts                       (ضد http://localhost:3000)
//   TEST_BASE_URL=http://host:port bun scripts/test-secret-leak.ts
//
// يفحص فعليًا عبر HTTP:
//   1) كل نقاط النهاية التي تعيد بيانات المستخدم أو المرفقات (معلم + مدير)
//   2) مسح عميق للحقول الممنوعة: passwordHash / storagePath / مفاتيح الأسرار
//   3) مسح قيمي: صيغة هاش scrypt$، سلاسل اتصال postgres://، قيمة SESSION_SECRET
//   4) غير المسجل → 401 (و /api/session → user:null)
// يخرج برمز 1 عند أي فشل — صالح للتشغيل في CI/الحواجز النهائية.

const BASE = (process.env.TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const TEACHER_EMAIL = process.env.TEST_TEACHER_EMAIL || 'sultan@madrasati.sa'
const TEACHER_PASSWORD = process.env.TEST_TEACHER_PASSWORD ?? ''
const MANAGER_EMAIL = process.env.TEST_MANAGER_EMAIL || 'noura@madrasati.sa'
const MANAGER_PASSWORD = process.env.TEST_MANAGER_PASSWORD ?? ''

// ─── الحقول الممنوعة (مفاتيح، بأي عمق، غير حساسة لحالة الحرف) ───
const FORBIDDEN_KEYS = new Set([
  'passwordhash', 'password_hash', 'password',
  'storagepath', 'storage_path',
  'sessionsecret', 'session_secret',
  'servicerolekey', 'service_role_key', 'servicerole', 'service_role',
  'supabase_service_role_key',
  'database_url', 'direct_url',
  'secret',
])

// ─── أنماط قيمية ممنوعة داخل نص الاستجابة ───
const FORBIDDEN_VALUE_PATTERNS: Array<{ re: RegExp; why: string }> = [
  { re: /scrypt\$/, why: 'تسريب مادة هاش كلمة المرور (scrypt$...)' },
  { re: /postgres(?:ql)?:\/\/[^\s"'`]+:[^\s"'`]+@/, why: 'سلسلة اتصال قاعدة بيانات بكلمات مرور' },
]
const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-DO-NOT-USE-IN-PRODUCTION'
const SECRET_VALUES: string[] = [DEV_FALLBACK_SECRET]
if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
  SECRET_VALUES.push(process.env.SESSION_SECRET)
}

// ─── نتائج ───
type Row = { name: string; status: number; ok: boolean; detail: string }
const results: Row[] = []
let failures = 0

function record(name: string, status: number, ok: boolean, detail: string) {
  results.push({ name, status, ok, detail })
  if (!ok) failures++
}

/** مسح عميق للمفاتيح الممنوعة في أي شجرة JSON */
function scanKeys(value: unknown, path: string, hits: string[]) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanKeys(v, `${path}[${i}]`, hits))
    return
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(k.toLowerCase())) hits.push(`${path}.${k}`)
      scanKeys(v, path ? `${path}.${k}` : k, hits)
    }
  }
}

async function login(email: string, password: string): Promise<{ cookie: string; id: string; role: string } | null> {
  const res = await fetch(`${BASE}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  const raw = res.headers.getSetCookie?.() ?? []
  const line = raw.length
    ? raw.find((c) => c.startsWith('pf_session='))
    : (res.headers.get('set-cookie') || '').split(',').find((c) => c.trim().startsWith('pf_session='))
  const cookie = line ? line.split(';')[0].trim() : ''
  const body = (await res.json()) as { user?: { id: string; role: string } }
  if (!cookie || !body.user) return null
  return { cookie, id: body.user.id, role: body.user.role }
}

async function get(path: string, cookie?: string): Promise<{ status: number; text: string; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
  })
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* ليس JSON */ }
  return { status: res.status, text, json }
}

/** فحص استجابة كاملة: مفاتيح ممنوعة + قيم ممنوعة + أسرار بيئية */
function audit(name: string, r: { status: number; text: string; json: any }, expect: number) {
  if (r.status !== expect) {
    record(name, r.status, false, `الحالة ${r.status} (المتوقع ${expect})`)
    return
  }
  const keyHits: string[] = []
  if (r.json !== null) scanKeys(r.json, '', keyHits)
  const valueHits: string[] = []
  for (const { re, why } of FORBIDDEN_VALUE_PATTERNS) {
    if (re.test(r.text)) valueHits.push(why)
  }
  for (const s of SECRET_VALUES) {
    if (s && s.length >= 16 && r.text.includes(s)) valueHits.push('قيمة SESSION_SECRET ظهرت حرفيًا')
  }
  if (keyHits.length || valueHits.length) {
    record(name, r.status, false,
      `ممنوع: ${[...keyHits.slice(0, 5), ...valueHits].join(' | ')}`)
  } else {
    record(name, r.status, true, 'نظيف')
  }
}

// ═══ التنفيذ ═════════════════════════════════════════════════

async function main() {
  console.log(`اختبار تسرب الأسرار ضد: ${BASE}`)
  console.log('─'.repeat(72))

  // 1) غير المسجل
  const unauthMe = await get('/api/me')
  record('UNAUTH /api/me → 401', unauthMe.status, unauthMe.status === 401, `الحالة ${unauthMe.status}`)
  const unauthDash = await get('/api/dashboard')
  record('UNAUTH /api/dashboard → 401', unauthDash.status, unauthDash.status === 401, `الحالة ${unauthDash.status}`)
  const unauthSession = await get('/api/session')
  record('UNAUTH /api/session → user:null', unauthSession.status,
    unauthSession.status === 200 && unauthSession.json?.user === null, 'يجب أن يعيد user:null')

  // 2) جلسة المعلم
  const teacher = await login(TEACHER_EMAIL, TEACHER_PASSWORD)
  if (!teacher) {
    console.error(`⛔ تعذر تسجيل دخول المعلم ${TEACHER_EMAIL} — شغّل الخادم وبيانات التطوير أولًا`)
    process.exit(1)
  }
  console.log(`✓ جلسة المعلم: ${teacher.id} (${teacher.role})`)

  // كل نقاط النهاية التي تعيد بيانات مستخدم أو مرفقات (جلسة معلم)
  const teacherEndpoints: Array<[string, string]> = [
    ['/api/me', 'GET /api/me (ثغرة passwordHash الأصلية)'],
    ['/api/session', 'GET /api/session'],
    ['/api/dashboard', 'GET /api/dashboard'],
    ['/api/profile', 'GET /api/profile'],
    ['/api/achievements', 'GET /api/achievements (روابط شواهد متداخلة)'],
    ['/api/attachments', 'GET /api/attachments'],
    ['/api/goals', 'GET /api/goals (روابط شواهد متداخلة)'],
    ['/api/search?q=' + encodeURIComponent('قراءة'), 'GET /api/search'],
    ['/api/reflection', 'GET /api/reflection'],
    ['/api/devplan', 'GET /api/devplan'],
    // /api/years لا يملك GET (السنوات تعود ضمن /api/me) — 405 متوقع وليس فشلًا
    ['/api/report', 'GET /api/report (بيانات التقارير كاملة)'],
  ]
  for (const [path, name] of teacherEndpoints) {
    const r = await get(path, teacher.cookie)
    audit(name, r, 200)
  }

  // 3) جلسة المدير — يرى ملفات المعلمين (استعلامات resolveTargetUser)
  const manager = await login(MANAGER_EMAIL, MANAGER_PASSWORD)
  if (!manager) {
    console.error(`⛔ تعذر تسجيل دخول المدير ${MANAGER_EMAIL}`)
    process.exit(1)
  }
  console.log(`✓ جلسة المدير: ${manager.id} (${manager.role})`)

  const managerEndpoints: Array<[string, string, number]> = [
    ['/api/manager/teachers', 'GET /api/manager/teachers', 200],
    [`/api/dashboard?userId=${teacher.id}`, 'GET /api/dashboard?userId (ملف معلم)', 200],
    [`/api/profile?userId=${teacher.id}`, 'GET /api/profile?userId (ملف معلم)', 200],
    [`/api/report?userId=${teacher.id}`, 'GET /api/report?userId (تقرير معلم)', 200],
    [`/api/achievements?userId=${teacher.id}`, 'GET /api/achievements?userId', 200],
  ]
  for (const [path, name, expect] of managerEndpoints) {
    const r = await get(path, manager.cookie)
    audit(name, r, expect)
  }

  // 4) تحقق إيجابي: البيانات المشروعة ما زالت تصل (لا كسر وظيفي بسبب التنقية)
  const me = await get('/api/me', teacher.cookie)
  const meOk = me.json?.user &&
    typeof me.json.user.name === 'string' &&
    typeof me.json.user.email === 'string' &&
    typeof me.json.user.role === 'string'
  record('SANITY /api/me يعيد بيانات مشروعة (name/email/role)', me.status,
    Boolean(meOk), meOk ? 'سليم' : 'حقول المستخدم الأساسية مفقودة!')
  const attach = await get('/api/attachments', teacher.cookie)
  const attachOk = Array.isArray(attach.json?.attachments) &&
    (attach.json.attachments.length === 0 ||
      ('id' in attach.json.attachments[0] && 'title' in attach.json.attachments[0]))
  record('SANITY /api/attachments يعيد حقول مشروعة (id/title)', attach.status,
    Boolean(attachOk), attachOk ? 'سليم' : 'حقول المرفقات الأساسية مفقودة!')

  // ─── التقرير ───
  console.log('─'.repeat(72))
  for (const r of results) {
    const icon = r.ok ? '✓' : '✗'
    console.log(`${icon} [${r.status}] ${r.name}${r.ok ? '' : ` — ${r.detail}`}`)
  }
  console.log('─'.repeat(72))
  const passed = results.length - failures
  console.log(`النتيجة: ${passed}/${results.length} اجتاز`)
  if (failures > 0) {
    console.error(`⛔ ${failures} فشل — أسرار/بيانات داخلية تغادر الخادم أو حالات غير متوقعة`)
    process.exit(1)
  }
  console.log('✓ لا passwordHash ولا storagePath ولا أي سر يغادر الخادم عبر أي API')
}

const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main().catch((e) => {
    console.error('خطأ في تنفيذ الاختبار:', e)
    process.exit(1)
  })
}

export { main as runSecretLeakTest }
