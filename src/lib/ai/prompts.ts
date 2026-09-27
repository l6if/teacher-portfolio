// ═══ تعريفات الأوامر + التحقق الصارم من المخرجات ═══════════════
// قاعدة ذهبية مكررة في كل أمر: لا اختراع أرقام/نسب/نتائج/تواريخ/أسماء طلاب.

import type { AiAction } from './types'
import { AiError } from './types'

export interface ActionSpec {
  /** واجهة الزر (تظهر بجانب الحقل) */
  uiLabel: string
  /** رسالة الانتظار داخل الحقل */
  loadingHint: string
  /** بناء رسالة system */
  system: (context: Record<string, string>) => string
  /** بناء رسالة user (المحتوى الذي يُعالج) */
  user: (context: Record<string, string>) => string
  /** إخراج JSON صارم */
  jsonMode: boolean
  temperature: number
  maxTokens: number
  /** التحقق من المخرجات — يرمي AiError(invalid_output) عند الفشل */
  validate: (raw: string) => unknown
}

const NO_INVENTION =
  'قواعد صارمة غير قابلة للنقاش: ' +
  'لا تخترع أي رقم أو نسبة مئوية أو نتيجة تحققت أو قياسًا بعديًا أو عدد طلاب أو تاريخًا. ' +
  'لا تستخدم أسماء طلاب. ' +
  'إن لم ترد البيانات قياسًا بعديًا فعليًا فاستخدم صياغة متوقعة/مقترحة بوضوح بدل ادعاء نتيجة. ' +
  'أعد النص النهائي فقط دون مقدمات أو تعليقات ميتا.'

const PROFESSIONAL =
  'أنت مساعد مهني خبير في الصياغة التربوية العربية لملف إنجاز المعلم/المعلمة في المملكة العربية السعودية. ' +
  'أسلوبك: عربية فصحى سليمة، مهنية، واضحة، موجزة، قابلة للقياس قدر الإمكان. '

function parseJsonLoose(raw: string): Record<string, unknown> {
  const text = raw.trim()
  // بعض النماذج تغلف JSON بأسوار ``` — نتعامل معها
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    // محاولة استخراج أول كائن JSON في النص
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>
      } catch {
        /* fallthrough */
      }
    }
    throw new AiError('invalid_output', 'استجابة غير صالحة من المزوّد.')
  }
}

