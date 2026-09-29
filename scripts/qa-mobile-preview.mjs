// فحص الجوال للمعاينة — بلا تمرير أفقي في 320/360/375/390/412
import { chromium } from 'playwright'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const WIDTHS = [320, 360, 375, 390, 412]
const browser = await chromium.launch()
const results = []
for (const w of WIDTHS) {
  const page = await browser.newPage({ viewport: { width: w, height: 780 } })
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })
  await page.getByRole('textbox', { name: 'البريد الإلكتروني' }).fill('sultan@madrasati.sa')
  await page.getByRole('textbox', { name: 'كلمة المرور' }).fill('DevLocal2026!X')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForSelector('h1', { timeout: 20000 })
  await sleep(4000)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim().startsWith('التقارير')); (b?.offsetParent !== null ? b : [...document.querySelectorAll('button')].filter(x => (x.textContent || '').trim().startsWith('التقارير') && x.offsetParent !== null)[0])?.click(); return true })
  await page.waitForSelector('h1', { timeout: 15000 }); await sleep(2500)
  await sleep(800)
  await page.evaluate(() => { const btns = [...document.querySelectorAll('button')].filter(b => b.textContent.includes('معاينة التقرير')); btns[0]?.click(); return btns.length }) // official — أصغر مستند للفحص السريع
  await page.waitForSelector('#report-preview-overlay .rp-page', { timeout: 40000 })
  await page.waitForFunction(() => {
    const nav = document.querySelector('.rp-nav span')
    const m = nav?.textContent?.match(/(\d+)\s*\/\s*(\d+)/)
    return m && window.__qaPrevNav === m[2] ? true : (window.__qaPrevNav = m?.[2], false)
  }, { timeout: 40000, polling: 1200 })

  const check = await page.evaluate(() => {
    const scroll = document.querySelector('.rp-scroll')
    const overlay = document.getElementById('report-preview-overlay')
    const back = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('رجوع للتعديل'))
    const pdfBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('PDF') || b.textContent.includes('تنزيل'))
    return {
      hOverflow: scroll ? scroll.scrollWidth > scroll.clientWidth + 1 : null,
      overlayW: overlay?.getBoundingClientRect().width,
      backVisible: back ? back.getBoundingClientRect().width > 40 : false,
      pdfVisible: !!pdfBtn,
      pageW: document.querySelector('.rp-page')?.getBoundingClientRect().width,
      navExists: !!document.querySelector('.rp-nav'),
    }
  })
  results.push({ w, ...check })
  console.log(`${w}px → hOverflow: ${check.hOverflow ? 'FAIL ❌' : 'PASS ✅'} | back: ${check.backVisible ? '✓' : '✗'} | PDF: ${check.pdfVisible ? '✓' : '✗'} | nav: ${check.navExists ? '✓' : '✗'}`)
  await page.close()
}
await browser.close()
const allPass = results.every((r) => !r.hOverflow && r.backVisible && r.pdfVisible)
console.log(allPass ? 'MOBILE: PASS ✅' : 'MOBILE: FAIL ❌')
process.exit(allPass ? 0 : 2)
