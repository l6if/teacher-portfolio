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

/** مساعد الحقول الموحد: التعليمات المشتركة لكل الاقتراحات الحقلية —
 *  نص المستخدم الحالي مسودة يُبنى عليها ولا يُستبدل استبدالًا أعمى */
const FIELD_ASSIST =
  'إن ورد في السياق نص حالي للحقل نفسه فهو مسودة كتبها المستخدم: ' +
  'حسّن صياغتها وأكملها بناءً عليها دون إسقاط أي معلومة واقعية وردت فيها. ' +
  'وإن لم يرد نص فاقترح من السياق المتاح فقط. '

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
    maxTokens: 700,
    system: (c) =>
      PROFESSIONAL +
      `بناءً على العنوان والهدف والمشكلة والفئة المستفيدة والمدة وأي محتوى كتبه المستخدم، ` +
      `اقترح وصفًا عمليًا منظمًا لتنفيذ الإنجاز يجيب عن: ماذا نُفِّذ؟ وكيف؟ وبأي أساليب أو أدوات؟ ` +
      `قدّمه كخطوات مرقمة عملية (4-8 خطوات) أو فقرات موجزة حسب طبيعة العمل. ` +
      FIELD_ASSIST +
      `لا تخترع نشاطًا أو أداة لم تُذكر في السياق؛ إن كان السياق ناقصًا فاجعل الاقتراح عامًا قابلًا للتعديل بصيغة مقترحة لا مؤكدة. ` +
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
    // SHORTEN_CONTENT — «اختصر»: أقصر صياغة عربية مهنية ممكنة بلا أي اختراع
    uiLabel: 'اختصر',
    loadingHint: 'جارٍ الاختصار…',
    jsonMode: true,
    temperature: 0.25,
    maxTokens: 1600,
    system: (c) => {
      const more = c.shortenMore === '1'
      const target = FIELD_SHORTEN_GUIDE[c.fieldTarget ?? '']
      return (
        PROFESSIONAL +
        (more
          ? 'اختصر هذا النص أكثر إلى الحد الأدنى الممكن مع الحفاظ على المعلومات الجوهرية وصحة المعنى. '
          : 'اختصر النص إلى أقصر صياغة عربية مهنية ممكنة مع المحافظة على المعنى والمعلومات الجوهرية. ') +
        'قاعدة الحذف الوحيدة: احذف الحشو والتكرار والجمل الزائدة والتفاصيل غير الضرورية فقط — ' +
        'أما المعلومات الكمية فهي جوهرية لا يجوز حذفها أبدًا: كل رقم أو نسبة أو عدد أو تاريخ أو مدة أو اسم أداة ورد في النص الأصلي يجب أن يظهر في النص المختصر كما هو. ' +
        'طريقة العمل الإلزامية: (1) اجمع أولًا كل الأرقام والنسب والتواريخ والأعداد الواردة في النص، ' +
        '(2) ابنِ النص المختصر بحيث يتضمنها كلها ضمن صياغة مختصرة، (3) تأكد قبل الإخراج أن كل واحدة منها ظهرت فعلًا في نصك المختصر. ' +
        'لا تغيّر أي قيمة عددية أبدًا: النسب والأعداد والتواريخ والمدد تبقى بالقيمة نفسها تمامًا. ' +
        'أبقِ العدد بالصيغة التي كتبها المستخدم ما أمكن: ما ورد رقمًا يبقى رقمًا، وما ورد كلمةً عددية يبقى كلمةً عددية — ' +
        'ولا تحوّل بين الصيغتين إلا إذا كان ذلك ضروريًا جدًا للصياغة. ' +
        'ممنوع منعًا باتًا إضافة أي معلومة غير موجودة في النص: لا أعداد طلاب، لا نسب، لا تواريخ، لا نتائج، لا أدوات، لا أسماء، لا مدد، لا شهادات، لا شواهد. ' +
        'تعامل مع النص الموجود فقط — إعادة صياغة أقصر له، لا تأليف جديد. ' +
        (target ? `هذا النص لحقل «${target.label}» — الصيغة الملائمة: ${target.guide} ` : '') +
        'أعد JSON فقط بالشكل: {"shortenedText": "..."} دون أي مقدمات أو تعليقات.'
      )
    },
    user: (c) => {
      const text = (c.text ?? '').trim()
      // قائمة ميكانيكية بكل الأرقام والكلمات العددية الواردة في النص — تُدرج في رسالة المستخدم
      // حتى يلتزم النموذج بإبقائها مهما كان ضعيفًا (provider-agnostic) — تشمل الكلمات العددية
      // (ست/خمسة/عشر/ثمانية/مرتين…) لأن سقوطها تغيير قيمة مثل سقوط الأرقام تمامًا.
      const NUM_WORD_RE =
        /(?<![\u0600-\u06FF])(?:خمسة عشر|ستة عشر|سبعة عشر|ثمانية عشر|تسعة عشر|خمس عشرة|ست عشرة|سبع عشرة|ثماني عشرة|تسع عشرة|واحدة|واحد|اثنان|اثنين|اثنتان|اثنتين|ثلاثة|ثلاث|أربعة|أربع|خمسة|خمس|ستة|ست|سبعة|سبع|ثمانية|ثماني|تسعة|تسع|عشرة|عشر|عشرون|عشرين|ثلاثون|ثلاثين|أربعون|أربعين|خمسون|خمسين|ستون|ستين|سبعون|سبعين|ثمانون|ثمانين|تسعون|تسعين|مئة|مائة|مئتين|ألفا?|آلاف|مرتين|مرتان)(?![\u0600-\u06FF])/g
      const nums = Array.from(new Set([
        ...(text.match(/\d+(?:[.,]\d+)?%?/g) ?? []),
        ...(text.match(NUM_WORD_RE) ?? []),
      ]))
      return nums.length
        ? `${text}\n\n[قائمة الأعداد الواردة في النص أعلاه — يجب أن تظهر كلها في النص المختصر بنفس قيمتها، مُبقية كل واحدة على صيغتها كما وردت: ${nums.join('، ')}]`
        : text
    },
    validate: (raw) => {
      const obj = parseJsonLoose(raw)
      const v = String(obj.shortenedText ?? '').trim()
      if (v.length < 4) throw new AiError('invalid_output', 'نص مختصر غير صالح.')
      return { shortenedText: v }
    },
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
    jsonMode: true,
    temperature: 0.4,
    maxTokens: 300,
    system: (c) =>
      PROFESSIONAL +
      `صِغ حقل «الأثر» لهذا الإنجاز بحيث يختلف جوهريًا عن «النتائج»: النتائج = ماذا حدث مباشرة؟ ` +
      `أما الأثر = القيمة أو التغير الأوسع الناتج عن الإنجاز (على الطلاب أو الممارسة المهنية أو بيئة التعلم). ` +
      `اجعله من جملة إلى ثلاث جمل مهنية جامعة. ` +
      FIELD_ASSIST +
      `إن وردت نتائج في السياق فابنِ الأثر عليها دون تكرار صياغتها حرفيًا. ` +
      `ممنوع اختراع أي أرقام أو نسب أو أدلة — استند إلى السياق حصرًا، ` +
      `وإن كان السياق لا يدعم أثرًا محققًا فاستخدم صياغة الأثر المتوقع بوضوح. ` +
      `أعد JSON فقط بالشكل: {"impact": "..."}. ` +
      NO_INVENTION,
    user: (c) => `الموضوع: ${c.title ?? 'غير محدد'}\n${promptContext(c)}`,
    validate: (raw) => {
      const obj = parseJsonLoose(raw)
      const v = String(obj.impact ?? '').trim()
      if (v.length < 12) throw new AiError('invalid_output', 'أثر غير كافٍ.')
      return { impact: v }
    },
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

  // ═══ مساعد الحقول الموحد — عملية مستقلة لكل حقل مهم في نموذج الإنجاز ═══
  // كل عملية: JSON صارم + سياق النموذج فقط + لا اختراع وقائع/أرقام إطلاقًا.

  // ─── 1) عنوان الإنجاز — واحد فقط ────────────────────────────────
  suggestAchievementTitle: {
    uiLabel: 'اقتراح العنوان',
    loadingHint: 'جاري اقتراح العنوان…',
    jsonMode: true,
    temperature: 0.5,
    maxTokens: 120,
    system: (c) =>
      PROFESSIONAL +
      `اقترح عنوانًا واحدًا فقط لهذا الإنجاز المهني. ` +
      `شروط العنوان: عربي مهني واضح ومختصر (من 4 إلى 10 كلمات)، مناسب لتقرير رسمي، ` +
      `ليس جملة طويلة ولا يحوي عبارات مدح أو تفاخر مبالغ فيه. ` +
      `ابنِه حصرًا من معلومات السياق المتاحة (نوع الإنجاز، المجال، المشكلة/الحاجة، وصف التنفيذ، الفئة المستفيدة). ` +
      FIELD_ASSIST +
      `لا تخترع أي معلومة غير موجودة في السياق. ` +
      `أعد JSON فقط بالشكل: {"title": "..."}. ` +
      NO_INVENTION,
    user: (c) => `الموضوع/البذرة الحالية: ${c.title ?? '(لا يوجد بعد)'}\n${promptContext(c)}`,
    validate: (raw) => {
      const obj = parseJsonLoose(raw)
      const v = String(obj.title ?? '').trim()
      if (v.length < 6 || v.length > 120) throw new AiError('invalid_output', 'عنوان غير صالح.')
      return { title: v }
    },
  },

  // ─── 2) وصف مختصر — 1-3 جمل ─────────────────────────────────────
  suggestShortDescription: {
    uiLabel: 'اقتراح الوصف المختصر',
    loadingHint: 'جاري اقتراح الوصف المختصر…',
    jsonMode: true,
    temperature: 0.45,
    maxTokens: 280,
    system: (c) =>
      PROFESSIONAL +
      `اقترح وصفًا مختصرًا (من جملة إلى ثلاث جمل فقط) يلخص هذا الإنجاز استنادًا إلى معلومات السياق حصرًا. ` +
      `لا تكرر العنوان حرفيًا — أضف قيمة تلخيصية موجزة (الغاية وطريقة العمل والناتج العام). ` +
      FIELD_ASSIST +
      `أعد JSON فقط بالشكل: {"description": "..."}. ` +
      NO_INVENTION,
    user: (c) => `الموضوع: ${c.title ?? 'غير محدد'}\n${promptContext(c)}`,
    validate: (raw) => {
      const obj = parseJsonLoose(raw)
      const v = String(obj.description ?? '').trim()
      if (v.length < 10) throw new AiError('invalid_output', 'وصف غير كافٍ.')
      return { description: v }
    },
  },

  // ─── 3) المشكلة أو الحاجة — بلا قياسات مختلقة ─────────────────────
  suggestProblem: {
    uiLabel: 'اقتراح المشكلة/الحاجة',
    loadingHint: 'جاري صياغة المشكلة أو الحاجة…',
    jsonMode: true,
    temperature: 0.45,
    maxTokens: 350,
    system: (c) =>
      PROFESSIONAL +
      `صِغ صياغة مهنية لـ«المشكلة أو الحاجة» التي أدت إلى هذا الإنجاز استنادًا إلى السياق حصرًا. ` +
      `ممنوع منعًا باتًا اختراع: نسب مئوية، أعداد طلاب، نتائج تشخيصية، درجات، اختبارات — ` +
      `إلا إذا وردت نصًا صريحًا في مدخلات المستخدم. ` +
      `إن لم تتوفر تفاصيل فاستخدم صياغة مهنية عامة قابلة للتعديل ` +
      `(مثل: «لوحظ وجود تفاوت في مستوى الطلاب في مهارات …») دون ادعاء أي قياس. ` +
      FIELD_ASSIST +
      `أعد JSON فقط بالشكل: {"problem": "..."}. ` +
      NO_INVENTION,
    user: (c) => `الموضوع: ${c.title ?? 'غير محدد'}\n${promptContext(c)}`,
    validate: (raw) => {
      const obj = parseJsonLoose(raw)
      const v = String(obj.problem ?? '').trim()
      if (v.length < 10) throw new AiError('invalid_output', 'صياغة غير كافية.')
      return { problem: v }
    },
  },

  // ─── 4) مراحل التنفيذ — مراحل متكيفة لا قالب ثابت ─────────────────
  suggestStages: {
    uiLabel: 'اقتراح مراحل التنفيذ',
    loadingHint: 'جاري اقتراح مراحل التنفيذ…',
    jsonMode: true,
    temperature: 0.45,
    maxTokens: 500,
    system: (c) =>
      PROFESSIONAL +
      `اقترح مراحل تنفيذ مرتبة (من 3 إلى 7 مراحل) لهذا الإنجاز، متكيفة مع طبيعته الفعلية الظاهرة في السياق ` +
      `(نوع الإنجاز، المدة، وصف التنفيذ، المراحل الحالية إن وُجدت) — ` +
      `لا تستخدم القالب الخماسي نفسه لكل إنجاز؛ عدّل عدد المراحل ومضمونها حسب العمل. ` +
      `صِغ كل مرحلة جملة قصيرة عملية واضحة. ` +
      FIELD_ASSIST +
      `أعد JSON فقط بالشكل: {"stages": ["...", "...", "..."]}. ` +
      NO_INVENTION,
    user: (c) => `الموضوع: ${c.title ?? 'غير محدد'}\n${promptContext(c)}`,
    validate: (raw) => {
      const obj = parseJsonLoose(raw)
      const list = obj.stages
      if (!Array.isArray(list) || list.length < 2 || list.length > 8) {
        throw new AiError('invalid_output', 'عدد مراحل غير مناسب.')
      }
      const stages = list.map((s) => String(s ?? '').trim()).filter(Boolean)
      if (stages.length < 2) throw new AiError('invalid_output', 'مراحل فارغة.')
      return { stages }
    },
  },

  // ─── 5) النتائج — وصفية/متوقعة فقط بلا أرقام مختلقة ────────────────
  suggestResults: {
    uiLabel: 'اقتراح النتائج',
    loadingHint: 'جاري صياغة النتائج…',
    jsonMode: true,
    temperature: 0.4,
    maxTokens: 400,
    system: (c) =>
      PROFESSIONAL +
      `اقترح صياغة حقل «النتائج» لهذا الإنجاز. ` +
      `قاعدة صارمة: ممنوع اختراع أي أرقام أو نسب أو أعداد أو قياسات ` +
      `(مثل «ارتفع التحصيل 30%» أو «نجح 25 طالبًا») إلا إذا وردت حرفيًا في مدخلات المستخدم. ` +
      `إن وردت نتائج فعلية في السياق فصِغها مهنيًا مع الحفاظ عليها بدقة دون إضافة عليها. ` +
      `وإن لم توجد قياسات فعلية فاستخدم لغة وصفية متحفظة مدعومة بالسياق فقط ` +
      `(مثل: «أسهم التنفيذ في تعزيز…»، «لوحظ تفاعل أفضل أثناء…»)، ` +
      `أو صيغة «النتائج المتوقعة…» — ولا تقدم أيًّا منها كحقيقة مقيسة. ` +
      FIELD_ASSIST +
      `أعد JSON فقط بالشكل: {"results": "..."}. ` +
      NO_INVENTION,
    user: (c) => `الموضوع: ${c.title ?? 'غير محدد'}\n${promptContext(c)}`,
    validate: (raw) => {
      const obj = parseJsonLoose(raw)
      const v = String(obj.results ?? '').trim()
      if (v.length < 10) throw new AiError('invalid_output', 'نتائج غير كافية.')
      return { results: v }
    },
  },
}

