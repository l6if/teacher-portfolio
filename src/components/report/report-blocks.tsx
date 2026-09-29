'use client'

/**
 * مكوّنات البناء المشتركة للهوية الجديدة — أخضر سعودي عميق + ذهبي هادئ على عاجي.
 * كل التقارير تُبنى منها حصرًا: الغلاف، السيرة، الملخص، الفهرس، المجالات،
 * الإقرار، وتقرير الإنجاز. الصور عبر محرك المعرض الذكي (واعٍ بالكثافة).
 */

import { useState } from 'react'
import {
  RC, S, RT, RR, REPORT_BRAND, FIELD_LABELS,
  schoolLine, educationAdminLine, educationOfficeLine,
} from '@/lib/report-tokens'
import { useReportDensity } from './report-engine'
import { useReportImages } from './report-image-context'
import { usePageMap } from './report-engine'
import { getGenderedLabels, type GenderValue } from '@/lib/gender'
import { isOriginalSize } from '@/components/shared/attachment-ui'
import { ATTACHMENT_KINDS } from '@/lib/constants'
import { formatDate, formatNumber, improvement } from '@/lib/format'
import type { TAchievement, TAttachment, TDomainNode } from '@/lib/types'
import type { ReportData } from '@/hooks/use-data'

/* ═══ عناصر مشتركة صغيرة ═══════════════════════════════════════ */

export function Rule({ width = '100%', color = RC.line, weight = '0.6px', margin = '0' }: { width?: string; color?: string; weight?: string; margin?: string }) {
  return <div style={{ width, borderBottom: `${weight} solid ${color}`, margin }} aria-hidden="true" />
}

/** حد مزدوج رسمي ذهبي/أخضر — توقيع الهوية الجديدة */
export function OfficialRule({ margin = '0' }: { margin?: string }) {
  return (
    <div style={{ margin }} aria-hidden="true">
      <div style={{ borderBottom: `1.6px solid ${RC.primaryDeep}` }} />
      <div style={{ height: '0.7mm' }} />
      <div style={{ borderBottom: `0.6px solid ${RC.gold}` }} />
    </div>
  )
}

/** تسمية حقل — خضراء عميقة صغيرة */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-block', minWidth: '19mm', color: RC.primaryDeep, fontSize: '9px', fontWeight: 700, letterSpacing: '0.02em', verticalAlign: 'top', paddingTop: '0.6mm' }}>
      {children}
    </span>
  )
}

/** حقل نصي — لا يُقص بين صفحتين */
export function LabeledField({ label, value }: { label: string; value?: string | null }) {
  const { t } = useReportDensity()
  if (!value) return null
  return (
    <div className="print-avoid-break" style={{ display: 'flex', gap: '2mm', marginBottom: t.blockGap, pageBreakInside: 'avoid' }}>
      <FieldLabel>{label}</FieldLabel>
      <p style={{ margin: 0, flex: 1, minWidth: 0, ...RT.body, color: RC.inkSoft, textAlign: 'right' }}>{value}</p>
    </div>
  )
}

