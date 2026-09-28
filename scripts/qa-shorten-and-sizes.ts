// ═══ QA محلي شامل — الرقع A/B على خادم التطوير :3100 ═══
// Task 8: بيانات QA (إنجاز بنصوص طويلة + 3 صور بأبعاد متنوعة)
// Task 9: SHORTEN_CONTENT فعلًا بنصوص 100/300/700 كلمة + اختصر أكثر + إلغاء لا يمس الأصل
// Task 10: Image1=COMPACT / Image2=ORIGINAL / Image3=COMPACT عبر PATCH
// كل شيء عبر API الحقيقي — ثم تنظيف لاحق عبر qa-cleanup.ts
//
// ═══ قاعدة القيم العددية في SHORTEN_CONTENT (2026-09-29) ═══
// الاختبار يفرّق بين:
//   SEMANTICALLY PRESERVED = PASS  → «ست طالبات» → «6 طالبات» (القيمة نفسها، اختلاف صيغة فقط)
//   VALUE CHANGED          = FAIL  → «ست» → «7»، «18%» → «20%»، «30 طالبًا» → «25 طالبًا»
// تُستخرج القيم من الأرقام اللاتينية/الهندية ومن الكلمات العددية العربية (ست/أربعة/عشر…)
// مع دمج المركبات (خمسة عشر=15) ووعي النسب (% وبالمئة/بالمائة)، ثم تُقارن دلاليًا لا نصيًا.
export {}

/** bun runtime global — غير معرّف في tsc بدون @types/bun (سكربت تشغيل فقط) */
declare const Bun: { file(path: string): { arrayBuffer(): Promise<ArrayBuffer>; text(): Promise<string> }; write(path: string, data: string): Promise<number> }

const BASE = process.env.BASE_URL || 'http://localhost:3100'
const EMAIL = 'qa-shorten@school.sa'
const PASSWORD = 'QaShorten!2026'
const ASSETS = '/home/z/my-project/scripts/qa-assets'
const STATE_FILE = new URL('qa-state.json', import.meta.url).pathname

let passed = 0
let failed = 0
function check(name: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (ok) passed++
  else failed++
}

