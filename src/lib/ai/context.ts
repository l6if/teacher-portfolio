// ═══ Context Builder + Data Minimization ═══════════════════════
// يجمع السياق الضروري فقط لكل عملية — ويمنع مغادرة البيانات الحساسة إلى المزوّد.
// ممنوع إرسال: أسماء الطلاب، أرقام الهواتف، أرقام الهوية، معلومات أولياء الأمور.

export interface ReportAIContextInput {
  // نوع العملية القائم (لا يُرسل كما هو — يُستخدم في بناء التعليمات)
  achievementType?: string
  // حقول مهنية عامة
  title?: string
  field?: string // المجال
  stage?: string // المرحلة
  subject?: string // المادة/التخصص
  grade?: string // الصف
  // التصنيف على الإطار المهني (القسم 52) — أسماء فقط، ولا يغيّر التصنيف تلقائيًا
  frameworkDomain?: string
  frameworkCriterion?: string
  frameworkSubCriterion?: string
  // سياق المشكلة والهدف
  problem?: string
  goal?: string
  generalGoal?: string
  // ── حقول نموذج الإنجاز (مساعد الحقول الموحد — Patch) ──
  description?: string // الوصف المختصر
  execution?: string // ماذا نُفِّذ وكيف
  stages?: string // مراحل التنفيذ الحالية
  results?: string // النتائج الحالية
  impact?: string // الأثر الحالي
  beneficiaries?: string // الفئة المستفيدة
  duration?: string // مدة التنفيذ
  // النص الموجود في الحقل (إن وُجد) — للحقول خارج الخانات المسمّاة أعلاه
  text?: string
  // أهداف مدخلة مسبقًا (لتنفيذ مرتبط بها)
  objectives?: string[]
  // ── «اختصر» (SHORTEN_CONTENT) — وعي بنوع الحقل + وضع «اختصر أكثر» ──
  /** الحقل المستهدف بالاختصار (title/description/goalText/problem/execution/actions/results/impact/notes…) */
  fieldTarget?: string
  /** "1" عند طلب «اختصر أكثر» — يعمل على النسخة المختصرة الحالية لا الأصل */
  shortenMore?: string
}

const MAX_FIELD_CHARS = 700
/** نص المعالجة (text) يسمح له بطول أكبر — «اختصر» و«تحسين» يعالجان نصوصًا طويلة (حتى ~700 كلمة) */
const MAX_TEXT_CHARS = 4000
const MAX_TOTAL_CHARS = 5200
const MAX_OBJECTIVES = 8

/** تنقية قيمة واحدة: قص + إزالة أنماط البيانات الحساسة */
function cleanValue(raw: unknown, limit = MAX_FIELD_CHARS): string {
  if (typeof raw !== 'string') return ''
  let v = raw.trim().slice(0, limit)
  // إزالة أنماط أرقام هوية سعودية (10 خانات تبدأ بـ1 أو2) وهواتف (05xxxxxxxxx / +966...)
  v = v.replace(/\b(?:[12]\d{9}|0?5\d{8}|\+?9665?\d{8})\b/g, '[رقم محذوف]')
  return v
}

/**
 * buildReportAIContext — يبني سياقًا منقّى ومحدودًا.
 * البيانات غير المهنية (أسماء طلاب مثلًا) لا تُطلب أصلًا من الواجهة،
 * وهنا يُقص كل شيء ويُنقّى قبل الوصول للمزوّد.
 */
export function buildReportAIContext(input: ReportAIContextInput): Record<string, string> {
  const out: Record<string, string> = {}
  // الترتيب مقصود: الحقل النشط (text) والعنوان أولًا حتى لا يُقتا عند حد المجموع،
  // ثم باقي حقول النموذج بترتيب أهميتها للاقتراحات الحقلية
  const fields: (keyof ReportAIContextInput)[] = [
    'text', 'title', 'problem', 'execution', 'results', 'impact',
    'description', 'stages', 'goal', 'generalGoal',
    'beneficiaries', 'duration', 'achievementType', 'field', 'stage', 'subject', 'grade',
    'frameworkDomain', 'frameworkCriterion', 'frameworkSubCriterion',
    'fieldTarget', 'shortenMore',
  ]
  let total = 0
  for (const f of fields) {
    const limit = f === 'text' ? MAX_TEXT_CHARS : MAX_FIELD_CHARS
    const v = cleanValue(input[f], limit)
    if (v && total + v.length <= MAX_TOTAL_CHARS) {
      out[f] = v
      total += v.length
    }
  }
  if (Array.isArray(input.objectives)) {
    const objectives = input.objectives
      .slice(0, MAX_OBJECTIVES)
      .map(cleanValue)
      .filter(Boolean)
      .filter((o) => total + o.length <= MAX_TOTAL_CHARS)
    if (objectives.length) out.objectives = objectives.join('\n- ')
  }
  return out
}

/** تحويل السياق إلى نص مضغوط يُدرج في التعليمات */
export function contextToPromptBlock(context: Record<string, string>): string {
  const labels: Record<string, string> = {
    achievementType: 'نوع الإنجاز',
    title: 'العنوان',
    field: 'المجال',
    stage: 'المرحلة',
    subject: 'المادة/التخصص',
    grade: 'الصف',
    frameworkDomain: 'المجال المهني الرسمي',
    frameworkCriterion: 'المعيار المهني',
    frameworkSubCriterion: 'المعيار الفرعي',
    problem: 'المشكلة/الحاجة',
    goal: 'الهدف المهني المرتبط',
    generalGoal: 'الهدف العام',
    description: 'الوصف المختصر',
    execution: 'وصف التنفيذ',
    stages: 'مراحل التنفيذ الحالية',
    results: 'النتائج الحالية',
    impact: 'الأثر الحالي',
    beneficiaries: 'الفئة المستفيدة',
    duration: 'مدة التنفيذ',
    text: 'النص الموجود',
    objectives: 'أهداف مدخلة',
    fieldTarget: 'الحقل المستهدف',
    shortenMore: 'وضع اختصار أكثر',
  }
  const lines: string[] = []
  for (const [k, v] of Object.entries(context)) {
    if (k === 'objectives') {
      lines.push(`${labels[k]}:\n- ${v}`)
    } else if (labels[k] && v) {
      lines.push(`${labels[k]}: ${v}`)
    }
  }
  return lines.length ? `السياق المهني المتاح:\n${lines.join('\n')}` : ''
}
