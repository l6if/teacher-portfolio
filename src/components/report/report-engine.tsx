'use client'

/**
 * محرك التقارير الموحد — PREVIEW = PRINT = PDF بنيويًا
 * ──────────────────────────────────────────────────────────
 * 1) طبقة قياس مخفية بعرض منطقة محتوى A4 نفسها تقيس التقرير كاملة.
 * 2) خوارزمية فواصل واعية بالمكونات: فواصل قسرية + احترام عدم القص +
 *    طي الصفحات الشبحية — وتسجيل «مرساة» أول صفحة لكل قسم (للفهرس الحقيقي).
 * 3) كل صفحة = ورقة A4 صريحة (PageShell) بنافذة محتوى من التدفق المقيس
 *    نفسه — فتتطابق المعاينة والطباعة وPDF صفحةً بصفحة.
 *
 * One-Page-First (وضع «official» — تقرير إنجاز مستقل):
 *   NORMAL → قياس → COMPACT → قياس → TIGHT → قياس → إن بقي الفائض: تقسيم صفحات.
 *   الكثافة تغيّر المسافات وميزانية الصور فقط — النص لا يُصغَّر أبدًا.
 */

import {
  createContext, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode, type RefObject,
} from 'react'
import { RD, type DensityLevel, type DensityTokens } from '@/lib/report-tokens'

export type { DensityLevel }

/* ─── ثوابت A4 — مطابقة لـ CSS الصفحة في globals.css ─────────── */

export const MM_PX = 96 / 25.4
export const PAGE_W_MM = 210
export const PAGE_H_MM = 297
/** ارتفاع الصفحة في DOM — أقل بـ 0.3mm من الورقة الفعلية: يستوعب تقريب
 *  المتصفح subpixel عند 297mm فيمنع صفحة فارغة زائدة في PDF
 *  (الهامش السفلي 15mm يستوعب الفرق — لا قصّ ولا تغيير بصري) */
export const PAGE_DOM_H_MM = 296.7
export const PAGE_W = PAGE_W_MM * MM_PX // ≈ 793.7px
export const PAGE_H = PAGE_H_MM * MM_PX // ≈ 1122.5px (الورقة المنطقية)
export const PAGE_DOM_H = PAGE_DOM_H_MM * MM_PX // ارتفاع DOM الفعلي للصفحة

/** هوامش الصفحة — أعلى/أسفل/جانبي (بالملم) */
export const PAGE_PAD = { top: 12, bottom: 15, side: 15 } as const
export const CONTENT_W_MM = PAGE_W_MM - PAGE_PAD.side * 2 // 180mm
export const CONTENT_H_MM = PAGE_H_MM - PAGE_PAD.top - PAGE_PAD.bottom // 270mm
export const CONTENT_H = CONTENT_H_MM * MM_PX

const EPS = 2
/** حد صفحة الشبح — فراغ أقل من ~12mm بين فاصلين قسريين متجاورين يُطوى */
const GHOST_PAGE_PX = 48

/* ─── سياقات المحرك ─────────────────────────────────────────── */

const DensityCtx = createContext<{ level: DensityLevel; t: DensityTokens }>({
  level: 'normal',
  t: RD.normal,
})

/** كثافة التقرير الحالية — تقرأها مكوّنات المحتوى لضبط المسافات والصور */
export function useReportDensity() {
  return useContext(DensityCtx)
}

export function DensityProvider({ level, children }: { level: DensityLevel; children: ReactNode }) {
  const value = useMemo(() => ({ level, t: RD[level] }), [level])
  return <DensityCtx.Provider value={value}>{children}</DensityCtx.Provider>
}

/** خريطة المرساة → رقم الصفحة الحقيقي (يملؤه المحرك بعد القياس) */
const PageMapCtx = createContext<Record<string, number>>({})

/** الفهرس يقرأ أرقام صفحاته الحقيقية من هنا — فارغة أثناء القياس الأول */
export function usePageMap() {
  return useContext(PageMapCtx)
}

