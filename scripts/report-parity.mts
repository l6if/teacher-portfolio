/** تكافؤ التقارير قبل/بعد الترحيل — نفس المعلم + نفس الإنجاز (شرط إلزامي) */
import { chromium } from 'playwright'
import { execSync } from 'child_process'
import { createHash } from 'crypto'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const LABEL = process.argv[2] // before | after | compare
const OUT = '/home/z/my-project/download/report-parity'
const ACH_TITLE = 'خطة علاجية لتنمية مهارة القراءة'

function sha256(b: Buffer | string): string {
  return createHash('sha256').update(b).digest('hex')
}

/** نص PDF مطبّع (مسافات/أسطر موحدة) للمقارنة الوظيفية */
function pdfText(file: string): string {
  try {
    const raw = execSync(`pdftotext -layout ${JSON.stringify(file)} -`, { maxBuffer: 64 * 1024 * 1024 }).toString()
    return raw.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim()
  } catch {
    return ''
  }
}

function pdfPages(file: string): number {
  const info = execSync(`pdfinfo ${JSON.stringify(file)} | grep Pages`).toString()
  return Number(info.replace(/\D+/g, ''))
}

async function apiSnapshot(cookie: string) {
  const res = await fetch(`${BASE}/api/report`, { headers: { cookie } })
  const d = await res.json()
  return {
    user: {
      id: d.user?.id, name: d.user?.name, school: d.user?.school,
      educationAdmin: d.user?.educationAdmin ?? null,
      educationOffice: d.user?.educationOffice ?? null,
      principalName: d.user?.principalName ?? null,
    },
    year: { id: d.year?.id, label: d.year?.label, archived: d.year?.archived },
    completion: d.completion,
    counts: {
      goals: d.goals?.length, achievements: d.achievements?.length,
      attachments: d.attachments?.length, devPlans: d.devPlans?.length,
      links: d.achievements?.reduce((a: number, x: any) => a + (x.links?.length ?? 0), 0),
      reflection: d.reflection ? 1 : 0,
    },
    goals: d.goals?.map((g: any) => ({ id: g.id, title: g.title, startDate: g.startDate, endDate: g.endDate, achCount: g.achievements?.length })),
    achievements: d.achievements?.map((a: any) => ({
      id: a.id, type: a.type, title: a.title, field: a.field ?? null, date: a.date,
      status: a.status, goalId: a.goalId ?? null,
      links: a.links?.map((l: any) => ({ attachmentId: l.attachmentId, url: l.attachment?.url ?? null, kind: l.attachment?.kind })),
      studentsCount: a.studentsCount ?? null, preScore: a.preScore ?? null, postScore: a.postScore ?? null,
    })),
    attachments: d.attachments?.map((a: any) => ({ id: a.id, kind: a.kind, title: a.title, url: a.url ?? null, storagePath: a.storagePath ?? null })),
  }
}

