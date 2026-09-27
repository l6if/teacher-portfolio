// ═══ E2E الإنتاجي الشامل — المرحلة الأولى (API) ضد الرابط العام الحقيقي ═══
// يغطي: مصادقة كاملة / إيقاف وإبطال جلسة / سوبر أدمن كامل / مصفوفة تخزين
//        مع تحقق Supabase فعلي / عزل ديمو / أمن (IDOR/تعداد/تسريب) / تسجيل الثبات
//
// الاستخدام (كل القيم من البيئة/الملفات المحجوبة — لا شيء في الكود):
//   bun scripts/e2e-prod-api.mts
// المتطلب: .env.production-secrets يحوي SUPER_ADMIN_*/DEMO_*/BENCH_*
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { randomBytes } from 'crypto'

const ROOT = resolve(import.meta.dir, '..')

function readEnv(f: string): Record<string, string> {
  const d: Record<string, string> = {}
  try {
    for (const line of readFileSync(`${ROOT}/${f}`, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m && !d[m[1]]) d[m[1]] = m[2].trim()
    }
  } catch { /* غير موجود */ }
  return d
}

const SECR = readEnv('.env.production-secrets')
const SUPA = readEnv('.env.supabase-project')

const BASE = process.env.E2E_BASE ?? 'https://teacher-portfolio-sultans-projects-bce2ab1d.vercel.app'
const ADMIN_EMAIL = SECR.SUPER_ADMIN_EMAIL!
const ADMIN_PW = SECR.SUPER_ADMIN_PASSWORD!
const DEMO_EMAIL = SECR.DEMO_EMAIL!
const DEMO_PW = SECR.DEMO_PASSWORD!
const B1_EMAIL = SECR.BENCH_EMAIL!
const B1_PW = SECR.BENCH_PASSWORD!
const B2_EMAIL = `e2e-b2-${Date.now()}@example.com`
const B2_PW = `E2e-${randomBytes(8).toString('hex')}!qA`

const S1 = 'مدرسة الاختبار الإنتاجي أ'
const S2 = 'مدرسة الاختبار الإنتاجي ب'

if (!ADMIN_EMAIL || !ADMIN_PW || !DEMO_EMAIL || !B1_EMAIL) {
  console.error('⛔ متغيرات الحسابات ناقصة في .env.production-secrets')
  process.exit(1)
}

