// ═══ التنظيف النهائي بعد إثبات الثبات — يحذف سجلات الاختبار فقط ═══
// 1) إنجاز/شعار الثبات (ديمو) عبر API (يحذف كائن التخزين عند اليُتم)
// 2) كل مستخدمي example.com المؤقتين (bench/e2e-b2/esc-test) عبر سوبر أدمن
// 3) كنس كائنات التخزين اليتيمة لأي مستخدم محذوف
// 4) تحقق نهائي: مستخدمان فقط + بيانات الديمو القياسية سليمة
import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')

function readEnv(f: string): Record<string, string> {
  const d: Record<string, string> = {}
  for (const line of readFileSync(`${ROOT}/${f}`, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !d[m[1]]) d[m[1]] = m[2].trim()
  }
  return d
}
const SECR = readEnv('.env.production-secrets')
const SUPA = readEnv('.env.supabase-project')
const BASE = process.env.E2E_BASE ?? 'https://teacher-portfolio-sultans-projects-bce2ab1d.vercel.app'
const IDS = JSON.parse(readFileSync(`${ROOT}/tool-results/persistence-ids.json`, 'utf8'))

let passed = 0, failed = 0
const ok = (n: string, c: boolean, e = '') => {
  if (c) { passed++; console.log(`  ✓ ${n}${e ? ' — ' + e : ''}`) }
  else { failed++; console.log(`  ✗ ${n}${e ? ' — ' + e : ''}`) }
}

async function req(method: string, path: string, body?: unknown, cookie?: string) {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  let payload: BodyInit | undefined
  if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body) }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload })
  const json = await res.json().catch(() => ({} as any))
  return { r: res, json, cookie: res.headers.get('set-cookie')?.split(';')[0] ?? '' }
}

async function main() {
  console.log(`═══ التنظيف النهائي ضد ${BASE} ═══`)

  // ─── 1) حذف سجلات الثبات (الديمو يملكها) ───
  const demo = await req('POST', '/api/session', { email: IDS.demoEmail, password: SECR.DEMO_PASSWORD })
  const demoCookie = demo.cookie
  ok('دخول الديمو للتنظيف', demo.r.status === 200)

  const delAtt = await req('DELETE', `/api/attachments/${IDS.attachmentId}`, undefined, demoCookie)
  ok('شاهد الثبات حُذف (مع كائن التخزين)', delAtt.r.status === 200 || delAtt.r.status === 204)

  const delAch = await req('DELETE', `/api/achievements/${IDS.achievementId}`, undefined, demoCookie)
  ok('إنجاز الثبات حُذف', delAch.r.status === 200 || delAch.r.status === 204)

  // ─── 2) حذف المستخدمين المؤقتين عبر السوبر أدمن ───
  const admin = await req('POST', '/api/session', { email: SECR.SUPER_ADMIN_EMAIL, password: SECR.SUPER_ADMIN_PASSWORD })
  const adminCookie = admin.cookie
  ok('دخول السوبر أدمن للتنظيف', admin.r.status === 200)

  const users = await req('GET', '/api/super-admin/users?limit=200', undefined, adminCookie)
  const all: any[] = users.json?.users ?? []
  const temps = all.filter((u) => u.email.endsWith('@example.com'))
  ok(`المستخدمون المؤقتون المرشحون للحذف: ${temps.length}`, temps.every((u) => u.email !== IDS.demoEmail))

  for (const u of temps) {
    // معاينة الأثر تعطينا confirmCount المطلوب
    const impact = await req('GET', `/api/super-admin/users/${u.id}/deletion-impact`, undefined, adminCookie)
    const counts = impact.json?.deletionImpact ?? impact.json ?? {}
    const confirmCount = Number(counts.achievements ?? 0) + Number(counts.attachments ?? 0) + Number(counts.users ?? 0)
    const del = await req('DELETE', `/api/super-admin/users/${u.id}`, { confirm: 'CONFIRM', confirmCount }, adminCookie)
    ok(`حذف ${u.email}`, del.r.status === 200 || del.r.status === 204, del.r.status !== 200 && del.r.status !== 204 ? JSON.stringify(del.json).slice(0, 120) : '')
  }

  // ─── 3) كنس كائنات التخزين اليتيمة (لمستخدمين لم يعودوا موجودين) ───
  const liveUsers = await req('GET', '/api/super-admin/users', undefined, adminCookie)
  const liveIds = new Set<string>(((liveUsers.json?.users ?? []) as any[]).map((u) => u.id))

  const listAt = async (prefix: string): Promise<any[]> => {
    const r = await fetch(`${SUPA.SUPABASE_URL}/storage/v1/object/list/${SUPA.SUPABASE_STORAGE_BUCKET}`, {
      method: 'POST',
      headers: { apikey: SUPA.SUPABASE_SERVICE_ROLE_KEY!, authorization: `Bearer ${SUPA.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 100 }),
    })
    return await r.json().catch(() => [])
  }
  const removeAt = async (path: string) => {
    const r = await fetch(`${SUPA.SUPABASE_URL}/storage/v1/object/${SUPA.SUPABASE_STORAGE_BUCKET}/${encodeURIComponent(path).split('%2F').join('/')}`, {
      method: 'DELETE',
      headers: { apikey: SUPA.SUPABASE_SERVICE_ROLE_KEY!, authorization: `Bearer ${SUPA.SUPABASE_SERVICE_ROLE_KEY}` },
    })
    return r.status === 200 || r.status === 204
  }

  // جمع كل الكائنات الفعلية (تفتيش متدرج)
  const prefixes = ['']
  const objects: string[] = []
  for (let depth = 0; depth < 6 && prefixes.length; depth++) {
    const next: string[] = []
    for (const pref of prefixes) {
      const entries = await listAt(pref)
      for (const e of entries) {
        const full = pref + e.name
        if (e.id == null) next.push(full + '/')
        else objects.push(full)
      }
    }
    prefixes.length = 0
    prefixes.push(...next.slice(0, 40))
  }
  console.log(`  ℹ كائنات التخزين الفعلية قبل الكنس: ${objects.length}`)
  let removed = 0
  for (const obj of objects) {
    const segs = obj.split('/')
    const owner = segs[1] // البنية: school/user/year/attachment/file
    if (owner && !liveIds.has(owner)) {
      if (await removeAt(obj)) removed++
    }
  }
  ok(`كنس الكائنات اليتيمة (${removed})`, true)

  // ─── 4) التحقق النهائي ───
  const finalUsers = await req('GET', '/api/super-admin/users', undefined, adminCookie)
  const finalList: any[] = finalUsers.json?.users ?? []
  ok('المستخدمون النهائيون: السوبر أدمن + الديمو فقط', finalList.length === 2,
    finalList.map((u) => u.email).join(' + '))

  const demoAchs = await req('GET', '/api/achievements', undefined, demoCookie)
  const titles: string[] = (demoAchs.json?.achievements ?? []).map((a: any) => a.title)
  ok('إنجازات الديمو القياسية سليمة (لا ثبات/لا اختبار)', !titles.includes('PRODUCTION-PERSISTENCE-TEST') && titles.length >= 5, `${titles.length} إنجازًا`)

  console.log(`\n═══ النتيجة: ${passed} نجاح / ${failed} فشل ═══`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
