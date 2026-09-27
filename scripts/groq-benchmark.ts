// ═══ Groq Benchmark العربي — قياس حقيقي عبر الواجهة بعد تفعيل GROQ_API_KEY ═══
// يُشغَّل ضد خادم حي (الافتراضي 3000) بجلسة ديمو موثقة.
// يقيس لكل عملية: نجاح HTTP، زمن الاستجابة (ms)، موثوقية JSON للعمليات البنيوية.
// العمليات المقيسة (المطلوبة): 4 أهداف / هدف عام / تحسين / تدقيق / مبادرة (JSON) / خطة علاجية (JSON)
//
// الاستخدام:
//   DEMO_PASSWORD='...' TEST_BASE='https://<النشر>' bun scripts/groq-benchmark.ts
//   (أو محليًا: DEMO_PASSWORD='...' bun scripts/groq-benchmark.ts)

import { readFileSync } from 'fs'

// بيئة الشل قد تحمل قيمًا قديمة — .env هو مصدر الحقيقة (نفس نمط test-final-phase)
const envOverride = () => {
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?\s*$/)
      if (!m) continue
      if (!process.env[m[1]] || process.env[m[1]]?.startsWith('file:')) process.env[m[1]] = m[2]
    }
  } catch { /* لا .env — نستخدم ما في البيئة */ }
}
envOverride()

const BASE = process.env.TEST_BASE ?? 'http://127.0.0.1:3000'
const EMAIL = process.env.DEMO_EMAIL ?? 'demo@madrasati.sa'
const PASSWORD = process.env.DEMO_PASSWORD ?? ''

if (!PASSWORD) {
  console.error('اضبط DEMO_PASSWORD في البيئة أولًا.')
  process.exit(1)
}

type Bench = {
  action: string
  label: string
  context: Record<string, string>
  jsonExpected: boolean
}

const benches: Bench[] = [
  {
    action: 'suggestObjectives',
    label: '4 أهداف ذكية',
    context: {
      achievementType: 'تحسين التحصيل الدراسي',
      title: 'تحسين مستوى القراءة لدى طالبات الصف الرابع',
      field: 'التعلم والتعليم',
      stage: 'الابتدائية',
      subject: 'اللغة العربية',
      grade: 'الرابع',
      problem: 'ضعف الطلاقة القرائية لدى 9 من 28 طالبة',
    },
    jsonExpected: false, // النتيجة قائمة أهداف نصية
  },
  {
    action: 'suggestGeneralObjective',
    label: 'هدف عام واحد',
    context: {
      achievementType: 'تحسين التحصيل الدراسي',
      title: 'رفع مستوى الفهم القرائي',
      field: 'التعلم والتعليم',
      subject: 'اللغة العربية',
    },
    jsonExpected: false,
  },
  {
    action: 'improveText',
    label: 'تحسين الصياغة',
    context: {
      text: 'سويت نشاط القراءة وطلبت من الطالبات يقرأن بصوت عالي وكانت النتيجة جيدة',
      field: 'التعلم والتعليم',
    },
    jsonExpected: false,
  },
  {
    action: 'proofread',
    label: 'تدقيق لغوي',
    context: {
      text: 'نفذت المعلمة درسا تطبيقيا هدفة تنميه مهارات القراءه الجهرية لدي طالبات الصف',
      field: 'التعلم والتعليم',
    },
    jsonExpected: false,
  },
  {
    action: 'suggestInitiative',
    label: 'مسودة مبادرة (JSON)',
    context: {
      achievementType: 'مبادرة نوعية',
      title: 'مبادرة ركن القراءة الصباحي',
      field: 'البيئة المدرسية',
      stage: 'الابتدائية',
      problem: 'ضعف الاهتمام بالكتاب вне الحصة',
    },
    jsonExpected: true,
  },
  {
    action: 'suggestRemedialPlan',
    label: 'خطة علاجية (JSON)',
    context: {
      achievementType: 'خطة علاجية',
      title: 'خطة علاجية لمهارات التهجي',
      field: 'التعلم والتعليم',
      stage: 'الابتدائية',
      subject: 'اللغة العربية',
      problem: 'أخطاء إملائية متكررة في الهمزات لدى 6 طالبات',
    },
    jsonExpected: true,
  },
]

async function main() {
  console.log('════ Groq Benchmark العربي ════')
  console.log(`الخادم: ${BASE}`)
  console.log('─'.repeat(72))

  // تسجيل الدخول
  const login = await fetch(`${BASE}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!login.ok) {
    console.error(`⛔ فشل تسجيل الدخول (${login.status}) — تحقق من DEMO_PASSWORD`)
    process.exit(1)
  }
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
  if (!cookie) {
    console.error('⛔ لا كوكي جلسة')
    process.exit(1)
  }
  console.log('✓ جلسة ديمو جاهزة')
  console.log('─'.repeat(72))

  let okCount = 0
  let jsonOk = 0
  let jsonTotal = 0
  let totalMs = 0
  const rows: Array<{ label: string; status: number; ms: number; model: string; note: string }> = []

  for (const b of benches) {
    const t0 = Date.now()
    let status = 0
    let model = '—'
    let note = ''
    try {
      const res = await fetch(`${BASE}/api/ai/${b.action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ context: b.context }),
      })
      status = res.status
      const body = await res.json().catch(() => ({} as Record<string, unknown>))
      model = String(body.model ?? '—')
      if (res.ok && body.result) {
        okCount++
        if (b.jsonExpected) {
          jsonTotal++
          const r = body.result as Record<string, unknown>
          const hasFields = Object.keys(r).length >= 3
          if (hasFields) jsonOk++
          else note = `JSON ضعيف (${Object.keys(r).length} حقول)`
        } else {
          const text = typeof body.result === 'string' ? body.result : JSON.stringify(body.result)
          note = `${text.length} حرفًا`
        }
      } else {
        note = String(body.error ?? 'بلا نتيجة')
      }
    } catch (e) {
      note = `خطأ شبكة: ${String(e).slice(0, 60)}`
    }
    const ms = Date.now() - t0
    totalMs += ms
    rows.push({ label: b.label, status, ms, model, note })
    // مهلة between requests — احترام للحد
    await new Promise((r) => setTimeout(r, 800))
  }

  console.log('العملية                     | HTTP | الزمن  | الموديل                | ملاحظة')
  console.log('────────────────────────────┼──────┼────────┼────────────────────────┼──────────────')
  for (const r of rows) {
    console.log(
      `${r.label.padEnd(28)} | ${String(r.status).padEnd(4)} | ${String(r.ms).padStart(5)}ms | ${r.model.slice(0, 24).padEnd(24)} | ${r.note.slice(0, 30)}`,
    )
  }
  console.log('─'.repeat(72))
  console.log(`النجاح: ${okCount}/${benches.length}`)
  if (jsonTotal > 0) console.log(`موثوقية JSON: ${jsonOk}/${jsonTotal}`)
  console.log(`متوسط الزمن: ${Math.round(totalMs / benches.length)}ms`)
  console.log('─'.repeat(72))
  if (okCount === benches.length && jsonOk === jsonTotal) {
    console.log('✅ Benchmark كامل — Groq يعمل عبر كل العمليات المطلوبة')
  } else {
    console.log('⛔ عمليات فاشلة — راجع الجدول قبل اعتماد الموديل')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