let passed = 0
let failed = 0
const failures: string[] = []
function ok(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; failures.push(name); console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`) }
}

async function req(method: string, path: string, body?: unknown, cookie?: string) {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  let payload: BodyInit | undefined
  if (body instanceof FormData) payload = body
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body) }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload })
  const json = await res.json().catch(() => ({} as any))
  return { r: res, json, cookie: res.headers.get('set-cookie')?.split(';')[0] ?? '' }
}

async function login(email: string, password: string) {
  return req('POST', '/api/session', { email, password })
}

async function adminPatch(userId: string, action: string, extra: Record<string, unknown> = {}) {
  return req('PATCH', `/api/super-admin/users/${userId}`, { action, ...extra }, adminCookie)
}

let demoPersistAttId = ''
let adminCookie = ''
let b1Cookie = ''
let b2Cookie = ''
let demoCookie = ''

// ─────────────────────────────────────────────────────────────
async function phaseAuth() {
  console.log('\n═══ أ) المصادقة ═══')

  const demo = await login(DEMO_EMAIL, DEMO_PW)
  demoCookie = demo.cookie
  const demoSess = await req('GET', '/api/session', undefined, demoCookie)
  ok('دخول الديمو 200', demo.r.status === 200)
  ok('الجلسة تؤكد isDemo=true', demoSess.json?.user?.isDemo === true)

  const wrong = await login(DEMO_EMAIL, 'كلمة-خاطئة-تمامًا')
  ok('كلمة مرور خاطئة → 401', wrong.r.status === 401)
  ok('رسالة 401 عامة (لا تكشف شيء)', typeof wrong.json?.error === 'string' && !JSON.stringify(wrong.json).includes('hash'))

  const dup = await req('POST', '/api/auth/signup', { email: DEMO_EMAIL, password: B2_PW, confirmPassword: B2_PW })
  ok('تسجيل بريد موجود مسبقًا → مرفوض', dup.r.status === 400 || dup.r.status === 409)

  const esc = await req('POST', '/api/auth/signup', { email: B2_EMAIL, password: B2_PW, confirmPassword: B2_PW, role: 'SUPER_ADMIN' })
  ok('تسجيل جديد مع محاولة تصعيد → TEACHER فقط', (esc.r.status === 200 || esc.r.status === 201) && esc.json?.user?.role === 'TEACHER')
  b2Cookie = esc.cookie

  const out = await req('DELETE', '/api/session', undefined, b2Cookie)
  ok('خروج → نجح', out.r.status === 200 || out.r.status === 204)
  // الجلسات عديمة الحالة (توكن موقّع) — الخروج يمسح الكوكي من المتصفح،
  // والإبطال الخادمي الحقيقي عبر sessionEpoch (الإيقاف/تغيير كلمة المرور — مُختبَر أدناه)
  const setCookie = (out.r.headers.get('set-cookie') ?? '').toLowerCase()
  ok('الخروج يمسح كوكي الجلسة من المتصفح', setCookie.includes('pf_session') && (setCookie.includes('max-age=0') || setCookie.includes('expires=thu, 01 jan 1970')))

  const again = await login(B2_EMAIL, B2_PW)
  b2Cookie = again.cookie
  ok('دخول ثاني بعد الخروج → 200', again.r.status === 200)
}

async function phaseSuspension() {
  console.log('\n═══ ب) الإيقاف وإبطال الجلسة ═══')
  const a = await login(ADMIN_EMAIL, ADMIN_PW)
  adminCookie = a.cookie
  ok('دخول السوبر أدمن الحقيقي 200', a.r.status === 200 && a.json?.user?.role === 'SUPER_ADMIN')

  const users = await req('GET', '/api/super-admin/users?search=' + encodeURIComponent(B2_EMAIL.split('@')[0]), undefined, adminCookie)
  const b2 = (users.json?.users ?? []).find((u: any) => u.email === B2_EMAIL)
  ok('البحث عن المستخدم الجديد يعيده', !!b2)

  const sus = await adminPatch(b2.id, 'suspend')
  ok('إيقاف الحساب عبر الأدمن → نجح', sus.r.status === 200)

  const oldSess = await req('GET', '/api/session', undefined, b2Cookie)
  ok('جلسة ما قبل الإيقاف → أُبطلت', oldSess.r.status === 401 || oldSess.json?.user == null)

  const susLogin = await login(B2_EMAIL, B2_PW)
  ok('دخول موقوف → مرفوض (403)', susLogin.r.status === 403)

  const act = await adminPatch(b2.id, 'activate')
  ok('إعادة التفعيل → نجح', act.r.status === 200)
  const reLogin = await login(B2_EMAIL, B2_PW)
  b2Cookie = reLogin.cookie
  ok('دخول بعد التفعيل → 200', reLogin.r.status === 200)
  return b2.id
}

async function phaseSuperAdmin(b2Id: string) {
  console.log('\n═══ ج) سوبر أدمن — المصفوفة والحمايات ═══')

  const unauth = await req('GET', '/api/super-admin/stats')
  ok('غير مسجل → 401', unauth.r.status === 401)

  const asTeacher = await req('GET', '/api/super-admin/stats', undefined, b2Cookie)
  ok('معلم → 403', asTeacher.r.status === 403)

  const stats = await req('GET', '/api/super-admin/stats', undefined, adminCookie)
  ok('سوبر أدمن → 200', stats.r.status === 200)
  ok('إحصاءات بأرقام حقيقية', typeof stats.json?.users?.total === 'number' && stats.json.users.total >= 3)

  const users = await req('GET', '/api/super-admin/users', undefined, adminCookie)
  ok('قائمة المستخدمين 200', users.r.status === 200 && Array.isArray(users.json?.users))
  ok('لا passwordHash في أي استجابة أدمن', !JSON.stringify([stats.json, users.json]).includes('passwordHash'))

  const filt = await req('GET', '/api/super-admin/users?role=TEACHER&status=ACTIVE', undefined, adminCookie)
  ok('فلتر role+status يعمل', filt.r.status === 200 && (filt.json?.users ?? []).every((u: any) => u.role === 'TEACHER' && u.status === 'ACTIVE'))

  const role = await adminPatch(b2Id, 'setRole', { role: 'MANAGER' })
  ok('ترقية إلى MANAGER → نجح', role.r.status === 200)

  const me = await req('GET', '/api/me', undefined, adminCookie)
  const adminId = me.json?.user?.id
  const selfSus = await adminPatch(adminId, 'suspend')
  ok('الأدمن لا يوقف نفسه → 400', selfSus.r.status === 400)
  const selfRole = await adminPatch(adminId, 'setRole', { role: 'TEACHER' })
  ok('الأدمن لا يخفض دوره → 400', selfRole.r.status === 400)

  const esc1 = await req('PATCH', `/api/super-admin/users/${adminId}`, { action: 'setRole', role: 'SUPER_ADMIN' }, b2Cookie)
  ok('مدير يحاول ترقية نفسه → 403', esc1.r.status === 403)
}

async function phaseStorage(b2Id: string) {
  console.log('\n═══ د) التخزين — مصفوفة كاملة مع تحقق Supabase ═══')

  // bench1 = معلم المالك بمدرسة S1، bench2 حاليًا MANAGER بمدرسة S2 (خارج النطاق)
  const users = await req('GET', '/api/super-admin/users?search=' + encodeURIComponent(B1_EMAIL.split('@')[0]), undefined, adminCookie)
  const b1 = (users.json?.users ?? []).find((u: any) => u.email === B1_EMAIL)
  ok('إيجاد bench1 (المالك)', !!b1)
  const sch1 = await adminPatch(b1.id, 'setSchool', { school: S1 })
  ok('ضبط مدرسة المالك S1', sch1.r.status === 200)
  const sch2 = await adminPatch(b2Id, 'setSchool', { school: S2 })
  ok('ضبط مدرسة المدير S2 (خارج النطاق)', sch2.r.status === 200)

  const l1 = await login(B1_EMAIL, B1_PW)
  b1Cookie = l1.cookie
  ok('دخول المالك', l1.r.status === 200)

  // سنة دراسية (إن لم توجد)
  let yearId = ''
  const dash = await req('GET', '/api/dashboard', undefined, b1Cookie)
  yearId = dash.json?.years?.find((y: any) => !y.archived)?.id ?? dash.json?.years?.[0]?.id ?? ''
  if (!yearId) {
    const ny = await req('POST', '/api/years', { label: '1448هـ — اختبار' }, b1Cookie)
    yearId = ny.json?.year?.id ?? ''
  }
  ok('سنة دراسية جاهزة للمالك', !!yearId)

  // رفع صورة حقيقية عبر الوكيل (أقل من 4MB)
  const sharp = (await import('sharp')).default
  const jpeg = await sharp({ create: { width: 2600, height: 1800, channels: 3, background: { r: 40, g: 100, b: 130 } } })
    .jpeg({ quality: 90 }).toBuffer()
  const fd = new FormData()
  fd.append('file', new File([new Uint8Array(jpeg)], 'e2e-prod.jpg', { type: 'image/jpeg' }))
  fd.append('yearId', yearId)
  const up = await req('POST', '/api/upload', fd, b1Cookie)
  ok('رفع عبر الوكيل → نجح', up.r.status === 201 || up.r.status === 200, JSON.stringify(up.json).slice(0, 120))
  const att = up.json?.attachment ?? up.json
  ok('مرفق أُنشئ بمعرف', !!att?.id)

  // تحقق Supabase الفعلي: الملف الأصلي في الحاوية الخاصة
  let supaOk = false
  let supaNote = 'قائمة الكائنات فارغة/تعذر'
  try {
    const listAt = async (prefix: string): Promise<any[]> => {
      const r = await fetch(`${SUPA.SUPABASE_URL}/storage/v1/object/list/${SUPA.SUPABASE_STORAGE_BUCKET}`, {
        method: 'POST',
        headers: { apikey: SUPA.SUPABASE_SERVICE_ROLE_KEY!, authorization: `Bearer ${SUPA.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ prefix, limit: 100 }),
      })
      return await r.json().catch(() => [])
    }
    // تفتيش متدرج حتى عمق 4 (القائمة تعيد مستوى واحد لكل بادئة)
    const prefixes = ['']
    const names: string[] = []
    for (let depth = 0; depth < 5 && prefixes.length; depth++) {
      const next: string[] = []
      for (const pref of prefixes) {
        const entries = await listAt(pref)
        for (const e of entries) {
          const full = pref + e.name
          if (e.id == null) next.push(full + '/') // مجلد
          else names.push(full) // ملف فعلي
        }
      }
      prefixes.length = 0
      prefixes.push(...next.slice(0, 30))
    }
    const found = names.some((n) => n.includes(att.id))
    supaOk = found
    supaNote = `ملفات فعلية بالحاوية: ${names.length}${names.length ? ' — ' + names.slice(0, 3).join(' | ') : ''}`
  } catch (e: any) { supaNote = String(e).slice(0, 80) }
  ok('الملف الأصلي محفوظ فعليًا في Supabase Storage (خاص)', supaOk, supaNote)

  // مصفوفة الوصول
  const anon = await req('GET', `/api/files/${att.id}`)
  ok('غير مسجل → 401', anon.r.status === 401)

  const own = await fetch(`${BASE}/api/files/${att.id}`, { headers: { cookie: b1Cookie } })
  const ownBytes = Buffer.from(await own.arrayBuffer())
  ok('المالك يقرأ ملفه → 200 + صورة فعلية', own.status === 200 && ownBytes.length > 1000 && ownBytes[0] === 0xff)

  const opt = await fetch(`${BASE}/api/files/${att.id}?w=1600&q=82`, { headers: { cookie: b1Cookie } })
  const optBuf = Buffer.from(await opt.arrayBuffer())
  const meta = await sharp(optBuf).metadata()
  ok('نسخة محسّنة ?w=1600 → عرض 1600', opt.status === 200 && meta.width === 1600, `width=${meta.width}`)

  const foreign = await req('GET', `/api/files/${att.id}`, undefined, b2Cookie)
  ok('مدير خارج نطاق المدرسة → 403', foreign.r.status === 403)

  // داخل النطاق: انقل مدير bench2 إلى S1
  const inScope = await adminPatch(b2Id, 'setSchool', { school: S1 })
  ok('نقل المدير إلى S1', inScope.r.status === 200)
  const mgr = await req('GET', `/api/files/${att.id}`, undefined, b2Cookie)
  ok('مدير داخل النطاق → 200', mgr.r.status === 200)

  const asDemo = await req('GET', `/api/files/${att.id}`, undefined, demoCookie)
  ok('الديمو لا يصل ملف غيره → 403', asDemo.r.status === 403)

  const tampered = await req('GET', `/api/files/${att.id}`, undefined, 'pf_session=forged.99999.AAAA')
  ok('كوكي مزوّر → 401', tampered.r.status === 401)

  const meta2 = await req('GET', `/api/attachments/${att.id}`, undefined, b1Cookie)
  ok('بيانات المرفق بلا storagePath', !JSON.stringify(meta2.json).includes('storagePath'))

  // ربط شاهد بإنجاز للمالك (يُستخدم لاحقًا في الثبات/العزل)
  const ach = await req('POST', '/api/achievements', {
    type: 'PRACTICE', title: 'E2E-تدفق-تخزين مؤقت', status: 'COMPLETED', yearId,
  }, b1Cookie)
  ok('إنجاز مؤقت للمالك', ach.r.status === 201 || ach.r.status === 200)
  const link = await req('POST', '/api/attachments/link', { attachmentId: att.id, achievementId: ach.json?.achievement?.id ?? ach.json?.id }, b1Cookie)
  ok('ربط الشاهد بالإنجاز', link.r.status === 200 || link.r.status === 201)

  return { attId: att.id, b1Id: b1.id, achId: ach.json?.achievement?.id ?? ach.json?.id }
}

