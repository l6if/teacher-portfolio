// رجريشن: حساب الديمو (شواهد قديمة بروابط url) — المعاينة وPDF ما زالا يعملان
import { chromium } from 'playwright'
import { execSync } from 'child_process'
const BASE = 'https://teacher-portfolio-sultans-projects-bce2ab1d.vercel.app'
const EMAIL = process.env.DEMO_EMAIL || ''
const PASSWORD = process.env.DEMO_PASSWORD || ''
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
await page.goto(BASE)
await page.getByLabel('البريد الإلكتروني').fill(EMAIL)
await page.locator('#login-password').fill(PASSWORD)
await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
await page.waitForTimeout(3500)
await page.getByRole('navigation').getByRole('button', { name: 'التقارير' }).click()
await page.waitForTimeout(2200)
const card = page.locator('.group', { hasText: 'تقرير ملف الإنجاز الكامل' }).first()
await card.getByRole('button', { name: 'معاينة التقرير' }).click()
await page.waitForTimeout(10000)
const pages = await page.locator('[data-rp-page]').count()
const imgs = await page.locator('[data-rp-page] img').count()
console.log(`ديمو — التقرير الكامل: صفحات=${pages} صور=${imgs}`)
await page.evaluate(() => { (window as unknown as { print: () => void }).print = () => {} })
await page.locator('#report-preview-overlay').getByRole('button', { name: 'تنزيل PDF' }).click()
await page.waitForTimeout(4000)
await page.emulateMedia({ media: 'print' })
await page.pdf({ path: '/home/z/my-project/download/production-print-patch/demo-full.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true })
await page.emulateMedia({ media: 'screen' })
const pdfPages = Number(execSync(`pdfinfo /home/z/my-project/download/production-print-patch/demo-full.pdf | awk '/^Pages:/{print $2}'`).toString().trim())
console.log(`ديمو — PDF: صفحات=${pdfPages} | تكافؤ=${pdfPages === pages ? 'PASS' : 'FAIL'}`)
await browser.close()
process.exit(pdfPages === pages && pages > 3 ? 0 : 1)
