// ═══ اختبار انحدار شامل — المرحلة النهائية: المصادقة + Super Admin + AI + الديمو ═══
// يُشغَّل ضد خادم التطوير (3000) — ينشئ بيانات اختبار مؤقتة ثم ينظفها.
// الاستخدام: bun scripts/test-final-phase.mts
import { readFileSync } from 'fs'

// بيئة الشل قد تحمل DATABASE_URL قديمًا (sqlite) يتجاوز .env — نُعقّم كما يفعل dev-server.sh
const envOverride = () => {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?\s*$/)
    if (!m) continue
    const current = process.env[m[1]]
    // نستبدل القيم غير المضبوطة أو القيم القديمة (file:) — .env هو مصدر الحقيقة
    if (!current || current.startsWith('file:')) process.env[m[1]] = m[2]
  }
}
envOverride()

const BASE = process.env.TEST_BASE ?? 'http://127.0.0.1:3000'

let passed = 0
let failed = 0
const failures: string[] = []

function ok(name: string, cond: boolean, extra?: string) {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    failures.push(name + (extra ? ` — ${extra}` : ''))
    console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`)
  }
}

async function req(method: string, path: string, body?: unknown, cookie?: string, opts?: { manualRedirect?: boolean }) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: opts?.manualRedirect ? 'manual' : 'follow',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* raw */ }
  return { status: res.status, json, text, headers: res.headers }
}

function cookieOf(r: { headers: Headers }): string {
  const set = r.headers.get('set-cookie')
  return set ? set.split(';')[0] : ''
}

// ═══ 1) المصادقة ═══════════════════════════════════════════════

async function testAuth() {
  console.log('\n─── المصادقة: تسجيل / دخول / استعادة ───')
  const email = `test-${Date.now()}@madrasati.sa`
  const password = 'Ahmad@Test1448'

  // تسجيل — كلمة مرور قصيرة
  let r = await req('POST', '/api/auth/signup', { email, password: 'abc123', confirmPassword: 'abc123' })
  ok('signup: كلمة مرور قصيرة → 400', r.status === 400 && /قصيرة/.test(r.json?.error ?? ''))

  // عدم تطابق
  r = await req('POST', '/api/auth/signup', { email, password, confirmPassword: 'different1A' })
  ok('signup: عدم تطابق → 400', r.status === 400 && /متطابقتين/.test(r.json?.error ?? ''))

  // كلمة ضعيفة شائعة (من قائمة WEAK_PASSWORDS في الخادم)
  r = await req('POST', '/api/auth/signup', { email, password: 'welcome123', confirmPassword: 'welcome123' })
  ok('signup: كلمة ضعيفة شائعة → 400', r.status === 400)

  // محاولة تصعيد دور عبر التسجيل — يجب تجاهلها تمامًا
  r = await req('POST', '/api/auth/signup', { email, password, confirmPassword: password, role: 'SUPER_ADMIN' })
  ok('signup: نجاح مع دور مُرسل SUPER_ADMIN', r.status === 200 || r.status === 201)
  ok('signup: الدور المُنشأ TEACHER دائمًا (تجاهل الحقل)', r.json?.user?.role === 'TEACHER', JSON.stringify(r.json?.user))
  const signupCookie = cookieOf(r)
  ok('signup: جلسة فورية (كوكي)', Boolean(signupCookie))

  // البريد مكرر (بنفس الحروف) وبحروف مختلفة
  r = await req('POST', '/api/auth/signup', { email, password, confirmPassword: password })
  ok('signup: بريد مكرر → 409 برسالة عربية', r.status === 409 && /مسجل بالفعل/.test(r.json?.error ?? ''))
  r = await req('POST', '/api/auth/signup', { email: `  ${email.toUpperCase()} `, password, confirmPassword: password })
  ok('signup: تطبيع البريد يمنع التكرار بحروف مختلفة → 409', r.status === 409)

  // الجلسة الجديدة — إكمال الملف
  r = await req('GET', '/api/me', undefined, signupCookie)
  ok('me: الاسم placeholder للمستخدم الجديد', r.json?.user?.name === 'مستخدم جديد')
  ok('me: الجنس null (محايد)', r.json?.user?.gender === null)
  ok('me: لا passwordHash في الاستجابة', !JSON.stringify(r.json).includes('passwordHash'))
  ok('me: لا sessionEpoch في الاستجابة', !JSON.stringify(r.json).includes('sessionEpoch'))

  // إكمال الملف — الاسم والجنس
  r = await req('PUT', '/api/profile', { name: 'مستخدم اختبار مؤقت', gender: 'FEMALE' }, signupCookie)
  ok('profile: تحديث الاسم والجنس', r.status === 200 && r.json?.user?.gender === 'FEMALE')

  // خروج — ينظف كوكي العميل (توكن stateless قياسي: إبطاله الفوري يتم عبر epoch عند تغيير كلمة المرور)
  r = await req('DELETE', '/api/session', undefined, signupCookie)
  ok('logout: نجاح', r.status === 200)
  const clearCookie = r.headers.get('set-cookie') ?? ''
  ok('logout: الكوكي يُمحى من العميل (set-cookie فارغ/منتهي)', /pf_session=;|Max-Age=0/.test(clearCookie), clearCookie.slice(0, 90))

  // دخول خاطئ ثم صحيح
  r = await req('POST', '/api/session', { email, password: 'WrongPass1' })
  ok('login: كلمة مرور خاطئة → 401 موحدة', r.status === 401 && /غير صحيحة/.test(r.json?.error ?? ''))
  r = await req('POST', '/api/session', { email, password })
  ok('login: دخول صحيح بعد الاستعادة النهائية', r.status === 200)
  const loginCookie = cookieOf(r)

  // ─── استعادة كلمة المرور (طلب أولًا ثم التقاط التوكن من سجل مزوّد البريد console) ───
  r = await req('POST', '/api/auth/forgot-password', { email })
  ok('forgot: الطلب قُبل برسالة عامة', /إذا كان البريد مسجلًا/.test(r.json?.message ?? ''))
  const log = readFileSync('dev.log', 'utf8')
  const matches = log.match(/\/reset-password\?token=[A-Za-z0-9_-]+/g) ?? []
  const resetPath = matches[matches.length - 1]
  ok('forgot: التوكن ظهر في سجل البريد (مزوّد التطوير)', Boolean(resetPath))
  const token = resetPath?.split('token=')[1]

  // توكن خاطئ
  r = await req('POST', '/api/auth/reset-password', { token: 'invalid-token-xyz', password: 'NewPass@1448', confirmPassword: 'NewPass@1448' })
  ok('reset: توكن خاطئ → 400', r.status === 400)

  // الجلسة القديمة تبقى صالحة قبل الاستعادة
  r = await req('GET', '/api/me', undefined, loginCookie)
  const sessionAliveBefore = r.status === 200
  ok('reset: الجلسة القديمة صالحة قبل الاستعادة', sessionAliveBefore)

  // توكن صحيح
  r = await req('POST', '/api/auth/reset-password', { token, password: 'NewPass@1448', confirmPassword: 'NewPass@1448' })
  ok('reset: توكن صحيح → نجاح', r.status === 200, JSON.stringify(r.json))
  const resetCookie = cookieOf(r)
  ok('reset: جلسة جديدة تلقائية', Boolean(resetCookie))

  // إبطال الجلسة القديمة (epoch)
  r = await req('GET', '/api/me', undefined, loginCookie)
  ok('reset: الجلسة القديمة أُبطلت (epoch)', r.json?.user === null || r.status === 401)

  // إعادة استخدام التوكن — مرة واحدة فقط
  r = await req('POST', '/api/auth/reset-password', { token, password: 'Another@1448', confirmPassword: 'Another@1448' })
  ok('reset: التوكن لا يُستخدم مرتين → 400', r.status === 400)

  // كلمة المرور القديمة تفشل، الجديدة تعمل
  r = await req('POST', '/api/session', { email, password })
  ok('reset: كلمة المرور القديمة مرفوضة', r.status === 401)
  r = await req('POST', '/api/session', { email, password: 'NewPass@1448' })
  ok('reset: كلمة المرور الجديدة تعمل', r.status === 200)

  // forgot بريد غير موجود — نفس الرسالة العامة تمامًا
  r = await req('POST', '/api/auth/forgot-password', { email: 'ghost@nowhere.sa' })
  ok('forgot: بريد غير موجود = نفس رسالة عدم الكشف', /إذا كان البريد مسجلًا/.test(r.json?.message ?? ''))
  r = await req('POST', '/api/auth/forgot-password', { email })
  ok('forgot: بريد موجود = نفس الرسالة العامة', /إذا كان البريد مسجلًا/.test(r.json?.message ?? ''))

  return { email }
}

// ═══ 2) إيقاف الحساب ═══════════════════════════════════════════

async function testSuspension() {
  console.log('\n─── إيقاف الحساب (عبر Super Admin) ───')
  const email = `susp-${Date.now()}@madrasati.sa`
  let r = await req('POST', '/api/auth/signup', { email, password: 'Susped@1448', confirmPassword: 'Susped@1448' })
  const cookie = cookieOf(r)

  // دخول المدير العام — كلمة المرور من البيئة (لا أسرار في الكود)
  const adminPw = process.env.ADMIN_PASSWORD ?? ''
  r = await req('POST', '/api/session', { email: 'admin@madrasati.sa', password: adminPw })
  ok('super-admin login: نجاح', r.status === 200)
  const adminCookie = cookieOf(r)

  // إيجاد المستخدم
  r = await req('GET', '/api/super-admin/users?q=' + encodeURIComponent(email), undefined, adminCookie)
  const target = r.json?.users?.[0]
  ok('super-admin users: البحث عن المستخدم', Boolean(target))

  // إيقافه
  r = await req('PATCH', `/api/super-admin/users/${target.id}`, { action: 'suspend' }, adminCookie)
  ok('suspend: نجاح الإجراء', r.status === 200)

  // جلسته القائمة تُبطل فورًا
  r = await req('GET', '/api/me', undefined, cookie)
  ok('suspend: الجلسة القائمة بُطلت (401/null)', r.json?.user === null || r.status === 401)

  // لا يستطيع الدخول
  r = await req('POST', '/api/session', { email, password: 'Susped@1448' })
  ok('suspend: الدخول مرفوض برسالة إيقاف واضحة', r.status === 403 && /موقوف/.test(r.json?.error ?? ''))

  // لا استعادة كلمة مرور لموقوف
  r = await req('POST', '/api/auth/forgot-password', { email })
  ok('suspend: استعادة كلمة المرور لا تكشف حالة الإيقاف', /إذا كان البريد مسجلًا/.test(r.json?.message ?? ''))

  // إعادة التفعيل
  r = await req('PATCH', `/api/super-admin/users/${target.id}`, { action: 'activate' }, adminCookie)
  ok('activate: إعادة التفعيل نجحت', r.status === 200)
  r = await req('POST', '/api/session', { email, password: 'Susped@1448' })
  ok('activate: الدخول يعمل بعد التفعيل', r.status === 200)

  return { adminCookie, targetId: target.id, email }
}

// ═══ 3) أمن Super Admin ════════════════════════════════════════

async function testSuperAdminSecurity(adminCookie: string, targetId: string) {
  console.log('\n─── أمن Super Admin: مصفوفة 401/403/200 ───')

  // غير مسجل → 401
  let r = await req('GET', '/api/super-admin/stats')
  ok('super-admin API: غير مسجل → 401', r.status === 401)

  // معلم → 403
  // كلمات مرور الحسابات المزروعة — من البيئة (لا أسرار في الكود)
  const teacherPw = process.env.TEACHER_PASSWORD ?? ''
  r = await req('POST', '/api/session', { email: 'sultan@madrasati.sa', password: teacherPw })
  const teacherCookie = cookieOf(r)
  ok('login: المعلم سلطان يدخل', r.status === 200)
  r = await req('GET', '/api/super-admin/stats', undefined, teacherCookie)
  ok('super-admin API: TEACHER → 403', r.status === 403)
  r = await req('GET', '/api/super-admin/users', undefined, teacherCookie)
  ok('super-admin users: TEACHER → 403', r.status === 403)
  r = await req('PATCH', `/api/super-admin/users/${targetId}`, { action: 'setRole', role: 'SUPER_ADMIN' }, teacherCookie)
  ok('super-admin PATCH: TEACHER يحاول ترقية نفسه → 403', r.status === 403)

  // مدير → 403
  r = await req('POST', '/api/session', { email: 'noura@madrasati.sa', password: process.env.TEACHER_PASSWORD ?? '' })
  const managerCookie = cookieOf(r)
  ok('login: المديرة نورة تدخل', r.status === 200)
  r = await req('GET', '/api/super-admin/stats', undefined, managerCookie)
  ok('super-admin API: MANAGER → 403', r.status === 403)

  // صفحة /super-admin — حارس الخادم (بدون اتباع التحويل)
  r = await req('GET', '/super-admin', undefined, undefined, { manualRedirect: true })
  ok('super-admin page: غير مسجل → تحويل للدخول (307)', r.status === 307 || r.status === 302)

  // مسؤول المنصة → 200
  r = await req('GET', '/api/super-admin/stats', undefined, adminCookie)
  ok('super-admin API: SUPER_ADMIN → 200', r.status === 200)
  const stats = r.json
  ok('stats: إجمالي المستخدمين رقم حقيقي', typeof stats?.users?.total === 'number' && stats.users.total >= 7)
  ok('stats: تعداد ذكر/أنثى موجود', typeof stats?.users?.teachers?.male === 'number' && typeof stats?.users?.teachers?.female === 'number')
  ok('stats: إنجازات وشواهد', typeof stats?.content?.achievements === 'number' && stats.content.achievements >= 40)
  ok('stats: بيانات AI موجودة (قد تكون صفرية)', typeof stats?.ai?.totalRequests === 'number')
  ok('stats: لا passwordHash في الاستجابة', !JSON.stringify(stats).includes('passwordHash'))

  // حماية العزل الذاتي
  const me = await req('GET', '/api/me', undefined, adminCookie)
  const adminId = me.json?.user?.id
  r = await req('PATCH', `/api/super-admin/users/${adminId}`, { action: 'suspend' }, adminCookie)
  ok('super-admin: لا يوقف نفسه → 400', r.status === 400)
  r = await req('PATCH', `/api/super-admin/users/${adminId}`, { action: 'setRole', role: 'TEACHER' }, adminCookie)
  ok('super-admin: لا يخفض دوره بنفسه → 400', r.status === 400)
  r = await req('DELETE', `/api/super-admin/users/${adminId}`, { confirm: 'CONFIRM', confirmCount: 0 }, adminCookie)
  ok('super-admin: لا يحذف نفسه → 400', r.status === 400)

  // ترقية SUPER_ADMIN تتطلب تأكيدًا صريحًا
  r = await req('PATCH', `/api/super-admin/users/${targetId}`, { action: 'setRole', role: 'SUPER_ADMIN' }, adminCookie)
  ok('super-admin: ترقية SUPER_ADMIN بلا تأكيد → 400', r.status === 400)

  // الحذف النهائي — بلا تأكيد يُرفض
  r = await req('DELETE', `/api/super-admin/users/${targetId}`, {}, adminCookie)
  ok('super-admin: حذف بلا تأكيد → 400', r.status === 400)

  return { teacherCookie, managerCookie }
}

// ═══ 4) الحذف النهائي بأثر ════════════════════════════════════

async function testUserDeletion(adminCookie: string) {
  console.log('\n─── الحذف النهائي (معاينة الأثر ثم تنفيذ) ───')
  const email = `del-${Date.now()}@madrasati.sa`
  let r = await req('POST', '/api/auth/signup', { email, password: 'Deleet@1448', confirmPassword: 'Deleet@1448' })
  const cookie = cookieOf(r)
  // أضف إنجازًا وشاهدًا
  const me = await req('GET', '/api/me', undefined, cookie)
  const yearId = me.json?.year?.id
  const years = me.json?.years ?? []
  r = await req('POST', '/api/achievements', { type: 'PRACTICE', title: 'إنجاز مؤقت للحذف', status: 'COMPLETED', yearId: years[0]?.id }, cookie)
  ok('delete-prep: إنشاء إنجاز', r.status === 201 || r.status === 200)

  r = await req('GET', '/api/super-admin/users?q=' + encodeURIComponent(email), undefined, adminCookie)
  const target = r.json?.users?.[0]

  // معاينة الأثر
  r = await req('GET', `/api/super-admin/users/${target.id}`, undefined, adminCookie)
  ok('delete: معاينة الأثر تعرض الإنجاز = 1', r.json?.deletionImpact?.achievements === 1, JSON.stringify(r.json?.deletionImpact))

  // تنفيذ الحذف
  r = await req('DELETE', `/api/super-admin/users/${target.id}`, { confirm: 'CONFIRM', confirmCount: 1 }, adminCookie)
  ok('delete: الحذف النهائي نجح', r.status === 200, JSON.stringify(r.json))

  // الحساب لم يعد موجودًا
  r = await req('POST', '/api/session', { email, password: 'Deleet@1448' })
  ok('delete: الدخول للحساب المحذوف → 401', r.status === 401)
}

// ═══ 5) الذكاء الاصطناعي ═══════════════════════════════════════

async function testAI(teacherCookie: string) {
  console.log('\n─── المساعد الذكي (GROQ/Sandbox عبر الواجهة) ───')

  // غير مسجل → 401
  let r = await req('POST', '/api/ai/improveText', { context: { text: 'نص تجريبي للاختبار' } })
  ok('ai: غير مسجل → 401', r.status === 401)

  // عمل غير معروف → 404
  r = await req('POST', '/api/ai/nonexistent', { context: {} }, teacherCookie)
  ok('ai: عملية غير معروفة → 404', r.status === 404)

  // نص فارغ → 400
  r = await req('POST', '/api/ai/improveText', { context: { text: '' } }, teacherCookie)
  ok('ai: نص فارغ → 400 برسالة عربية', r.status === 400 && /اكتب نصًا/.test(r.json?.error ?? ''))

  // حمولة ضخمة → 413
  r = await req('POST', '/api/ai/improveText', { context: { text: 'أ'.repeat(20000) } }, teacherCookie)
  ok('ai: حمولة ضخمة → 413', r.status === 413)

  // اقتراح الأهداف — يجب 4 أهداف بالضبط
  r = await req('POST', '/api/ai/suggestObjectives', {
    context: { title: 'برنامج تعزيز مهارات القراءة', subject: 'اللغة العربية', stage: 'المرحلة المتوسطة' },
  }, teacherCookie)
  ok('ai: suggestObjectives نجح', r.status === 200, r.json?.error)
  const objectives = r.json?.result?.objectives
  ok('ai: الأهداف = 4 بالضبط', Array.isArray(objectives) && objectives.length === 4, JSON.stringify(objectives?.length))
  ok('ai: كل الأهداف غير فارغة', Array.isArray(objectives) && objectives.every((o: unknown) => typeof o === 'string' && o.trim().length > 0))

  // الهدف العام — واحد فقط
  r = await req('POST', '/api/ai/suggestGeneralObjective', {
    context: { title: 'برنامج تعزيز مهارات القراءة' },
  }, teacherCookie)
  ok('ai: الهدف العام هدف واحد', r.status === 200 && typeof r.json?.result?.generalObjective === 'string' && r.json.result.generalObjective.length > 0)

  // تحسين نص
  r = await req('POST', '/api/ai/improveText', {
    context: { text: 'قمت بتنفيذ نشاط قراءة في الفصل وكان جيدا جدا وطلاب استفادوا منه كثيرا' },
  }, teacherCookie)
  ok('ai: تحسين الصياغة يعيد نصًا', r.status === 200 && typeof r.json?.result === 'string' && r.json.result.length > 10, r.json?.error)

  // الميزانية تظهر في الاستجابة
  ok('ai: معلومات الحد اليومي مرفقة', typeof r.json?.quota === 'object' && r.json?.quota !== null)

  // ممنوع اختراع النسب — تحقق من أن الأثر لا يحتوي نسبة مختلقة من لا شيء
  r = await req('POST', '/api/ai/suggestImpact', {
    context: { text: 'نفذت برنامج قراءة صفي بدون أي قياس بعدي حتى الآن' },
  }, teacherCookie)
  if (r.status === 200) {
    const impact = String(r.json?.result ?? '')
    ok('ai: الأثر بلا نسبة مختلقة (لا ادعاء نتائج)', !/ارتفعت.{0,20}(9|8|7)\d%/.test(impact), impact.slice(0, 80))
  } else {
    ok('ai: suggestImpact استجاب', false, r.json?.error)
  }
}

// ═══ 6) عزل الديمو + حد الاستخدام ══════════════════════════════

async function testDemoIsolation() {
  console.log('\n─── الحساب التجريبي: العزل وحد الاستخدام ───')
  const { PrismaClient } = await import('@prisma/client')
  const { hashPassword } = await import('../src/lib/auth')
  const db = new PrismaClient()
  const demo = await db.user.findUnique({ where: { email: 'demo@madrasati.sa' } })
  ok('demo: علم isDemo مضبوط', demo?.isDemo === true)
  ok('demo: مدرسة معزولة مستقلة', demo?.school === 'مدرسة المعاينة النموذجية')
  ok('demo: دور TEACHER فقط', demo?.role === 'TEACHER')
  ok('demo: بيانات غنية (إنجازات كافية للمعاينة)', (await db.achievement.count({ where: { userId: demo.id } })) >= 8)

  // المعلم الحقيقي لا يرى بيانات الديمو عبر API (معلم آخر)
  let r = await req('POST', '/api/session', { email: 'sultan@madrasati.sa', password: process.env.TEACHER_PASSWORD ?? '' })
  const sultanCookie = cookieOf(r)
  if (demo) {
    r = await req('GET', `/api/achievements?userId=${demo.id}`, undefined, sultanCookie)
    ok('demo isolation: معلم آخر لا يرى إنجازات الديمو', r.status === 403 || r.json?.achievements === undefined)
    r = await req('GET', `/api/profile?userId=${demo.id}`, undefined, sultanCookie)
    ok('demo isolation: معلم آخر لا يرى ملف الديمو', r.status === 403)
  }

  // المديرة الحقيقية (مدرسة مختلفة) لا ترى الديمو ضمن معلميها
  r = await req('POST', '/api/session', { email: 'noura@madrasati.sa', password: process.env.TEACHER_PASSWORD ?? '' })
  const managerCookie = cookieOf(r)
  if (demo) {
    r = await req('GET', `/api/profile?userId=${demo.id}`, undefined, managerCookie)
    ok('demo isolation: مديرة مدرسة حقيقية لا ترى ملف الديمو (نطاق مختلف)', r.status === 403)
  }

  // ─── حد الديمو الأدنى: ديمو مؤقت بكلمة معروفة — لا نلمس حصة الديمو الحقيقي ───
  const tmpEmail = `tmp-demo-${Date.now()}@madrasati.sa`
  const tmp = await db.user.create({
    data: {
      email: tmpEmail,
      passwordHash: hashPassword('TmpDemo@1448'),
      name: 'ديمو مؤقت للاختبار',
      role: 'TEACHER',
      isDemo: true,
      school: 'مدرسة المعاينة النموذجية',
    },
  })
  r = await req('POST', '/api/session', { email: tmpEmail, password: 'TmpDemo@1448' })
  ok('demo quota: دخول الديمو المؤقت', r.status === 200)
  const tmpCookie = cookieOf(r)

  // عملية واحدة حقيقية (ضمن الحد)
  r = await req('POST', '/api/ai/summarize', { context: { text: 'نص تجريبي قصير لاختبار الحد اليومي.' } }, tmpCookie)
  ok('demo quota: أول عملية مسموحة', r.status === 200, r.json?.error)

  // نملأ باقي الحد (15) بسجلات مباشرة ثم نتحقق من الرفض — دون استهلاك وقت
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  await db.aiUsageLog.createMany({
    data: Array.from({ length: 14 }, () => ({
      userId: tmp.id, action: 'summarize', model: 'test', success: true, latencyMs: 10, createdAt: startOfDay,
    })),
  })
  r = await req('POST', '/api/ai/summarize', { context: { text: 'نص تجريبي ثانٍ بعد بلوغ الحد.' } }, tmpCookie)
  ok('demo quota: 429 عند بلوغ الحد اليومي الأدنى', r.status === 429 && /حدك اليومي/.test(r.json?.error ?? ''), `الحالة: ${r.status}`)

  // المعلم الحقيقي حدُّه الأعلى يعمل بشكل طبيعي (سطحًا)
  r = await req('POST', '/api/ai/summarize', { context: { text: 'تحقق سريع أن المعلم الحقيقي غير متأثر.' } }, sultanCookie)
  ok('demo quota: المعلم الحقيقي غير متأثر (60/يوم)', r.status === 200, r.json?.error)

  // تنظيف الديمو المؤقت
  await db.user.delete({ where: { id: tmp.id } })
  ok('demo quota: تنظيف الديمو المؤقت', true)
  await db.$disconnect()
}

// ═══ التنفيذ ═══════════════════════════════════════════════════

async function main() {
  console.log(`═══ اختبار المرحلة النهائية ضد ${BASE} ═══`)
  const { adminCookie, targetId } = await testSuspension()
  const auth = await testAuth()
  const { teacherCookie } = await testSuperAdminSecurity(adminCookie, targetId)
  await testUserDeletion(adminCookie)
  await testAI(teacherCookie)
  await testDemoIsolation()

  console.log(`\n═══ النتيجة: ${passed} نجاح / ${failed} فشل ═══`)
  if (failures.length) {
    console.log('الفشل:')
    failures.forEach((f) => console.log('  • ' + f))
    process.exit(1)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
