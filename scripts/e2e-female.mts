// ═══ اختبار الصياغة المؤنثة (FEMALE) على الإنتاج — تقرير رسمي لمعلمة ═══
// ينشئ معلمة مؤقتة بإنجاز واحد → يفتح التقرير الرسمي → يتحقق من الصياغة
// المؤنثة العربية → ينظف الحساب كليًا بعد الاختبار.
import { chromium } from 'playwright'
import { readFileSync } from 'fs'
import { randomBytes } from 'crypto'

const BASE = process.env.E2E_BASE ?? 'https://teacher-portfolio-sultans-projects-bce2ab1d.vercel.app'
const SECR: Record<string, string> = {}
for (const line of readFileSync('/home/z/my-project/.env.production-secrets', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) SECR[m[1]] = m[2].trim()
}

const EMAIL = `female-e2e-${Date.now()}@example.com`
const PASSWORD = `Fe-${randomBytes(8).toString('hex')}!qA`

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
  console.log(`═══ اختبار المؤنث (FEMALE) ضد ${BASE} ═══`)

  // 1) التسجيل + إكمال الملف المهني (أنثى)
  const signup = await req('POST', '/api/auth/signup', { email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD })
  let cookie = signup.cookie
  ok('تسجيل المعلمة المؤقتة', signup.r.status === 200 || signup.r.status === 201)

  const profile = await req('PUT', '/api/profile', { name: 'أمل التجريبية', gender: 'FEMALE' }, cookie)
  ok('ضبط الجنس أنثى عبر الملف المهني', profile.r.status === 200)
  const me = await req('GET', '/api/me', undefined, cookie)
  ok('الجنس محفوظ ومُعاد (roundtrip)', me.json?.user?.gender === 'FEMALE')

  // 2) سنة + إنجاز بتاريخ
  const year = await req('POST', '/api/years', { label: '1448هـ' }, cookie)
  const yearId = year.json?.year?.id
  ok('سنة دراسية للمعلمة', !!yearId)
  const ach = await req('POST', '/api/achievements', {
    type: 'PRACTICE', title: 'توظيف التعلم النشط في دروس القواعد', field: 'التعلم والتعليم',
    description: 'نفّذت استراتيجيات التعلم النشط على مدى فصل دراسي كامل.', status: 'COMPLETED', yearId,
  }, cookie)
  const achId = ach.json?.achievement?.id ?? ach.json?.id
  ok('إنجاز للمعلمة', !!achId)

  // 3) التقرير الرسمي عبر المتصفح — الصياغة المؤنثة
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('البريد الإلكتروني').fill(EMAIL)
  await page.locator('#login-password').fill(PASSWORD)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForTimeout(4500)
  ok('دخول المعلمة عبر الواجهة', (await page.getByRole('navigation').count()) > 0)

  await page.getByRole('navigation').getByRole('button', { name: 'التقارير' }).click()
  await page.waitForTimeout(2500)
  await page.locator('[aria-label="اختيار الإنجاز"]').click()
  await page.waitForTimeout(800)
  await page.locator('[role="option"]', { hasText: 'توظيف التعلم النشط' }).first().click()
  await page.waitForTimeout(600)
  const card = page.locator('.group', { hasText: 'التقرير الرسمي للإنجاز' }).first()
  await card.getByRole('button', { name: 'معاينة التقرير' }).click()
  await page.waitForTimeout(5000)

  const previewPages = await page.locator('[data-rp-page]').count()
  ok('التقرير الرسمي للمعلمة يُعاين', previewPages > 0, `${previewPages} صفحة`)
  const bodyText = await page.evaluate(() => document.body.innerText)
  ok('صياغة مؤنثة (المعلمة) في التقرير', bodyText.includes('المعلمة'))
  ok('الترويسة الرسمية حاضرة للتقرير المؤنث', bodyText.includes('وزارة التعليم') && bodyText.includes('المملكة العربية السعودية'))
  const logoOk = await page.evaluate(() => document.querySelectorAll('img[alt="شعار وزارة التعليم"]').length > 0)
  ok('شعار الوزارة في تقرير المعلمة', logoOk)
  await page.screenshot({ path: '/home/z/my-project/screenshots/prod-e2e/female-official-report.png' })
  await ctx.close()
  await browser.close()

  // 4) التنظيف — حذف المعلمة عبر السوبر أدمن (يتتالي لكل بياناتها)
  const admin = await req('POST', '/api/session', { email: SECR.SUPER_ADMIN_EMAIL, password: SECR.SUPER_ADMIN_PASSWORD })
  const adminCookie = admin.cookie
  const users = await req('GET', '/api/super-admin/users?search=' + encodeURIComponent(EMAIL.split('@')[0]), undefined, adminCookie)
  const her = (users.json?.users ?? []).find((u: any) => u.email === EMAIL)
  if (her) {
    const impact = await req('GET', `/api/super-admin/users/${her.id}/deletion-impact`, undefined, adminCookie)
    const c = impact.json?.deletionImpact ?? impact.json ?? {}
    const confirmCount = Number(c.achievements ?? 0) + Number(c.attachments ?? 0) + Number(c.users ?? 0)
    const del = await req('DELETE', `/api/super-admin/users/${her.id}`, { confirm: 'CONFIRM', confirmCount }, adminCookie)
    ok('تنظيف حساب المعلمة المؤقتة', del.r.status === 200 || del.r.status === 204)
  } else {
    ok('تنظيف حساب المعلمة المؤقتة', false, 'لم يُعثر عليها للحذف')
  }

  const finalUsers = await req('GET', '/api/super-admin/users', undefined, adminCookie)
  ok('المستخدمون النهائيون: أدمن + ديمو فقط', (finalUsers.json?.users ?? []).length === 2)

  console.log(`\n═══ النتيجة: ${passed} نجاح / ${failed} فشل ═══`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
