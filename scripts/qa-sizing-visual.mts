/**
 * QA بصري — Evidence Image Sizing (Patch B) في معاينة التقرير الرسمي
 * ─────────────────────────────────────────────────────────────────
 * يثبت أن الصورة بوضع ORIGINAL تُعرض فعلًا أكبر من COMPACT في المعاينة الحقيقية،
 * وأن النسبة الباعية محفوظة (object-fit: contain — لا قص ولا تمديد)،
 * وأن الصورة الطويلة تأخذ صفًّا مستقلًا. يُصدر لقطات دليل.
 */
import { chromium } from 'playwright'
import fs from 'fs/promises'

const BASE = process.env.BASE_URL || 'http://localhost:3100'
const OUT = '/home/z/my-project/screenshots/qa-sizing'
const EMAIL = 'qa-shorten@school.sa'
const PASSWORD = 'QaShorten!2026'

interface TestResult { name: string; pass: boolean; detail: string }
const results: TestResult[] = []
const check = (name: string, pass: boolean, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  await fs.mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))

  console.log('═══ 1) الدخول بمستخدم QA + إكمال بوابة الملف (مستخدم جديد يُوجَّه للملف تلقائيًا) ═══')
  await page.goto(BASE)
  await page.getByLabel('البريد الإلكتروني').fill(EMAIL)
  await page.locator('#login-password').fill(PASSWORD)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForTimeout(3500)
  // بوابة الملف: الاسم والجنس شرط التنقل — نكملهما مرة واحدة عبر API الجلسة نفسها
  const profileRes = await page.request.put(`${BASE}/api/profile`, {
    data: { name: 'معلم اختبار الأحجام', gender: 'MALE' },
  })
  if (profileRes.ok()) {
    await page.reload()
    await page.waitForTimeout(3500)
  }

  console.log('═══ 2) معاينة التقرير الرسمي لإنجاز QA (3 صور متنوعة الأحجام) ═══')
  await page.getByRole('navigation').getByRole('button', { name: 'التقارير' }).click()
  await page.waitForTimeout(2500)
  const officialCard = page.locator('.group', { hasText: 'التقرير الرسمي للإنجاز' }).first()
  await officialCard.locator('[role=combobox]').click()
  await page.waitForTimeout(800)
  await page.getByRole('option', { name: /QA — مبادرة اختبار اختصر وأحجام الصور/ }).first().click()
  await page.waitForTimeout(600)
  await officialCard.getByRole('button', { name: 'معاينة التقرير' }).click()
  // انتظر اكتمال الصور داخل صفحات المعاينة
  await page.waitForFunction(() => {
    const root = document.getElementById('print-root') ?? document.body
    const imgs = Array.from(root.querySelectorAll('img'))
    return imgs.length >= 3 && imgs.every((i) => i.complete && i.naturalWidth > 0)
  }, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)

  const pageCount = await page.locator('[data-rp-page]').count()
  check('المعاينة جاهزة بصفحات منطقية', pageCount >= 1 && pageCount <= 4, `${pageCount} صفحة`)

  // ═══ 3) قياس أبعاد كل صورة — من أول صفحة فقط ═══
  // (بنية المعاينة: كل صفحة A4 نافذة إزاحة على نسخة كاملة من المحتوى —
  //  الأشكال موجودة مرة منطقيًا وتتكرر DOM في كل صفحة، فالقياس من الأولى = الأشكال الفريدة)
  const imgs = await page.evaluate(() => {
    const firstPage = document.querySelector('[data-rp-page]')
    if (!firstPage) return []
    const out: { title: string; w: number; h: number; nw: number; nh: number; rowSiblings: number; objectFit: string; maxWidthPct: number }[] = []
    for (const fig of Array.from(firstPage.querySelectorAll('figure'))) {
      const img = fig.querySelector('img')
      if (!img || !img.naturalWidth) continue
      const r = img.getBoundingClientRect()
      out.push({
        title: fig.querySelector('figcaption')?.textContent?.trim() ?? '(بلا عنوان)',
        w: Math.round(r.width), h: Math.round(r.height),
        nw: img.naturalWidth, nh: img.naturalHeight,
        rowSiblings: fig.parentElement ? fig.parentElement.querySelectorAll('figure').length : 0,
        objectFit: getComputedStyle(img).objectFit,
        maxWidthPct: Math.round((r.width / (firstPage.getBoundingClientRect().width || 1)) * 100),
      })
    }
    return out
  })
  check('الصور الثلاث ظاهرة في المعاينة', imgs.length === 3, `${imgs.length}/3`)
  console.log('  الأبعاد المقاسة (أول صفحة — الأشكال الفريدة):')
  for (const i of imgs) console.log(`   • ${i.title.slice(0, 38)} — عرض=${i.w}px (${i.maxWidthPct}% من الصفحة) ارتفاع=${i.h}px (طبيعي ${i.nw}×${i.nh}) صف=${i.rowSiblings} objectFit=${i.objectFit}`)

  const byTitle = (needle: string) => imgs.find((i) => i.title.includes(needle))
  const compact = byTitle('portrait') // A1 COMPACT (صورة عمودية طويلة → صف مستقل مصغّر)
  const original = byTitle('landscape') // A2 ORIGINAL
  const tall = byTitle('tall') // A3 COMPACT (لقطة شاشة ممتدة)

  if (compact && original && tall) {
    // ORIGINAL أكبر عرضًا من COMPACT بفارق جوهري
    const ratio1 = original.w / compact.w
    check('ORIGINAL أعرض من COMPACT المصغّرة (≥120%)', ratio1 >= 1.2, `${original.w}px مقابل ${compact.w}px (${(ratio1 * 100).toFixed(0)}%)`)
    const ratio2 = original.w / tall.w
    check('ORIGINAL أعرض من اللقطة الطويلة المصغّرة (≥120%)', ratio2 >= 1.2, `${original.w}px مقابل ${tall.w}px (${(ratio2 * 100).toFixed(0)}%)`)
    // الصور الطويلة والأصلية في صفوف مستقلة
    check('ORIGINAL في صف مستقل (بلا اقتران)', original.rowSiblings === 1, `${original.rowSiblings} صورة في الصف`)
    check('اللقطة الطويلة في صف مستقل', tall.rowSiblings === 1, `${tall.rowSiblings} صورة في الصف`)
    // لا قص ولا تمديد: object-fit contain مضمون بنيويًا لكل صورة
    for (const i of [compact, original, tall]) {
      check(`بلا قص ولا تمديد (object-fit: contain) — ${i.title.slice(0, 24)}`, i.objectFit === 'contain', `objectFit=${i.objectFit}`)
    }
    // الحد الأقصى للارتفاع مُطبق: الطويلة لا تتجاوز 108مم (≈408px) في الوضع المصغّر
    check('اللقطة الطويلة (COMPACT) محدودة الارتفاع (≤ ~110مم)', tall.h <= 420 && tall.h > 300, `${tall.h}px`)
  } else {
    check('العثور على الصور الثلاث بأنواعها', false, JSON.stringify(imgs.map((i) => i.title.slice(0, 20))))
  }

  await page.screenshot({ path: `${OUT}/sizing-preview-desktop.png`, fullPage: false })

  // لقطة لصفحة المعرض (الصور تظهر بصريًا في الصفحة 2+ — قياس DOM أعلاه شملها جميعًا)
  const nextBtn = page.getByRole('button', { name: 'الصفحة التالية' })
  if (await nextBtn.isEnabled().catch(() => false)) {
    await nextBtn.click()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/sizing-preview-gallery.png` })
  }

  // ═══ 4) جوال 360px — المعاينة تعمل والأحجام قابلة للتمييز ═══
  await page.setViewportSize({ width: 360, height: 800 })
  await page.waitForTimeout(1500)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('جوال 360px — بلا تجاوز أفقي في المعاينة', overflow <= 0, `overflow=${overflow}px`)
  await page.screenshot({ path: `${OUT}/sizing-preview-mobile.png` })

  const realErrors = consoleErrors.filter((e) => !e.includes('Download the React DevTools') && !e.includes('404') && !e.includes('Failed to load resource'))
  check('لا أخطاء كونسول', realErrors.length === 0, realErrors.slice(0, 2).join(' | ').slice(0, 140))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log('\n══════════ الخلاصة ══════════')
  console.log(`${results.length - failed.length}/${results.length} ناجحًا${failed.length ? `\nفشل: ${failed.map((f) => `${f.name} (${f.detail})`).join('\n      ')}` : ''}`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => { console.error('QA CRASH:', e); process.exit(1) })
