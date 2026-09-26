/** اختبار WYSIWYG: عدد صفحات المعاينة = عدد صفحات PDF A4 الحقيقي */
import { chromium } from 'playwright'
import { execSync } from 'child_process'

const BASE = 'http://localhost:3000'
const OUT = '/home/z/my-project/screenshots/pdf-qa'

async function previewAndPdf(page: import('playwright').Page, cardText: string, name: string) {
  await page.getByRole('navigation').getByRole('button', { name: 'التقارير' }).click()
  await page.waitForTimeout(2200)
  const card = page.locator('.group', { hasText: cardText }).first()
  await card.getByRole('button', { name: 'معاينة التقرير' }).click()
  await page.waitForTimeout(6500)
  const previewPages = await page.locator('[data-rp-page]').count()
  await page.getByRole('button', { name: 'تنزيل PDF' }).click()
  // انتظر جاهزية print-root
  const start = Date.now()
  while (Date.now() - start < 20000) {
    const ready = await page.evaluate(() => {
      const root = document.getElementById('print-root')
      if (!root || !root.children.length) return false
      return Array.from(root.querySelectorAll('img')).every((i) => i.complete && i.naturalWidth > 0)
    })
    if (ready) break
    await page.waitForTimeout(400)
  }
  await page.pdf({ path: `${OUT}/${name}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true })
  const info = execSync(`pdfinfo ${OUT}/${name}.pdf | grep Pages`).toString()
  const pdfPages = Number(info.replace(/\D+/g, ''))
  await page.getByRole('button', { name: 'رجوع للتعديل' }).click()
  await page.waitForTimeout(900)
  return { previewPages, pdfPages }
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.getByLabel('البريد الإلكتروني').fill('sultan@madrasati.sa')
  await page.locator('#login-password').fill('***REMOVED-DEV-SECRET***')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForTimeout(3500)

  const full = await previewAndPdf(page, 'تقرير ملف الإنجاز الكامل', 'wysiwyg-full')
  console.log(`التقرير الكامل: معاينة=${full.previewPages} صفحة • PDF A4=${full.pdfPages} صفحة ${full.previewPages === full.pdfPages ? '✓ متطابق' : '⚠ فارق ' + (full.pdfPages - full.previewPages)}`)

  const summary = await previewAndPdf(page, 'تقرير ملخص الإنجازات', 'wysiwyg-summary')
  console.log(`الملخص: معاينة=${summary.previewPages} • PDF=${summary.pdfPages} ${summary.previewPages === summary.pdfPages ? '✓' : '⚠'}`)

  const impact = await previewAndPdf(page, 'تقرير الأثر المهني', 'wysiwyg-impact')
  console.log(`الأثر: معاينة=${impact.previewPages} • PDF=${impact.pdfPages} ${impact.previewPages === impact.pdfPages ? '✓' : '⚠'}`)

  const init = await previewAndPdf(page, 'تقرير المبادرات', 'wysiwyg-initiatives')
  console.log(`المبادرات: معاينة=${init.previewPages} • PDF=${init.pdfPages} ${init.previewPages === init.pdfPages ? '✓' : '⚠'}`)

  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