export function PageMapProvider({ map, children }: { map: Record<string, number>; children: ReactNode }) {
  return <PageMapCtx.Provider value={map}>{children}</PageMapCtx.Provider>
}

/* ─── خوارزمية الفواصل — واعية بالمكونات والمراسي ───────────── */

export interface PageSlice {
  /** موضع بداية نافذة المحتوى لهذه الصفحة (px من أعلى التدفق المقيس) */
  start: number
  /** ارتفاع المحتوى الظاهر في الصفحة (px، ≤ CONTENT_H) */
  height: number
}

export interface PaginationResult {
  pages: PageSlice[]
  /** أول صفحة (0-based) يظهر فيها كل قسم ذو data-anchor */
  anchors: Record<string, number>
}

export function computePagesV2(container: HTMLElement): PaginationResult {
  const totalH = container.scrollHeight
  if (totalH <= 0) return { pages: [{ start: 0, height: CONTENT_H }], anchors: {} }

  const cRect = container.getBoundingClientRect()
  const spanOf = (el: Element) => {
    const r = el.getBoundingClientRect()
    return { top: r.top - cRect.top, bottom: r.bottom - cRect.top }
  }

  // عناصر نصية — لتمييز صفحة الشبح عن فائض محتوى حقيقي
  const textEls: { top: number; bottom: number }[] = []
  container.querySelectorAll('p, h1, h2, h3, h4, li, td, span').forEach((el) => {
    if (!el.textContent?.trim()) return
    const s = spanOf(el)
    if (s.bottom > EPS && s.top < totalH - EPS) textEls.push(s)
  })

  // فواصل قسرية: بداية صفحة إلزامية
  const forced: number[] = []
  container.querySelectorAll('.print-section-cover, .print-report-start').forEach((el) => {
    const { top } = spanOf(el)
    if (top > EPS && top < totalH - EPS) forced.push(top)
  })
  container.querySelectorAll('.print-page').forEach((el) => {
    const { bottom } = spanOf(el)
    if (bottom > EPS && bottom < totalH - EPS && textEls.some((t) => t.top > bottom + EPS)) forced.push(bottom)
  })
  forced.sort((a, b) => a - b)

  // كتل يمنع قصّها بين صفحتين
  const atomics: { top: number; bottom: number }[] = []
  container.querySelectorAll('.print-avoid-break, tr, figure').forEach((el) => {
    const s = spanOf(el)
    if (s.bottom - s.top > EPS && s.bottom > EPS && s.top < totalH - EPS) atomics.push(s)
  })

  // المرساة — أول صفحة تظهر فيها (تُحسب بعد اكتمال الصفحات)
  const anchorEls: { id: string; top: number }[] = []
  container.querySelectorAll('[data-anchor]').forEach((el) => {
    const { top } = spanOf(el)
    anchorEls.push({ id: (el as HTMLElement).dataset.anchor!, top })
  })

  const pages: PageSlice[] = []
  let start = 0
  let startWasForced = true
  let guard = 0
  while (start < totalH - EPS && guard++ < 400) {
    const limit = start + CONTENT_H

    const forcedHit = forced.find((f) => f > start + EPS && f <= Math.min(limit, totalH) - EPS)

    if (limit >= totalH - EPS && forcedHit === undefined) {
      pages.push({ start, height: Math.max(totalH - start, 10) })
      break
    }

    let end = limit
    let endWasForced = false

    if (forcedHit !== undefined) {
      end = forcedHit
      endWasForced = true
    } else {
      let moved = true
      let guarded = 0
      while (moved && guarded++ < 50) {
        moved = false
        for (const b of atomics) {
          if (b.top < end - EPS && b.bottom > end + EPS && b.top > start + EPS) {
            end = b.top
            moved = true
            break
          }
        }
      }
    }

    if (end <= start + EPS) {
      start = start + EPS
      continue
    }

    if (
      endWasForced && startWasForced && end - start < GHOST_PAGE_PX &&
      !textEls.some((t) => t.bottom > start + EPS && t.top < end - EPS)
    ) {
      start = end
      startWasForced = true
      continue
    }

    pages.push({ start, height: end - start })
    start = end
    startWasForced = endWasForced
  }

  if (!pages.length) pages.push({ start: 0, height: Math.max(totalH, 10) })

  // المرساة: أول صفحة تحتوي قمة العنصر
  const anchors: Record<string, number> = {}
  for (const a of anchorEls) {
    let page = pages.findIndex((p) => a.top >= p.start - EPS && a.top < p.start + p.height + EPS)
    if (page === -1) {
      // عنصر يبدأ في نهاية صفحة ويمتد — الصفحة التي تحتوي قمته الفعلية
      page = pages.findIndex((p) => a.top < p.start + p.height + CONTENT_H * 0.12)
      if (page === -1) page = pages.length - 1
    }
    if (!(a.id in anchors)) anchors[a.id] = page
  }

  return { pages, anchors }
}

