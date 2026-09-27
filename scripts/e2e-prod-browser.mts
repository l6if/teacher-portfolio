// ═══ E2E الإنتاجي بالمتصفح — تقارير/PDF/ترويسة رسمية/موبايل/RTL ضد الرابط العام ═══
// يحتاج: Playwright chromium + pdftotext/pdfinfo (poppler)
// الاستخدام: bun scripts/e2e-prod-browser.mts
import { chromium } from 'playwright'
import { execSync } from 'child_process'
import { readFileSync, mkdirSync } from 'fs'

const BASE = process.env.E2E_BASE ?? 'https://teacher-portfolio-sultans-projects-bce2ab1d.vercel.app'
const OUT = '/home/z/my-project/screenshots/prod-e2e'
mkdirSync(OUT, { recursive: true })

const SECR: Record<string, string> = {}
for (const line of readFileSync('/home/z/my-project/.env.production-secrets', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) SECR[m[1]] = m[2].trim()
}
const EMAIL = SECR.DEMO_EMAIL!
const PASSWORD = SECR.DEMO_PASSWORD!

let passed = 0
let failed = 0
const failures: string[] = []
function ok(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`) }
  else { failed++; failures.push(name); console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`) }
}

async function login(page: import('playwright').Page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('البريد الإلكتروني').fill(EMAIL)
  await page.locator('#login-password').fill(PASSWORD)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForTimeout(4000)
}

async function openReports(page: import('playwright').Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'التقارير' }).click()
  await page.waitForTimeout(2500)
}

async function waitPreviewReady(page: import('playwright').Page) {
  const start = Date.now()
  while (Date.now() - start < 25000) {
    const ready = await page.evaluate(() => {
      const root = document.getElementById('print-root')
      if (!root || !root.children.length) return false
      return Array.from(root.querySelectorAll('img')).every((i) => i.complete && i.naturalWidth > 0)
    })
    if (ready) return true
    await page.waitForTimeout(500)
  }
  return false
}