/** بطاقة مقياس — رقم كبير + خط ذهبي علوي */
export function Metric({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div style={{ borderTop: `1.2px solid ${accent ? RC.gold : RC.lineStrong}`, paddingTop: S.s2, minWidth: 0 }}>
      <p style={{ margin: 0, ...RT.metric, color: accent ? RC.primaryDeep : RC.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <p style={{ margin: `${S.s1} 0 0`, ...RT.metricLabel, color: RC.muted }}>{label}</p>
    </div>
  )
}

/** نجمة ثمانية مركزية للغلاف — عنصر بصري رسمي فاخر (أخضر + ذهبي) */
export function CoverMedallion({ size = 120 }: { size?: number }) {
  const g = RC.gold
  const gr = RC.primary
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" style={{ display: 'block' }}>
      <circle cx="60" cy="60" r="56" fill="none" stroke={g} strokeWidth="1" opacity="0.9" />
      <circle cx="60" cy="60" r="49" fill="none" stroke={g} strokeWidth="0.6" opacity="0.55" />
      <path
        d="M60 16 L71 49 L104 60 L71 71 L60 104 L49 71 L16 60 L49 49 Z"
        fill={RC.tint}
        stroke={gr}
        strokeWidth="1.4"
      />
      <rect x="34" y="34" width="52" height="52" fill="none" stroke={g} strokeWidth="0.9" opacity="0.85" />
      <rect x="34" y="34" width="52" height="52" fill="none" stroke={g} strokeWidth="0.9" opacity="0.85" transform="rotate(45 60 60)" />
      <path d="M60 38 L67.5 52.5 L82 60 L67.5 67.5 L60 82 L52.5 67.5 L38 60 L52.5 52.5 Z" fill={gr} opacity="0.92" />
      <circle cx="60" cy="60" r="7" fill={RC.cream} />
      <circle cx="60" cy="60" r="3.2" fill={g} />
    </svg>
  )
}

/** شريط تقدم رفيع — أخضر على شريط دافئ */
export function ProgressBar({ pct, height = '2.4mm', color }: { pct: number; height?: string; color?: string }) {
  const p = Math.max(0, Math.min(100, pct))
  return (
    <div style={{ width: '100%', height, background: RC.creamDeep, borderRadius: RR.bar, overflow: 'hidden' }}>
      <div style={{ width: `${p}%`, height: '100%', background: color ?? `linear-gradient(to left, ${RC.primary}, ${RC.primaryDeep})`, borderRadius: RR.bar }} />
    </div>
  )
}

/** حلقة تقدم SVG دائرية — للمجالات والاكتمال */
export function ProgressRing({ pct, size = 54, stroke = 3.5, color = RC.primary, track = RC.creamDeep, children }: { pct: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode }) {
  const p = Math.max(0, Math.min(100, pct))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${(c * p) / 100} ${c}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children ?? <span style={{ fontSize: `${size / 4.4}px`, fontWeight: 800, color: RC.primaryDeep, fontVariantNumeric: 'tabular-nums' }}>{formatNumber(Math.round(p))}%</span>}
      </div>
    </div>
  )
}

/* ═══ الترويسة الرسمية — شعار الوزارة + سطور الجهة الديناميكية ═══ */

export function MinistryLogo({ size = 56 }: { size?: number }) {
  if (!REPORT_BRAND.ministryLogo) return null
  return (
    <img
      src={REPORT_BRAND.ministryLogo}
      alt="شعار وزارة التعليم"
      style={{ height: size, width: 'auto', maxWidth: '40%', objectFit: 'contain', display: 'block', flexShrink: 0 }}
    />
  )
}

export function orgHeaderLines(user: { school?: string | null; educationAdmin?: string | null; educationOffice?: string | null }): { text: string; strong?: boolean }[] {
  return [
    { text: 'المملكة العربية السعودية', strong: true },
    { text: 'وزارة التعليم' },
    { text: educationAdminLine(user.educationAdmin) ?? '' },
    { text: educationOfficeLine(user.educationOffice) ?? '' },
    { text: schoolLine(user.school) ?? '' },
  ].filter((l) => l.text !== '')
}

/** ترويسة الجهة الرسمية — سطور ديناميكية + العام الدراسي، بحد مزدوج ذهبي */
export function OrgHeaderStrip({ user, year, compact = false }: { user: ReportData['user']; year: string; compact?: boolean }) {
  const org = orgHeaderLines(user)
  return (
    <div className="print-avoid-break" style={{ pageBreakInside: 'avoid', pageBreakAfter: 'avoid' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: S.s4 }}>
        <MinistryLogo size={compact ? 48 : 54} />
        <div style={{ flex: 1, textAlign: 'right', minWidth: 0, paddingTop: '0.8mm' }}>
          {org.map((l, i) => (
            <p key={i} style={{
              margin: 0,
              ...RT.caption,
              fontSize: i === 0 ? '9.5px' : '9px',
              fontWeight: l.strong ? 700 : 500,
              color: i === 0 || (l.strong && i === org.length - 1) ? RC.ink : RC.muted,
              lineHeight: 1.9,
            }}>
              {l.text}
            </p>
          ))}
        </div>
        <p style={{ margin: 0, ...RT.caption, color: RC.muted, whiteSpace: 'nowrap', paddingTop: '0.8mm' }}>العام الدراسي {year}</p>
      </div>
      <div style={{ marginTop: S.s3 }}>
        <OfficialRule />
      </div>
    </div>
  )
}