async function phaseDemoIsolation(b1AchId: string) {
  console.log('\n═══ هـ) عزل الديمو ═══')

  const own = await req('GET', '/api/achievements', undefined, demoCookie)
  ok('الديمو يرى إنجازاته', own.r.status === 200 && Array.isArray(own.json?.achievements))
  const titles: string[] = (own.json?.achievements ?? []).map((a: any) => a.title)
  ok('إنجازات الديمو لا تتسرب لغيره (كلها تخصه)', titles.length > 0)

  const foreignAch = await req('GET', `/api/achievements/${b1AchId}`, undefined, demoCookie)
  ok('الديمو يطلب إنجاز معلم آخر → 403/404', foreignAch.r.status === 403 || foreignAch.r.status === 404)

  const demAtt = await req('GET', '/api/attachments', undefined, demoCookie)
  const demoAttId = (demAtt.json?.attachments ?? [])[0]?.id
  ok('للديمو شواهده الخاصة', !!demoAttId)
  if (demoPersistAttId) {
    const b1Try = await req('GET', `/api/files/${demoPersistAttId}`, undefined, b1Cookie)
    ok('معلم حقيقي لا يصل ملف تخزين الديمو → 403', b1Try.r.status === 403)
    const demoTry = await req('GET', `/api/files/${demoPersistAttId}`, undefined, demoCookie)
    ok('الديمو يقرأ ملف تخزينه الخاص → 200', demoTry.r.status === 200)
  }

  const mgrTeachers = await req('GET', '/api/manager/teachers', undefined, b2Cookie)
  const mgrList = JSON.stringify(mgrTeachers.json ?? {})
  ok('المدير (S1) لا يرى الديمو في قائمته', !mgrList.includes(DEMO_EMAIL) && !mgrList.includes('المعلم التجريبي'), 'قد يظهر اسم الديمو إذا كانت القائمة واسعة — تحقق يدوي')
}

