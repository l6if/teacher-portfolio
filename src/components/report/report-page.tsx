'use client'

/**
 * صفحة A4 واحدة — الهيكل البصري الموحد للمعاينة والطباعة وPDF.
 * ───────────────────────────────────────────────────────────────
 * خلفية عاجية + نمط هندسي إسلامي شبه غير مرئي + ترويسة/تذييل الصفحة
 * (اسم المعلم/ة والعام ورقم الصفحة) داخل منطقة الهوامش — لا يأكلان
 * من مساحة المحتوى أبدًا.
 *
 * المعاينة فقط: ظل خفيف جدًا + شارة «معاينة» صغيرة — لا تظهر في الطباعة/PDF.
 */

import type { ReactNode } from 'react'
import { RC, REPORT_BRAND, ISLAMIC_PATTERN_URL } from '@/lib/report-tokens'
import { PAGE_PAD, PAGE_W_MM, PAGE_DOM_H_MM, type PageSlice } from './report-engine'

export type ReportVariant = 'preview' | 'print'

export interface PageChrome {
  /** اسم المعلم/ة للتذييل */
  name: string
  /** العام الدراسي */
  year: string
  /** اسم المدرسة للترويسة الخفيفة (اختياري) */
  school?: string | null
}

export interface PageShellProps {
  slice: PageSlice
  index: number
  total: number
  variant: ReportVariant
  mounted: boolean
  chrome: PageChrome
  /** الصفحة الأولى غلاف مستقل — بلا ترويسة/تذييل ترخيم */
  cover?: boolean
  children: ReactNode
}

export function PageShell({
  slice,
  index,
  total,
  variant,
  mounted,
  chrome,
  cover = false,
  children,
}: PageShellProps) {
  const isCover = cover
  return (
    <div
      data-rp-page={index}
      className={`rp-page${variant === 'preview' ? ' rp-page-preview' : ''}`}
      style={{
        width: `${PAGE_W_MM}mm`,
        height: `${PAGE_DOM_H_MM}mm`,
        position: 'relative',
        direction: 'rtl',
        background: RC.cream,
        backgroundImage: ISLAMIC_PATTERN_URL,
        backgroundRepeat: 'repeat',
        overflow: 'hidden',
      }}
      aria-label={`صفحة ${index + 1} من ${total}`}
    >
      {mounted ? (
        <>
          {/* ترويسة الصفحة — داخل الهامش العلوي، لا تُطبَع على الغلاف */}
          {!isCover && (
            <div
              className="rp-chrome-top"
              style={{
                position: 'absolute',
                top: `${PAGE_PAD.top - 8.4}mm`,
                right: `${PAGE_PAD.side}mm`,
                left: `${PAGE_PAD.side}mm`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                fontSize: '7.5px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: RC.muted,
              }}
            >
              <span>{chrome.school ?? chrome.year}</span>
              <span style={{ color: RC.goldDeep }}>{REPORT_BRAND.appName}</span>
            </div>
          )}

          {/* نافذة المحتوى — شريحة من التدفق المقيس نفسه */}
          <div
            className="rp-window"
            style={{
              position: 'absolute',
              top: `${PAGE_PAD.top}mm`,
              right: `${PAGE_PAD.side}mm`,
              left: `${PAGE_PAD.side}mm`,
              height: `${slice.height / 3.7795}mm`,
              overflow: 'hidden',
            }}
          >
            {children}
          </div>

          {/* تذييل الصفحة — داخل الهامش السفلي */}
          {!isCover && (
            <div
              className="rp-chrome-bottom"
              style={{
                position: 'absolute',
                bottom: `${PAGE_PAD.bottom - 10.6}mm`,
                right: `${PAGE_PAD.side}mm`,
                left: `${PAGE_PAD.side}mm`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                fontSize: '8px',
                fontWeight: 600,
                color: RC.muted,
                borderTop: `0.6px solid ${RC.goldLine}`,
                paddingTop: '1.6mm',
              }}
            >
              <span>
                {chrome.name} — {chrome.year}
              </span>
              <span style={{ color: RC.primaryDeep, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                {index + 1} / {total}
              </span>
              <span>{REPORT_BRAND.appName}</span>
            </div>
          )}

          {/* شارة المعاينة — في وضع المعاينة حصرًا، لا تُطبع أبدًا */}
          {variant === 'preview' && (
            <div
              aria-hidden="true"
              className="rp-preview-chip"
              style={{
                position: 'absolute',
                bottom: '2.2mm',
                left: '4mm',
                fontSize: '6.5px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: RC.goldDeep,
                opacity: 0.55,
              }}
            >
              معاينة
            </div>
          )}
        </>
      ) : (
        <div className="rp-placeholder" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '22px', fontWeight: 300, color: RC.lineStrong, fontVariantNumeric: 'tabular-nums' }}>{index + 1}</span>
        </div>
      )}
    </div>
  )
}

/** مُغلِّف نافذة المحتوى — يزيح التدفق المقيس إلى موضع الشريحة */
export function ContentSlice({ slice, children }: { slice: PageSlice; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', top: -slice.start, right: 0, left: 0 }}>
      {children}
    </div>
  )
}
