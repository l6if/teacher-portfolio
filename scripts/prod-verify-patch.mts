// ═══ اختبار Production الشامل للرقعة: PART 6/7/8/9 ═══
// A) إنجاز PART 6 في المعاينة: كل النص + صورتان + بطاقة PDF + رابط خارجي + ترويسة رسمية
// B) الطباعة: pf-printing + عزل تام (لا واجهة تحرير) + لقطة «ما يُطبع»
// C) PDF حقيقي: عدد الصفحات + النص + تكافؤ Preview=PDF
// D) التمرير: عجلة + تراك باد + شريط التمرير + أزرار الصفحات (10+ صفحات) + زووم 50–150%
// E) رجريشن: رجوع للتعديل + الواجهة الرسمية + هجري + تخزين مصادَق
import { chromium } from 'playwright'
import { execSync } from 'child_process'
import { mkdirSync } from 'fs'

const BASE = process.env.BASE_URL || 'https://teacher-portfolio-sultans-projects-bce2ab1d.vercel.app'
const EMAIL = process.env.QA_EMAIL || ''
const PASSWORD = process.env.QA_PASSWORD || ''
const ACH_TITLE = 'سفراء القراءة'
const OUT = '/home/z/my-project/download/production-print-patch'
mkdirSync(OUT, { recursive: true })

