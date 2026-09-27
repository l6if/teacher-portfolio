// ═══ تحقق متصفح محلي لإصلاحات الرقعة الثلاثة ═══
// 1) الشواهد تظهر في المعاينة (صورة + بطاقة PDF + رابط خارجي)
// 2) عجلة الفأرة تمرر المعاينة فوق نموذج مفتوح (قفل react-remove-scroll)
// 3) عزل الطباعة: pf-printing يخفي بوابة النموذج ويبقي #print-root وحده
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const EMAIL = 'qa-patch-local@school.sa'
const PASSWORD = 'QaPatch!2026'

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const fails: string[] = []
  const ok = (name: string, cond: boolean, extra = '') => {
    console.log(`  ${cond ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
    if (!cond) fails.push(name)
  }

  await page.goto(BASE)
  await page.getByLabel('البريد الإلكتروني').fill(EMAIL)
  await page.locator('#login-password').fill(PASSWORD)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForTimeout(3000)

  // فتح نموذج الإنجاز التجريبي (الورقة = قفل تمرير Radix نشط تحتها):
  // فتح الإنجاز الموجود من قسم المبادرات
  await page.getByRole('navigation').getByRole('button', { name: 'ملف إنجازي' }).first().click()
  await page.waitForTimeout(2200)
  await page.getByRole('link', { name: 'المبادرات' }).first().click().catch(async () => {
    // البديل: بطاقة القسم في شاشة الملف
    await page.locator('text=المبادرات').first().click()
  })
  await page.waitForTimeout(1800)
  await page.locator('[aria-label="فتح مبادرة اختبار الرقعة"]').first().click()
  await page.waitForTimeout(1600) // تحميل الإنجاز في النموذج
  await page.evaluate(() => {
    const sc = document.querySelector('[data-slot="sheet-content"]')
    sc?.scrollTo(0, sc.scrollHeight)
  })
  await page.waitForTimeout(300)

  // فتح المعاينة من النموذج (المسار الذي كان يقتل العجلة)
  const previewBtn = page.getByRole('button', { name: 'معاينة', exact: true })
  await previewBtn.click()
  await page.waitForTimeout(6000) // قياس الصفحات

  ok('المعاينة مفتوحة', await page.locator('#report-preview-overlay').count() === 1)

  // ── 1) قسم الشواهد داخل المعاينة (القالب الرسمي: «المرفقات والشواهد» + «صور من التنفيذ») ──
  const preview = page.locator('#report-preview-overlay')
  const evLabel = await preview.locator('text=المرفقات والشواهد').count()
  const photosLabel = await preview.locator('text=صور من التنفيذ').count()
  ok('قسم الشواهد ظاهر (صور + مرفقات)', evLabel > 0 && photosLabel > 0, `مرفقات=${evLabel} صور=${photosLabel}`)
  const evImgs = await preview.locator('[data-rp-page] img').count()
  ok('صورة الشاهد معروضة في الصفحة', evImgs > 0, `صور=${evImgs}`)
  const linkCard = await preview.locator('text=شاهد رابط:').count()
  ok('بطاقة الرابط الخارجي معروضة', linkCard > 0)
  const madrasati = await preview.locator('text=schools.madrasati.sa').count()
  ok('نص الرابط الخارجي ظاهر', madrasati > 0)

  // ── 2) عجلة الفأرة فوق المعاينة والنموذج مفتوح تحتها ──
  const box = await page.locator('.rp-scroll').boundingBox()
  const before = await page.evaluate(() => (document.querySelector('.rp-scroll') as HTMLElement).scrollTop)
  await page.mouse.move(box!.x + box!.width / 2, box!.y + Math.min(300, box!.height / 2))
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(90)
  }
  const after = await page.evaluate(() => (document.querySelector('.rp-scroll') as HTMLElement).scrollTop)
  ok('عجلة الفأرة تمرر المعاينة (فوق نموذج مفتوح)', after > before + 100, `scrollTop ${before}→${after}`)

  // الخلفية مقفلة: body overflow hidden
  const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow)
  ok('الخلفية خلف المعاينة مقفلة', bodyOverflow === 'hidden', `overflow=${bodyOverflow}`)

  // ── 3) عزل الطباعة ──
  await page.getByRole('button', { name: 'طباعة', exact: true }).first().click()
  // خلال نافذة الـ 900ms قبل window.print: pf-printing مفعّل
  await page.waitForTimeout(500)
  const hasClass = await page.evaluate(() => document.body.classList.contains('pf-printing'))
  ok('body.pf-printing مفعّل عند الطباعة', hasClass)

  // محاكاة وسائط الطباعة والتحقق من الأنماط المحسوبة
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(200)
  const styles = await page.evaluate(() => {
    const vis = (el: Element | null) => {
      if (!el) return 'absent'
      let cur: Element | null = el
      while (cur && cur !== document.body) {
        const d = getComputedStyle(cur).display
        if (d === 'none') return 'hidden'
        cur = cur.parentElement
      }
      return 'visible'
    }
    const sheet = document.querySelector('[data-slot="sheet-content"]')   // نموذج الإنجاز (بوابة Radix)
    const app = document.getElementById('app-shell')
    const root = document.getElementById('print-root')
    const prev = document.getElementById('report-preview-overlay')
    return { sheet: vis(sheet), app: vis(app), root: vis(root), preview: vis(prev), rootHasContent: (root?.children.length ?? 0) > 0 }
  })
  ok('نموذج الإنجاز (بوابة Radix) مخفي في الطباعة', styles.sheet === 'hidden' || styles.sheet === 'absent', styles.sheet)
  ok('واجهة التطبيق مخفية في الطباعة', styles.app === 'hidden', styles.app)
  ok('المعاينة مخفية في الطباعة', styles.preview === 'hidden' || styles.preview === 'absent', styles.preview)
  ok('#print-root وحده ظاهر وفيه التقرير', styles.root === 'visible' && styles.rootHasContent, JSON.stringify(styles))

  // لا واجهة تحرير داخل مستند الطباعة نفسه
  const editorUI = await page.evaluate(() => {
    const root = document.getElementById('print-root')
    if (!root) return -1
    return root.textContent?.includes('حفظ الإنجاز') || root.textContent?.includes('اختيار من مكتبة الشواهد') ? 1 : 0
  })
  ok('لا واجهة تحرير داخل مستند الطباعة', editorUI === 0)

  // رجوع للتعديل (بعد إغلاق الطباعة)
  await page.emulateMedia({ media: 'screen' })
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'رجوع للتعديل' }).click()
  await page.waitForTimeout(1000)
  const titleVal = await page.locator('[data-slot="sheet-content"] input[type="text"]').first().inputValue()
  ok('رجوع للتعديل يحفظ حالة النموذج', titleVal.includes('مبادرة اختبار الرقعة'), titleVal)

  await browser.close()
  console.log(fails.length === 0 ? '\n✓✓ كل فحوصات المتصفح ناجحة' : `\n✗ ${fails.length} فشل: ${fails.join(' | ')}`)
  process.exit(fails.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