async function previewAndCapture(page: import('playwright').Page, cardText: string, name: string) {
  await page.getByRole('navigation').getByRole('button', { name: 'التقارير' }).click()
  await page.waitForTimeout(2200)
  const card = page.locator('.group', { hasText: cardText }).first()

  if (cardText.includes('الرسمي')) {
    // اختر الإنجاز المستهدف من المنتقي
    await card.getByRole('combobox').click()
    await page.waitForTimeout(700)
    await page.getByRole('option', { name: new RegExp(ACH_TITLE) }).first().click()
    await page.waitForTimeout(700)
  }

  await card.getByRole('button', { name: 'معاينة التقرير' }).click()
  await page.waitForTimeout(7000)
  const previewPages = await page.locator('[data-rp-page]').count()
  const previewImgs = await page.locator('[data-rp-page] img').count()

  await page.getByRole('button', { name: 'تنزيل PDF' }).click()
  const start = Date.now()
  while (Date.now() - start < 25000) {
    const ready = await page.evaluate(() => {
      const root = document.getElementById('print-root')
      if (!root || !root.children.length) return false
      return Array.from(root.querySelectorAll('img')).every((i) => i.complete && i.naturalWidth > 0)
    })
    if (ready) break
    await page.waitForTimeout(400)
  }
  const pdfFile = `${OUT}/${LABEL}-${name}.pdf`
  await page.pdf({ path: pdfFile, format: 'A4', printBackground: true, preferCSSPageSize: true })
  const pages = pdfPages(pdfFile)
  const text = pdfText(pdfFile)
  await page.getByRole('button', { name: 'رجوع للتعديل' }).click()
  await page.waitForTimeout(1000)

  return {
    previewPages, previewImgs, pdfPages: pages,
    pdfTextHash: sha256(text),
    pdfTextLength: text.length,
    hijriMarkers: (text.match(/هـ/g) ?? []).length,
    pdfBytes: execSync(`stat -c %s ${JSON.stringify(pdfFile)}`).toString().trim(),
    textSample: text.slice(0, 400),
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true })

  if (LABEL === 'compare') {
    const before = JSON.parse(readFileSync(`${OUT}/before.json`, 'utf8'))
    const after = JSON.parse(readFileSync(`${OUT}/after.json`, 'utf8'))
    console.log('═══ مقارنة تكافؤ التقارير: قبل الترحيل مقابل بعده ═══\n')
    let diffs = 0
    const compareObj = (a: any, b: any, path = '') => {
      if (a === null && b === null) return
      if (JSON.stringify(a) === JSON.stringify(b)) return
      diffs++
      console.log(`  ⚠ ${path}:\n     قبل: ${JSON.stringify(a)?.slice(0, 160)}\n     بعد: ${JSON.stringify(b)?.slice(0, 160)}`)
    }
    // API snapshot: كل شيء يجب أن يتطابق (نفس البيانات المُرحّلة)
    for (const k of Object.keys(before.api)) {
      if (k === 'user') { for (const uk of Object.keys(before.api.user)) compareObj(before.api.user[uk], after.api.user[uk], `api.user.${uk}`) }
      else compareObj(before.api[k], after.api[k], `api.${k}`)
    }
    console.log(before.api ? (diffs === 0 ? '  ✓ لقطة بيانات API متطابقة تمامًا (معرفات، تواريخ، علاقات، روابط شواهد)' : '') : '')
    // التقارير
    for (const rep of ['official', 'full']) {
      const b = before[rep], a = after[rep]
      if (!b || !a) { console.log(`  ⚠ ${rep}: لقطة ناقصة`); diffs++; continue }
      const fields = ['previewPages', 'previewImgs', 'pdfPages', 'hijriMarkers']
      const mism = fields.filter((f) => b[f] !== a[f])
      if (mism.length === 0 && b.pdfTextHash === a.pdfTextHash) {
        console.log(`  ✓ ${rep === 'official' ? 'التقرير الرسمي' : 'التقرير الكامل'}: وظيفيًا متطابق (صفحات ${b.pdfPages}=${a.pdfPages}، صور ${b.previewImgs}=${a.previewImgs}، هجري ${b.hijriMarkers}=${a.hijriMarkers}، نص PDF متطابق)`)
      } else {
        diffs++
        console.log(`  ⚠ ${rep}: فروق في ${mismatchList(b, a, mism)}`)
        if (b.pdfTextHash !== a.pdfTextHash) {
          console.log(`     نص PDF قبل: ${b.pdfTextLength} حرفًا / بعد: ${a.pdfTextLength} حرفًا`)
          // أظهر أول اختلاف في النص
          const tb = readTextSample(b), ta = readTextSample(a)
          if (tb && ta) {
            let i = 0
            while (i < Math.min(tb.length, ta.length) && tb[i] === ta[i]) i++
            console.log(`     أول اختلاف عند الحرف ${i}: قبل «${tb.slice(Math.max(0, i - 30), i + 40)}» بعد «${ta.slice(Math.max(0, i - 30), i + 40)}»`)
          }
        }
      }
    }
    console.log(`\n═══ الخلاصة: ${diffs === 0 ? 'التكافؤ الوظيفي الكامل مثبت ✓' : `${diffs} اختلافًا يتطلب تفسيرًا`} ═══`)
    process.exit(diffs === 0 ? 0 : 1)
  }

  if (LABEL !== 'before' && LABEL !== 'after') {
    console.error('الاستخدام: bun scripts/report-parity.mts <before|after|compare>')
    process.exit(1)
  }

  // ── لقطة API ──
  const login = await fetch(`${BASE}/api/session`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'sultan@madrasati.sa', password: '***REMOVED-DEV-SECRET***' }),
  })
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
  const api = await apiSnapshot(cookie)

  // ── لقطة المتصفح ──
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.getByLabel('البريد الإلكتروني').fill('sultan@madrasati.sa')
  await page.locator('#login-password').fill('***REMOVED-DEV-SECRET***')
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()
  await page.waitForTimeout(3500)

  console.log(`── لقطة ${LABEL}: التقرير الرسمي (${ACH_TITLE}) ──`)
  const official = await previewAndCapture(page, 'التقرير الرسمي للإنجاز', 'official')
  console.log(`صفحات: معاينة=${official.previewPages} • PDF=${official.pdfPages} • صور=${official.previewImgs} • مواضع هجرية=${official.hijriMarkers}`)

  console.log(`── لقطة ${LABEL}: تقرير ملف الإنجاز الكامل ──`)
  const full = await previewAndCapture(page, 'تقرير ملف الإنجاز الكامل', 'full')
  console.log(`صفحات: معاينة=${full.previewPages} • PDF=${full.pdfPages} • صور=${full.previewImgs} • مواضع هجرية=${full.hijriMarkers}`)

  await browser.close()

  writeFileSync(`${OUT}/${LABEL}.json`, JSON.stringify({ label: LABEL, api, official, full }, null, 2))
  console.log(`\n✓ حُفظت اللقطة: ${OUT}/${LABEL}.json (+ PDFs)`)
}

function mismatchList(b: any, a: any, fields: string[]): string {
  return fields.map((f) => `${f} ${b[f]}→${a[f]}`).join('، ')
}

function readTextSample(s: { textSample?: string }): string {
  return s.textSample ?? ''
}

main().catch((e) => { console.error(e); process.exit(1) })
