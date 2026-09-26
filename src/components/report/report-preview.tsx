'use client'

/**
 * معاينة التقرير — مرحلة مستقلة قبل التنزيل
 * ──────────────────────────────────────────────
 * المبدأ: What You Preview Is What You Export — تعرض نفس ReportBody
 * (نفس مكونات PDF الحقيقية) مقسّمة إلى صفحات A4 فعلية:
 *
 * 1) طبقة قياس مخفية بعرض منطقة الطباعة نفسها (180mm) تقيس المحتوى.
 * 2) خوارزمية فواصل تحاكي قواعد الطباعة: فواصل قسرية (print-section-cover /
 *    print-page) + احترام عدم القص (print-avoid-break) + سعة الصفحة (255mm).
 * 3) كل صفحة = ورقة A4 بيضاء بهوامش @page نفسها وظل خفيف، تُظهر نافذتها
 *    الخاصة من المحتوى نفسه — فتتطابق المعاينة مع PDF المطبوع.
 *
 * الجوال: Fit Width + تكبير + تنقل بين الصفحات + مؤشر الصفحة الحالية.
 * رجوع للتعديل يغلق الطبقة فقط — شاشة الإعداد تبقى محمّلة بحالتها كاملة.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '@/store/app-store'
import { useReport } from '@/hooks/use-data'
import { Icon } from '@/components/shared/icon'
import { Button } from '@/components/ui/button'
import { ReportBody } from './report-print'
import { ReportImageProvider } from './report-image-context'
import { PrintFooter } from './report-parts'
import { RC } from '@/lib/report-tokens'

/* ثواطت A4 — مطابقة لـ @page في globals.css (18mm 15mm 24mm 15mm) */
const MM_PX = 96 / 25.4
const PAGE_W = 210 * MM_PX // ≈ 793.7px
const PAGE_H = 297 * MM_PX // ≈ 1122.5px
const CONTENT_W_MM = 180
const CONTENT_H_MM = 255
const CONTENT_H = CONTENT_H_MM * MM_PX // سعة المحتوى في الصفحة الواحدة
const EPS = 2
/** حد صفحة الشبح — فراغ أقل من ~12mm بين فاصلين قسريين متجاورين يُطوى */
const GHOST_PAGE_PX = 48

interface PageInfo {
  /** موضع بداية نافذة المحتوى لهذه الصفحة (px) */
  start: number
  /** ارتفاع المحتوى الظاهر في الصفحة (px، ≤ CONTENT_H) */
  height: number
}