function promptContext(c: Record<string, string>): string {
  const parts: string[] = []
  const skip = new Set(['title', 'text', 'fieldTarget', 'shortenMore'])
  for (const [k, v] of Object.entries(c)) {
    if (skip.has(k) || !v) continue
    if (k === 'objectives') parts.push(`أهداف مدخلة:\n- ${v}`)
    else parts.push(`${k}: ${v}`)
  }
  return parts.length ? `السياق:\n${parts.join('\n')}` : ''
}

/** توجيه اختصار واعٍ بنوع الحقل (SHORTEN_CONTENT) — الصيغة الملائمة لكل حقل */
const FIELD_SHORTEN_GUIDE: Record<string, { label: string; guide: string }> = {
  title: { label: 'عنوان الإنجاز', guide: 'عنوان قصير جدًا ومهني (٣–٧ كلمات).' },
  description: { label: 'الوصف المختصر', guide: 'جملة إلى جملتين فقط.' },
  goalText: { label: 'الهدف', guide: 'جملة مباشرة واحدة تبدأ بالمقصود من العمل.' },
  problem: { label: 'المشكلة أو الحاجة', guide: 'الحاجة الأساسية فقط في جملة أو جملتين.' },
  execution: { label: 'ماذا نُفِّذ وكيف', guide: 'ماذا تم وكيف بأقل صياغة مناسبة مع الإبقاء على الخطوات الجوهرية.' },
  actions: { label: 'مراحل التنفيذ', guide: 'ادمج المراحل المتشابه واحذف التفاصيل المكررة — كل مرحلة سطر واحد قصير.' },
  results: { label: 'النتائج', guide: 'أهم النتائج فقط مع كل الأرقام الواردة كما هي.' },
  impact: { label: 'الأثر', guide: 'جملة مختصرة تصف الأثر الأساسي.' },
  notes: { label: 'الملاحظات', guide: 'أهم الملاحظات فقط.' },
  reflection: { label: 'التأمل المهني', guide: 'جوهر الإجابة في جملة إلى ثلاث جمل.' },
}

export function isAiAction(value: string): value is AiAction {
  return value in ACTIONS
}
