/**
 * QA الجوال — مصفوفة مقاسات × شاشات ضد فرع الدمج (:3100)
 * ─────────────────────────────────────────────────────────────
 * لكل مقاس (320/360/375/390/412) × لكل شاشة أساسية (اللوحة، ملف الإنجاز،
 * الإطار المهني، الشواهد، التقارير، الرحلة المهنية): لا تجاوز أفقي إطلاقًا.
 * + شريط التنقل السفلي ظاهر والأزرار ≥40px تقريبًا.
 */
import { chromium } from 'playwright'

const BASE = process.env.TEST_BASE || 'http://localhost:3100'

interface TestResult { name: string; pass: boolean; detail: string }
const results: TestResult[] = []
const check = (name: string, pass: boolean, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const VIEWPORTS: [number, number, string][] = [
  [320, 660, '320'],
  [360, 800, '360'],
  [375, 812, '375'],
  [390, 844, '390'],
  [412, 892, '412'],
]

const NAV_BUTTONS = ['الرئيسية', 'ملف الإنجاز', 'الإطار المهني', 'الشواهد', 'التقارير', 'رحلتي المهنية'] as const

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } })
  const page = await ctx.newPage()

  // دخول سلطان (بيانات غنية)
  await page.goto(BASE)
  await page.getByLabel('البريد الإلكتروني').fill('sultan@madrasati.sa')
  await page.locator('#login-password').fill(process.env.TEACHER_PASSWORD ?? 'teacher123')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForTimeout(3500)
  const loginOk = await page.getByText(/(صباح|مساء) الخير/).first().isVisible().catch(() => false)
  check('دخول سلطان (تحية اللوحة ظاهرة)', loginOk)

  // الشاشة الأولى (تسجيل الدخول) بكل المقاسات — بجلسة خروج؟ لا: نقيسها قبل الدخول لاحقًا عبر سياق جديد
  for (const [w, h, label] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(1200)
    for (const btnText of NAV_BUTTONS) {
      // النقر عبر JS: طبقة nextjs-dev-overlay (خاصة وضع التطوير فقط) تعترض نقاط البروتوكول
      // على الجوال — لا وجود لها في بناء الإنتاج؛ والقياس نفسه (scrollWidth) لا تتأثر بها.
      await page.evaluate((t) => {
        const nav = document.querySelector('nav[aria-label="التنقل السفلي"]')
        const btn = Array.from(nav?.querySelectorAll('button') ?? []).find((b) => (b.textContent ?? '').includes(t))
        ;(btn as HTMLElement | undefined)?.click()
      }, btnText)
      await page.waitForTimeout(1500)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      check(`جوال ${label}px — ${btnText} بلا تجاوز أفقي`, overflow <= 0, `overflow=${overflow}px`)
    }
  }

  // شريط التنقل السفلي: ظاهر على الجوال وأزراره بحجم لمس مناسب
  await page.setViewportSize({ width: 360, height: 800 })
  await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="التنقل السفلي"]')
    const btn = Array.from(nav?.querySelectorAll('button') ?? []).find((b) => (b.textContent ?? '').includes('الرئيسية'))
    ;(btn as HTMLElement | undefined)?.click()
  })
  await page.waitForTimeout(1200)
  const navInfo = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="التنقل السفلي"]')
    if (!nav) return { exists: false }
    const btns = Array.from(nav.querySelectorAll('button')).map((b) => {
      const r = (b as HTMLElement).getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height) }
    })
    return { exists: true, count: btns.length, minH: Math.min(...btns.map((b) => b.h)), minW: Math.min(...btns.map((b) => b.w)) }
  })
  check('شريط التنقل السفلي ظاهر على الجوال', Boolean(navInfo.exists && navInfo.count >= 4), `أزرار=${navInfo.count}`)
  if (navInfo.exists && navInfo.count) {
    check('أزرار اللمس بارتفاع مناسب (≥48px)', (navInfo.minH ?? 0) >= 48, `أصغر ارتفاع=${navInfo.minH}px`)
  }

  // كونسول نظيف عبر الجولة
  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log('\n══════════ الخلاصة ══════════')
  console.log(`${results.length - failed.length}/${results.length} ناجحًا${failed.length ? `\nفشل: ${failed.map((f) => `${f.name} (${f.detail})`).join('\n      ')}` : ''}`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => { console.error('QA CRASH:', e); process.exit(1) })
