/**
 * نظام تصميم التقارير المطبوعة — المصدر الوحيد للحقيقة (Design Tokens v2)
 * ─────────────────────────────────────────────────────────────────
 * الهوية الجديدة: وثيقة رسمية فاخرة — كحلي عميق + ذهبي هادئ
 * على خلفية عاجية دافئة بزخرفة هندسية إسلامية شبه غير مرئية.
 *
 * القواعد:
 *  - كل تقارير PDF تشترك في هذه الرموز حصرًا (طباعة/معاينة/PDF).
 *  - نظام كثافة NORMAL / COMPACT / TIGHT لمحرك One-Page-First.
 *  - النص لا يُصغَّر أبدًا بتغيّر الكثافة — تتغير المسافات والصور فقط.
 *
 * لتغيير الهوية مستقبلًا (شعار، لون، اسم المنصة): عدّل REPORT_BRAND فقط.
 */

export const REPORT_BRAND = {
  /** اسم المنصة — يظهر في الغلاف والتذييل وترخيم الصفحات */
  appName: 'ملف إنجاز المعلم',
  /** اللون الأساسي — كحلي عميق مريح للطباعة */
  primary: '#1B2A41',
  /** شعار وزارة التعليم السعودي — المصدر الموحد لكل تقرير (الأصل المتجهي الرسمي) */
  ministryLogo: '/branding/ministry-logo.svg' as string,
} as const

/** ألوان الهوية الفاخرة — كحلي عميق + ذهبي هادئ على عاجي */
export const RC = {
  primary: REPORT_BRAND.primary,
  /** كحلي أعمق للعناوين والحدود المؤكدة */
  primaryDeep: '#121D31',
  /** خلفية الصفحة — عاجي دافئ فاتح جدًا */
  cream: '#FBF8F1',
  /** عاجي أعمق قليلًا — شرائط زخرفية */
  creamDeep: '#F4EEDF',
  /** خلفية البطاقات — أبيض نظيف */
  paper: '#FFFFFF',
  /** صبغة كحلية خفيفة جدًا */
  tint: '#EEF1F6',
  /** خلفية مغسولة للمقاطع الثانوية */
  wash: '#F5F6F9',
  /** الذهبي الهادئ — حدود وتأكيدات دقيقة */
  gold: '#B8956A',
  /** ذهبي أعمق للنصوص الذهبية الصغيرة */
  goldDeep: '#8A6D2E',
  /** خلفية بصبغة ذهبية فاتحة */
  goldWash: '#F7F1E1',
  /** حد ذهبي رفيع (شعرة) */
  goldLine: '#D9C89E',
  /** نص أساسي — كحلي مسود عميق (ليس أسود 100%) */
  ink: '#1C2433',
  /** نص ثانوي */
  inkSoft: '#434C5E',
  /** نص معلق / تسميات */
  muted: '#6B7385',
  /** خط شعرة دافئ */
  line: '#E4DECF',
  /** خط أغمق للحدود المؤكدة */
  lineStrong: '#C2BA9F',
  /** لون النجاح المحدود — يُستخدم للتحسن فقط */
  success: '#0B6B4F',
  successTint: '#EAF5EF',
} as const

/**
 * مقياس المسافات الثابت — محوَّل إلى مليمترات A4.
 * لا Padding عشوائي في التقارير إطلاقًا.
 */
export const S = {
  s1: '1.1mm',   // ≈ 4px
  s2: '2.1mm',   // ≈ 8px
  s3: '3.2mm',   // ≈ 12px
  s4: '4.2mm',   // ≈ 16px
  s6: '6.4mm',   // ≈ 24px
  s8: '8.5mm',   // ≈ 32px
  s12: '12.7mm', // ≈ 48px
} as const

