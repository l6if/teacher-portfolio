// تنسيق التواريخ والأرقام بالعربية (أرقام لاتينية للوضوح)

const dateFmt = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {
  day: 'numeric', month: 'long', year: 'numeric',
})
const shortFmt = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {
  day: 'numeric', month: 'long',
})
const monthFmt = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', { month: 'long' })

const relFmt = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' })

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  try { return dateFmt.format(new Date(d)) } catch { return '—' }
}

export function formatDateShort(d: string | Date | null | undefined): string {
  if (!d) return '—'
  try { return shortFmt.format(new Date(d)) } catch { return '—' }
}

export function formatMonth(d: string | Date | null | undefined): string {
  if (!d) return '—'
  try { return monthFmt.format(new Date(d)) } catch { return '—' }
}

export function relTime(d: string | Date | null | undefined): string {
  if (!d) return ''
  const date = new Date(d)
  const diffMs = date.getTime() - Date.now()
  const absMinutes = Math.abs(diffMs) / 60000
  if (absMinutes < 1) return 'الآن'
  if (absMinutes < 60) return relFmt.format(Math.round(diffMs / 60000), 'minute')
  const absHours = Math.abs(diffMs) / 3600000
  if (absHours < 24) return relFmt.format(Math.round(diffMs / 3600000), 'hour')
  const days = Math.round(diffMs / 86400000)
  if (Math.abs(days) < 30) return relFmt.format(days, 'day')
  const months = Math.round(days / 30)
  if (Math.abs(months) < 12) return relFmt.format(months, 'month')
  return relFmt.format(Math.round(months / 12), 'year')
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('ar-u-nu-latn').format(n)
}

export function formatHours(n: number | null | undefined): string {
  if (!n) return '0'
  return `${formatNumber(n)} ساعة`
}

export function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} بايت`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} ك.ب`
  return `${(bytes / 1024 / 1024).toFixed(1)} م.ب`
}

export function improvement(pre: number | null | undefined, post: number | null | undefined): number | null {
  if (pre === null || pre === undefined || post === null || post === undefined) return null
  return Math.round((post - pre) * 10) / 10
}

export function toDateInput(d: string | Date | null | undefined): string {
  if (!d) return ''
  const date = new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** ترتيب الأشهر عربيًا للرحلة المهنية */
export const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