/** خوارزمية الفواصل — تحاكي قواعد print CSS الحالية */
function computePages(container: HTMLElement): PageInfo[] {
  const totalH = container.scrollHeight
  if (totalH <= 0) return [{ start: 0, height: CONTENT_H }]

  const cRect = container.getBoundingClientRect()
  const spanOf = (el: Element) => {
    const r = el.getBoundingClientRect()
    return { top: r.top - cRect.top, bottom: r.bottom - cRect.top }
  }

  // فواصل قسرية: بداية صفحة إلزامية
  const forced: number[] = []
  container.querySelectorAll('.print-section-cover').forEach((el) => {
    const { top } = spanOf(el)
    if (top > EPS && top < totalH - EPS) forced.push(top)
  })
  container.querySelectorAll('.print-page').forEach((el) => {
    const { bottom } = spanOf(el)
    if (bottom > EPS && bottom < totalH - EPS) forced.push(bottom)
  })
  forced.sort((a, b) => a - b)

  // كتل يمنع قصّها بين صفحتين — print-avoid-break + صفوف الجداول والأشكال
  // (قواعد الطباعة الفعلية: tr/th/td/figure لديها page-break-inside: avoid)
  const atomics: { top: number; bottom: number }[] = []
  const atomicSelector = '.print-avoid-break, tr, figure'
  container.querySelectorAll(atomicSelector).forEach((el) => {
    const s = spanOf(el)
    if (s.bottom - s.top > EPS && s.bottom > EPS && s.top < totalH - EPS) atomics.push(s)
  })

  // عناصر نصية — لتمييز صفحة الشبح (فراغ بين فاصلين قسريين) عن فائض محتوى حقيقي
  const textEls: { top: number; bottom: number }[] = []
  container.querySelectorAll('p, h1, h2, h3, h4, li, td, span').forEach((el) => {
    if (!el.textContent?.trim()) return
    const s = spanOf(el)
    if (s.bottom > EPS && s.top < totalH - EPS) textEls.push(s)
  })

  const pages: PageInfo[] = []
  let start = 0
  let startWasForced = true // الصفحة الأولى تبدأ عند فاصل ضمني (بداية المستند)
  let guard = 0
  while (start < totalH - EPS && guard++ < 400) {
    const limit = start + CONTENT_H
    if (limit >= totalH - EPS) {
      pages.push({ start, height: Math.max(totalH - start, 10) })
      break
    }

    let end = limit
    let endWasForced = false

    // فاصل قسري داخل هذه الصفحة؟ الصفحة تنتهي عنده
    const forcedHit = forced.find((f) => f > start + EPS && f <= end - EPS)
    if (forcedHit !== undefined) {
      end = forcedHit
      endWasForced = true
    } else {
      // لا قص لكتلة avoid-break: إن عبرت الكتلة حد الصفحة تبدأ في التالية
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

    // صفحة فارغة تقريبًا (فاصل قسري متلاصق) → تقدّم البداية قليلًا وتابع
    if (end <= start + EPS) {
      start = start + EPS
      continue
    }

    // طيّ الفاصلين القسريين المتجاورين: الطباعة تدمجهما (CSS: adjacent forced
    // breaks collapse) — فلا صفحة للفراغ بينهما ما لم يوجد نص فعلي فيه
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
  return pages
}

/* ─── بطاقة صفحة A4 واحدة ─────────────────────────────────── */

function PageCard({
  page, index, total, mounted, data, config, user, yearLabel,
}: {
  page: PageInfo
  index: number
  total: number
  mounted: boolean
  data: Parameters<typeof ReportBody>[0]['data']
  config: Parameters<typeof ReportBody>[0]['config']
  user: { name: string }
  yearLabel: string
}) {
  return (
    <div
      data-rp-page={index}
      className="rp-card"
      style={{ width: '210mm', height: '297mm', padding: '18mm 15mm 24mm 15mm' }}
      aria-label={`صفحة ${index + 1} من ${total}`}
    >
      {mounted ? (
        <>
          {/* نافذة المحتوى — نفس ReportBody بإزاحة رأسية */}
          <div className="rp-window" style={{ height: page.height }}>
            <div style={{ position: 'absolute', top: -page.start, left: 0, right: 0 }}>
              <ReportImageProvider variant="preview">
                <ReportBody config={config} data={data} />
              </ReportImageProvider>
            </div>
          </div>
          {/* التذييل — يتكرر أسفل كل صفحة كما في الطباعة */}
          <div className="rp-card-footer">
            <PrintFooter name={user.name} year={yearLabel} />
          </div>
        </>
      ) : (
        <div className="rp-placeholder">
          <span>{index + 1}</span>
        </div>
      )}
    </div>
  )
}

/* ═══ شاشة المعاينة الكاملة ═════════════════════════════════ */

export function ReportPreview() {
  const previewConfig = useApp((s) => s.previewConfig)
  const setPreviewConfig = useApp((s) => s.setPreviewConfig)
  const setPrintConfig = useApp((s) => s.setPrintConfig)
  const { data, isLoading } = useReport()

  const [pages, setPages] = useState<PageInfo[] | null>(null)
  const [measureTick, setMeasureTick] = useState(0)
  const [visible, setVisible] = useState<Set<number>>(new Set([0]))
  const [current, setCurrent] = useState(0)
  /** null = ملاءمة العرض (تُحسب عند العرض) — رقم = تكبير صريح */
  const [scale, setScale] = useState<number | null>(null)
  /** إعادة الحساب عند تغيير حجم النافذة في وضع الملاءمة */
  const [resizeTick, setResizeTick] = useState(0)

  const measureRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  const open = Boolean(previewConfig)

  /* قفل تمرير الصفحة خلف المعاينة */
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  /* تغيّر حجم النافذة — يُعيد حساب الملاءمة (أثناء المعاينة فقط) */
  useEffect(() => {
    if (!open) return
    const onResize = () => setResizeTick((t) => t + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open])

  /* القياس: خطوط + صور ثم حساب الصفحات */
  useEffect(() => {
    if (!open || isLoading || !data || !previewConfig) return
    let cancelled = false

    const run = async () => {
      setPages(null)
      await document.fonts.ready
      if (cancelled) return
      // انتظر الصور داخل طبقة القياس
      const imgs = Array.from(measureRef.current?.querySelectorAll('img') ?? [])
      await Promise.all(imgs.map((img) =>
        img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res() }),
      ))
      if (cancelled) return
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      if (cancelled) return
      const el = measureRef.current
      if (el) setPages(computePages(el))
    }

    run().catch(() => { if (!cancelled) setPages([{ start: 0, height: CONTENT_H }]) })
    return () => { cancelled = true }
  }, [open, isLoading, data, previewConfig, measureTick])

  /* الصفحات المرئية (تحميل كسول ±صفحتين) */
  useEffect(() => {
    if (!open || !pages) return
    const root = scrollRef.current
    if (!root) return
    const io = new IntersectionObserver((entries) => {
      setVisible((prev) => {
        const next = new Set(prev)
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.rpPage)
          if (Number.isInteger(idx)) {
            if (e.isIntersecting) next.add(idx)
            else next.delete(idx)
          }
        }
        return next
      })
    }, { root, rootMargin: '1600px 0px' })

    root.querySelectorAll('[data-rp-page]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [open, pages])

  /* مؤشر الصفحة الحالية */
  const onPageScroll = useCallback(() => {
    const root = scrollRef.current
    if (!root || !pages) return
    const probe = root.scrollTop + root.clientHeight * 0.45
    let idx = 0
    for (let i = 0; i < cardRefs.current.length; i++) {
      const el = cardRefs.current[i]
      if (!el) continue
      if (el.offsetTop <= probe) idx = i
      else break
    }
    setCurrent(idx)
  }, [pages])

  useEffect(() => {
    const root = scrollRef.current
    if (!root || !open) return
    let raf = 0
    const handler = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(onPageScroll)
    }
    root.addEventListener('scroll', handler, { passive: true })
    return () => { root.removeEventListener('scroll', handler); cancelAnimationFrame(raf) }
  }, [open, onPageScroll])

  /* التنقل بين الصفحات */
  const goTo = useCallback((idx: number) => {
    const root = scrollRef.current
    const el = cardRefs.current[idx]
    if (!root || !el || !pages) return
    const clamped = Math.max(0, Math.min(pages.length - 1, idx))
    root.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' })
    setCurrent(clamped)
  }, [pages])

  /* التكبير — null يعني ملاءمة العرض (مشتقة أثناء العرض) */
  const fitScale = () => Number(Math.min(1, Math.max(0.3, (Math.min(window.innerWidth, 1400) - 48) / PAGE_W)).toFixed(3))
  const zoom = (dir: 1 | -1) => {
    setScale((prev) => {
      const base = prev ?? fitScale()
      return Math.min(1.6, Math.max(0.35, Number((base + dir * 0.15).toFixed(3))))
    })
  }
  const fitWidth = () => setScale(null)

  // الملاءمة تُشتق عند العرض — resizeTick يفجّر إعادة الحساب عند تغيّر النافذة
  const s = useMemo(() => scale ?? fitScale(), [scale, resizeTick])
  const total = pages?.length ?? 0

  const download = () => {
    if (!previewConfig) return
    setPrintConfig(previewConfig) // نفس الإعداد → نفس المكونات → PDF مطابق
  }

  const back = () => setPreviewConfig(null)

  const previewTitle = previewConfig?.title
  const isFit = scale === null

  const toolbar = useMemo(() => (
    <div className="rp-toolbar" dir="rtl">
      <div className="flex min-w-0 items-center gap-2.5">
        <Button variant="ghost" onClick={back} className="min-h-10 gap-2 rounded-xl px-3 text-sm font-semibold">
          <Icon name="ArrowRight" className="size-4" />
          <span className="hidden sm:inline">رجوع للتعديل</span>
        </Button>
        <div className="min-w-0 border-r border-white/15 pr-2.5 sm:pr-4">
          <h2 className="truncate text-sm font-bold text-white sm:text-base">معاينة التقرير</h2>
          <p className="hidden truncate text-[11px] text-white/60 sm:block">راجع التقرير قبل اعتماده أو تنزيله — {previewConfig?.title ?? ''}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* التكبير */}
        <div className="flex items-center gap-0.5 rounded-xl bg-white/10 p-0.5">
          <button onClick={() => zoom(-1)} className="flex size-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white" aria-label="تصغير">
            <Icon name="ZoomOut" className="size-4" />
          </button>
          <button onClick={fitWidth} className={`flex h-9 items-center justify-center rounded-lg px-2 text-xs font-bold tabular-nums transition-colors hover:bg-white/15 ${scale === null ? 'text-emerald-300' : 'text-white/80'}`} aria-label="ملاءمة العرض" title="ملاءمة العرض">
            {Math.round(s * 100)}%
          </button>
          <button onClick={() => zoom(1)} className="flex size-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white" aria-label="تكبير">
            <Icon name="ZoomIn" className="size-4" />
          </button>
        </div>
        <Button onClick={download} className="min-h-10 gap-2 rounded-xl bg-white px-4 text-sm font-bold text-emerald-900 hover:bg-emerald-50">
          <Icon name="Download" className="size-4" />
          <span className="hidden sm:inline">تنزيل PDF</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </div>
    </div>
  ), [s, isFit, previewTitle, back, download])

  if (!open || !previewConfig) return null

  if (isLoading) {
    return (
      <div id="report-preview-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-200" dir="rtl">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
          <p className="text-sm text-neutral-600">جارٍ تحميل بيانات التقرير…</p>
        </div>
      </div>
    )
  }

  return (
    <div id="report-preview-overlay" className="fixed inset-0 z-50 flex flex-col bg-neutral-200/95 backdrop-blur-sm" dir="rtl">
      {toolbar}

      {/* منطقة الصفحات */}
      <div ref={scrollRef} className="rp-scroll flex-1 overflow-auto">
        {pages === null ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
              <p className="text-sm text-neutral-600">جارٍ تهيئة المعاينة بدقة الطباعة…</p>
            </div>
          </div>
        ) : (
          <div style={{ width: PAGE_W * s, margin: '0 auto', padding: '24px 0 96px', display: 'flex', flexDirection: 'column', gap: 28 }}>
            {pages.map((p, i) => (
              <div
                key={i}
                ref={(el) => { cardRefs.current[i] = el }}
                style={{ width: PAGE_W * s, height: PAGE_H * s, flexShrink: 0 }}
                data-rp-wrapper={i}
              >
                <div style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${s})`, transformOrigin: 'top right', position: 'relative' }}>
                  <PageCard
                    page={p}
                    index={i}
                    total={total}
                    mounted={visible.has(i) || visible.has(i - 1) || visible.has(i + 1)}
                    data={data!}
                    config={previewConfig}
                    user={{ name: data!.user.name }}
                    yearLabel={data!.year.label}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* شريط التنقل السفلي — مؤشر الصفحة الحالية */}
      {pages && total > 0 && (
        <div className="rp-nav" dir="rtl">
          <button onClick={() => goTo(current - 1)} disabled={current === 0} className="flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 disabled:opacity-30" aria-label="الصفحة السابقة">
            <Icon name="ChevronRight" className="size-5" />
          </button>
          <span className="min-w-16 text-center text-sm font-bold tabular-nums text-white" aria-live="polite">
            {current + 1} / {total}
          </span>
          <button onClick={() => goTo(current + 1)} disabled={current === total - 1} className="flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 disabled:opacity-30" aria-label="الصفحة التالية">
            <Icon name="ChevronLeft" className="size-5" />
          </button>
        </div>
      )}

      {/* طبقة القياس المخفية — نفس مكونات التقرير بعرض منطقة الطباعة */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="rp-measure"
        style={{ width: `${CONTENT_W_MM}mm` }}
      >
        <ReportImageProvider variant="preview">
          <ReportBody config={previewConfig} data={data!} />
        </ReportImageProvider>
      </div>
    </div>
  )
}