/* ─── عدّادات الصور قبل القياس (أبعاد الصور تؤثر على التدفق) ── */

export async function waitForReportMedia(container: HTMLElement | null) {
  if (!container) return
  await document.fonts.ready
  const imgs = Array.from(container.querySelectorAll('img'))
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.onload = () => res()
            img.onerror = () => res()
          }),
    ),
  )
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  await new Promise((r) => requestAnimationFrame(() => r(null)))
}

/* ─── خطاف المحرك — القياس + تصعيد الكثافة (One-Page-First) ── */

export interface PagedReportState {
  /** ref لطبقة القياس — يعلّقها المستدعي على حاوية مخفية بعرض CONTENT_W_MM */
  measureRef: RefObject<HTMLDivElement | null>
  /** الكثافة المقررة */
  density: DensityLevel
  /** الصفحات المحسوبة — null أثناء القياس */
  pages: PageSlice[] | null
  /** خريطة المرساة → صفحة (0-based) */
  anchors: Record<string, number>
  /** حالة المحرك */
  status: 'measuring' | 'ready'
}

/**
 * الاستخدام:
 *   const { measureRef, density, pages, anchors, status } = useReportPagination({ deps: [config, data], enabled: true })
 *   <div ref={measureRef} className="rp-measure" style={{ width: CONTENT_W_MM + 'mm' }}>
 *     <DensityProvider level={density}>
 *       <PageMapProvider map={anchors}><ReportBody … /></PageMapProvider>
 *     </DensityProvider>
 *   </div>
 *   {pages?.map(...) }
 */