/* ═══ محرك الصور الذكي — Gallery v2 ════════════════════════════
 * واعٍ بالكثافة (ميزانية ارتفاع لكل مستوى) وبأبعاد الصور الطبيعية:
 * مفردة: وسط بحجم متوسط | زوج: عمودان | 3-4: شبكة 2×2 | 5+: تصغير تدريجي
 * الصورة + تسميتها وحدة واحدة (break-inside: avoid) — دائمًا object-fit: contain.
 * لقطة الشاشة الطويلة (نسبة ≥ 1.35): صف مستقل كامل حتى لا تُحشر في عمود ضيق.
 */

export function Gallery({ images }: { images: (TAttachment & { url: string })[] }) {
  const { toImgUrl } = useReportImages()
  const { t, level } = useReportDensity()
  const [dims, setDims] = useState<Record<string, { w: number; h: number }>>({})
  if (!images.length) return null

  const isTall = (img: TAttachment & { url: string }) => {
    const d = dims[img.id]
    return Boolean(d && d.w > 0 && d.h / d.w >= 1.35)
  }

  // بناء الصفوف
  const rows: { images: (TAttachment & { url: string })[]; wide: boolean }[] = []
  let pairAcc: (TAttachment & { url: string })[] = []
  const flushPair = () => {
    if (pairAcc.length) {
      rows.push({ images: pairAcc, wide: false })
      pairAcc = []
    }
  }
  for (const img of images) {
    const solo = isOriginalSize(img) || isTall(img)
    if (solo) {
      flushPair()
      rows.push({ images: [img], wide: true })
    } else {
      pairAcc.push(img)
      if (pairAcc.length === 2) flushPair()
    }
  }
  flushPair()

  const onImgLoad = (id: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget
    if (el.naturalWidth > 0 && el.naturalHeight > 0) {
      setDims((d) => (d[id]?.w === el.naturalWidth && d[id]?.h === el.naturalHeight ? d : { ...d, [id]: { w: el.naturalWidth, h: el.naturalHeight } }))
    }
  }

  // ميزانية الارتفاع حسب العدد والكثافة — الصور أولًا تُضغط قبل النص دائمًا
  const budget = () => {
    const n = images.length
    if (n === 1) return { single: t.imgSingle, pair: t.imgPair, grid: t.imgGrid, tall: t.imgTall }
    if (n === 2) return { single: t.imgSingle, pair: t.imgPair, grid: t.imgGrid, tall: t.imgTall }
    if (n <= 4) return { single: t.imgPair, pair: t.imgPair, grid: t.imgGrid, tall: t.imgTall }
    // 5+ — تصغير تدريجي إضافي ضمن حد القراءة
    const squeeze = level === 'tight' ? 0.86 : 0.92
    return {
      single: `${parseFloat(t.imgSingle) * squeeze}mm`,
      pair: `${parseFloat(t.imgPair) * squeeze}mm`,
      grid: `${parseFloat(t.imgGrid) * squeeze}mm`,
      tall: `${parseFloat(t.imgTall) * squeeze}mm`,
    }
  }
  const B = budget()

  return (
    <div style={{ marginTop: S.s2, display: 'flex', flexDirection: 'column', gap: S.s2 }}>
      {rows.map((row, ri) => {
        const original = isOriginalSize(row.images[0])
        const single = row.images.length === 1
        const soloTall = single && isTall(row.images[0])
        return (
          <div
            key={ri}
            className="print-avoid-break"
            style={{
              display: 'flex',
              gap: S.s2,
              pageBreakInside: 'avoid',
              justifyContent: single && !original ? 'center' : 'stretch',
            }}
          >
            {row.images.map((img) => {
              // مفرد: ميزانية مفردة (أصلي/طويل/عادي) — زوج: ميزانية الزوج (شبكة 2×2 عند 3-4)
              const maxHeight = single
                ? original ? t.imgTall : soloTall ? B.tall : B.single
                : B.pair
              return (
                <figure
                  key={img.id}
                  style={{
                    margin: 0,
                    flex: single ? (original || soloTall ? '1 1 auto' : '0 0 72%') : '1 1 0',
                    minWidth: 0,
                    maxWidth: '100%',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                  }}
                >
                  <img
                    src={toImgUrl(img.url)}
                    alt={img.title}
                    onLoad={(e) => onImgLoad(img.id, e)}
                    style={{
                      width: '100%',
                      maxHeight,
                      objectFit: 'contain',
                      borderRadius: RR.img,
                      border: `0.7px solid ${RC.line}`,
                      background: RC.paper,
                      display: 'block',
                      marginLeft: 'auto',
                      marginRight: 'auto',
                    }}
                  />
                  <figcaption style={{ marginTop: '1.2mm', textAlign: 'center', ...RT.caption, color: RC.muted, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {img.title}
                  </figcaption>
                </figure>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/** بطاقة شاهد غير صوري — اسم الملف ونوعه، والروابط قابلة للنقر في PDF */
export function EvidenceCard({ a }: { a: TAttachment }) {
  const isLink = a.kind === 'LINK'
  const kindLabel = ATTACHMENT_KINDS[a.kind]?.label ?? 'مرفق'
  const ellipsis = { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', minWidth: 0 } as const
  return (
    <div className="print-avoid-break" style={{ display: 'flex', alignItems: 'center', gap: '2mm', border: `0.7px solid ${RC.goldLine}`, borderRadius: RR.card, padding: '1.6mm 3.5mm', background: RC.paper, pageBreakInside: 'avoid' }}>
      <span style={{ width: '1.6mm', height: '1.6mm', borderRadius: RR.chip, background: RC.gold, flexShrink: 0 }} aria-hidden="true" />
      <span style={{ ...RT.body, fontSize: '9.5px', color: RC.ink, flexShrink: 0 }}>شاهد {isLink ? 'رابط' : 'مرفق'}:</span>
      <span style={{ ...RT.bodyStrong, fontSize: '9.5px', color: RC.inkSoft, flexShrink: 1, ...ellipsis }}>{a.title}</span>
      {a.fileName && !isLink && (
        <span dir="ltr" style={{ ...RT.caption, color: RC.muted, flexShrink: 1, ...ellipsis }}>{a.fileName}</span>
      )}
      {isLink && a.url ? (
        <a href={a.url} target="_blank" rel="noopener noreferrer" dir="ltr" style={{ ...RT.caption, color: RC.primaryDeep, textDecoration: 'none', flexShrink: 1, ...ellipsis }}>
          {a.url.replace(/^https?:\/\//, '')}
        </a>
      ) : (
        <span style={{ ...RT.caption, color: RC.muted, border: `0.6px solid ${RC.line}`, borderRadius: RR.chip, padding: '0.4mm 2.2mm', flexShrink: 0 }}>{kindLabel}</span>
      )}
    </div>
  )
}

export function FileEvidenceList({ files }: { files: TAttachment[] }) {
  const { t } = useReportDensity()
  if (!files.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: t.blockGap }}>
      {files.map((f) => <EvidenceCard key={f.id} a={f} />)}
    </div>
  )
}

/* ═══ القياس القبلي/البعدي — بطاقة عاجية بحافة ذهبية ═══ */

export function BeforeAfter({ pre, post }: { pre: number; post: number }) {
  const diff = improvement(pre, post) ?? 0
  return (
    <div className="print-avoid-break" style={{ marginTop: S.s3, padding: `${S.s3} ${S.s4}`, background: RC.goldWash, borderRadius: RR.card, border: `0.7px solid ${RC.goldLine}`, pageBreakInside: 'avoid' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: S.s4 }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.muted }}>قبل</p>
          <p style={{ margin: '1mm 0 0', fontSize: '17px', fontWeight: 700, color: RC.inkSoft, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{formatNumber(pre)}%</p>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.muted }}>بعد</p>
          <p style={{ margin: '1mm 0 0', fontSize: '17px', fontWeight: 700, color: RC.primaryDeep, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{formatNumber(post)}%</p>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'center', borderRight: `0.8px solid ${RC.goldLine}`, paddingRight: S.s4 }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.success }}>التحسن</p>
          <p style={{ margin: '1mm 0 0', ...RT.metric, color: RC.success, fontSize: '19px' }}>+{formatNumber(diff)}</p>
        </div>
      </div>
      <div style={{ marginTop: S.s3, display: 'flex', flexDirection: 'column', gap: '1.6mm' }} aria-hidden="true">
        <div style={{ height: '2.2mm', background: RC.creamDeep, borderRadius: RR.bar }}>
          <div style={{ width: `${Math.min(100, pre)}%`, height: '100%', background: RC.lineStrong, borderRadius: RR.bar }} />
        </div>
        <div style={{ height: '2.2mm', background: RC.creamDeep, borderRadius: RR.bar }}>
          <div style={{ width: `${Math.min(100, post)}%`, height: '100%', background: RC.primary, borderRadius: RR.bar }} />
        </div>
      </div>
    </div>
  )
}

/* ═══ عنوان قسم رسمي — شرطة خضراء + ذهبي ═══ */

export function SectionHeading({ children, kicker, first = false }: { children: React.ReactNode; kicker?: string; first?: boolean }) {
  const { t, level } = useReportDensity()
  const tight = level === 'tight'
  return (
    <div className="print-avoid-break" style={{ marginTop: first ? 0 : t.sectionGap, pageBreakInside: 'avoid', pageBreakAfter: 'avoid' }}>
      {kicker && <p style={{ margin: 0, ...RT.caption, color: RC.goldDeep, letterSpacing: '0.16em' }}>{kicker}</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: S.s2 }}>
        <span style={{ width: '1.4mm', height: tight ? '4mm' : '5mm', background: RC.primary, borderRadius: RR.chip, flexShrink: 0 }} aria-hidden="true" />
        <h2 style={{ margin: 0, ...RT.h2, color: RC.ink, fontSize: '15px' }}>{children}</h2>
      </div>
      <Rule margin={tight ? `${S.s1} 0 ${S.s1}` : `${S.s1} 0 ${S.s3}`} color={RC.goldLine} weight="0.8px" />
    </div>
  )
}

/** شارة نصية صغيرة — للأنواع والحالات */
export function Badge({ children, tone = 'green' }: { children: React.ReactNode; tone?: 'green' | 'gold' | 'neutral' | 'success' }) {
  const styles = {
    green: { bg: RC.tint, fg: RC.primaryDeep, border: `0.6px solid ${RC.line}` },
    gold: { bg: RC.goldWash, fg: RC.goldDeep, border: `0.6px solid ${RC.goldLine}` },
    neutral: { bg: RC.wash, fg: RC.inkSoft, border: `0.6px solid ${RC.line}` },
    success: { bg: RC.successTint, fg: RC.success, border: `0.6px solid ${RC.line}` },
  }[tone]
  return (
    <span style={{ background: styles.bg, color: styles.fg, border: styles.border, borderRadius: RR.chip, padding: '0.7mm 2.8mm', fontSize: '8px', fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

/** معالجة فراغ البيانات — سطر أنيق واحد لا صفحة كاملة */
export function EmptyNote({ label }: { label: string }) {
  return (
    <p style={{ margin: `${S.s6} 0`, textAlign: 'center', ...RT.caption, color: RC.muted, letterSpacing: '0.08em' }}>
      {label}
    </p>
  )
}

/** فاصل صفحة قسري داخل التدفق المقيس */
export function PageBreak() {
  return <div className="print-page" style={{ minHeight: '1mm' }} aria-hidden="true" />
}

/* ═══ مساعدات التصدير ══════════════════════════════════════════ */

export function teacherLine(user: { gender?: GenderValue; subject?: string | null }, labels: { teacher: string }) {
  return user.subject ? `${labels.teacher} ${user.subject}` : labels.teacher
}

/** فئة حالة المعيار الفرعي من عقدة الإطار */
export function subStatus(sub: { completed: boolean; completedNoEvidence: boolean }): { label: string; tone: 'success' | 'gold' | 'neutral' } {
  if (sub.completed) return { label: 'مستوفى', tone: 'success' }
  if (sub.completedNoEvidence) return { label: 'يحتاج توثيقًا', tone: 'gold' }
  return { label: 'غير مستوفى', tone: 'neutral' }
}

export type { TDomainNode, TAchievement, TAttachment }
export { getGenderedLabels, formatDate, formatNumber }