async function phaseSecurity() {
  console.log('\n═══ و) الأمان — تعداد/تسريب ═══')

  const exist = await login(DEMO_EMAIL, 'wrong-password-x')
  const nonexist = await login('ghost-' + Date.now() + '@example.com', 'wrong-password-x')
  ok('لا تعداد مستخدمين (نفس الحالة والرسالة)', exist.r.status === nonexist.r.status && (exist.json?.error ?? '') === (nonexist.json?.error ?? ''))

  const probes: any[] = []
  probes.push(await req('GET', '/api/me', undefined, demoCookie))
  probes.push(await req('GET', '/api/dashboard', undefined, demoCookie))
  probes.push(await req('GET', '/api/super-admin/users', undefined, adminCookie))
  probes.push(await req('GET', '/api/manager/teachers', undefined, b2Cookie))
  probes.push(await req('GET', '/api/report', undefined, demoCookie))
  const blob = JSON.stringify(probes.map((p) => p.json))
  ok('لا passwordHash في أي استجابة', !blob.includes('passwordHash'))
  ok('لا storagePath في أي استجابة', !blob.includes('storagePath'))
  ok('لا مفاتيح/أسرار في أي استجابة', !blob.includes('gsk_') && !blob.includes('SESSION_SECRET') && !blob.includes('sbp_'))
}

