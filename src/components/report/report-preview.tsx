'use client'

/**
 * معاينة التقرير v2 — مرحلة مستقلة قبل الطباعة/التنزيل
 * ──────────────────────────────────────────────────────────────
 * تعرض مستند الصفحات الموحد نفسه (ReportDocument — نفس المكونات
 * التي ستُطبع وتُصدَّر PDF) بتكبير حر وملاءمة عرض وتنقل صفحات.
 *
 * المبدأ: PREVIEW = PRINT = PDF — المعاينة ليست نسخة ثانية من
 * التصميم بل نفس شجرة المحتوى بنفس خوارزمية التقسيم.
 *
 * الجوال: ملاءمة العرض تلقائيًا + تكبير + تنقل بين الصفحات.
 * «رجوع للتعديل» زر أبيض بارز أقصى اليمين دائمًا بكل المقاسات.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '@/store/app-store'
import { useReport } from '@/hooks/use-data'
import { Icon } from '@/components/shared/icon'
import { Button } from '@/components/ui/button'
import { ReportDocument } from './report-print'
import { PAGE_W, PAGE_DOM_H } from './report-engine'

/* ثوابت A4 */
const MM_PX = 96 / 25.4

export function ReportPreview() {
  const previewConfig = useApp((s) => s.previewConfig)
  const setPreviewConfig = useApp((s) => s.setPreviewConfig)
  const setPrintConfig = useApp((s) => s.setPrintConfig)
  const { data, isLoading } = useReport()

  const [totalPages, setTotalPages] = useState(0)
  const [visible, setVisible] = useState<Set<number>>(new Set([0]))
  const [current, setCurrent] = useState(0)
  /** null = ملاءمة العرض — رقم = تكبير صريح */
  const [scale, setScale] = useState<number | null>(null)
  const [resizeTick, setResizeTick] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const wrapperRefs = useRef<(HTMLDivElement | null)[]>([])

  const open = Boolean(previewConfig)

  /* عزل تمرير المعاينة عن قفل Radix (react-remove-scroll) —
     stopPropagation عند نافذة الالتقاط يعيد التمرير داخل المعاينة حصرًا */
  useEffect(() => {
    if (!open) return
    const stop = (e: WheelEvent | TouchEvent) => {
      const root = document.getElementById('report-preview-overlay')
      const t = e.target as Node | null
      if (root && t && root.contains(t)) e.stopPropagation()
    }
    window.addEventListener('wheel', stop, { passive: true, capture: true })
    window.addEventListener('touchmove', stop, { passive: true, capture: true })
    return () => {
      window.removeEventListener('wheel', stop, { capture: true })
      window.removeEventListener('touchmove', stop, { capture: true })
    }
  }, [open])

  /* قفل تمرير الصفحة خلف المعاينة */
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  /* تغيّر حجم النافذة — إعادة حساب الملاءمة */
  useEffect(() => {
    if (!open) return
    const onResize = () => setResizeTick((t) => t + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open])

  /* الصفحات المرئية — تحميل كسول ±صفحة (المستند يدير مراقبته بنفسه) */
  const mountedPredicate = useCallback((i: number) => visible.has(i) || visible.has(i - 1) || visible.has(i + 1), [visible])

  /* مراقبة الصفحات المرئية + الصفحة الحالية — من التمرير نفسه */
  useEffect(() => {
    if (!open) return
    const root = scrollRef.current
    if (!root) return
    let raf = 0
    const handler = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const wrappers = Array.from(root.querySelectorAll<HTMLElement>('[data-rp-wrapper]'))
        const probe = root.scrollTop + root.clientHeight * 0.45
        let idx = 0
        const next = new Set<number>()
        wrappers.forEach((el, i) => {
          const top = el.offsetTop
          const bottom = top + el.offsetHeight
          if (bottom > root.scrollTop - 1200 && top < root.scrollTop + root.clientHeight + 1200) next.add(i)
          if (top <= probe) idx = i
        })
        setVisible(next)
        setCurrent(idx)
      })
    }
    root.addEventListener('scroll', handler, { passive: true })
    handler()
    return () => { root.removeEventListener('scroll', handler); cancelAnimationFrame(raf) }
  }, [open, totalPages])

  /* التنقل بين الصفحات */
  const goTo = useCallback((idx: number) => {
    const root = scrollRef.current
    if (!root) return
    const el = root.querySelector<HTMLElement>(`[data-rp-wrapper="${Math.max(0, Math.min(totalPages - 1, idx))}"]`)
    if (el) {
      root.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' })
      setCurrent(idx)
    }
  }, [totalPages])

  /* التكبير — null يعني ملاءمة العرض */
  const fitScale = () => Number(Math.min(1, Math.max(0.3, (Math.min(window.innerWidth, 1400) - 48) / PAGE_W)).toFixed(3))
  const zoom = (dir: 1 | -1) => {
    setScale((prev) => {
      const base = prev ?? fitScale()
      return Math.min(1.6, Math.max(0.35, Number((base + dir * 0.15).toFixed(3))))
    })
  }
  const fitWidth = () => setScale(null)

  const s = useMemo(() => scale ?? fitScale(), [scale, resizeTick])  

  const download = () => {
    if (!previewConfig) return
    setPrintConfig(previewConfig) // نفس الإعداد → نفس المكونات → PDF مطابق
  }

  /** الطباعة المباشرة — نفس مسار PDF */
  const print = () => {
    if (!previewConfig) return
    setPrintConfig(previewConfig)
  }

  const back = () => setPreviewConfig(null)

  const previewTitle = previewConfig?.title

  /** تغليف كل صفحة للتكبير — نفس نمط القياس الأصلي */
  const pageWrapper = useCallback((index: number, _total: number, page: React.ReactNode) => {
    return (
      <div
        ref={(el) => { wrapperRefs.current[index] = el }}
        style={{ width: PAGE_W * s, height: PAGE_DOM_H * s, flexShrink: 0, overflow: 'hidden' }}
        data-rp-zoom={index}
      >
        <div style={{ width: PAGE_W, height: PAGE_DOM_H, transform: `scale(${s})`, transformOrigin: 'top right', position: 'relative' }}>
          {page}
        </div>
      </div>
    )
  }, [s])

  const onReady = useCallback((info: { pages: number }) => {
    setTotalPages(info.pages)
  }, [])

  const toolbar = useMemo(() => (
    <div className="rp-toolbar" dir="rtl">
      <div className="flex min-w-0 flex-auto items-center gap-2.5">
        {/* رجوع للتعديل — زر أبيض بارز أقصى اليمين */}
        <button type="button" onClick={back} className="rp-back-btn" aria-label="رجوع للتعديل">
          <Icon name="ArrowRight" className="size-4.5" strokeWidth={2.2} />
          <span>رجوع للتعديل</span>
        </button>
        <div className="min-w-0 border-r border-white/15 pr-2.5 sm:pr-4">
          <h2 className="truncate text-sm font-bold text-white sm:text-base">معاينة التقرير</h2>
          <p className="hidden truncate text-[11px] text-white/60 sm:block">راجع التقرير قبل اعتماده أو تنزيله — {previewTitle ?? ''}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
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
        {/* عدد الصفحات + الكثافة الفعلية للمستند الحالي */}
        <div className="hidden items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80 sm:flex" aria-live="polite">
          <span className="tabular-nums">{totalPages}</span>
          <span className="text-white/50">صفحة A4</span>
        </div>
        <Button onClick={print} className="min-h-10 gap-2 rounded-xl border border-white/25 bg-white/10 px-3 text-sm font-bold text-white hover:bg-white/20 sm:px-4">
          <Icon name="Printer" className="size-4" />
          <span className="hidden sm:inline">طباعة</span>
        </Button>
        <Button onClick={download} className="min-h-10 gap-2 rounded-xl bg-white px-4 text-sm font-bold text-emerald-900 hover:bg-emerald-50">
          <Icon name="Download" className="size-4" />
          <span className="hidden sm:inline">تنزيل PDF</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </div>
    </div>
  ), [s, scale, previewTitle, totalPages, back, download, print])  

  if (!open || !previewConfig) return null

  if (isLoading) {
    return (
      <div id="report-preview-overlay" className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-200" dir="rtl">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
          <p className="text-sm text-neutral-600">جارٍ تحميل بيانات التقرير…</p>
        </div>
      </div>
    )
  }

  return (
    <div id="report-preview-overlay" className="fixed inset-0 z-[70] flex flex-col bg-neutral-200/95 backdrop-blur-sm" dir="rtl">
      {toolbar}

      {/* منطقة الصفحات — المستند الموحد نفسه */}
      <div ref={scrollRef} className="rp-scroll flex-1 overflow-auto">
        {data ? (
          <div style={{ width: PAGE_W * s, margin: '0 auto', padding: '24px 0 96px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
            <ReportDocument
              config={previewConfig}
              data={data}
              variant="preview"
              pageWrapper={pageWrapper}
              mountedPredicate={mountedPredicate}
              onReady={onReady}
            />
          </div>
        ) : null}
      </div>

      {/* شريط التنقل السفلي — مؤشر الصفحة الحالية */}
      {totalPages > 0 && (
        <div className="rp-nav" dir="rtl">
          <button onClick={() => goTo(current - 1)} disabled={current === 0} className="flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 disabled:opacity-30" aria-label="الصفحة السابقة">
            <Icon name="ChevronRight" className="size-5" />
          </button>
          <span className="min-w-16 text-center text-sm font-bold tabular-nums text-white" aria-live="polite">
            {current + 1} / {totalPages}
          </span>
          <button onClick={() => goTo(current + 1)} disabled={current === totalPages - 1} className="flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 disabled:opacity-30" aria-label="الصفحة التالية">
            <Icon name="ChevronLeft" className="size-5" />
          </button>
        </div>
      )}
    </div>
  )
}