function expectNonEmptyString(raw: string, minChars = 8): string {
  const text = raw.trim().replace(/^["']|["']$/g, '')
  if (text.length < minChars) throw new AiError('invalid_output', 'استجابة قصيرة غير صالحة.')
  return text
}

export const ACTIONS: Record<AiAction, ActionSpec> = {
  // ─── الأهداف: 4 أهداف حصرًا ────────────────────────────────
  suggestObjectives: {
    uiLabel: 'اقتراح الأهداف',
    loadingHint: 'جاري إعداد مقترح الأهداف…',
    jsonMode: true,
    temperature: 0.5,
    maxTokens: 500,
    system: (c) =>
      PROFESSIONAL +
      `اقترح 4 أهداف مهنية بالضبط (ولا أكثر ولا أقل) مرتبطة ارتباطًا مباشرًا بالموضوع والسياق التالي. ` +
      `صِغ كل هدفًا جملة واحدة قابلة للملاحظة أو القياس قدر الإمكان دون أرقام مختلقة. ` +
      `أعد JSON فقط بالشكل: {"objectives": ["هدف1", "هدف2", "هدف3", "هدف4"]}. ` +
      NO_INVENTION,
    user: (c) => `الموضوع: ${c.title ?? c.text ?? 'غير محدد'}\n${promptContext(c)}`,
    validate: (raw) => {
      const obj = parseJsonLoose(raw)
      const list = obj.objectives
      if (!Array.isArray(list) || list.length !== 4) {
        throw new AiError('invalid_output', 'المقترح لا يحتوي 4 أهداف.')
      }
      const objectives = list.map((o) => String(o ?? '').trim())
      if (objectives.some((o) => !o)) {
        throw new AiError('invalid_output', 'أهداف فارغة في المقترح.')
      }
      return { objectives }
    },
  },

  // ─── الهدف العام: واحد فقط ──────────────────────────────────
  suggestGeneralObjective: {
    uiLabel: 'اقتراح الهدف العام',
    loadingHint: 'جاري إعداد الهدف العام…',
    jsonMode: true,
    temperature: 0.45,
    maxTokens: 200,
    system: (c) =>
      PROFESSIONAL +
      `اقترح هدفًا عامًا واحدًا فقط (وليس قائمة) يلخص الغاية من العمل في السياق التالي بصياغة مهنية جامعة. ` +
      `أعد JSON فقط بالشكل: {"generalObjective": "..."}. ` +
      NO_INVENTION,
    user: (c) => `الموضوع: ${c.title ?? c.text ?? 'غير محدد'}\n${promptContext(c)}`,
    validate: (raw) => {
      const obj = parseJsonLoose(raw)
      const v = String(obj.generalObjective ?? '').trim()
      if (!v) throw new AiError('invalid_output', 'هدف عام فارغ.')
      return { generalObjective: v }
    },
  },

  // ─── تفاصيل التنفيذ ─────────────────────────────────────────
  suggestExecution: {
    uiLabel: 'اقتراح تفاصيل التنفيذ',
    loadingHint: 'جاري إعداد تفاصيل التنفيذ…',
    jsonMode: true,
    temperature: 0.45,
    maxTokens: 600,
    system: (c) =>
      PROFESSIONAL +
      `بناءً على العنوان والسياق والأهداف (إن وُجدت)، اقترح خطوات تنفيذ منطقية عملية كقائمة مرقمة (5-8 خطوات). ` +
      `الخطوات مقترحة عامة قابلة للتكييف — لا تدّعِ أنها نُفذت. ` +
      `أعد JSON فقط بالشكل: {"execution": "1. ...\\n2. ..."}. ` +
      NO_INVENTION,
    user: (c) => `الموضوع: ${c.title ?? 'غير محدد'}\n${promptContext(c)}`,
    validate: (raw) => {
      const obj = parseJsonLoose(raw)
      const v = String(obj.execution ?? '').trim()
      if (v.length < 20) throw new AiError('invalid_output', 'تفاصيل غير كافية.')
      return { execution: v }
    },
  },

  // ─── التحسين والتدقيق ───────────────────────────────────────
  improveText: {
    uiLabel: 'تحسين الصياغة',
    loadingHint: 'جاري تحسين الصياغة…',
    jsonMode: false,
    temperature: 0.35,
    maxTokens: 600,
    system: () =>
      PROFESSIONAL +
      `أعد صياغة النص التالي بأسلوب مهني واضح وموجز مناسب لملف إنجاز مهني، ` +
      `دون إضافة أي معلومات غير موجودة فيه ودون تغيير أي رقم. أعد النص المحسّن فقط.` +
      NO_INVENTION,
    user: (c) => (c.text ?? '').trim(),
    validate: (raw) => expectNonEmptyString(raw),
  },

  improveTitle: {
    uiLabel: 'تحسين العنوان',
    loadingHint: 'جاري تحسين العنوان…',
    jsonMode: false,
    temperature: 0.4,
    maxTokens: 80,
    system: () =>
      PROFESSIONAL +
      `اقترح عنوانًا مهنيًا موجزًا (لا يتجاوز 9 كلمات) للعمل الموصوف. أعد العنوان فقط دون أي مقدمات أو علامات ترقيم زائدة.`,
    user: (c) => `العنوان الحالي: ${c.title ?? ''}\nالوصف: ${(c.text ?? '').slice(0, 400)}`,
    validate: (raw) => expectNonEmptyString(raw, 4),
  },

  proofread: {
    uiLabel: 'تدقيق لغوي',
    loadingHint: 'جاري التدقيق اللغوي…',
    jsonMode: false,
    temperature: 0.2,
    maxTokens: 600,
    system: () =>
      `أنت مدقق لغوي عربي دقيق. صحّح الأخطاء الإملائية والنحوية والترقيم في النص التالي ` +
      `دون تغيير المعنى أو إضافة محتوى جديد. أعد النص المصحح فقط.` ,
    user: (c) => (c.text ?? '').trim(),
    validate: (raw) => expectNonEmptyString(raw),
  },

  summarize: {
    uiLabel: 'تلخيص',
    loadingHint: 'جاري تلخيص النص…',
    jsonMode: false,
    temperature: 0.3,
    maxTokens: 250,
    system: () =>
      `لخص النص التالي في سطر أو سطرين بأسلوب مهني موجز دون إضافة معلومات جديدة. أعد الملخص فقط.`,
    user: (c) => (c.text ?? '').trim(),
    validate: (raw) => expectNonEmptyString(raw, 10),
  },

  toBullets: {
    uiLabel: 'تحويل إلى نقاط',
    loadingHint: 'جاري التحويل إلى نقاط…',
    jsonMode: false,
    temperature: 0.3,
    maxTokens: 500,
    system: () =>
      `حوّل النص التالي إلى قائمة نقاط مهنية (سطر لكل نقطة يبدأ بـ «•») دون إضافة معلومات جديدة. أعد القائمة فقط.`,
    user: (c) => (c.text ?? '').trim(),
    validate: (raw) => expectNonEmptyString(raw),
  },

  shorten: {
    uiLabel: 'اختصار',
    loadingHint: 'جاري الاختصار…',
    jsonMode: false,
    temperature: 0.3,
    maxTokens: 400,
    system: () =>
      `اختصر النص التالي إلى النصف تقريبًا مع الحفاظ على كل المعاني الجوهرية والأرقام. أعد النص المختصر فقط.`,
    user: (c) => (c.text ?? '').trim(),
    validate: (raw) => expectNonEmptyString(raw),
  },

  expand: {
    uiLabel: 'توسيع',
    loadingHint: 'جاري التوسيع…',
    jsonMode: false,
    temperature: 0.4,
    maxTokens: 600,
    system: () =>
      PROFESSIONAL +
      `وسّع النص التالي بتفاصيل مهنية منطقية مستمدة من سياقه فقط — دون اختلاق أرقام أو نتائج. أعد النص الموسع فقط.` +
      NO_INVENTION,
    user: (c) => (c.text ?? '').trim(),
    validate: (raw) => expectNonEmptyString(raw),
  },

  // ─── الأثر والتوصيات ────────────────────────────────────────
  suggestImpact: {
    uiLabel: 'صياغة الأثر',
    loadingHint: 'جاري صياغة الأثر…',
    jsonMode: false,
    temperature: 0.4,
    maxTokens: 300,
    system: () =>
      PROFESSIONAL +
      `بناءً على الوصف التالي فقط، صِغ فقرة «أثر مهني» واقعية من جملة إلى جملتين. ` +
      `إن لم يرد قياس فعلي فاستخدم صياغة نوعية متوقعة بلا نسب مئوية مختلقة. أعد الأثر فقط.` +
      NO_INVENTION,
    user: (c) => (c.text ?? c.title ?? '').trim(),
    validate: (raw) => expectNonEmptyString(raw, 12),
  },

  suggestRecommendations: {
    uiLabel: 'اقتراح التوصيات',
    loadingHint: 'جاري إعداد التوصيات…',
    jsonMode: true,
    temperature: 0.45,
    maxTokens: 400,
    system: () =>
      PROFESSIONAL +
      `بناءً على المحتوى التالي فقط، اقترح 3-5 توصيات مهنية مرتبطة مباشرة بمضمونه للاستمرار والتطوير. ` +
      `أعد JSON فقط بالشكل: {"recommendations": ["...", "..."]}. ` +
      NO_INVENTION,
    user: (c) => `الموضوع: ${c.title ?? ''}\nالمحتوى:\n${(c.text ?? '').slice(0, 1200)}`,
    validate: (raw) => {
      const obj = parseJsonLoose(raw)
      const list = obj.recommendations
      if (!Array.isArray(list) || list.length < 3 || list.length > 5) {
        throw new AiError('invalid_output', 'عدد توصيات غير مناسب.')
      }
      const recommendations = list.map((r) => String(r ?? '').trim()).filter(Boolean)
      if (recommendations.length < 3) throw new AiError('invalid_output', 'توصيات فارغة.')
      return { recommendations }
    },
  },

  // ─── مسودة مبادرة كاملة ─────────────────────────────────────
  suggestInitiative: {
    uiLabel: 'اقتراح مبادرة',
    loadingHint: 'جاري إعداد مسودة المبادرة…',
    jsonMode: true,
    temperature: 0.5,
    maxTokens: 1400,
    system: () =>
      PROFESSIONAL +
      `أعد مسودة مبادرة تربوية كاملة بالحقول التالية، مبنية على السياق المرفق فقط. ` +
      `كل الأثر والمؤشرات «متوقعة/مقترحة» — لا تدّعِ أن نتيجة تحققت. ` +
      `أعد JSON فقط بالشكل: ` +
      `{"name": "...", "idea": "...", "problem": "...", "generalGoal": "...", ` +
      `"objectives": ["...", "...", "...", "..."], "targetGroup": "...", ` +
      `"phases": "1. ...\\n2. ...", "resources": "...", "successIndicators": "...", ` +
      `"measurement": "...", "expectedImpact": "...", "recommendations": "..."} ` +
      NO_INVENTION,
    user: (c) => `الموضوع/البذرة: ${c.title ?? c.text ?? 'مبادرة تربوية'}\n${promptContext(c)}`,
    validate: (raw) => {
      const obj = parseJsonLoose(raw)
      const required = ['name', 'generalGoal', 'objectives']
      for (const k of required) {
        const v = obj[k]
        if (!v || (Array.isArray(v) && v.length < 2) || (typeof v === 'string' && !v.trim())) {
          throw new AiError('invalid_output', `الحقل «${k}» مفقود من المسودة.`)
        }
      }
      return obj
    },
  },

  // ─── مسودة خطة علاجية كاملة ─────────────────────────────────
  suggestRemedialPlan: {
    uiLabel: 'اقتراح خطة علاجية',
    loadingHint: 'جاري إعداد مسودة الخطة العلاجية…',
    jsonMode: true,
    temperature: 0.5,
    maxTokens: 1400,
    system: () =>
      PROFESSIONAL +
      `أعد مسودة خطة علاجية تربوية كاملة بالحقول التالية مبنية على السياق. ` +
      `القياس البعدي «مقترح» فقط إن لم يرد قياس فعلي. لا تخترع عدد طلاب ولا نسب نجاح تحققت. ` +
      `أعد JSON فقط بالشكل: ` +
      `{"diagnosis": "...", "skill": "...", "goal": "...", "targetGroup": "...", ` +
      `"duration": "...", "actions": "1. ...\\n2. ...", "activities": "...", ` +
      `"assessmentTools": "...", "postAssessment": "...", "successIndicators": "...", "title": "..."} ` +
      NO_INVENTION,
    user: (c) => `المادة: ${c.subject ?? 'غير محدد'}\nالمرحلة: ${c.stage ?? 'غير محدد'}\n${promptContext(c)}`,
    validate: (raw) => {
      const obj = parseJsonLoose(raw)
      const required = ['diagnosis', 'goal', 'actions']
      for (const k of required) {
        const v = obj[k]
        if (!v || (typeof v === 'string' && !v.trim())) {
          throw new AiError('invalid_output', `الحقل «${k}» مفقود من المسودة.`)
        }
      }
      return obj
    },
  },
}

function promptContext(c: Record<string, string>): string {
  const parts: string[] = []
  const skip = new Set(['title', 'text'])
  for (const [k, v] of Object.entries(c)) {
    if (skip.has(k) || !v) continue
    if (k === 'objectives') parts.push(`أهداف مدخلة:\n- ${v}`)
    else parts.push(`${k}: ${v}`)
  }
  return parts.length ? `السياق:\n${parts.join('\n')}` : ''
}

export function isAiAction(value: string): value is AiAction {
  return value in ACTIONS
}