/** معاينة تقرير → تحقق الترويسة الرسمية → رجوع → إعادة معاينة → PDF A4 حقيقي */
async function reportCycle(
  page: import('playwright').Page,
  cardText: string,
  name: string,
  prepare?: () => Promise<void>,
) {
  await openReports(page)
  if (prepare) await prepare()
  const card = page.locator('.group', { hasText: cardText }).first()
  await card.getByRole('button', { name: 'معاينة التقرير' }).click()
  await page.waitForTimeout(4500)
  const previewPages1 = await page.locator('[data-rp-page]').count()
  ok(`${name}: المعاينة جاهزة`, previewPages1 > 0)
  ok(`${name}: صفحات معاينة فعلية`, previewPages1 > 0, `${previewPages1} صفحة`)
  if (previewPages1 === 0) {
    ok(`${name}: PDF بتنسيق A4`, false, 'المعاينة لم تُفتح أصلًا')
    ok(`${name}: PDF بصفحات فعلية`, false, 'المعاينة لم تُفتح أصلًا')
    ok(`${name}: نص عربي سليم داخل PDF`, false, 'المعاينة لم تُفتح أصلًا')
    return
  }

  // الترويسة الرسمية — داخل المعاينة
  const headerText = await page.evaluate(() => document.body.innerText)
  const hasMinistry = headerText.includes('وزارة التعليم')
  const hasKingdom = headerText.includes('المملكة العربية السعودية')
  const hasSchool = headerText.includes('المعاينة النموذجية') || headerText.includes('مدرسة')
  ok(`${name}: الترويسة الرسمية (المملكة+الوزارة)`, hasKingdom && hasMinistry)
  ok(`${name}: حقول الجهة الديناميكية (مدرسة)`, hasSchool)
  const logoOk = await page.evaluate(() => document.querySelectorAll('img[alt="شعار وزارة التعليم"]').length > 0)
  ok(`${name}: شعار الوزارة الرسمي حاضر`, logoOk)

  await page.screenshot({ path: `${OUT}/report-${name}.png`, fullPage: false })

  // رجوع للتعديل — ثم إعادة المعاينة (صفر فقدان)
  await page.getByRole('button', { name: 'رجوع للتعديل' }).click()
  await page.waitForTimeout(1200)
  const backOk = await page.evaluate(() => !document.getElementById('print-root')?.children.length)
  ok(`${name}: رجوع للتعديل يعيد المحرر`, backOk)
  const card2 = page.locator('.group', { hasText: cardText }).first()
  await card2.getByRole('button', { name: 'معاينة التقرير' }).click()
  await page.waitForTimeout(4000)
  const previewPages2 = await page.locator('[data-rp-page]').count()
  ok(`${name}: إعادة المعاينة بعد الرجوع (نفس الصفحات)`, previewPages2 === previewPages1 && previewPages2 > 0, `${previewPages1}→${previewPages2}`)

  // زر الطباعة موجود (الوجهة الحقيقية نافذة الطباعة — نتحقق من وجوده فقط)
  const hasPrint = await page.getByRole('button', { name: 'طباعة' }).count()
  ok(`${name}: زر الطباعة موجود`, hasPrint > 0)

  // PDF حقيقي A4
  await page.getByRole('button', { name: 'تنزيل PDF' }).last().click()
  await waitPreviewReady(page)
  await page.pdf({ path: `${OUT}/${name}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true })
  const pages = Number(execSync(`pdfinfo ${OUT}/${name}.pdf | grep Pages | grep -oE '[0-9]+'`).toString())
  const size = execSync(`pdfinfo ${OUT}/${name}.pdf | grep 'Page size'`).toString().trim()
  const m = size.match(/([\d.]+) x ([\d.]+)/)
  const isA4 = !!m && Math.abs(Number(m[1]) - 595) < 1.5 && Math.abs(Number(m[2]) - 842) < 1.5
  ok(`${name}: PDF بتنسيق A4`, isA4, size.replace('Page size:', '').trim())
  ok(`${name}: PDF بصفحات فعلية`, pages > 0 && pages === previewPages1, `PDF=${pages} / معاينة=${previewPages1}`)

  // نص عربي داخل PDF
  const txt = execSync(`pdftotext ${OUT}/${name}.pdf - 2>/dev/null | head -c 3000`).toString()
  ok(`${name}: نص عربي سليم داخل PDF`, /وزارة التعليم|ملف إنجاز|المعلم/.test(txt))

  await page.getByRole('button', { name: 'رجوع للتعديل' }).click()
  await page.waitForTimeout(900)
}

async function main() {
  console.log(`═══ E2E الإنتاجي (متصفح) ضد ${BASE} ═══`)
  const browser = await chromium.launch()

  // ─── 1) دخول الديمو + RTL ───
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await login(page)
  const loggedIn = await page.getByRole('navigation').count()
  ok('دخول الديمو عبر الواجهة', loggedIn > 0)
  const dir = await page.evaluate(() => document.documentElement.dir)
  ok('RTL على مستوى المستند', dir === 'rtl')
  await page.screenshot({ path: `${OUT}/dashboard.png` })

  // عرض الإنجازات (الديمو: 8+ إنجازات منها إنجاز الثبات)
  const bodyTxt = await page.evaluate(() => document.body.innerText)
  ok('لوحة الديمو تعرض بياناتها', bodyTxt.includes('إنجاز') || bodyTxt.includes('ملف'))

  // ─── 2) التقارير السبعة ───
  console.log('\n═══ التقارير: معاينة/رجوع/طباعة/PDF لكل نوع ═══')
  await reportCycle(page, 'تقرير ملف الإنجاز الكامل', 'full')
  await reportCycle(page, 'تقرير ملخص الإنجازات', 'summary')
  await reportCycle(page, 'تقرير الأثر المهني', 'impact')
  await reportCycle(page, 'تقرير التطوير المهني', 'pd')
  await reportCycle(page, 'تقرير المبادرات', 'initiatives')
  await reportCycle(page, 'التقرير الرسمي للإنجاز', 'official', async () => {
    // اختيار إنجاز من القائمة (إنجاز الثبات)
    await page.locator('[aria-label="اختيار الإنجاز"]').click()
    await page.waitForTimeout(800)
    await page.locator('[role="option"]', { hasText: 'PRODUCTION-PERSISTENCE-TEST' }).first().click()
    await page.waitForTimeout(600)
  })
  await reportCycle(page, 'تصدير مخصص', 'custom', async () => {
    const cb = page.getByRole('checkbox').first()
    if (await cb.count()) { await cb.click(); await page.waitForTimeout(500) }
  })

  await ctx.close()

  // ─── 3) مصفوفة الجوال 320–412: صفر تجاوز أفقي ───
  console.log('\n═══ الجوال: 320/360/375/390/412 — صفر تجاوز أفقي ═══')
  for (const w of [320, 360, 375, 390, 412]) {
    const mctx = await browser.newContext({ viewport: { width: w, height: 800 } })
    const mpage = await mctx.newPage()
    await login(mpage)
    await mpage.waitForTimeout(1500)
    const overflowLogin = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    await mpage.getByRole('navigation').getByRole('button', { name: 'التقارير' }).click()
    await mpage.waitForTimeout(2200)
    const overflowReports = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    // معاينة على الجوال + القوائم المنسدلة
    const card = mpage.locator('.group', { hasText: 'تقرير ملخص الإنجازات' }).first()
    await card.getByRole('button', { name: 'معاينة التقرير' }).click()
    await mpage.waitForTimeout(3500)
    await waitPreviewReady(mpage)
    const overflowPreview = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (w === 360) await mpage.screenshot({ path: `${OUT}/mobile-360-preview.png` })
    ok(`جوال ${w}px: صفر تجاوز أفقي (دخول/تقارير/معاينة)`, overflowLogin <= 0 && overflowReports <= 0 && overflowPreview <= 0,
      `دخول=${overflowLogin} تقارير=${overflowReports} معاينة=${overflowPreview}`)
    await mctx.close()
  }

  await browser.close()
  console.log(`\n═══ النتيجة: ${passed} نجاح / ${failed} فشل ═══`)
  if (failures.length) { console.log('الفشل:'); failures.forEach((f) => console.log('  • ' + f)) }
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
