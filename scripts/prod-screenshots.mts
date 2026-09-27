// ═══ لقطات Production الثلاث النهائية (حساب الديمو — بيانات قياسية غنية) ═══
// 1) المعاينة وفيها قسم الشواهد والصور (مستوية على صفحة الصور)
// 2) مستند الطباعة وحده (وسائط الطباعة + pf-printing): التقرير فقط بلا نموذج التحرير
// 3) تقرير طويل أثناء التمرير (مؤشر الصفحة في منتصف التقرير)
import { chromium } from 'playwright'

const BASE = 'https://teacher-portfolio-sultans-projects-bce2ab1d.vercel.app'
const OUT = '/home/z/my-project/download/production-print-patch'
const secrets = (await Bun.file('.env.production-secrets').text()).split('\n')
const get = (k: string) => secrets.find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1).trim() ?? ''

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.getByLabel('البريد الإلكتروني').fill(get('DEMO_EMAIL'))
  await page.locator('#login-password').fill(get('DEMO_PASSWORD'))
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForTimeout(3500)

  /* ── 1) المعاينة بقسم الشواهد والصور ── */
  await page.getByRole('navigation').getByRole('button', { name: 'التقارير' }).click()
  await page.waitForTimeout(2400)
  const card = page.locator('.group', { hasText: 'التقرير الرسمي للإنجاز' }).first()
  await card.getByRole('combobox').click()
  await page.waitForTimeout(800)
  // إنجاز بصور (خطة علاجية لتنمية مهارة القراءة — له شواهد صور بالبيانات القياسية)
  await page.getByRole('option', { name: /خطة علاجية/ }).first().click()
  await page.waitForTimeout(800)
  await card.getByRole('button', { name: 'معاينة التقرير' }).click()
  await page.waitForTimeout(9000)

  const preview = page.locator('#report-preview-overlay')
  const evPages = await preview.locator('[data-rp-page]', { has: preview.locator('figure img') }).count()
  console.log('صفحات بصور:', evPages)
  // استوِ على الصفحة التي فيها معرض الصور
  await page.evaluate(() => {
    const sc = document.querySelector('.rp-scroll') as HTMLElement
    const pages = Array.from(sc.querySelectorAll('[data-rp-page]')) as HTMLElement[]
    const withGallery = pages.find((p) => p.querySelectorAll('figure img').length >= 1)
    if (withGallery) sc.scrollTo({ top: withGallery.offsetTop - 30 })
  })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/1-preview-evidence.png` })
  console.log('✓ لقطة 1 (معاينة بشواهدها)')

  /* ── 2) مستند الطباعة وحده ── */
  await preview.getByRole('button', { name: 'طباعة', exact: true }).click()
  await page.waitForTimeout(500)
  const cls = await page.evaluate(() => document.body.classList.contains('pf-printing'))
  console.log('pf-printing:', cls)
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/2-print-document-only.png` })
  await page.emulateMedia({ media: 'screen' })
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await page.waitForTimeout(1600)
  await page.getByRole('button', { name: 'رجوع للتعديل' }).click()
  await page.waitForTimeout(1000)
  console.log('✓ لقطة 2 (مستند الطباعة وحده)')

  /* ── 3) تقرير طويل أثناء التمرير ── */
  const fullCard = page.locator('.group', { hasText: 'تقرير ملف الإنجاز الكامل' }).first()
  await fullCard.getByRole('button', { name: 'معاينة التقرير' }).click()
  await page.waitForTimeout(13000)
  const total = await page.locator('[data-rp-page]').count()
  console.log('صفحات التقرير الطويل:', total)
  // مرر لعُشر التقرير ثم أطلق عجلة فأرة حقيقية عدة مرات — واللقطة أثناء منتصف التمرير
  const box = await page.locator('.rp-scroll').boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 300)
  for (let i = 0; i < 9; i++) {
    await page.mouse.wheel(0, 650)
    await page.waitForTimeout(70)
  }
  await page.waitForTimeout(600)
  const mid = await page.locator('.rp-nav span').innerText()
  const st = await page.evaluate(() => (document.querySelector('.rp-scroll') as HTMLElement).scrollTop)
  console.log(`أثناء التمرير: ${mid.trim()} — scrollTop=${st}`)
  await page.screenshot({ path: `${OUT}/3-long-report-scrolling.png` })
  console.log('✓ لقطة 3 (تقرير طويل أثناء التمرير بعجلة الفأرة)')

  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
