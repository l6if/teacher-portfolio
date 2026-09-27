// ═══ إثبات إصلاح اللمس على مستوى سلسلة الأحداث ═══
// نستنسخ مستمع react-remove-scroll الحقيقي على مستوى المستند (passive:false
// + preventDefault لأي حدث خارج محتوى الورقة) ثم نطلق أحداث touchmove حقيقية:
//   1) داخل المعاينة (فوق نموذج مفتوح) → يجب ألا تُلغى (الإصلاح قطع انتشارها)
//   2) على خلفية التطبيق → تُلغى (يثبت أن النسخة تعمل كما المكتبة)
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:3000'

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.getByLabel('البريد الإلكتروني').fill('qa-patch-local@school.sa')
  await page.locator('#login-password').fill('QaPatch!2026')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForTimeout(3000)

  // نموذج مفتوح (قفل Radix/react-remove-scroll نشط) ثم معاينة فوقه
  await page.getByRole('button', { name: 'إضافة إنجاز' }).first().click()
  await page.waitForTimeout(800)
  await page.locator('button', { hasText: 'مبادرة' }).last().click({ force: true, timeout: 8000 })
  await page.waitForTimeout(900)
  // عنوان → إنشاء المسودة حتى تظهر أزرار إجراءات التقرير أسفل النموذج
  await page.locator('[data-slot="sheet-content"] input[type="text"]').first().fill('اختبار سلسلة اللمس')
  await page.waitForTimeout(2600)
  await page.evaluate(() => {
    const sc = document.querySelector('[data-slot="sheet-content"]')
    sc?.scrollTo(0, sc.scrollHeight)
  })
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'معاينة', exact: true }).click()
  await page.waitForTimeout(6000)

  // مستمع مطابق لـ react-remove-scroll على المستند (فقاعة، غير سلبي)
  await page.evaluate(() => {
    ;(window as any).__lock = { preview: 'n/a', background: 'n/a' }
    const isLocked = () => document.querySelector('[data-slot="sheet-content"]') != null
    document.addEventListener(
      'touchmove',
      (e) => {
        const target = e.target as HTMLElement
        const inDialog = document.querySelector('[data-slot="sheet-content"]')?.contains(target)
        // نفس منطق المكتبة: خارج محتوى الورقة → preventDefault (noIsolation=false)
        if (isLocked() && !inDialog) e.preventDefault()
      },
      { passive: false },
    )
    window.addEventListener('touchmove', () => {
      const e = window.event as Event
      ;(window as any).__lock.lastDefaultPrevented = e.defaultPrevented
    }, true)
  })

  const fire = async (selector: string) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement
      const ev = new TouchEvent('touchmove', {
        bubbles: true, cancelable: true,
        touches: [new Touch({ identifier: 1, target: el, clientX: 100, clientY: 200, radiusX: 2, radiusY: 2, rotationAngle: 0, force: 1 })],
      })
      el.dispatchEvent(ev)
      return ev.defaultPrevented
    }, selector)

  const previewPrevented = await fire('.rp-scroll')
  const backgroundPrevented = await fire('#app-shell')

  console.log(`touchmove داخل المعاينة: defaultPrevented = ${previewPrevented} (المطلوب: false)`)
  console.log(`touchmove على الخلفية:   defaultPrevented = ${backgroundPrevented} (يثبت عمل النسخة: true)`)
  const pass = previewPrevented === false && backgroundPrevented === true
  console.log(pass ? '✓✓ الإصلاح يعمل: اللمس داخل المعاينة يمر حرًا والخلفية مقفلة' : '✗ فشل')
  await browser.close()
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