async function j(url: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${url}`, init)
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body, headers: res.headers }
}

// ═══════════════════════════════════════════════════════════════
// محرك المقارنة الدلالية للقيم العددية
// ═══════════════════════════════════════════════════════════════

/** تطبيع عربي: حذف التشكيل والتطويل وتوحيد الألف والياء والتاء المربوطة */
function normAr(s: string): string {
  return s
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
}

/** الأرقام الهندية → لاتينية */
const AR_DIGIT: Record<string, string> = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' }

/** الكلمات العددية العربية (بصيغة مطبّعة) → قيمتها. تشمل الأصلية والمؤنثة والترتيبية والتكرارية */
const NUM_WORDS: Record<string, number> = {
  صفر: 0, واحد: 1, واحده: 1, اول: 1, الاولي: 1, اولي: 1,
  اثنان: 2, اثنين: 2, اثنتان: 2, اثنتين: 2, ثاني: 2, مرتان: 2, مرتين: 2,
  ثلاث: 3, ثلاثه: 3, ثالث: 3,
  اربع: 4, اربعه: 4, رابع: 4,
  خمس: 5, خمسه: 5, خامس: 5,
  ست: 6, سته: 6, سادس: 6,
  سبع: 7, سبعه: 7, سابع: 7,
  ثمان: 8, ثماني: 8, ثمانيه: 8, ثامن: 8,
  تسع: 9, تسعه: 9, تاسع: 9,
  عشر: 10, عشره: 10, عاشر: 10,
  عشرون: 20, عشرين: 20, ثلاثون: 30, ثلاثين: 30, اربعون: 40, اربعين: 40,
  خمسون: 50, خمسين: 50, ستون: 60, ستين: 60, سبعون: 70, سبعين: 70,
  ثمانون: 80, ثمانين: 80, تسعون: 90, تسعين: 90,
  مئه: 100, مائه: 100, مئتان: 200, مئتين: 200,
  الف: 1000, الاف: 1000, آلاف: 1000, الفين: 2000, ألفين: 2000,
  مره: 1,
}

/** كلمات التكرار الظرفية (مرة/مرتين) — معدّلات تكرار قابلة للضغط، ليست مقاييس صلبة مثل النسب والأعداد والمدد */
const SOFT_WORDS = new Set(['مره', 'مرة', 'مرتان', 'مرتين'])

/** كلمات النسبة المئوية — علامة دلالية لا قيمة عددية */
const PCT_WORD_RE = /بالمئ[هة]|بالمائ[هة]|في\s?المئ[هة]|في\s?المائ[هة]|نسبه\s?مئوي[هة]|%/g

interface NumMention { value: number; percent: boolean; form: 'digit' | 'word'; soft?: boolean }

/** هل تلي علامة نسبة الرقمَ خلال نافذة قصيرة؟ (بلاغة عربية: «من 18 إلى 7 بالمئة») */
function pctWordNear(text: string, idxAfter: number): boolean {
  const win = text.slice(idxAfter, idxAfter + 25)
  return /%|بالمئ|بالمائ|في المئ|في المائ/.test(win)
}

/** استخراج كل الذكرات العددية من نص (أرقام + كلمات عددية، مع دمج المركبات) */
function extractNumMentions(rawText: string): NumMention[] {
  const t = normAr(rawText)
  const out: NumMention[] = []

  // ── أ) الأرقام اللاتينية والهندية (مع فواصل عشرية و٪) — مع استثناء ترقيم القوائم البنيوي
  const digitRe = /[0-9]+(?:[.,][0-9]+)?%?|[٠-٩]+(?:[.,][٠-٩]+)?%?/g
  let m: RegExpExecArray | null
  while ((m = digitRe.exec(t))) {
    const rawNum = m[0]
    const ascii = rawNum.replace(/[٠-٩]/g, (d) => AR_DIGIT[d] ?? d).replace('%', '')
    const value = Number(ascii.replace(',', '.'))
    if (!Number.isFinite(value)) continue
    // ترقيم قوائم بنيوي: رقم ≤99 في مفتتح السطر يليه نقطة/قوس/شرطة ثم فراغ — ليس حقيقة عددية
    const before = t.slice(Math.max(0, m.index - 4), m.index)
    const after = t.slice(m.index + rawNum.length, m.index + rawNum.length + 3)
    if (value <= 99 && /(^|\n)\s*$/.test(before) && /^[.:،\-)]\s/.test(after)) continue
    const percent = rawNum.includes('%') || pctWordNear(t, m.index + rawNum.length)
    out.push({ value, percent, form: 'digit' })
  }

  // ── ب) الكلمات العددية — مع دمج المتتاليات (خمسة عشر=15، ثلاثة وعشرين=23، مئة وخمسين=150)
  const wordRe = /[\u0600-\u06FF]+/g
  const tokens: { word: string; idx: number }[] = []
  while ((m = wordRe.exec(t))) tokens.push({ word: m[0], idx: m.index })
  const bare = (w: string) => (w.startsWith('ال') && w.length > 3 ? w.slice(2) : w)
  const val = (w: string) => NUM_WORDS[bare(w)] ?? NUM_WORDS[w.replace(/^و/, '')]

  let i = 0
  while (i < tokens.length) {
    const v = val(tokens[i].word)
    if (v === undefined) { i++; continue }
    // اجمع المتتالية (يسمح بواو العطف بين الرقميين)
    const parts: number[] = [v]
    let endIdx = tokens[i].idx + tokens[i].word.length
    let j = i + 1
    while (j < tokens.length) {
      const w = tokens[j].word
      if (w === 'و' && j + 1 < tokens.length) {
        const nv = val(tokens[j + 1].word)
        if (nv !== undefined) { parts.push(nv); endIdx = tokens[j + 1].idx + tokens[j + 1].word.length; j += 2; continue }
      }
      const nv = val(w)
      if (nv !== undefined) { parts.push(nv); endIdx = j === tokens.length - 1 ? t.length : tokens[j].idx + w.length; j++; continue }
      break
    }
    // طي المركب
    let value = parts[0]
    for (let k = 1; k < parts.length; k++) {
      const cur = parts[k]
      if (cur === 10 && value < 10) value += 10
      else if (cur >= 20 && cur <= 90 && value < 10) value += cur
      else if ((cur === 100 || cur === 200 || cur === 1000 || cur === 2000) && value > 0 && value < 10) value *= cur
      else if (cur < value) value += cur
      else value = cur
    }
    const percent = pctWordNear(t, endIdx)
    const soft = SOFT_WORDS.has(tokens[i].word) || SOFT_WORDS.has(tokens[i].word.replace(/^ال/, ''))
    out.push({ value, percent, form: 'word', soft })
    i = j
  }
  return out
}

/** صياغة قيمة للعرض */
const fmtV = (v: number, pct: boolean) => `${v}${pct ? '%' : ''}`

/**
 * المقارنة الدلالية بين نص المصدر والنص المختصر.
 * PASS (SEMANTICALLY PRESERVED): كل قيمة في المصدر موجودة في الناتج بأي صيغة، ولا قيمة جديدة في الناتج.
 * FAIL (VALUE CHANGED): قيمة سقطت أو تغيرت، أو قيمة مخترعة لم ترد في المصدر.
 */
function semanticNumCompare(src: string, out: string) {
  const s = extractNumMentions(src)
  const o = extractNumMentions(out)
  const mapOf = (list: NumMention[]) => {
    const map = new Map<number, { pct: boolean; form: 'digit' | 'word'; soft: boolean }>()
    for (const m of list) {
      const e = map.get(m.value)
      map.set(m.value, { pct: (e?.pct ?? false) || m.percent, form: e?.form ?? m.form, soft: (e?.soft ?? true) && Boolean(m.soft) })
    }
    return map
  }
  const sMap = mapOf(s)
  const oMap = mapOf(o)

  const changed: string[] = [] // قيم صلبة تغيرت/سقطت/فقدت علامة نسبتها — FAIL
  const invented: string[] = [] // قيم لم ترد في المصدر إطلاقًا — FAIL
  const formOnly: string[] = [] // اختلاف صيغة فقط (دلاليًا محفوظ) — PASS
  const softDropped: string[] = [] // كلمات تكرار ظرفية سقطت (مرة/مرتين) — تنبيه لا فشل
  const seen = new Set<string>()
  for (const [v, info] of sMap) {
    seen.add(String(v))
    const ov = oMap.get(v)
    if (!ov) {
      if (info.soft) softDropped.push(fmtV(v, info.pct))
      else changed.push(fmtV(v, info.pct))
    }
    else if (info.pct && !ov.pct) changed.push(`${v}% (فقدت علامة النسبة)`)
    else if (info.form !== ov.form) formOnly.push(`${v} (${info.form === 'word' ? 'كلمة' : 'رقم'}→${ov.form === 'word' ? 'كلمة' : 'رقم'})`)
  }
  for (const [v, info] of oMap) if (!seen.has(String(v))) invented.push(fmtV(v, info.pct))
  return { ok: changed.length === 0 && invented.length === 0, changed, invented, formOnly, softDropped }
}

/** نص عربي مهني طويل مولّد بعدد كلمات محدد — يحوي أرقامًا وكلمات عددية وحقائق يجب حفظها */
function longText(words: number): string {
  const base = 'نفّذت خلال هذا الفصل مجموعة من الأنشطة التعليمية المتنوعة التي استهدفت رفع مستوى الطلاب في مهارات القراءة والفهم القرائي، حيث عملت على تصميم خطط دراسية مرنة تراعي الفروق الفردية بين الطلاب وتستجيب لاحتياجاتهم الفعلية المقيسة عبر أدوات تشخيص مبدئية في بداية الفصل الدراسي، وتم توظيف استراتيجيات التعلم النشط داخل الصف من خلال العمل التعاوني في مجموعات صغيرة متناسقة المستوى، إذ وزّعت الطلاب على ست مجموعات بحيث تضم كل مجموعة خمسة طلاب بمستويات متقاربة، مع تكليف كل مجموعة بمهام قرائية متدرجة الصعوبة تناسب مستواها الفعلي، وجرى قياس التقدم أسبوعيًا عبر بطاقات متابعة قصيرة تستغرق عشر دقائق في نهاية كل أسبوع، وقد أظهرت النتائج المبدئية تحسنًا ملحوظًا في سرعة القراءة لدى أغلب الطلاب المستهدفين، إذ ارتفع متوسط الكلمات المقروءة في الدقيقة من 62 كلمة إلى 94 كلمة خلال ثمانية أسابيع من التنفيذ المنتظم، كما انخفضت نسبة الأخطاء الشائعة في القراءة من 18 بالمئة إلى 7 بالمائة فقط بحسب اختبار إعادة التطبيق في نهاية المدة، ولوحظ كذلك نمو واضح في دافعية الطلاب نحو القراءة الحرة خلال حصص ركن القراءة الصفي التي خصصتها مرتين أسبوعيًا بحصة واحدة في كل مرة، وشارك في البرنامج 30 طالبًا من طلاب الصف السابع في مدرسة متوسطة الملك عبدالعزيز بمدينة الرياض خلال الفصل الدراسي الأول من العام 1448هـ.'
  let out = ''
  while (out.split(/\s+/).length < words) out += ' ' + base
  const arr = out.trim().split(/\s+/)
  return arr.slice(0, words).join(' ')
}

// ═══ اختبارات الوحدة لمحرك المقارنة الدلالية (تُنفَّذ أولًا — إثبات صحة القاعدة) ═══
function selfTest() {
  console.log('═══ 0) اختبار وحدة محرك القيم العددية ═══')
  const cases: { src: string; out: string; ok: boolean; label: string }[] = [
    { src: 'ست طالبات', out: '6 طالبات', ok: true, label: 'ست→6 = PASS (محفوظة دلاليًا)' },
    { src: 'ست طالبات', out: 'سبع طالبات', ok: false, label: 'ست→7 = FAIL (قيمة تغيرت)' },
    { src: '18%', out: '18%', ok: true, label: '18%→18% = PASS' },
    { src: '18%', out: '20%', ok: false, label: '18%→20% = FAIL' },
    { src: '30 طالبًا', out: '30 طالبًا', ok: true, label: '30→30 = PASS' },
    { src: '30 طالبًا', out: '25 طالبًا', ok: false, label: '30→25 = FAIL' },
    { src: 'أربعة أسابيع', out: '4 أسابيع', ok: true, label: 'أربعة→4 = PASS' },
    { src: 'خمسة عشر معلمًا', out: '15 معلمًا', ok: true, label: 'مركب: خمسة عشر→15 = PASS' },
    { src: 'خمسة عشر معلمًا', out: '50 معلمًا', ok: false, label: 'مركب: خمسة عشر→50 = FAIL' },
    { src: 'من 18 بالمئة إلى 7 بالمائة', out: 'من 18 إلى 7 بالمئة', ok: true, label: 'علامة النسبة المؤجلة (بلاغة عربية) = PASS' },
    { src: '٦٢ كلمة', out: '62 كلمة', ok: true, label: 'أرقام هندية→لاتينية = PASS' },
    { src: 'خلال ثمانية أسابيع شارك 30 طالبًا', out: 'خلال 8 أسابيع شارك 30 طالبًا', ok: true, label: 'مزيج كلمات وأرقام = PASS' },
    { src: '1. تجهيز\n2. تنفيذ', out: '1. تجهيز وتنفيذ', ok: true, label: 'ترقيم القوائم البنيوي لا يُحسب اختراعًا = PASS' },
    { src: 'ارتفع من 62 إلى 94', out: 'ارتفع من 62 إلى 100', ok: false, label: '94→100 = FAIL (قيمة مخترعة)' },
    { src: 'خصصت ركن القراءة مرتين أسبوعيًا', out: 'خصصت ركن القراءة أسبوعيًا', ok: true, label: 'سقوط التكرار الظرفي «مرتين» = PASS (تنبيه)' },
    { src: 'شارك اثنان من المعلمين في البرنامج', out: 'شارك المعلمون في البرنامج', ok: false, label: 'سقوط العدد الصلب «اثنان» = FAIL' },
  ]
  for (const c of cases) {
    const r = semanticNumCompare(c.src, c.out)
    check(`محرك القيم: ${c.label}`, r.ok === c.ok, `changed=[${r.changed.join('،')}] invented=[${r.invented.join('،')}]`)
  }
}

async function main() {
  selfTest()

  console.log('═══ 1) دخول/إنشاء مستخدم QA ═══')
  // إنشاء المستخدم عبر signup (idempotent — إن وُجد نسجل دخولًا)
  const su = await j('/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD }),
  })
  const login = await j('/api/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  check('تسجيل الدخول', login.status === 200, `signup=${su.status} login=${login.status}`)
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
  const H = { cookie }
  const HJ = { cookie, 'content-type': 'application/json' }

  // سنة دراسية
  const me = await j('/api/me', { headers: H })
  let yearId: string | undefined = me.body.year?.id ?? me.body.years?.[0]?.id
  if (!yearId) {
    const yr = await j('/api/years', { method: 'POST', headers: HJ, body: JSON.stringify({ label: '1448هـ' }) })
    yearId = yr.body.year?.id ?? yr.body.years?.[0]?.id
  }
  check('سنة دراسية', Boolean(yearId))

  console.log('═══ 2) رفع صور QA الثلاث ═══')
  const upload = async (file: string, _title: string) => {
    const buf = await Bun.file(`${ASSETS}/${file}`).arrayBuffer()
    const fd = new FormData()
    fd.append('file', new Blob([buf], { type: 'image/png' }), file)
    fd.append('yearId', yearId ?? '')
    const res = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: H, body: fd })
    const body = await res.json().catch(() => ({}))
    return { status: res.status, att: body.attachment as any }
  }
  const up1 = await upload('qa-portrait.png', 'شاهد عمودي كبير — لقاء أولياء الأمور')
  const up2 = await upload('qa-landscape.png', 'شاهد أفقي — مجموعات العمل التعاوني')
  const up3 = await upload('qa-tall-screenshot.png', 'لقطة شاشة طويلة — لوحة متابعة مدرستي')
  check('رفع الصورة العمودية', up1.status === 201 && up1.att?.kind === 'IMAGE')
  check('رفع الصورة الأفقية', up2.status === 201 && up2.att?.kind === 'IMAGE')
  check('رفع لقطة الشاشة الطويلة', up3.status === 201 && up3.att?.kind === 'IMAGE')
  const A1 = up1.att.id, A2 = up2.att.id, A3 = up3.att.id

  console.log('═══ 3) PATCH أحجام العرض — Task 10: 1=COMPACT 2=ORIGINAL 3=COMPACT ═══')
  const patch = async (id: string, size: string) => {
    const r = await j(`/api/attachments/${id}`, { method: 'PATCH', headers: HJ, body: JSON.stringify({ reportDisplaySize: size }) })
    return { status: r.status, size: r.body.attachment?.reportDisplaySize as string }
  }
  const p1 = await patch(A1, 'ORIGINAL') // ثم نعيدها COMPACT لاحقًا — نتحقق من التبديل الفعلي
  check('PATCH يعيّن ORIGINAL', p1.status === 200 && p1.size === 'ORIGINAL')
  const p1b = await patch(A1, 'COMPACT')
  check('PATCH يعيد COMPACT', p1b.status === 200 && p1b.size === 'COMPACT')
  const p2 = await patch(A2, 'ORIGINAL')
  check('الصورة 2 = ORIGINAL (كما يتطلب Task 10)', p2.status === 200 && p2.size === 'ORIGINAL')
  const p3 = await patch(A3, 'COMPACT')
  check('الصورة 3 = COMPACT', p3.status === 200 && p3.size === 'COMPACT')
  const badSize = await patch(A1, 'HUGE')
  check('قيمة غير صالحة مرفوضة (400)', badSize.status === 400)
  const noAuth = await fetch(`${BASE}/api/attachments/${A1}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reportDisplaySize: 'ORIGINAL' }),
  })
  check('بلا جلسة → 401', noAuth.status === 401)

  console.log('═══ 4) إنجاز QA بنصوص طويلة ═══')
  const execText = longText(300)
  const resultsText = longText(200)
  const ach = await j('/api/achievements', {
    method: 'POST', headers: HJ,
    body: JSON.stringify({
      type: 'INITIATIVE', title: 'QA — مبادرة اختبار اختصر وأحجام الصور', status: 'COMPLETED', yearId,
      problem: 'تفاوت ملحوظ في مستوى مهارات القراءة لدى طلاب الصف السابع بمعدل 30 طالبًا خلال العام 1448هـ',
      goalText: 'رفع متوسط سرعة القراءة من 62 إلى 94 كلمة في الدقيقة خلال ثمانية أسابيع',
      execution: execText, results: resultsText,
      impact: 'تحسن مقيس في سرعة القراءة وانخفاض الأخطاء من 18% إلى 7% خلال 8 أسابيع',
      attachmentIds: [A1, A2, A3],
    }),
  })
  check('إنشاء الإنجاز', ach.status === 201)
  const achId = ach.body.achievement?.id as string

  console.log('═══ 5) التقرير يعيد reportDisplaySize لكل شاهد ═══')
  const report = await j(`/api/report?yearId=${yearId}`, { headers: H })
  const ra = (report.body.achievements ?? []).find((x: any) => x.id === achId)
  const linked: any[] = ra?.links ?? []
  const byId: Record<string, string> = {}
  for (const l of linked) byId[l.attachment?.id ?? ''] = l.attachment?.reportDisplaySize ?? '(missing)'
  check('التقرير: الصورة 1 (عمودية) COMPACT', byId[A1] === 'COMPACT', byId[A1])
  check('التقرير: الصورة 2 (أفقية) ORIGINAL', byId[A2] === 'ORIGINAL', byId[A2])
  check('التقرير: الصورة 3 (لقطة طويلة) COMPACT', byId[A3] === 'COMPACT', byId[A3])

  console.log('═══ 6) SHORTEN_CONTENT — Task 9: 100/300/700 كلمة (مقارنة دلالية للقيم) ═══')
  const shorten = async (text: string, extra: Record<string, string> = {}) => {
    const call = () => j('/api/ai/shorten', { method: 'POST', headers: HJ, body: JSON.stringify({ context: { text, fieldTarget: 'execution', ...extra } }) })
    let r = await call()
    // إعادة محاولة واحدة عند تعطل المزوّد العابر (5xx) — لا تنطبق على أخطاء المنطق (400/401/429)
    if (r.status >= 500) {
      console.log(`  (تعطل مزوّد عابر ${r.status} — إعادة محاولة واحدة بعد 5 ثوانٍ)`)
      await new Promise((res) => setTimeout(res, 5000))
      r = await call()
    }
    return { status: r.status, result: r.body.result as any, error: r.body.error as string }
  }
  const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length

  for (const target of [100, 300, 700]) {
    const src = longText(target)
    const r = await shorten(src)
    if (r.status !== 200 || !r.result?.shortenedText) {
      check(`اختصر ${target} كلمة`, false, `status=${r.status} err=${r.error}`)
      continue
    }
    const out = r.result.shortenedText as string
    const outWords = wordCount(out)
    check(`اختصر ${target} كلمة → ناتج أقصر فعليًا`, outWords < wordCount(src), `${wordCount(src)} → ${outWords}`)
    // ═══ القاعدة المعتمدة: SEMANTICALLY PRESERVED = PASS / VALUE CHANGED = FAIL ═══
    const cmp = semanticNumCompare(src, out)
    check(`اختصر ${target}: القيم العددية محفوظة دلاليًا (PASS)`, cmp.changed.length === 0,
      cmp.changed.length
        ? `قيم تغيرت/سقطت: ${cmp.changed.join('، ')}`
        : `محفوظة دلاليًا${cmp.formOnly.length ? ` (اختلاف صيغة فقط: ${cmp.formOnly.join('، ')})` : ''}${cmp.softDropped.length ? ` • تنبيه: سقط تكرار ظرفي ${cmp.softDropped.join('، ')}` : ''}`)
    check(`اختصر ${target}: لا قيم عددية مخترعة (VALUE CHANGED = FAIL)`, cmp.invented.length === 0,
      cmp.invented.length ? `قيم لم ترد في المصدر: ${cmp.invented.join('، ')}` : '')
  }

  console.log('═══ 7) اختصر أكثر — على النسخة المختصرة الحالية ═══')
  const src = longText(300)
  const s1 = await shorten(src)
  const t1 = s1.result?.shortenedText as string
  const s2 = await shorten(t1, { shortenMore: '1' })
  if (s2.status === 200 && s2.result?.shortenedText) {
    const t2 = s2.result.shortenedText as string
    check('اختصر أكثر → أقصر من المختصر الأول', wordCount(t2) < wordCount(t1), `${wordCount(t1)} → ${wordCount(t2)}`)
    // القيم العددية محفوظة حتى في الاختصار الأعمق — مقابل النسخة المختصرة الأولى (المصدر الفعلي للطلب)
    const cmp2 = semanticNumCompare(t1, t2)
    check('اختصر أكثر: القيم العددية محفوظة دلاليًا', cmp2.changed.length === 0 && cmp2.invented.length === 0,
      `${cmp2.changed.join('،')} ${cmp2.invented.join('،')}`.trim())
  } else {
    check('اختصر أكثر → أقصر من المختصر الأول', false, `status=${s2.status} err=${s2.error}`)
  }

  console.log('═══ 8) إلغاء لا يمس الأصل — الحقل كما هو بعد اختيار الإلغاء (محاكاة العميل) ═══')
  // في الواجهة: إلغاء = إغلاق النافذة دون onApplyText — لا استدعاء PATCH أصلًا.
  // نثبت هنا أن التخزين لم يتغير: جلب الإنجاز ويظل نص التنفيذ هو الأصل.
  const got = await j(`/api/achievements/${achId}`, { headers: H })
  const execNow = (got.body.achievement?.execution ?? '') as string
  check('نص الحقل الأصلي لم يُمس (لا استبدال تلقائي)', execNow === execText, `طول=${execNow.length}/${execText.length}`)

  console.log('═══ 9) حقل فارغ → 400 (لا اختصار بلا نص) ═══')
  const empty = await j('/api/ai/shorten', { method: 'POST', headers: HJ, body: JSON.stringify({ context: { fieldTarget: 'execution' } }) })
  check('الحقل الفارغ يرفض الاختصار', empty.status === 400)

  // حفظ معرفات QA للتنظيف الجراحي لاحقًا
  const state = { EMAIL, achId, attachmentIds: [A1, A2, A3], yearId }
  await Bun.write(STATE_FILE, JSON.stringify(state, null, 2))
  console.log(`\n═══ النتيجة: ${passed} ✓ / ${failed} ✗ ═══`)
  console.log('(معرفات QA محفوظة في scripts/qa-state.json للتنظيف الجراحي)')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
