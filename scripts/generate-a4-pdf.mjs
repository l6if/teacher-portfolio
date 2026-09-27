// توليد PDF حقيقي بمقاس A4 (preferCSSPageSize) عبر نفس رحلة المستخدم:
// دخول → التقارير → معاينة تقرير الأثر → زر «تنزيل PDF» → page.pdf
// الاستخدام: node /home/z/my-project/scripts/generate-a4-pdf.mjs
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs'

const BASE = 'http://localhost:3000'
const EMAIL = 'demo@madrasati.sa'
const PASS = '***REMOVED-DEV-SECRET***'
const OUT = process.argv[2] || '/home/z/my-project/download/impact-3reports-a4.pdf'

const browser = await chromium.launch({ executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome' })
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  // 1) تسجيل الدخول
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('textbox', { name: 'البريد الإلكتروني' }).fill(EMAIL)
  await page.getByRole('textbox', { name: 'كلمة المرور' }).fill(PASS)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForLoadState('networkidle')

  // 2) الذهاب إلى التقارير
  await page.getByRole('button', { name: 'التقارير' }).first().click()
  await page.waitForTimeout(1200)

  // 3) فتح معاينة «تقرير الأثر المهني» (البطاقة الرابعة)
  const previewButtons = page.getByRole('button', { name: 'معاينة التقرير' })
  await previewButtons.nth(3).click()
  await page.waitForTimeout(5000) // قياس الصفحات

  // 4) زر «تنزيل PDF» في تولبار المعاينة → يضبط printConfig ويملأ #print-root
  await page.locator('#report-preview-overlay').getByRole('button', { name: /PDF|تنزيل/ }).last().click()
  await page.waitForTimeout(3500) // اكتمال الصور + تفعيل print-root

  const title = await page.title()
  const reportStarts = await page.locator('#print-root .print-report-start').count()
  console.log('document.title =', title)
  console.log('print-root report-starts =', reportStarts)

  // 5) PDF بمقاس الصفحة من CSS (@page A4) مع الخلفيات
  await page.pdf({ path: OUT, preferCSSPageSize: true, printBackground: true })
  console.log('PDF saved:', OUT)
} finally {
  await browser.close()
}
