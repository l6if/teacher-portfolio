// اختبار الشعار الرسمي لوزارة التعليم — Preview / Print(PDF) / Grayscale + ريجريشن التخطيط
// رحلة حقيقية: دخول ديمو → التقارير → التقرير الرسمي (إنجاز) + تقرير الأثر → قياس + PDF حقيقي
// الاستخدام: node /home/z/my-project/scripts/test-ministry-logo.mjs
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs'

const BASE = 'http://localhost:3000'
const EMAIL = 'demo@madrasati.sa'
const PASS = process.env.DEMO_PASSWORD ?? ''
if (!PASS) { console.error('اضبط DEMO_PASSWORD في البيئة أولًا'); process.exit(1) }
const SHOT = (n) => `/home/z/my-project/download/${n}`

const browser = await chromium.launch({ executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome' })
const results = []
const note = (k, v) => { results.push([k, v]); console.log(`  ${k}: ${v}`) }

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  // ═══ 1) الدخول ═══
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('textbox', { name: 'البريد الإلكتروني' }).fill(EMAIL)
  await page.getByRole('textbox', { name: 'كلمة المرور' }).fill(PASS)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForLoadState('networkidle')

  // ═══ 2) التقارير → التقرير الرسمي للإنجاز (البطاقة الثانية) ═══
  await page.getByRole('button', { name: 'التقارير' }).first().click()
  await page.waitForTimeout(1200)

  // اختيار أول إنجاز في منتقي البطاقة الرسمية
  const officialSelect = page.locator('button[aria-label="اختيار الإنجاز"]')
  console.log('official select found:', await officialSelect.count())
  await officialSelect.first().click()
  await page.waitForTimeout(400)
  await page.getByRole('option').first().click()
  await page.waitForTimeout(400)

  // معاينة البطاقة الرسمية (أزرار «معاينة التقرير» — الرسمية هي الثانية)
  const previewButtons = page.getByRole('button', { name: 'معاينة التقرير' })
  await previewButtons.nth(1).click()
  await page.waitForTimeout(5000) // قياس الصفحات

  // ═══ 3) قياسات المعاينة — الشعار والترويسة ═══
  const logo = page.locator('#report-preview-overlay img[alt="شعار وزارة التعليم"]').first()
  const logoCount = await page.locator('#report-preview-overlay img[alt="شعار وزارة التعليم"]').count()
  note('PREVIEW logo imgs rendered', logoCount)

  const img = await logo.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { src: el.getAttribute('src'), complete: el.complete, naturalW: el.naturalWidth, naturalH: el.naturalHeight, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), right: Math.round(r.right) }
  })
  note('PREVIEW logo src', img.src)
  note('PREVIEW logo loaded (naturalW>0)', img.naturalW > 0 ? `true (${img.naturalW}x${img.naturalH})` : 'FALSE')
  note('PREVIEW logo box', `${img.w}x${img.h} @ (${img.x},${img.y})`)

  // موقع الشعار: أعلى يمين أول صفحة A4 داخل المعاينة
  const page1 = await page.locator('#report-preview-overlay [data-rp-page="0"]').first().boundingBox()
  if (page1) {
    const pageRight = page1.x + page1.width
    const marginFromRight = Math.round(pageRight - img.right)
    const marginFromTop = Math.round(img.y - page1.y)
    note('PREVIEW logo margin from page right', marginFromRight + 'px')
    note('PREVIEW logo margin from page top', marginFromTop + 'px')
    note('PREVIEW logo fully inside A4 page', img.x >= page1.x && img.right <= pageRight && img.y >= page1.y ? 'true' : 'FALSE')
  } else note('PREVIEW page1 box', 'not found')

  // سطور الجهة كما هي (٥ سطور للديمو الكامل)
  const orgText = await page.locator('#report-preview-overlay').first().evaluate((el) => el.innerText.slice(0, 400))
  const need = ['المملكة العربية السعودية', 'وزارة التعليم', 'الإدارة العامة للتعليم', 'مكتب التعليم', 'مدرسة']
  const missing = need.filter((t) => !orgText.includes(t))
  note('PREVIEW org lines present', missing.length === 0 ? 'ALL 5 line-types found' : 'MISSING: ' + missing.join(', '))

  // عدد الصفحات (التقرير الرسمي لإنجاز بلا صور = صفحة واحدة — خط الأساس)
  const counter = await page.locator('#report-preview-overlay').evaluate((el) => {
    const m = el.innerText.match(/(\d+)\s*\/\s*(\d+)/)
    return m ? m[0] : 'n/a'
  })
  note('PREVIEW official report pages (baseline=1)', counter)

  // لقطة أعلى الصفحة الأولى
  const overlay = await page.locator('#report-preview-overlay').boundingBox()
  await page.screenshot({ path: SHOT('logo-preview-official-top.png'), clip: { x: Math.max(0, overlay.x), y: Math.max(0, overlay.y), width: Math.min(1280, overlay.width), height: Math.min(700, overlay.height) } })
  note('SHOT', 'logo-preview-official-top.png')

  // ═══ 4) Grayscale — الشعار يبقى مرئيًا ومتميزًا ═══
  await page.evaluate(() => { document.getElementById('report-preview-overlay').style.filter = 'grayscale(1)' })
  await page.waitForTimeout(300)
  await page.screenshot({ path: SHOT('logo-preview-grayscale.png'), clip: { x: Math.max(0, overlay.x), y: Math.max(0, overlay.y), width: Math.min(1280, overlay.width), height: Math.min(700, overlay.height) } })
  const grayCheck = await logo.evaluate((el) => {
    // متوسط لمعان بكسلات منطقة الشعار عبر canvas
    const r = el.getBoundingClientRect()
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(r.width)); c.height = Math.max(1, Math.round(r.height))
    const ctx = c.getContext('2d')
    try { ctx.drawImage(el, 0, 0, c.width, c.height) } catch (e) { return 'drawImage blocked' }
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let lumSum = 0, n = 0, dark = 0
    for (let i = 0; i < d.length; i += 4) { const a = d[i + 3]; if (a > 100) { const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; lumSum += l; n++; if (l < 200) dark++ } }
    return n === 0 ? 'no opaque pixels' : `opaque=${n} avgLum=${(lumSum / n).toFixed(0)} inkPixels(l<200)=${dark}`
  })
  note('GRAYSCALE logo pixel analysis', grayCheck)
  await page.evaluate(() => { document.getElementById('report-preview-overlay').style.filter = '' })

  // ═══ 5) تقرير الأثر (متعدد التقارير) — Parity: المعاينة = PDF ═══
  await page.getByRole('button', { name: 'رجوع للتعديل' }).click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'التقارير' }).first().click()
  await page.waitForTimeout(1000)
  await previewButtons.nth(3).click() // تقرير الأثر المهني
  await page.waitForTimeout(5000)
  const impactPages = await page.locator('#report-preview-overlay').evaluate((el) => {
    const m = el.innerText.match(/(\d+)\s*\/\s*(\d+)/)
    return m ? m[0] : 'n/a'
  })
  note('PREVIEW impact pages', impactPages)

  // أول صفحة لتقرير الأثر — الترويسة (org) بشعارها
  const overlay2 = await page.locator('#report-preview-overlay').boundingBox()
  await page.screenshot({ path: SHOT('logo-preview-impact-org-header.png'), clip: { x: Math.max(0, overlay2.x), y: Math.max(0, overlay2.y), width: Math.min(1280, overlay2.width), height: Math.min(700, overlay2.height) } })

  // تنزيل PDF — نفس زر المستخدم
  await page.locator('#report-preview-overlay').getByRole('button', { name: /PDF|تنزيل/ }).last().click()
  await page.waitForTimeout(3500)
  note('PDF document.title', await page.title())
  note('PDF print-root report-starts', await page.locator('#print-root .print-report-start').count())
  await page.pdf({ path: SHOT('logo-impact-a4.pdf'), preferCSSPageSize: true, printBackground: true })
  note('PDF saved', 'download/logo-impact-a4.pdf')

  await ctx.close()
} finally {
  await browser.close()
  console.log('\n════ SUMMARY ════')
  results.forEach(([k, v]) => console.log(`${k} = ${v}`))
}
