// ═══ QA الجوال + رجريشن المساعد الذكي على Production ═══
// 320/360/375/390/412: صفر تجاوز أفقي + أزرار AI ظاهرة + معاينة بشواهدها
// + مسار Groq حقيقي كامل (زر → اقتراح → إلغاء يحفظ النص الأصلي)
import { chromium } from 'playwright'

const BASE = 'https://teacher-portfolio-sultans-projects-bce2ab1d.vercel.app'
const EMAIL = process.env.QA_EMAIL || ''
const PASSWORD = process.env.QA_PASSWORD || ''

const fails: string[] = []
const ok = (name: string, cond: boolean, extra = '') => {
  console.log(`  ${cond ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) fails.push(name)
}

async function main() {
  const browser = await chromium.launch()

  /* ── الجوال: كل المقاسات ── */
  for (const w of [320, 360, 375, 390, 412]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 780 }, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
    })
    const page = await ctx.newPage()
    await page.goto(BASE)
    await page.getByLabel('البريد الإلكتروني').fill(EMAIL)
    await page.locator('#login-password').fill(PASSWORD)
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
    await page.waitForTimeout(3200)

    // تجاوز أفقي في التطبيق
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    ok(`[${w}px] صفر تجاوز أفقي (التطبيق)`, overflow <= 1, `Δ=${overflow}px`)

    // نموذج الإنجاز الموجود (بشواهده) من قسم المبادرات — أزرار AI ظاهرة بلا فيض
    await page.getByRole('navigation').getByRole('button', { name: 'ملف إنجازي' }).first().click()
    await page.waitForTimeout(2000)
    await page.getByRole('link', { name: 'المبادرات' }).first().click().catch(async () => {
      await page.locator('text=المبادرات').first().click()
    })
    await page.waitForTimeout(1600)
    await page.locator('[aria-label*="سفراء القراءة"]').first().click()
    await page.waitForTimeout(1600)
    const aiChips = await page.locator('[data-slot="sheet-content"] button[aria-label*="اقتراح"], [data-slot="sheet-content"] button[aria-label*="تحسين"]').count()
    ok(`[${w}px] أزرار المساعد الذكي ظاهرة بالنموذج`, aiChips >= 5, `أزرار=${aiChips}`)

    // المعاينة: قسم الشواهد + الصور
    await page.evaluate(() => {
      const sc = document.querySelector('[data-slot="sheet-content"]')
      sc?.scrollTo(0, sc.scrollHeight)
    })
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'معاينة', exact: true }).click()
    await page.waitForTimeout(7000)
    const evSection = await page.locator('#report-preview-overlay').locator('text=صور من التنفيذ').count()
    const evImgs = await page.locator('#report-preview-overlay [data-rp-page] img').count()
    ok(`[${w}px] المعاينة تعرض قسم الشواهد وصورها`, evSection > 0 && evImgs >= 2, `قسم=${evSection} صور=${evImgs}`)
    const pOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    ok(`[${w}px] صفر تجاوز أفقي (المعاينة)`, pOverflow <= 1, `Δ=${pOverflow}px`)
    if (w === 375) {
      await page.screenshot({ path: '/home/z/my-project/download/production-print-patch/4-mobile-375-preview.png' })
    }
    await ctx.close()
  }

  /* ── المساعد الذكي: مسار Groq حقيقي كامل ── */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.getByLabel('البريد الإلكتروني').fill(EMAIL)
  await page.locator('#login-password').fill(PASSWORD)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForTimeout(3200)
  await page.getByRole('navigation').getByRole('button', { name: 'ملف إنجازي' }).first().click()
  await page.waitForTimeout(2200)
  await page.getByRole('link', { name: 'المبادرات' }).first().click().catch(async () => {
    await page.locator('text=المبادرات').first().click()
  })
  await page.waitForTimeout(1800)
  await page.locator('[aria-label*="سفراء القراءة"]').first().click()
  await page.waitForTimeout(1800)

  // حقل النتائج فيه نص → زر «تحسين» — نفتح نافذة المساعد وننتظر اقتراح Groq الفعلي
  const before = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[data-slot="sheet-content"] textarea')) as HTMLTextAreaElement[]
    const results = els.find((e) => (e.value ?? '').includes('أسهم التنفيذ'))
    return results?.value ?? ''
  })
  const aiBtn = page.locator('[data-slot="sheet-content"] button[aria-label*="النتائج"]').first()
  await aiBtn.click()
  await page.waitForTimeout(1000)
  // نافذة المساعد — انتظر ظهور نص الاقتراح (Groq حقيقي عبر الإنتاج)
  let suggestion = ''
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000)
    suggestion = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"][data-state="open"]')
      return dlg?.textContent?.slice(0, 400) ?? ''
    })
    if (suggestion && !suggestion.includes('جارٍ') && suggestion.length > 120) break
  }
  ok('مساعد Groq الحقيقي يولّد اقتراحًا (حقل النتائج)', suggestion.length > 120, `${suggestion.length} حرفًا`)
  // إلغاء يحفظ النص الأصلي — زر الإلغاء داخل النافذة (Escape يغلق النموذج نفسه)
  await page.getByRole('dialog').getByRole('button', { name: 'إلغاء', exact: true }).click()
  await page.waitForTimeout(800)
  const after = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[data-slot="sheet-content"] textarea')) as HTMLTextAreaElement[]
    return els.find((e) => (e.value ?? '').includes('أسهم التنفيذ'))?.value ?? '__MISSING__'
  })
  ok('إلغاء المساعد يحفظ النص الأصلي', before === after, `${after.length} حرفًا كما هي`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(700)

  await browser.close()
  console.log(fails.length === 0 ? '\n✓✓ كل فحوصات الجوال والمساعد ناجحة' : `\n✗ ${fails.length} فشل: ${fails.join(' | ')}`)
  process.exit(fails.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
