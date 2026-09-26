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
  // سياق المشكلة والهدف
  problem?: string
  goal?: string
  generalGoal?: string
  // النص الموجود في الحقل (إن وُجد)
  text?: string
  // أهداف مدخلة مسبقًا (لتنفيذ مرتبط بها)
  objectives?: string[]
}

const MAX_FIELD_CHARS = 700
const MAX_TOTAL_CHARS = 3000
const MAX_OBJECTIVES = 8

/** تنقية قيمة واحدة: قص + إزالة أنماط البيانات الحساسة */
function cleanValue(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  let v = raw.trim().slice(0, MAX_FIELD_CHARS)
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
  const fields: (keyof ReportAIContextInput)[] = [
    'achievementType', 'title', 'field', 'stage', 'subject', 'grade',
    'problem', 'goal', 'generalGoal', 'text',
  ]
  let total = 0
  for (const f of fields) {
    const v = cleanValue(input[f])
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
    problem: 'المشكلة/الحاجة',
    goal: 'الهدف المهني المرتبط',
    generalGoal: 'الهدف العام',
    text: 'النص الموجود',
    objectives: 'أهداف مدخلة',
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
