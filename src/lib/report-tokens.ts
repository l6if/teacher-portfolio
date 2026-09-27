/**
 * نظام تصميم التقارير المطبوعة — المصدر الوحيد للحقيقة (Design Tokens)
 * ─────────────────────────────────────────────────────────────────
 * كل تقارير PDF تشترك في هذه الرموز: الطباعة، المسافات، الحدود، الألوان،
 * بطاقات الإنجاز، المقاييس — فلا يُصمَّم تقرير بطريقة مختلفة عن الآخر.
 *
 * الهوية: Modern / Elegant / Minimal / Arabic-first / Educational
 * لون أساسي واحد + محايدات + نجاح محدود — ممتاز بالأبيض والأسود أيضًا.
 *
 * لتغيير الهوية مستقبلًا (شعار، لون، اسم المدرسة): عدّل BRAND فقط.
 */

export const REPORT_BRAND = {
  /** اسم المنصة — يظهر في الغلاف والتذييل */
  appName: 'ملف إنجاز المعلم',
  /** اللون الأساسي للهوية — أخضر زمردي */
  primary: '#0E7F6E',
  /** شعار وزارة التعليم السعودي — المصدر الموحد لكل تقرير (بريد/معاينة/PDF).
   *  الأصل الرسمي المتجهي (SVG) من موقع الوزارة نفسها، بخلفية شفافة، مع تكييف
   *  لون التعبئة الوحيد إلى الأخضر المعماري نفسه الذي تستخدمه الوزارة (#2FAB99)
   *  ليصلح للطباعة على ورق أبيض — المسارات المتجهية كما هي بلا أي إعادة رسم.
   *  الملفان في public/branding/ (نسخة بيضاء أصلية محفوظة بجانبها للاستخدام على خلفيات داكنة). */
  ministryLogo: '/branding/ministry-logo.svg' as string,
} as const

/** ألوان الطباعة — محايدات هادئة بلون واحد */
export const RC = {
  primary: REPORT_BRAND.primary,
  primaryDeep: '#0A5D51',
  /** خلفية صبغة خفيفة جدًا (10%) */
  tint: '#EDF5F2',
  /** خلفية مغسولة للمقاطع الثانوية */
  wash: '#F6FAF8',
  /** نص أساسي — أخضر مسود عميق */
  ink: '#1D2B27',
  /** نص ثانوي */
  inkSoft: '#41524C',
  /** نص معلق / تسميات */
  muted: '#66786F',
  /** خط شعرة */
  line: '#D9E3DF',
  /** خط أغمق للحدود المؤكدة */
  lineStrong: '#B4C6C0',
  /** لون النجاح المحدود — يُستخدم للتحسن فقط */
  success: '#0B6B4F',
  successTint: '#EAF5EF',
} as const

/**
 * مقياس المسافات الثابت — 4/8/12/16/24/32/48 بكسل (محوَّلة إلى مليمترات A4).
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
  display: { fontSize: '30px', fontWeight: 300, lineHeight: 1.35, letterSpacing: '0.02em' },
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

/** الحدود والزوايا */
export const RR = {
  card: '3mm',
  chip: '99px',
  img: '1.8mm',
  bar: '99px',
} as const

/** التسميات العربية الموحدة لحقول الإنجاز في كل التقارير */
export const FIELD_LABELS = {
  description: 'الوصف',
  problem: 'المشكلة / الحاجة',
  goalText: 'الهدف',
  execution: 'التنفيذ',
  results: 'النتائج',
  impact: 'الأثر',
  notes: 'ملاحظات',
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
  return /^مدرسة\s/.test(v) ? v : `مدرسة ${v}`
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
