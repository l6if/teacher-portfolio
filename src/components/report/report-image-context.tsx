'use client'

/**
 * سياق صور التقارير — نسخ محسّنة للطباعة والمعاينة
 * ──────────────────────────────────────────────────
 * «What You Preview Is What You Export»: نفس المكونات، ونفس الأبعاد
 * ونسبة العرض — تختلف فقط درجة دقة الصورة (المعاينة أخف، والطباعة أدق).
 *
 * toImgUrl(url):
 *   - روابط /api/files/<id> المرفوعة → تُزاد بمعاملات التحسين ?w=&q=
 *     (يعيد الخادم نسخة مضغوطة مناسبة للطباعة/المعاينة — الملف الأصلي لا يُمس).
 *   - الأصول الثابتة (SVG في /uploads) → كما هي — متجهات صغيرة أصلًا.
 */

import { createContext, useContext } from 'react'

export type ReportImageVariant = 'print' | 'preview'

const PRINT_MAX_W = 1600 // عرض كافٍ لجودة طباعة A4 (~200dpi على 180mm)
const PREVIEW_MAX_W = 1000 // أخف للتمرير السلس على الشاشة
const QUALITY = 82

interface Ctx {
  variant: ReportImageVariant
  /** رابط الصورة بصيغته النهائية حسب السياق الحالي */
  toImgUrl: (url: string | null | undefined) => string
}

const ReportImageContext = createContext<Ctx>({
  variant: 'print',
  toImgUrl: (url) => buildImgUrl(url, 'print'),
})

export function buildImgUrl(url: string | null | undefined, variant: ReportImageVariant): string {
  if (!url) return ''
  // فقط الملفات المرفوعة عبر الخادم — الأصول الثابتة تمر كما هي
  if (!url.startsWith('/api/files/')) return url
  const w = variant === 'print' ? PRINT_MAX_W : PREVIEW_MAX_W
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}w=${w}&q=${QUALITY}`
}

export function ReportImageProvider({
  variant,
  children,
}: {
  variant: ReportImageVariant
  children: React.ReactNode
}) {
  const toImgUrl = (url: string | null | undefined) => buildImgUrl(url, variant)
  return <ReportImageContext.Provider value={{ variant, toImgUrl }}>{children}</ReportImageContext.Provider>
}

export function useReportImages(): Ctx {
  return useContext(ReportImageContext)
}

/** للاستخدام خارج مكونات React (مكونات الطباعة الحالية) */
export function toImgUrl(url: string | null | undefined): string {
  return buildImgUrl(url, 'print')
}
