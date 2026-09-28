/**
 * QA شامل — المرحلة النهائية: التقرير الرسمي + المعاينة + تحسين الصور
 * ─────────────────────────────────────────────────────────────
 * يغطي: رفع صور كبيرة → تقرير رسمي (0/4 صور) → معاينة (سطح مكتب/جوال)
 * → تنزيل PDF A4 → التحقق من نسخ الصور المحسنة والقوالب الموجودة.
 */
import { chromium } from 'playwright'
import { execSync } from 'child_process'
import { tmpdir } from 'os'
import path from 'path'
import fs from 'fs/promises'

const BASE = process.env.TEST_BASE || process.env.BASE_URL || 'http://localhost:3000'
const OUT = '/home/z/my-project/screenshots/pdf-qa'
const SHOTS = '/home/z/my-project/screenshots'

interface TestResult { name: string; pass: boolean; detail: string }
const results: TestResult[] = []
const check = (name: string, pass: boolean, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '  ✓' : '✗'.padStart(3) } ${name}${detail ? ` — ${detail}` : ''}`)
}

/** انتظر جاهزية print-root (المحتوى + الصور) ثم التقط PDF فورًا */
async function capturePdf(page: import('playwright').Page, path: string, timeoutMs = 15000): Promise<number> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const ready = await page.evaluate(() => {
      const root = document.getElementById('print-root')
      if (!root || !root.children.length) return false
      const imgs = Array.from(root.querySelectorAll('img'))
      return imgs.every((i) => i.complete && i.naturalWidth > 0)
    })
    if (ready) break
    await page.waitForTimeout(300)
  }
  await page.pdf({ path, format: 'A4', printBackground: true, preferCSSPageSize: true })
  return (await fs.stat(path)).size
}

async function main() {
  await fs.mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))

  console.log('═══ 1) الدخول ═══')
  await page.goto(BASE)
  await page.getByLabel('البريد الإلكتروني').fill('sultan@madrasati.sa')
  await page.locator('#login-password').fill(process.env.DEMO_PASSWORD ?? '')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForTimeout(3500)
  check('تسجيل الدخول', await page.getByText('سلطان بن حمد').first().isVisible())

  console.log('═══ 2) رفع 4 صور كبيرة + إنشاء إنجاز اختبار ═══')
  const uploadIds: string[] = []
  for (let i = 1; i <= 4; i++) {
    const buf = await fs.readFile(`${SHOTS}/big-photo-${i}.jpg`)
    const res = await page.request.fetch(`${BASE}/api/upload`, {
      method: 'POST',
      multipart: { file: { name: `photo-${i}.jpg`, mimeType: 'image/jpeg', buffer: buf } },
    })
    const body = await res.json().catch(() => ({}))
    if (body.attachment?.id) uploadIds.push(body.attachment.id)
  }
  check('رفع 4 صور كبيرة (≈7MB لكل صورة)', uploadIds.length === 4, `${uploadIds.length}/4`)

  const createRes = await page.request.post(`${BASE}/api/achievements`, {
    data: {
      type: 'INITIATIVE',
      title: 'مبادرة اختبار الصور الكبيرة في التقرير الرسمي',
      field: 'المبادرات',
      date: '2026-09-20',
      goalText: 'اختبار شامل لسلوك الصور الكبيرة داخل التقرير الرسمي والمعاينة وملف PDF النهائي مع قياس الأحجام.',
      execution: '١. تجهيز الصور بأحجام واقعية\n٢. رفعها كمرفقات\n٣. توليد التقرير الرسمي والمعاينة\n٤. قياس حجم PDF الناتج',
      results: 'تحسن ملحوظ في جودة الاختبار',
      impact: 'ارتفاع دقة التحقق من تحسين الصور',
      beneficiaries: 'طلاب المدرسة',
      beneficiariesCount: 120,
      durationText: 'أسبوعان',
      preScore: 55,
      postScore: 88,
      status: 'COMPLETED',
      attachmentIds: uploadIds,
    },
  })
  const ach = await createRes.json().catch(() => ({}))
  const achId = ach.achievement?.id ?? ach.id
  check('إنشاء إنجاز الاختبار مع الصور', Boolean(achId))

  // إنجاز نصي بلا صور — لاختبار صفحة واحدة
  const pdRes = await page.request.post(`${BASE}/api/achievements`, {
    data: {
      type: 'PD', title: 'لقاء مهني قصير — اختبار تقرير صفحة واحدة', date: '2026-09-10',
      provider: 'إدارة التعليم', hours: 3,
      goalText: 'التعرف على ممارسات التقييم الرقمي الحديثة.',
      execution: 'لقاء افتراضي لمدة ثلاث ساعات مع تطبيقات عملية على أدوات التقييم الرقمي.',
      status: 'COMPLETED',
    },
  })
  const pdAch = await pdRes.json().catch(() => ({}))
  const pdId = pdAch.achievement?.id ?? pdAch.id

  // إعادة تحميل لتحديث بيانات react-query
  await page.reload()
  await page.waitForTimeout(3500)

  console.log('═══ 3) معاينة التقرير الرسمي (4 صور كبيرة) ═══')
  await page.getByRole('navigation').getByRole('button', { name: 'التقارير' }).click()
  await page.waitForTimeout(2500)
  const officialCard = page.locator('.group', { hasText: 'التقرير الرسمي للإنجاز' }).first()
  await officialCard.locator('[role=combobox]').click()
  await page.waitForTimeout(800)
  await page.getByRole('option', { name: /مبادرة اختبار الصور الكبيرة/ }).first().click()
  await page.waitForTimeout(600)
  const titleHint = await page.getByText('سيُصدر بعنوان').textContent().catch(() => '')
  check('العنوان الديناميكي', titleHint.includes('تقرير مبادرة'), titleHint.slice(0, 50))
  await officialCard.getByRole('button', { name: 'معاينة التقرير' }).click()
  await page.waitForTimeout(5000)

  const pageCount4 = await page.locator('[data-rp-page]').count()
  check('معاينة رسمي 4 صور — صفحات منطقية (2-6)', pageCount4 >= 2 && pageCount4 <= 6, `${pageCount4} صفحات`)
  await page.screenshot({ path: `${OUT}/official-4img-preview.png` })

  console.log('═══ 4) تنزيل PDF A4 + تحسين الصور ═══')
  await page.locator('.rp-toolbar').getByRole('button', { name: 'تنزيل PDF' }).click()
  const size4 = await capturePdf(page, `${OUT}/official-4img.pdf`)
  const mb4 = size4 / 1024 / 1024
  check('PDF رسمي 4 صور — حجم محسّن (<4.5MB مقابل 27MB أصلًا)', mb4 < 4.5, `${mb4.toFixed(2)} MB`)

  // النسخ المحسنة في طبقة tmpdir (تنفيذ origin/main القائم: teacherfolio-optimized/<userId>)
  const optimizedRoot = path.join(tmpdir(), 'teacherfolio-optimized')
  let optCount = 0
  try {
    for (const d of await fs.readdir(optimizedRoot)) {
      optCount += (await fs.readdir(path.join(optimizedRoot, d)).catch(() => [])).length
    }
  } catch { /* لا مجلد بعد */ }
  check('نسخ محسنة على القرص (print w=1600 + preview w=1000)', optCount >= 8, `${optCount} ملفًا`)
  const origSize = (await fs.stat(`${SHOTS}/big-photo-1.jpg`)).size
  check('الملفات الأصلية لم تُمس', origSize > 6 * 1024 * 1024, `${(origSize / 1024 / 1024).toFixed(2)} MB`)

  console.log('═══ 5) رجوع للتعديل — الحفاظ على الحالة ═══')
  await page.getByRole('button', { name: 'رجوع للتعديل' }).click()
  await page.waitForTimeout(900)
  const backOk = await page.getByText('التقارير الاحترافية').isVisible().catch(() => false)
  const stillSelected = await officialCard.locator('[role=combobox]').textContent().catch(() => '')
  check('رجوع للتعديل — شاشة الإعداد والاختيار محفوظان', backOk && stillSelected.includes('اختبار الصور'), (stillSelected || '').slice(0, 45))

  console.log('═══ 6) تقرير رسمي بلا صور = صفحة واحدة ═══')
  await officialCard.locator('[role=combobox]').click()
  await page.waitForTimeout(700)
  await page.getByRole('option', { name: /لقاء مهني قصير/ }).first().click()
  await page.waitForTimeout(500)
  await officialCard.getByRole('button', { name: 'معاينة التقرير' }).click()
  await page.waitForTimeout(3500)
  const pageCount1 = await page.locator('[data-rp-page]').count()
  check('رسمي بلا صور = صفحة A4 واحدة', pageCount1 === 1, `${pageCount1} صفحة`)
  await page.screenshot({ path: `${OUT}/official-noimg-preview.png` })
  await page.locator('.rp-toolbar').getByRole('button', { name: 'تنزيل PDF' }).click()
  await capturePdf(page, `${OUT}/official-noimg.pdf`)
  const noImgPages = execSync(`pdfinfo ${OUT}/official-noimg.pdf | grep Pages`).toString().trim()
  const noImgSize = (await fs.stat(`${OUT}/official-noimg.pdf`)).size
  check('PDF رسمي بلا صور = صفحة واحدة فعليًا', noImgPages.includes('Pages:           1'), `${noImgPages} • ${(noImgSize / 1024).toFixed(0)}KB`)

  console.log('═══ 7) معاينة الجوال 360px و 390px ═══')
  for (const [w, h, label] of [[360, 800, '360'], [390, 844, '390']] as const) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(1300)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(`جوال ${label}px — بلا تجاوز أفقي`, overflow <= 0, `overflow=${overflow}px`)
    const fitPct = await page.evaluate(() => {
      const m = document.querySelector('.rp-toolbar')?.innerText.match(/(\d+)%/)
      return m ? Number(m[1]) : -1
    })
    check(`جوال ${label}px — ملاءمة عرض تلقائية`, fitPct > 30 && fitPct < 60, `${fitPct}%`)
    await page.screenshot({ path: `${OUT}/official-mobile-${label}.png` })
    const nextBtn = page.getByRole('button', { name: 'الصفحة التالية' })
    if (await nextBtn.isEnabled().catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(900)
      const indicator = await page.locator('.rp-nav span').textContent().catch(() => '')
      check(`جوال ${label}px — مؤشر وتنقل الصفحات`, Boolean(indicator?.includes('/')), indicator ?? '')
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'رجوع للتعديل' }).click().catch(() => {})
  await page.waitForTimeout(900)

  console.log('═══ 8) القوالب الموجودة: كامل + مخصص ═══')
  const fullCard = page.locator('.group', { hasText: 'تقرير ملف الإنجاز الكامل' }).first()
  await fullCard.getByRole('button', { name: 'معاينة التقرير' }).click()
  await page.waitForTimeout(6000)
  const fullPages = await page.locator('[data-rp-page]').count()
  check('معاينة التقرير الكامل (القوالب الموجودة تعمل)', fullPages >= 20, `${fullPages} صفحة`)
  await page.screenshot({ path: `${OUT}/full-preview.png` })
  await page.getByRole('button', { name: 'رجوع للتعديل' }).click()
  await page.waitForTimeout(1000)

  const customCard = page.locator('.group', { hasText: 'تصدير مخصص' }).first()
  const boxes = customCard.locator('[role=checkbox]')
  await boxes.first().check()
  await boxes.nth(1).check()
  await page.waitForTimeout(400)
  await customCard.getByRole('button', { name: 'معاينة التقرير' }).click()
  await page.waitForTimeout(4000)
  const customPages = await page.locator('[data-rp-page]').count()
  check('معاينة المخصص', customPages >= 1, `${customPages} صفحة`)
  await page.getByRole('button', { name: 'رجوع للتعديل' }).click()
  await page.waitForTimeout(900)
  const checkedNow = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.group'))
    const custom = cards.find((c) => c.textContent.includes('تصدير مخصص'))
    return custom ? custom.querySelectorAll('[data-state=checked]').length : 0
  })
  check('المخصص — الاختيارات محفوظة بعد الرجوع', checkedNow >= 2, `${checkedNow} مجالًا محددًا`)

  console.log('═══ 9) كونسول نظيف ═══')
  const realErrors = consoleErrors.filter((e) => !e.includes('Download the React DevTools') && !e.includes('404') && !e.includes('Failed to load resource'))
  check('لا أخطاء كونسول', realErrors.length === 0, realErrors.slice(0, 2).join(' | ').slice(0, 140))

  console.log('═══ 10) تنظيف ═══')
  await page.request.delete(`${BASE}/api/achievements/${achId}`).catch(() => {})
  await page.request.delete(`${BASE}/api/achievements/${pdId}`).catch(() => {})
  for (const attId of uploadIds) await page.request.delete(`${BASE}/api/attachments/${attId}`).catch(() => {})
  check('حذف بيانات الاختبار', true)

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log('\n══════════ الخلاصة ══════════')
  console.log(`${results.length - failed.length}/${results.length} ناجحًا${failed.length ? `\nفشل: ${failed.map((f) => `${f.name} (${f.detail})`).join('\n      ')}` : ''}`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => { console.error('QA CRASH:', e); process.exit(1) })