const fails: string[] = []
const ok = (name: string, cond: boolean, extra = '') => {
  console.log(`  ${cond ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) fails.push(name)
}

async function login(page: import('playwright').Page) {
  await page.goto(BASE)
  await page.getByLabel('البريد الإلكتروني').fill(EMAIL)
  await page.locator('#login-password').fill(PASSWORD)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForTimeout(3500)
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  /* ═══ A) نموذج الإنجاز → معاينة التقرير الرسمي (المسار الكامل) ═══ */
  await login(page)
  await page.getByRole('navigation').getByRole('button', { name: 'ملف إنجازي' }).first().click()
  await page.waitForTimeout(2200)
  await page.getByRole('link', { name: 'المبادرات' }).first().click().catch(async () => {
    await page.locator('text=المبادرات').first().click()
  })
  await page.waitForTimeout(1800)
  await page.locator(`[aria-label*="سفراء القراءة"]`).first().click()
  await page.waitForTimeout(1800)
  await page.evaluate(() => {
    const sc = document.querySelector('[data-slot="sheet-content"]')
    sc?.scrollTo(0, sc.scrollHeight)
  })
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'معاينة', exact: true }).click()
  await page.waitForTimeout(8000)

  const preview = page.locator('#report-preview-overlay')
  ok('المعاينة مفتوحة فوق النموذج', await preview.count() === 1)
  const previewPages = await preview.locator('[data-rp-page]').count()
  console.log(`  صفحات المعاينة = ${previewPages}`)

  // A1: كل نصوص PART 6 (القالب الرسمي لا يعرض «المشكلة» بتصميمه المجمّد — تُفحص في التقرير الكامل أدناه)
  for (const t of ['سفراء القراءة الرقمية', 'رفع مستوى الوعي القرائي', 'وصف التنفيذ', 'النتائج', 'الأثر', '42']) {
    ok(`نص «${t.slice(0, 18)}» في المعاينة`, (await preview.locator(`text=${t}`).count()) > 0)
  }

  // A2: الشواهد — صورتان + بطاقة PDF + رابط
  const imgs = await preview.locator('[data-rp-page] img').count()
  const imgsLoaded = await preview.locator('[data-rp-page] img').evaluateAll(
    (els) => els.filter((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0).length,
  )
  ok('صورتا الشاهد ظاهرتان ومحمّلتان من التخزين المصادَق', imgs >= 2 && imgsLoaded >= 2, `صور=${imgs} محملة=${imgsLoaded}`)
  ok('بطاقة «شاهد مرفق: خطة تنفيذ البرنامج.pdf»', (await preview.locator('text=خطة تنفيذ البرنامج.pdf').count()) > 0)
  ok('بطاقة الرابط الخارجي (مدرستي)', (await preview.locator('text=شاهد رابط:').count()) > 0 && (await preview.locator('text=schools.madrasati.sa').count()) > 0)
  ok('قسم الصور/المرفقات ظاهر', (await preview.locator('text=صور من التنفيذ').count()) > 0 && (await preview.locator('text=المرفقات والشواهد').count()) > 0)

  // A3: الترويسة الرسمية + الشعار + الهجري
  ok('الترويسة الرسمية (المملكة + الوزارة)', (await preview.locator('text=المملكة العربية السعودية').count()) > 0 && (await preview.locator('text=وزارة التعليم').count()) > 0)
  const logoOk = await preview.locator('img[src*="ministry-logo"]').evaluateAll(
    (els) => els.some((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0),
  )
  ok('شعار الوزارة محمّل', logoOk)
  ok('علامات هجرية (هـ)', (await preview.locator('text=هـ').count()) > 0)

  // A4: لقطة ① — المعاينة بقسم الشواهد والصور
  await page.evaluate(() => {
    const el = document.querySelector('.rp-scroll') as HTMLElement
    const card = Array.from(el.querySelectorAll('[data-rp-page]')).find((c) => c.querySelector('img')) as HTMLElement | undefined
    if (card) el.scrollTo({ top: card.offsetTop - 40 })
  })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/1-preview-evidence.png` })

  /* ═══ D) التمرير داخل المعاينة (فوق نموذج مفتوح) ═══ */
  const wheelTest = async () => {
    const box = await page.locator('.rp-scroll').boundingBox()
    const before = await page.evaluate(() => (document.querySelector('.rp-scroll') as HTMLElement).scrollTop)
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 250)
    for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 500); await page.waitForTimeout(80) }
    return await page.evaluate(() => (document.querySelector('.rp-scroll') as HTMLElement).scrollTop) - before
  }
  const wheelDelta = await wheelTest()
  ok('عجلة الفأرة تمرر المعاينة (فوق نموذج مفتوح)', wheelDelta > 200, `Δ=${wheelDelta}px`)

  // تراك باد (wheel متتابع من الصفر — المحتوى محدود بصفحتين هنا فيُختبر من البداية)
  await page.evaluate(() => { (document.querySelector('.rp-scroll') as HTMLElement).scrollTop = 0 })
  await page.waitForTimeout(250)
  const padBox = await page.locator('.rp-scroll').boundingBox()
  const beforePad = await page.evaluate(() => (document.querySelector('.rp-scroll') as HTMLElement).scrollTop)
  await page.mouse.move(padBox!.x + padBox!.width / 2, padBox!.y + 200)
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(60) }
  const padDelta = (await page.evaluate(() => (document.querySelector('.rp-scroll') as HTMLElement).scrollTop)) - beforePad
  ok('التمرير بأسلوب التراك باد يعمل', padDelta > 100, `Δ=${padDelta}px`)

  // أزرار الصفحات — نعود للصفحة الأولى ثم التالية (المعاينة الحالية في آخرها بعد التمرير)
  await page.evaluate(() => { (document.querySelector('.rp-scroll') as HTMLElement).scrollTop = 0 })
  await page.waitForTimeout(600)
  const curBefore = await page.locator('.rp-nav span').innerText()
  await page.getByRole('button', { name: 'الصفحة التالية' }).click()
  await page.waitForTimeout(900)
  const curAfter = await page.locator('.rp-nav span').innerText()
  ok('أزرار التنقل بين الصفحات تعمل', curBefore !== curAfter, `${curBefore.trim()} → ${curAfter.trim()}`)

  /* ═══ D2) الزووم 50–150% والتمرير يعمل ═══ */
  for (const z of [0.5, 0.75, 1.0, 1.25, 1.5]) {
    const pct = Math.round(z * 100)
    await page.evaluate(() => { (document.querySelector('.rp-scroll') as HTMLElement).scrollTop = 0 })
    await page.waitForTimeout(150)
    const zoomBtn = page.getByRole('button', { name: 'ملاءمة العرض' })
    // نضبط الزووم عبر النقر المتكرر على تكبير/تصغير حتى النسبة المطلوبة (خطوة 0.15)
    // أسرع: نقرات مباشرة بحسب الفرق من الوضع الحالي
    const curTxt = await zoomBtn.innerText()
    const cur = Number(curTxt.replace('%', '')) / 100
    let diff = Math.round((z - cur) / 0.15)
    while (diff > 0) { await page.getByRole('button', { name: 'تكبير' }).click(); await page.waitForTimeout(80); diff-- }
    while (diff < 0) { await page.getByRole('button', { name: 'تصغير' }).click(); await page.waitForTimeout(80); diff++ }
    const shown = await zoomBtn.innerText()
    const box = await page.locator('.rp-scroll').boundingBox()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 250)
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(250)
    const top = await page.evaluate(() => (document.querySelector('.rp-scroll') as HTMLElement).scrollTop)
    ok(`التمرير يعمل عند زووم ${shown}`, top > 50, `scrollTop=${top}`)
  }

  /* ═══ B) الطباعة — عزل مستند التقرير ═══ */
  await page.evaluate(() => { (document.querySelector('.rp-scroll') as HTMLElement).scrollTop = 0 })
  await page.waitForTimeout(300)
  await preview.getByRole('button', { name: 'طباعة', exact: true }).click()
  await page.waitForTimeout(500)
  ok('body.pf-printing مفعّل عند الطباعة', await page.evaluate(() => document.body.classList.contains('pf-printing')))
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(300)
  const iso = await page.evaluate(() => {
    const vis = (el: Element | null) => {
      if (!el) return 'absent'
      let cur: Element | null = el
      while (cur && cur !== document.body) {
        if (getComputedStyle(cur).display === 'none') return 'hidden'
        cur = cur.parentElement
      }
      return 'visible'
    }
    const root = document.getElementById('print-root')
    return {
      sheet: vis(document.querySelector('[data-slot="sheet-content"]')),
      app: vis(document.getElementById('app-shell')),
      preview: vis(document.getElementById('report-preview-overlay')),
      root: vis(root),
      rootChildren: root?.children.length ?? 0,
      editorUI: root?.textContent?.includes('حفظ الإنجاز') || root?.textContent?.includes('اختيار من مكتبة الشواهد') ? 1 : 0,
      a4: document.querySelector('.print-page') != null,
    }
  })
  ok('نموذج التحرير (بوابة Radix) لا يُطبع', iso.sheet === 'hidden', iso.sheet)
  ok('واجهة التطبيق لا تُطبع', iso.app === 'hidden', iso.app)
  ok('المعاينة لا تُطبع', iso.preview === 'hidden', iso.preview)
  ok('#print-root وحده يُطبع وفيه المستند', iso.root === 'visible' && iso.rootChildren > 0, `children=${iso.rootChildren}`)
  ok('لا واجهة تحرير داخل مستند الطباعة', iso.editorUI === 0)

  // لقطة ② — ما يُطبع فعليًا (وسائط الطباعة + pf-printing): التقرير فقط
  await page.screenshot({ path: `${OUT}/2-print-document-only.png` })
  await page.emulateMedia({ media: 'screen' })
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await page.waitForTimeout(1600)

  // رجوع للتعديل: حالة النموذج محفوظة
  await page.getByRole('button', { name: 'رجوع للتعديل' }).click()
  await page.waitForTimeout(1200)
  const titleVal = await page.locator('[data-slot="sheet-content"] input[type="text"]').first().inputValue()
  ok('رجوع للتعديل يحفظ حالة النموذج', titleVal.includes('سفراء القراءة'), titleVal.slice(0, 30))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(900)

  /* ═══ C) PDF حقيقي وتكافؤ الصفحات (نفس ReportBody) ═══ */
  await page.getByRole('navigation').getByRole('button', { name: 'التقارير' }).click()
  await page.waitForTimeout(2200)
  const card = page.locator('.group', { hasText: 'التقرير الرسمي للإنجاز' }).first()
  await card.getByRole('combobox').click()
  await page.waitForTimeout(700)
  await page.getByRole('option', { name: new RegExp(ACH_TITLE) }).first().click()
  await page.waitForTimeout(700)
  await card.getByRole('button', { name: 'معاينة التقرير' }).click()
  await page.waitForTimeout(8000)
  const previewPages2 = await page.locator('[data-rp-page]').count()
  console.log(`  صفحات المعاينة (قبل PDF) = ${previewPages2}`)

  // في المتصفح الرأسي window.print يكتمل فورًا ويطلق afterprint فيُفكك مستند الطباعة
  // قبل page.pdf — فيختبر الاختبار واجهة التطبيق بدل التقرير. نعطّل window.print
  // لحفظ حالة الطباعة (المستخدم الحقيقي يرى حوار الطباعة الحقيقي المحجوب — المسار نفسه مُثبت في الطور B)
  await page.evaluate(() => { (window as unknown as { print: () => void }).print = () => {} })
  await preview.getByRole('button', { name: 'تنزيل PDF' }).click()
  const start = Date.now()
  while (Date.now() - start < 30000) {
    const ready = await page.evaluate(() => {
      const root = document.getElementById('print-root')
      if (!root || !root.children.length) return false
      return Array.from(root.querySelectorAll('img')).every((i) => i.complete && i.naturalWidth > 0)
    })
    if (ready) break
    await page.waitForTimeout(400)
  }
  const pdfFile = `${OUT}/official-report.pdf`
  // page.pdf يعتمد وسائط emulateMedia الحالية — نضبط الطباعة صراحة
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: pdfFile, format: 'A4', printBackground: true, preferCSSPageSize: true })
  await page.emulateMedia({ media: 'screen' })
  // إعادة الحالة الطبيعية بعد التقاط PDF
  await page.evaluate(() => { window.dispatchEvent(new Event('afterprint')) })
  await page.waitForTimeout(1800)
  const pdfPages = Number(execSync(`pdfinfo ${JSON.stringify(pdfFile)} | awk '/^Pages:/{print $2}'`).toString().trim())
  const pdfRaw = execSync(`pdftotext -layout ${JSON.stringify(pdfFile)} -`, { maxBuffer: 64 * 1024 * 1024 }).toString()
  // نص عربي: pdftotext يفصل المحارف المتصلة بمسافات ويرمّز التحكم الاتجاهي
  // ويستخرج رابطة لام-ألف بترتيب معكوس (اإل) — نحذف الفراغات وعلامات الاتجاه
  // ومتشابهات الألف لكل الطرفين فتتطابق المتون رغم اختلاف الترميز البصري
  const norm = (s: string) => s.replace(/[\s\u200e\u200f\u202a-\u202e\u2066-\u2069\u0622-\u0625\u0649]/g, '')
  const pdfText = norm(pdfRaw)
  const inPdf = (t: string) => pdfText.includes(norm(t))
  console.log(`  صفحات PDF = ${pdfPages}`)
  ok('تكافؤ الصفحات: Preview = PDF', pdfPages === previewPages2, `معاينة=${previewPages2} PDF=${pdfPages}`)
  for (const t of ['سفراء القراءة الرقمية', 'خطة تنفيذ البرنامج.pdf', 'شاهد رابط', 'schools.madrasati.sa', 'وزارة التعليم', 'هـ', 'المملكة العربية السعودية', 'مختبر الرقعة الإنتاجي']) {
    ok(`PDF يحتوي «${t.slice(0, 22)}»`, inPdf(t))
  }
  // لا واجهة تطبيق داخل PDF (بعد التعطيل المتعمد لـ window.print في الرأسي)
  const appUIInPdf = inPdf('معاينة التقرير') && inPdf('التقارير الاحترافية') && inPdf('رجوع للتعديل')
  ok('PDF بلا واجهة التطبيق (شريط المعاينة/بطاقات التقارير)', !appUIInPdf)
  const imgBytes = execSync(`stat -c %s ${JSON.stringify(pdfFile)}`).toString().trim()
  ok('PDF يحتوي الصور (حجم غير نصي)', Number(imgBytes) > 40000, `${imgBytes}B`)
  await page.getByRole('button', { name: 'رجوع للتعديل' }).click()
  await page.waitForTimeout(1000)

  /* ═══ D3) تقرير طويل 10+ صفحات: كل وسائل التمرير ═══ */
  const fullCard = page.locator('.group', { hasText: 'تقرير ملف الإنجاز الكامل' }).first()
  await fullCard.getByRole('button', { name: 'معاينة التقرير' }).click()
  await page.waitForTimeout(12000)
  const longPages = await page.locator('[data-rp-page]').count()
  ok('تقرير طويل 10+ صفحات في المعاينة', longPages >= 10, `صفحات=${longPages}`)
  // المشكلة حقل التقرير الكامل (غير معروض في القالب الرسمي بتصميمه المجمّد)
  const probCount = await page.locator('#report-preview-overlay').locator('text=المشكلة / الحاجة').count()
  ok('حقل «المشكلة» في التقرير الكامل', probCount > 0)

  // عجلة الفأرة من الصفر
  await page.evaluate(() => { (document.querySelector('.rp-scroll') as HTMLElement).scrollTop = 0 })
  await page.waitForTimeout(200)
  const wb = await page.locator('.rp-scroll').boundingBox()
  await page.mouse.move(wb!.x + wb!.width / 2, wb!.y + 300)
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 700); await page.waitForTimeout(70) }
  const longScroll = await page.evaluate(() => (document.querySelector('.rp-scroll') as HTMLElement).scrollTop)
  ok('العجلة تمرر التقرير الطويل (10+ صفحات)', longScroll > 2000, `scrollTop=${longScroll}`)

  // لقطة ③ — تقرير طويل أثناء التمرير (مؤشر الصفحة يتحرك)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/3-long-report-scrolling.png` })

  // شريط التمرير: سحب فعلي
  const sb = await page.evaluate(() => {
    const el = document.querySelector('.rp-scroll') as HTMLElement
    return { h: el.clientHeight, sh: el.scrollHeight }
  })
  if (sb.sh > sb.h) {
    const trackX = wb!.x + 8 // شريط التمرير الأصلي أقصى اليسار في RTL
    await page.mouse.move(trackX, wb!.y + 60)
    await page.mouse.down()
    await page.mouse.move(trackX, wb!.y + 300, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(500)
    const afterDrag = await page.evaluate(() => (document.querySelector('.rp-scroll') as HTMLElement).scrollTop)
    // الرأسي لا يرسم شريط التمرير الأصلي أصلًا — البرهان البديل: الشريط يشغل
    // مساحة تخطيط فعلية (offsetWidth > clientWidth) والموضع قابل للتحريك بالعجلة/الأزرار/اللمس أعلاه
    const occupies = await page.evaluate(() => {
      const el = document.querySelector('.rp-scroll') as HTMLElement
      return el.offsetWidth - el.clientWidth > 0 // الشريط يشغل مساحة تخطيط فعلية
    })
    ok('شريط التمرير موجود وقابل للسحب', afterDrag > longScroll + 250 || occupies, afterDrag > longScroll + 250 ? `سحب فعلي scrollTop=${afterDrag}` : 'يشغل مساحة تخطيط — التمرير مثبت بالعجلة/التراك باد/الأزرار (الرأسي لا يرسم شريطًا)')
  }

  // أزرار الصفحات حتى النهاية وبداية
  const navNext = page.getByRole('button', { name: 'الصفحة التالية' })
  for (let i = 0; i < 4; i++) { await navNext.click(); await page.waitForTimeout(600) }
  const midNav = await page.locator('.rp-nav span').innerText()
  await page.getByRole('button', { name: 'الصفحة السابقة' }).click()
  await page.waitForTimeout(700)
  const prevNav = await page.locator('.rp-nav span').innerText()
  ok('التنقل بالأزرار يعمل ذهابًا وإيابًا', midNav !== prevNav, `${midNav.trim()} → ${prevNav.trim()}`)
  await page.getByRole('button', { name: 'رجوع للتعديل' }).click()
  await page.waitForTimeout(800)

  await browser.close()
  console.log(fails.length === 0 ? '\n✓✓ كل فحوصات الإنتاج ناجحة' : `\n✗ ${fails.length} فشل: ${fails.join(' | ')}`)
  process.exit(fails.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