/** سلّم الطباعة — تراتب حقيقي H1/H2/H3/Body/Caption/Metric/Quote */
export const RT = {
  // الأحجام بالبكسل (تنقل للطباعة كما هي — A4 عند 96dpi ≈ 793px عرضًا)
  display: { fontSize: '34px', fontWeight: 300, lineHeight: 1.3, letterSpacing: '0.01em' },
  h1: { fontSize: '22px', fontWeight: 700, lineHeight: 1.4 },
  h2: { fontSize: '17px', fontWeight: 700, lineHeight: 1.45 },
  h3: { fontSize: '13.5px', fontWeight: 700, lineHeight: 1.55 },
  body: { fontSize: '10.5px', fontWeight: 400, lineHeight: 1.85 },
  bodyStrong: { fontSize: '10.5px', fontWeight: 600, lineHeight: 1.8 },
  caption: { fontSize: '8.5px', fontWeight: 500, lineHeight: 1.7, letterSpacing: '0.03em' },
  metric: { fontSize: '21px', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.01em' },
  metricLabel: { fontSize: '8px', fontWeight: 600, lineHeight: 1.5, letterSpacing: '0.06em' },
  quote: { fontSize: '11.5px', fontWeight: 400, lineHeight: 2, letterSpacing: '0.01em' },
} as const

/** الحدود والزوايا — أضيق وأرسم في الهوية الرسمية */
export const RR = {
  card: '2.2mm',
  chip: '99px',
  img: '1.6mm',
  bar: '99px',
} as const

/* ═══════════════════════════════════════════════════════════════
   نظام الكثافة — محرك One-Page-First (NORMAL / COMPACT / TIGHT)
   الكثافة تغيّر المسافات وميزانية الصور فقط — النص لا يُصغَّر أبدًا.
   ═══════════════════════════════════════════════════════════════ */

export type DensityLevel = 'normal' | 'compact' | 'tight'

export interface DensityTokens {
  /** فجوة بين الأقسام الرئيسية */
  sectionGap: string
  /** فجوة بين الحقول/البطاقات */
  blockGap: string
  /** padding رأسي للبطاقات */
  cardPadY: string
  /** padding أفقي للبطاقات */
  cardPadX: string
  /** فجوة قوائم/خطوات */
  listGap: string
  /** أقصى ارتفاع لصورة مفردة */
  imgSingle: string
  /** أقصى ارتفاع للقطة الشاشة الطويلة */
  imgTall: string
  /** أقصى ارتفاع لكل صورة في زوج */
  imgPair: string
  /** أقصى ارتفاع لخلية شبكة */
  imgGrid: string
}

export const RD: Record<DensityLevel, DensityTokens> = {
  normal: {
    sectionGap: '6.4mm',
    blockGap: '2.6mm',
    cardPadY: '3.6mm',
    cardPadX: '4.6mm',
    listGap: '2.1mm',
    imgSingle: '112mm',
    imgTall: '126mm',
    imgPair: '76mm',
    imgGrid: '56mm',
  },
  compact: {
    sectionGap: '4.2mm',
    blockGap: '1.8mm',
    cardPadY: '2.6mm',
    cardPadX: '3.6mm',
    listGap: '1.4mm',
    imgSingle: '92mm',
    imgTall: '102mm',
    imgPair: '62mm',
    imgGrid: '46mm',
  },
  tight: {
    sectionGap: '2.2mm',
    blockGap: '1mm',
    cardPadY: '1.5mm',
    cardPadX: '2.6mm',
    listGap: '0.8mm',
    imgSingle: '60mm',
    imgTall: '74mm',
    imgPair: '45mm',
    imgGrid: '32mm',
  },
}

export const DENSITY_ORDER: DensityLevel[] = ['normal', 'compact', 'tight']

/** التسميات العربية الموحدة لحقول الإنجاز في كل التقارير */
export const FIELD_LABELS = {
  description: 'الوصف',
  problem: 'المشكلة / الحاجة',
  goalText: 'الهدف',
  execution: 'التنفيذ',
  results: 'النتائج',
  impact: 'الأثر',
  notes: 'التوصيات والملاحظات',
  durationText: 'المدة',
} as const

/** نص التذييل المشترك */
export function footerLine(name: string, year: string) {
  return { right: `${name} — ${year}`, left: REPORT_BRAND.appName }
}

/* ═══ صياغة سطور الترويسة الرسمية — كلها من بيانات المستخدم، بلا Hardcode ═══ */

/** اسم المدرسة بلا تكرار كلمة «مدرسة» إن كانت موجودة أصلًا في القيمة */
export function schoolLine(school?: string | null): string | undefined {
  const v = school?.trim()
  if (!v) return undefined
  return /^(?:مدرسة|ثانوية|متوسطة|ابتدائية|ثانويـة)\s/.test(v) ? v : `مدرسة ${v}`
}

/** الإدارة التعليمية: اسم كامل يُعرض كما أُدخل، ومحافظة فقط تُركَّب في صيغة رسمية بلا مضاعفة */
export function educationAdminLine(admin?: string | null): string | undefined {
  const v = admin?.trim()
  if (!v) return undefined
  if (/إدارة|التعليم/.test(v)) return v
  return `الإدارة العامة للتعليم بمحافظة ${v}`
}

/** مكتب التعليم: يُعرض كما أُدخل إن كان اسمًا كاملًا، وإلا يُركَّب — ويُحذف السطر كليًا عند غيابه */
export function educationOfficeLine(office?: string | null): string | undefined {
  const v = office?.trim()
  if (!v) return undefined
  if (/مكتب|تعليم/.test(v)) return v
  return `مكتب التعليم بـ${v}`
}

/* ═══ الزخرفة الهندسية الإسلامية — نمط خلفية شبه غير مرئي ═══ */

/**
 * بلاطة نمط هندسي إسلامي (نجمة ثمانية + مربعان متراكبان) — SVG مضمّن.
 * تُستخدم كخلفية صفحات A4 بشفافية منخفضة جدًا (تُضبط في CSS).
 * أبعاد البلاطة 64px تتكرر بانتظام — لا تُطبع حادة في PDF أبدًا (متجهية).
 */
export const ISLAMIC_PATTERN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'%3E%3Cg fill='none' stroke='%230E5A45' stroke-opacity='0.045' stroke-width='1'%3E%3Cpath d='M36 8 L42 30 L64 36 L42 42 L36 64 L30 42 L8 36 L30 30 Z'/%3E%3Crect x='20' y='20' width='32' height='32'/%3E%3Crect x='20' y='20' width='32' height='32' transform='rotate(45 36 36)'/%3E%3C/g%3E%3C/svg%3E\")"