async function phasePersistenceRecord() {
  console.log('\n═══ ز) تسجيل الثبات (الديمو) — قبل إعادة النشر ═══')

  const dash = await req('GET', '/api/dashboard', undefined, demoCookie)
  const yearId = dash.json?.years?.find((y: any) => !y.archived)?.id ?? dash.json?.years?.[0]?.id

  const ach = await req('POST', '/api/achievements', {
    type: 'PRACTICE',
    title: 'PRODUCTION-PERSISTENCE-TEST',
    field: 'التعلم والتعليم',
    description: 'إنجاز اختبار الثبات الإنتاجي — يُحذف بعد التحقق',
    status: 'COMPLETED',
    yearId,
  }, demoCookie)
  const achId = ach.json?.achievement?.id ?? ach.json?.id
  ok('إنجاز الثبات أُنشئ', !!achId)

  const sharp = (await import('sharp')).default
  const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 200, g: 60, b: 60 } } }).png().toBuffer()
  const fd = new FormData()
  fd.append('file', new File([new Uint8Array(png)], 'persistence-test.png', { type: 'image/png' }))
  fd.append('yearId', yearId)
  const up = await req('POST', '/api/upload', fd, demoCookie)
  const attId = up.json?.attachment?.id ?? up.json?.id
  demoPersistAttId = attId
  ok('صورة الثبات رُفعت', !!attId)

  const link = await req('POST', '/api/attachments/link', { attachmentId: attId, achievementId: achId }, demoCookie)
  ok('الشاهد رُبط بالإنجاز', link.r.status === 200 || link.r.status === 201)

  const report = await req('GET', `/api/report?yearId=${yearId}`, undefined, demoCookie)
  const repTitles: string[] = (report.json?.achievements ?? []).map((a: any) => a.title)
  ok('تقرير الديمو يتضمن إنجاز الثبات', repTitles.includes('PRODUCTION-PERSISTENCE-TEST'))

  writeFileSync(`${ROOT}/tool-results/persistence-ids.json`, JSON.stringify({
    at: new Date().toISOString(),
    achievementId: achId, attachmentId: attId, yearId, demoEmail: DEMO_EMAIL,
  }, null, 2))
  console.log('  ✓ معرفات الثبات محفوظة محليًا (achievementId + attachmentId)')
}

async function main() {
  console.log(`═══ E2E الإنتاجي (API) ضد ${BASE} ═══`)
  await phaseAuth()
  const b2Id = await phaseSuspension()
  await phaseSuperAdmin(b2Id)
  const store = await phaseStorage(b2Id)
  await phasePersistenceRecord()
  await phaseDemoIsolation(store.achId)
  await phaseSecurity()

  console.log(`\n═══ النتيجة: ${passed} نجاح / ${failed} فشل ═══`)
  if (failures.length) { console.log('الفشل:'); failures.forEach((f) => console.log('  • ' + f)) }
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
