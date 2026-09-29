// ═══════════════════════════════════════════════════════════════════
// رَحم QA للتقارير — Playwright حقيقي: معاينة ← طباعة ← PDF فعلي
// يتحقق أن: عدد صفحات PDF = عدد صفحات المعاينة (PREVIEW = PRINT = PDF)
// ويصدر لقطات PNG لكل صفحة بمحاكاة وسائط الطباعة الحقيقية.
// الاستخدام:
//   node scripts/qa-report-pdf.mjs official "توظيف التعلم" case1
//   node scripts/qa-report-pdf.mjs full "" full
// ═══════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.QA_BASE ?? 'http://localhost:3000'
const EMAIL = process.env.QA_EMAIL ?? 'sultan@madrasati.sa'
const PASSWORD = process.env.QA_PASSWORD ?? 'DevLocal2026!X'

const [, , mode = 'official', pattern = '', tag = 'report'] = process.argv
const OUT = `/home/z/my-project/screenshots/qa-${tag}`
mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message.slice(0, 200)))
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text().slice(0, 200)) })

  // ─── دخول ───
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('textbox', { name: 'البريد الإلكتروني' }).fill(EMAIL)
  await page.getByRole('textbox', { name: 'كلمة المرور' }).fill(PASSWORD)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForSelector('nav', { timeout: 20000 })
  console.log('✓ login')

  // ─── إلى التقارير ───
  await page.getByRole('button', { name: 'التقارير', exact: true }).click()
  await page.waitForSelector('h1:has-text("التقارير الاحترافية")', { timeout: 15000 })
  await sleep(800)
  console.log('✓ reports view')

  let expectedPages = 0

  if (mode === 'official') {
    // ─── اختر الإنجاز ───
    await page.getByRole('combobox', { name: 'اختيار الإنجاز' }).click()
    await page.waitForSelector('[role=option]', { timeout: 10000 })
    await page.getByRole('option', { name: new RegExp(pattern) }).click()
    await sleep(1200)
    // ─── زر المعاينة الثاني (قسم التقرير الرسمي) ───
    const previewBtns = await page.getByRole('button', { name: 'معاينة التقرير' }).all()
    await previewBtns[1].click()
  } else {
    // full/summary/impact/pd/initiatives — أول زر معاينة (قسم الملف الكامل)
    const previewBtns = await page.getByRole('button', { name: 'معاينة التقرير' }).all()
    await previewBtns[0].click()
  }

  // ─── انتظر اكتمال قياس المعاينة ───
  await page.waitForSelector('#report-preview-overlay .rp-page', { timeout: 40000 })
  await page.waitForFunction(
    () => {
      const nav = document.querySelector('.rp-nav span')
      if (!nav) return false
      const m = nav.textContent?.match(/(\d+)\s*\/\s*(\d+)/)
      // انتظر ثبات الترقيم (لا قياس جارٍ) — رقمين متطابقين متتاليين
      return m && window.__qaPrevNav === m[2] ? true : (window.__qaPrevNav = m?.[2], false)
    },
    { timeout: 40000, polling: 1200 },
  )
  expectedPages = await page.evaluate(() => document.querySelectorAll('#report-preview-overlay .rp-page').length)
  console.log(`✓ preview ready: ${expectedPages} pages`)

  // ─── لقطة معاينة (أول صفحتين) ───
  const previewShot = await page.locator('#report-preview-overlay .rp-page').first().screenshot()
  writeFileSync(`${OUT}/preview-page1.png`, previewShot)

  // ─── الطباعة — نفس مسار المستخدم (زر داخل شريط المعاينة حصرًا) ───
  // نعطّل حوار الطباعة الفعلي وحدث afterprint حتى يبقى مستند الطباعة
  // مركّباً للفحص (PDF/لقطات) — نفس محتوى ما سيراه مستخدم Chrome تمامًا
  await page.evaluate(() => {
    window.print = () => {}
    window.addEventListener('afterprint', (e) => e.stopImmediatePropagation(), true)
  })
  await page.locator('#report-preview-overlay').getByRole('button', { name: 'طباعة' }).click()
  // انتظر مستند الطباعة في #print-root (نفس عدد صفحات المعاينة)
  await page.waitForFunction(
    (n) => document.querySelectorAll('#print-root .rp-page').length === n,
    expectedPages,
    { timeout: 150000, polling: 1500 },
  )
  console.log(`✓ print document mounted: ${expectedPages} pages`)

  // ─── PDF فعلي عبر بروتوكول المتصفح — هوامش صفرية + A4 (كما يفعل مستخدم Chrome) ───
  await page.pdf({
    path: `${OUT}/document.pdf`,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  })
  console.log(`✓ PDF saved: ${OUT}/document.pdf`)

  // ─── عدّ صفحات PDF ───
  const pdfBytes = (await import('node:fs')).readFileSync(`${OUT}/document.pdf`)
  const pageMatches = pdfBytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g)
  const pdfPages = pageMatches ? pageMatches.length : 0
  console.log(`PDF pages: ${pdfPages} | preview pages: ${expectedPages} | MATCH: ${pdfPages === expectedPages ? 'PASS ✅' : 'FAIL ❌'}`)

  // ─── لقطات وسائط الطباعة لكل صفحة (بكسل-مطابقة للمطبوع) ───
  await page.emulateMedia({ media: 'print' })
  await sleep(600)
  const printPages = await page.locator('#print-root .rp-page').all()
  for (let i = 0; i < Math.min(printPages.length, 12); i++) {
    await printPages[i].scrollIntoViewIfNeeded().catch(() => {})
    await printPages[i].screenshot({ path: `${OUT}/print-page-${String(i + 1).padStart(2, '0')}.png` })
  }
  console.log(`✓ print-media screenshots: ${Math.min(printPages.length, 12)} pages`)

  await browser.close()

  // النتيجة النهائية
  const result = { mode, tag, expectedPages, pdfPages, match: pdfPages === expectedPages }
  writeFileSync(`${OUT}/result.json`, JSON.stringify(result, null, 2))
  process.exit(pdfPages === expectedPages ? 0 : 2)
}

main().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