export function useReportPagination(opts: {
  /** مفاتيح التبعية — أي تغيّر يعيد القياس من الكثافة الابتدائية */
  deps: unknown[]
  enabled: boolean
  /** تفعيل One-Page-First — لتقرير الإنجاز المستقل */
  onePageFirst?: boolean
  /** الكثافة الابتدائية (الملف الكامل يبدأ مدمجًا بطبيعته) */
  initialDensity?: DensityLevel
}): PagedReportState {
  const { deps, enabled, onePageFirst = false, initialDensity = 'normal' } = opts

  const measureRef = useRef<HTMLDivElement | null>(null)
  const [density, setDensity] = useState<DensityLevel>(initialDensity)
  const [result, setResult] = useState<{ pages: PageSlice[]; anchors: Record<string, number> } | null>(null)
  const [status, setStatus] = useState<'measuring' | 'ready'>('measuring')
  /** أقفال سُلّم الكثافة — تُقرأ وتُكتب داخل الـ effect حصرًا */
  const exhaustedRef = useRef(false)
  const pageCountsRef = useRef<Partial<Record<DensityLevel, number>>>({})
  const lastInputsRef = useRef<unknown[]>(deps)

  // أي تغيّر في المدخلات يعيد القياس من الكثافة الابتدائية — نمط React
  // الموصى به لضبط الحالة أثناء العرض (setState أثناء الرندر لا داخل effect).
  // أقفال السُلّم (refs) تُدار داخل الـ effect حصرًا — لا تُمس أثناء الرندر.
  const [prevDeps, setPrevDeps] = useState<unknown[]>(deps)
  const [prevEnabled, setPrevEnabled] = useState(enabled)
  const depsChanged =
    deps.length !== prevDeps.length || deps.some((d, i) => d !== prevDeps[i])
  if (enabled && (prevEnabled !== enabled || depsChanged)) {
    setPrevDeps(deps)
    setPrevEnabled(enabled)
    setDensity(initialDensity)
    setResult(null)
    setStatus('measuring')
  }
  if (!enabled && prevEnabled !== enabled) {
    setPrevEnabled(enabled)
    setResult(null)
    setStatus('measuring')
  }

  // القياس عند كل تغيّر كثافة (يشمل العودة إلى normal)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    // مدخلات جديدة؟ (تغيّر عناصر deps لا هوية المصفوفة) — أعد ضبط أقفال السُلّم.
    // تغيّر الكثافة وحده (تصعيد/تراجع) لا يُعد مدخلات جديدة — يستكمل السُلّم.
    const isNewInput =
      lastInputsRef.current.length !== deps.length ||
      deps.some((d, i) => d !== lastInputsRef.current[i])
    if (isNewInput) {
      lastInputsRef.current = deps
      exhaustedRef.current = false
      pageCountsRef.current = {}
    }

    const run = async () => {
      setStatus('measuring')
      await waitForReportMedia(measureRef.current)
      if (cancelled) return
      // تمريرة استقرار: إعادة رسم أبعاد الصور (كشف الطول) والخطوط قد تصل متأخرة
      // عن اكتمال التحميل نفسه — مهلة قصيرة ثم إعادة انتظار تضمن قياسًا حتميًا
      // متطابقًا بين أي مستندين (معاينة/طباعة) على نفس المحتوى
      await new Promise((r) => setTimeout(r, 350))
      if (cancelled) return
      await waitForReportMedia(measureRef.current)
      if (cancelled) return
      const el = measureRef.current
      if (!el) return
      const { pages, anchors } = computePagesV2(el)
      if (cancelled) return

      // One-Page-First: صفحة واحدة؟ اقبل. وإلا صعّد الكثافة خطوة (مرة واحدة لكل مستوى).
      if (onePageFirst && pages.length > 1 && !exhaustedRef.current) {
        pageCountsRef.current[density] = pages.length
        const nextLevel: DensityLevel | undefined =
          density === 'normal' ? 'compact' : density === 'compact' ? 'tight' : undefined
        if (nextLevel) {
          setDensity(nextLevel)
          return
        }
        // استُنفد السُّلم بلا احتواء — القاعدة 70: القراءة أولًا ثم أقل صفحات.
        // نختار أريح كثافة تحقق أقل عدد صفحات مقيس (لا نُبقي الانضغاط الأقصى عبثًا)
        const counts = pageCountsRef.current
        const levels: DensityLevel[] = ['normal', 'compact', 'tight']
        const measured = levels.filter((l) => counts[l] != null)
        const minCount = Math.min(...measured.map((l) => counts[l]!))
        const optimal = measured.find((l) => counts[l] === minCount) ?? initialDensity
        exhaustedRef.current = true
        if (density !== optimal) {
          setDensity(optimal)
          return
        }
      }
      setResult({ pages, anchors })
      setStatus('ready')
    }

    run().catch(() => {
      if (!cancelled) {
        setResult({ pages: [{ start: 0, height: CONTENT_H }], anchors: {} })
        setStatus('ready')
      }
    })
    return () => {
      cancelled = true
    }
  }, [enabled, density, ...deps])

  return {
    measureRef,
    density,
    pages: result?.pages ?? null,
    anchors: result?.anchors ?? {},
    status,
  }
}

/** هل هذا الوضع من وضعيات التقرير المستقل (إنجاز واحد)؟ — تقرره طبقة القوالب */
export function isSingleDocumentMode(mode: string): boolean {
  return mode === 'official'
}
