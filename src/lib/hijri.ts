/**
 * طبقة التحويل المركزية للتقويم الهجري — أم القرى (Islamic Umm al-Qura)
 * ─────────────────────────────────────────────────────────────────
 * المبدأ: التخزين يبقى معياريًا ISO/Gregorian داخل قاعدة البيانات،
 * والعرض للمستخدم يكون هجريًا أم القرى في كل مكان (التطبيق + تقارير PDF).
 *
 *   stored date (ISO) ──► toHijri/formatHijri ──► «16 ربيع الآخر 1448 هـ» في الواجهة
 *   اختيار هجري ──► fromHijri ──► ISO معياري يُخزَّن كما هو
 *
 * التحويل يعتمد Intl.DateTimeFormat بتقويم islamic-umalqura (جدول أم القرى
 * الرسمي المدمج في ICU) — لا جداول يدوية قابلة للانحراف.
 *
 * هذه هي الأداة الوحيدة للتحويل — يُمنع تكرار منطق التحويل في المكونات.
 */

/** أسماء الأشهر الهجرية — الصياغة الرسمية السعودية */
export const HIJRI_MONTHS = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
] as const

export interface HijriParts {
  day: number
  month: number // 1..12
  year: number // هـ
}

/* ─── محول Intl (مرة واحدة) ─────────────────────────────────── */

const umqFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
})

/** ميلادي (محلي) ──► هجري أم القرى */
export function toHijri(date: Date): HijriParts {
  const parts = umqFmt.formatToParts(date)
  const num = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value)
  return { day: num('day'), month: num('month'), year: num('year') }
}

/** اليوم بالهجري — أم القرى */
export function hijriToday(): HijriParts {
  return toHijri(new Date())
}

/* ─── هجري ──► ميلادي (بحث عن التطابق عبر Intl — دقة أم القرى الكاملة) ─── */

/** مرساة تقريبية: 1 محرم 1هـ ≈ 19 يوليو 622م (الخطأ الثابت يغطيه نطاق البحث) */
const HIJRI_EPOCH_UTC = Date.UTC(622, 6, 19)
const AVG_YEAR_DAYS = 354.36706
const AVG_MONTH_DAYS = 29.530589
const DAY_MS = 86_400_000

/** تقدير ميلادي تقريبي ليوم هجري معين (قد ينحرف أيامًا — يصححه البحث) */
function estimateGregorianMs(h: HijriParts): number {
  return (
    HIJRI_EPOCH_UTC +
    ((h.year - 1) * AVG_YEAR_DAYS + (h.month - 1) * AVG_MONTH_DAYS + (h.day - 1)) * DAY_MS
  )
}

/**
 * هجري ──► ميلادي (منتصف الليل المحلي).
 * يعيد null إذا كان التركيب غير صالح في تقويم أم القرى
 * (مثل يوم 30 في شهر من 29 يومًا) — لا تواريخ غير صالحة إطلاقًا.
 */
export function fromHijri(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 30 || year < 1300 || year > 1600) return null

  const target = { year, month, day }
  const center = estimateGregorianMs({ year, month, day })
  // نطاق البحث ±60 يومًا يغطي أي انحراف تراكمي للجدول مع هامش مريح
  const startMs = center - 60 * DAY_MS
  const start = new Date(startMs)
  const startY = start.getFullYear()
  const startM = start.getMonth()
  const startD = start.getDate()

  for (let i = 0; i <= 120; i++) {
    const d = new Date(startY, startM, startD + i)
    const h = toHijri(d)
    if (h.year === year && h.month === month && h.day === day) return d
    // تخطي ذكي: إذا تجاوز التقدير الهدف ب.month كثيرًا نستمر — البحث خطي بسيط وسريع
  }
  return null
}

/** عدد أيام الشهر الهجري وفق أم القرى — 29 أو 30 (تلقائيًا حسب الشهر والسنة) */
export function hijriMonthLength(year: number, month: number): number {
  if (month < 1 || month > 12) return 30
  return fromHijri(year, month, 30) ? 30 : 29
}

/** هل التركيب الهجري صالح في أم القرى؟ */
export function isValidHijri(year: number, month: number, day: number): boolean {
  return day >= 1 && day <= hijriMonthLength(year, month)
}

/* ─── التنسيق والعرض ────────────────────────────────────────── */

/** استخراج أجزاء التاريخ الميلادي المحلية من قيمة مخزنة (ISO أو Date) */
export function gregorianParts(d: string | Date | null | undefined): { y: number; m: number; day: number } | null {
  if (!d) return null
  if (typeof d === 'string') {
    // قيمة بتاريخ فقط (YYYY-MM-DD) تُقرأ كما كُتبت دون انزياح منطقة زمنية
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d.trim())
    if (m) return { y: +m[1], m: +m[2], day: +m[3] }
  }
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, day: dt.getDate() }
}

/** قيمة مخزنة ──► أجزاء هجرية (للواجهة) */
export function storedToHijri(d: string | Date | null | undefined): HijriParts | null {
  const g = gregorianParts(d)
  if (!g) return null
  return toHijri(new Date(g.y, g.m - 1, g.day))
}

/**
 * قيمة مخزنة ──► نص هجري للمستخدم: «16 ربيع الآخر 1448 هـ»
 * (أرقام لاتينية — اتساقًا مع هوية التطبيق)
 */
export function formatHijri(d: string | Date | null | undefined): string {
  const h = storedToHijri(d)
  if (!h) return '—'
  return `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year} هـ`
}

/** نسخة قصيرة: «16 ربيع الآخر» */
export function formatHijriShort(d: string | Date | null | undefined): string {
  const h = storedToHijri(d)
  if (!h) return '—'
  return `${h.day} ${HIJRI_MONTHS[h.month - 1]}`
}

/** اسم الشهر الهجري فقط: «ربيع الآخر» */
export function hijriMonthName(d: string | Date | null | undefined): string {
  const h = storedToHijri(d)
  if (!h) return '—'
  return HIJRI_MONTHS[h.month - 1]
}

/* ─── التخزين المعياري ──────────────────────────────────────── */

/** Date محلي ──► ISO «YYYY-MM-DD» للتخزين (كما تتعامل بقية النظام) */
export function dateToISOInput(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** اختيار هجري ──► ISO معياري يُخزَّن في قاعدة البيانات (null إذا غير صالح) */
export function hijriToISOInput(year: number, month: number, day: number): string | null {
  const d = fromHijri(year, month, day)
  return d ? dateToISOInput(d) : null
}

/** نطاق سنوات معقول للمنتقي حول سنة مرجعية (للعرض في القائمة) */
export function hijriYearOptions(centerYear: number, span = 12): number[] {
  const start = Math.max(1300, centerYear - span)
  const end = Math.min(1600, centerYear + span)
  const years: number[] = []
  for (let y = end; y >= start; y--) years.push(y)
  return years
}
