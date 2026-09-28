'use client'

import { useEffect, useState } from 'react'
import { useApp } from '@/store/app-store'
import { useReport } from '@/hooks/use-data'
import { SECTIONS, TYPE_LABEL, STATUS_LABEL, ATTACHMENT_KINDS } from '@/lib/constants'
import { formatDate, formatNumber, improvement } from '@/lib/format'
import { LoadingState, ErrorState } from '@/components/shared/states'
import { RC, S, RT, RR, REPORT_BRAND, FIELD_LABELS, footerLine, schoolLine, educationAdminLine, educationOfficeLine } from '@/lib/report-tokens'
import { useReportImages } from './report-image-context'
import { getGenderedLabels } from '@/lib/gender'
import { isOriginalSize } from '@/components/shared/attachment-ui'
import type { TAchievement, TAttachment } from '@/lib/types'
import type { ReportData } from '@/hooks/use-data'

/* ═══════════════════════════════════════════════════════════════
   مكوّنات البناء المشتركة — كل التقارير تُبنى منها حصرًا
   ═══════════════════════════════════════════════════════════════ */

export function Rule({ width = '100%', color = RC.line, weight = '0.6px', margin = '0' }: { width?: string; color?: string; weight?: string; margin?: string }) {
  return <div style={{ width, borderBottom: `${weight} solid ${color}`, margin }} aria-hidden="true" />
}

/** تسمية حقل — صغيرة، أساسية، بلا زخرفة */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-block', minWidth: '20mm', color: RC.primaryDeep, fontSize: '9px', fontWeight: 700, letterSpacing: '0.02em', verticalAlign: 'top', paddingTop: '0.6mm' }}>
      {children}
    </span>
  )
}

/** حقل نصي تحريري — لا يُقطع بين صفحتين */
export function LabeledField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="print-avoid-break" style={{ display: 'flex', gap: '2mm', marginBottom: '2.6mm', pageBreakInside: 'avoid' }}>
      <FieldLabel>{label}</FieldLabel>
      <p style={{ margin: 0, flex: 1, minWidth: 0, ...RT.body, color: RC.inkSoft, textAlign: 'right' }}>{value}</p>
    </div>
  )
}

/** بطاقة مقياس — رقم كبير + تسمية، بخط علوي هوية */
export function Metric({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div style={{ borderTop: `1.2px solid ${accent ? RC.primary : RC.lineStrong}`, paddingTop: S.s2, minWidth: 0 }}>
      <p style={{ margin: 0, ...RT.metric, color: accent ? RC.primaryDeep : RC.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <p style={{ margin: `${S.s1} 0 0`, ...RT.metricLabel, color: RC.muted }}>{label}</p>
    </div>
  )
}

/** بطاقة شاهد غير صوري داخل التقرير — اسم الملف ونوعه، والرابط الخارجي قابل للنقر في PDF
 *  (متصفحات Chromium تحفظ <a href> عند «حفظ بصيغة PDF»). لا تُصوَّر محتويات
 *  الملف تلقائيًا — التوثيق بإسمه ونوعه كما في المستندات المدرسية الرسمية. */
export function EvidenceCard({ a }: { a: TAttachment }) {
  const isLink = a.kind === 'LINK'
  const kindLabel = ATTACHMENT_KINDS[a.kind]?.label ?? 'مرفق'
  const ellipsis = { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', minWidth: 0 } as const
  return (
    <div className="print-avoid-break" style={{ display: 'flex', alignItems: 'center', gap: '2mm', border: `0.7px solid ${RC.line}`, borderRadius: RR.card, padding: '1.6mm 3.5mm', background: RC.wash, pageBreakInside: 'avoid' }}>
      <span style={{ width: '1.6mm', height: '1.6mm', borderRadius: RR.chip, background: RC.primary, flexShrink: 0 }} aria-hidden="true" />
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

/** قائمة الشواهد غير الصورية — بطاقات بسيطة متطابقة في المعاينة والطباعة وPDF */
export function FileEvidenceList({ files }: { files: TAttachment[] }) {
  if (!files.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6mm' }}>
      {files.map((f) => <EvidenceCard key={f.id} a={f} />)}
    </div>
  )
}

/** معرض صور التقرير — واعٍ بحجم العرض المستقل لكل صورة (Patch B):
 *  مصغّر COMPACT (الافتراضي، مناسب لمساحة A4) أو أصلي ORIGINAL (أكبر حجم آمن داخل
 *  الصفحة). النسبة الباعية محفوظة دائمًا عبر object-fit: contain — لا قص ولا تمديد،
 *  والصورة مع اسمها وحدة واحدة غير قابلة للانقسام بين صفحتين. الصور الطويلة جدًا
 *  (نمط عمودي/لقطة شاشة ممتدة) تأخذ صفًّا مستقلًا حتى لا تُحشر في عمود صغير.
 *  المكون نفسه يُستخدم في المعاينة والطباعة وPDF — التكافؤ مضمون بنيويًا. */
export function Gallery({ images }: { images: (TAttachment & { url: string })[] }) {
  const { toImgUrl } = useReportImages()
  /** الأبعاد الطبيعية المقاسة عند التحميل — لتمييز الصور العمودية الشديدة الطول */
  const [dims, setDims] = useState<Record<string, { w: number; h: number }>>({})
  if (!images.length) return null

  const isTall = (img: TAttachment & { url: string }) => {
    const d = dims[img.id]
    return Boolean(d && d.w > 0 && d.h / d.w >= 1.35)
  }

  // بناء الصفوف: أصلي أو عمودي طويل → صف مستقل، والمصغّرة العادية تُقرن عمودين
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

  return (
    <div style={{ marginTop: S.s3, display: 'flex', flexDirection: 'column', gap: S.s2 }}>
      {rows.map((row, ri) => {
        const original = isOriginalSize(row.images[0])
        return (
          <div
            key={ri}
            className="print-avoid-break"
            style={{ display: 'flex', gap: S.s2, pageBreakInside: 'avoid', justifyContent: row.images.length === 1 && !original ? 'center' : 'stretch' }}
          >
            {row.images.map((img) => {
              // مفرد مصغّر: 72% من مساحة المحتوى (والعمودي الطويل 62%) — ضمن نطاق A4؛
              // مفرد أصلي: عرض كامل بأكبر ارتفاع آمن؛ والزوج: عمودان متوازنان
              const single = row.images.length === 1
              const soloCompact = single && !original
              const soloTall = soloCompact && isTall(img)
              // الحد الأقصى للارتفاع: أصلي 162مم (أكبر مساحة آمنة بعد الترويسة/التذييل)،
              // عمودي طويل 108مم، مفرد عادي 95مم، وزوج 88مم — كلها ضمن 80–110مم للمصغّر
              const imgStyle: React.CSSProperties = single
                ? {
                    width: '100%',
                    maxHeight: original ? '162mm' : soloTall ? '108mm' : '95mm',
                    objectFit: 'contain',
                    borderRadius: RR.img,
                    border: `0.7px solid ${RC.line}`,
                    display: 'block',
                  }
                : {
                    width: '100%',
                    maxHeight: '88mm',
                    objectFit: 'contain',
                    borderRadius: RR.img,
                    border: `0.7px solid ${RC.line}`,
                    display: 'block',
                  }
              return (
                <figure
                  key={img.id}
                  style={{
                    margin: 0,
                    flex: single ? (soloCompact ? `0 0 ${soloTall ? '62%' : '72%'}` : '1 1 auto') : '1 1 0',
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
                    style={imgStyle}
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

/** القياس القبلي/البعدي — قبل | بعد | التحسن بعمود بصري واضح */
export function BeforeAfter({ pre, post }: { pre: number; post: number }) {
  const diff = improvement(pre, post) ?? 0
  return (
    <div className="print-avoid-break" style={{ marginTop: S.s3, padding: `${S.s3} ${S.s4}`, background: RC.tint, borderRadius: RR.card, pageBreakInside: 'avoid' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: S.s4 }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.muted }}>قبل</p>
          <p style={{ margin: '1mm 0 0', fontSize: '17px', fontWeight: 700, color: RC.inkSoft, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{formatNumber(pre)}%</p>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.muted }}>بعد</p>
          <p style={{ margin: '1mm 0 0', fontSize: '17px', fontWeight: 700, color: RC.primaryDeep, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{formatNumber(post)}%</p>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'center', borderRight: `0.8px solid ${RC.lineStrong}`, paddingRight: S.s4 }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.success }}>التحسن</p>
          <p style={{ margin: '1mm 0 0', ...RT.metric, color: RC.success, fontSize: '19px' }}>+{formatNumber(diff)}</p>
        </div>
      </div>
      <div style={{ marginTop: S.s3, display: 'flex', flexDirection: 'column', gap: '1.6mm' }} aria-hidden="true">
        <div style={{ height: '2.2mm', background: '#DFE9E5', borderRadius: RR.bar }}>
          <div style={{ width: `${Math.min(100, pre)}%`, height: '100%', background: RC.lineStrong, borderRadius: RR.bar }} />
        </div>
        <div style={{ height: '2.2mm', background: '#DCEDE7', borderRadius: RR.bar }}>
          <div style={{ width: `${Math.min(100, post)}%`, height: '100%', background: RC.primary, borderRadius: RR.bar }} />
        </div>
      </div>
    </div>
  )
}

/** رأس كل إنجاز — شريط علوي + نوع + تاريخ + حالة */
export function CaseHead({ a, extra }: { a: TAchievement; extra?: string | null }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2.5mm', flexWrap: 'wrap', marginBottom: '1.6mm' }}>
        <span style={{ background: RC.tint, color: RC.primaryDeep, borderRadius: RR.chip, padding: '0.8mm 3mm', fontSize: '8px', fontWeight: 700, letterSpacing: '0.03em' }}>
          {TYPE_LABEL(a.type)}
        </span>
        <span style={{ ...RT.caption, color: RC.muted }}>{a.date ? formatDate(a.date) : ''}</span>
        <span style={{ ...RT.caption, color: RC.muted }}>•</span>
        <span style={{ ...RT.caption, color: RC.muted }}>{STATUS_LABEL(a.status)}</span>
        {extra && <span style={{ ...RT.caption, color: RC.muted }}>• {extra}</span>}
      </div>
      <h3 style={{ margin: 0, ...RT.h3, color: RC.ink, fontSize: '14px' }}>{a.title}</h3>
      <Rule margin={`${S.s2} 0 ${S.s3}`} />
    </div>
  )
}

/** الإنجاز كدراسة حالة مصغّرة — الوحدة الأساسية في كل التقارير */
export function AchievementCase({ a, index, fields }: { a: TAchievement; index?: number; fields?: string[] }) {
  const attachments = a.attachments ?? []
  const images = attachments.filter((x): x is TAttachment & { url: string } => x.kind === 'IMAGE' && Boolean(x.url))
  const files = attachments.filter((x) => x.kind !== 'IMAGE')
  const scored = a.preScore != null && a.postScore != null
  const beneficiaries = a.beneficiaries ?? (a.studentsCount ? `${formatNumber(a.studentsCount)} طالبًا` : undefined) ?? (a.beneficiariesCount ? `${formatNumber(a.beneficiariesCount)} مستفيدًا` : undefined)

  const fieldOrder = fields ?? ['description', 'problem', 'goalText', 'execution', 'results', 'impact', 'notes']
  const rendered = fieldOrder
    .map((k) => <LabeledField key={k} label={FIELD_LABELS[k as keyof typeof FIELD_LABELS] ?? k} value={a[k as keyof TAchievement] as string | undefined} />)
    .filter(Boolean)
  const firstField = rendered[0] ?? null

  return (
    <article style={{ marginBottom: S.s6 }}>
      {/* الرأس + أول حقل معًا — يمنع عنوانًا يتيمًا أسفل الصفحة */}
      <div className="print-avoid-break" style={{ pageBreakInside: 'avoid' }}>
        {index !== undefined && (
          <span style={{ ...RT.caption, color: RC.lineStrong, fontSize: '10px', fontWeight: 700 }}>{String(index).padStart(2, '0')}</span>
        )}
        <CaseHead a={a} extra={beneficiaries ? `${a.provider ? `${a.provider} • ` : ''}${a.hours ? `${formatNumber(a.hours)} ساعة • ` : ''}${beneficiaries}` : a.provider} />
        {firstField}
      </div>
      {rendered.slice(1)}
      {a.durationText && <LabeledField label={FIELD_LABELS.durationText} value={a.durationText} />}
      {scored && <BeforeAfter pre={a.preScore!} post={a.postScore!} />}
      {/* قسم الشواهد والمرفقات — يظهر فقط عند وجود شواهد (لا عنوان فارغًا أبدًا):
          الصور بمعرض النظام نفسه (1 بطولية / 2 عمودان / 3 أثلاث / 4+ شبكة)،
          وغير الصور بطاقات باسم الملف ونوعه، والروابط الخارجية بنصها القابل للنقر */}
      {(images.length > 0 || files.length > 0) && (
        <div style={{ marginTop: S.s3 }}>
          <p style={{ margin: `0 0 ${S.s2}`, ...RT.metricLabel, color: RC.primaryDeep, pageBreakAfter: 'avoid' }}>الشواهد والمرفقات</p>
          {images.length > 0 && <Gallery images={images} />}
          {files.length > 0 && <FileEvidenceList files={files} />}
        </div>
      )}
      <Rule margin={`${S.s4} 0 0`} color={RC.line} />
    </article>
  )
}

/** فاصل قسم — رقم ضخم محدد + عنوان + وصف + مقاييس صغيرة */
export function SectionDivider({ num, title, desc, stats }: { num: number; title: string; desc: string; stats?: { label: string; value: string }[] }) {
  return (
    <div className="print-section-cover print-avoid-break" style={{ minHeight: '105mm', display: 'flex', flexDirection: 'column', justifyContent: 'center', pageBreakBefore: 'always', pageBreakInside: 'avoid' }}>
      <span
        aria-hidden="true"
        style={{ fontSize: '58px', fontWeight: 200, lineHeight: 1, color: 'transparent', WebkitTextStroke: `1px ${RC.lineStrong}`, letterSpacing: '0.04em' }}
      >
        {String(num).padStart(2, '0')}
      </span>
      <h2 style={{ margin: `${S.s3} 0 ${S.s2}`, ...RT.h1, color: RC.ink, fontSize: '24px' }}>{title}</h2>
      <div style={{ width: '30mm', height: '1.1mm', background: RC.primary, marginBottom: S.s4 }} />
      <p style={{ margin: 0, ...RT.body, color: RC.muted, maxWidth: '130mm' }}>{desc}</p>
      {stats && stats.length > 0 && (
        <div style={{ display: 'flex', gap: '3mm', marginTop: S.s6, flexWrap: 'wrap' }}>
          {stats.map((s) => (
            <div key={s.label} style={{ border: `0.7px solid ${RC.line}`, borderRadius: RR.card, padding: `${S.s2} ${S.s4}`, minWidth: '30mm' }}>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: RC.primaryDeep, fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
              <p style={{ margin: '0.8mm 0 0', ...RT.metricLabel, color: RC.muted }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══ الترويسة الرسمية — كل تقرير مستقل يبدأ بها ═══════════ */

/** شعار وزارة التعليم السعودي — المصدر الموحد الوحيد REPORT_BRAND.ministryLogo
 *  (أصل رسمي متجهي SVG من موقع الوزارة بخلفية شفافة — بلا أي نسخة مرسومة أو أيقونة بديلة).
 *  علامة الوزارة أفقية (شعار + الاسم عربي/إنجليزي)، فيُضبط الارتفاع ويتبع العرض نسبته. */
export function MinistryLogo({ size = 58 }: { size?: number }) {
  if (!REPORT_BRAND.ministryLogo) return null
  return (
    <img
      src={REPORT_BRAND.ministryLogo}
      alt="شعار وزارة التعليم"
      style={{ height: size, width: 'auto', maxWidth: '38%', objectFit: 'contain', display: 'block', flexShrink: 0 }}
    />
  )
}

/** سطور الجهة الرسمية — المملكة/الوزارة/الإدارة/المكتب/المدرسة، كلها من بيانات المستخدم.
 *  السطر غير الموجود يُحذف كليًا ويعاد توزيع الباقي — بلا فراغات وبلا أسماء افتراضية. */
export function orgHeaderLines(user: { school?: string | null; educationAdmin?: string | null; educationOffice?: string | null }): { text: string; strong?: boolean }[] {
  return [
    { text: 'المملكة العربية السعودية', strong: true },
    { text: 'وزارة التعليم' },
    { text: educationAdminLine(user.educationAdmin) ?? '' },
    { text: educationOfficeLine(user.educationOffice) ?? '' },
    { text: schoolLine(user.school) ?? '' },
  ].filter((l) => l.text !== '')
}

/** الترويسة الرسمية التعليمية — شعار الوزارة أعلى اليمين + سطور الجهة + العام الدراسي.
 *  mode='full'  : الترويسة + كتلة عنوان التقرير (لكل تقرير مستقل جديد).
 *  mode='org'   : الترويسة فقط (أول صفحة لتقرير متعدد العناصر أو قالب موحّد).
 *  mode='title' : كتلة العنوان فقط (أول عنصر بعد ترويسة المستند المفتوحة أعلى الصفحة). */
export function OfficialDocHeader({ user, year, title, dateText, mode = 'full' }: {
  user: ReportData['user']
  year: string
  title?: string
  dateText?: string
  mode?: 'full' | 'org' | 'title'
}) {
  const labels = getGenderedLabels(user.gender)
  const org = orgHeaderLines(user)
  return (
    <div className="print-avoid-break" style={{ pageBreakInside: 'avoid', pageBreakAfter: 'avoid' }}>
      {mode !== 'title' && (
        <>
          {/* صف الجهة: الشعار أعلى اليمين + السطور الرسمية + العام الدراسي في الطرف المقابل */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: S.s4 }}>
            <MinistryLogo size={mode === 'org' ? 54 : 58} />
            <div style={{ flex: 1, textAlign: 'right', minWidth: 0, paddingTop: '1mm' }}>
              {org.map((l, i) => (
                <p key={i} style={{
                  margin: 0,
                  ...RT.caption,
                  fontSize: i === 0 ? '9.5px' : '9px',
                  fontWeight: l.strong ? 700 : 500,
                  color: i === 0 || l.strong && i === org.length - 1 ? RC.ink : RC.muted,
                  lineHeight: 1.9,
                }}>
                  {l.text}
                </p>
              ))}
            </div>
            <p style={{ margin: 0, ...RT.caption, color: RC.muted, whiteSpace: 'nowrap', paddingTop: '1mm' }}>العام الدراسي {year}</p>
          </div>
          {/* حد مزدوج رسمي */}
          <div style={{ marginTop: S.s3 }}>
            <Rule weight="1.6px" color={RC.primaryDeep} />
            <div style={{ height: '0.8mm' }} />
            <Rule weight="0.6px" color={RC.lineStrong} />
          </div>
        </>
      )}
      {title && mode !== 'org' && (
        <>
          {/* عنوان التقرير + سطر التعريف */}
          <div style={{ textAlign: 'center', marginTop: mode === 'title' ? 0 : S.s4 }}>
            <p style={{ margin: 0, ...RT.caption, color: RC.primaryDeep, letterSpacing: '0.16em' }}>تقرير تنفيذ رسمي</p>
            <h1 style={{ margin: `${S.s2} 0 0`, ...RT.h1, color: RC.ink, fontSize: '23px' }}>{title}</h1>
            <p style={{ margin: `${S.s2} 0 0`, ...RT.caption, color: RC.muted }}>
              {user.subject ? `${labels.teacher} ${user.subject}` : labels.teacher}:{' '}
              <span style={{ color: RC.inkSoft, fontWeight: 700 }}>{user.name}</span>
              <span> • </span>
              العام الدراسي {year}
              {dateText ? (<><span> • </span>{dateText}</>) : null}
            </p>
          </div>
          <Rule margin={`${S.s4} 0 0`} weight="0.6px" color={RC.lineStrong} />
        </>
      )}
    </div>
  )
}

/** غلاف كل تقرير مستقل داخل قائمة — يفرض صفحة A4 جديدة لكل تقرير (عدا الأول)،
 *  ويسمح لمحتواه الطويل بالتدفق عبر صفحات متعددة (بلا break-inside: avoid على المستوى كله).
 *  الترويسة الرسمية + عنوان التقرير يبقيان مع بداية التقرير (avoid-break على كتلة الترويسة فقط). */
export function ReportDocumentSection({ first = false, headerMode = 'full', user, year, title, dateText, children }: {
  first?: boolean
  headerMode?: 'full' | 'title' | 'none'
  user: ReportData['user']
  year: string
  title?: string
  dateText?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={first ? undefined : 'print-report-start'}
      style={first ? undefined : { pageBreakBefore: 'always', breakBefore: 'page' }}
    >
      {headerMode !== 'none' && (
        <OfficialDocHeader user={user} year={year} title={title} dateText={dateText} mode={headerMode === 'title' ? 'title' : 'full'} />
      )}
      {children}
    </section>
  )
}

/** الغلاف — تخطيط تحريري غير متمركز مع عنصر هندسي بسيط */
export function Cover({ name, school, subject, year, completion, date, gender, educationAdmin, educationOffice }: { name: string; school?: string | null; subject?: string | null; year: string; completion: number; date: string; gender?: 'MALE' | 'FEMALE' | null; educationAdmin?: string | null; educationOffice?: string | null }) {
  const teacherLabel = getGenderedLabels(gender).teacher
  const org = orgHeaderLines({ school, educationAdmin, educationOffice })
  return (
    <div className="print-page" style={{ display: 'flex', flexDirection: 'column', minHeight: '245mm', paddingTop: S.s4 }}>
      {/* شريط التعريف العلوي — ترويسة رسمية: الشعار أعلى اليمين + سطور الجهة + العام الدراسي */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: S.s4 }}>
        <MinistryLogo size={46} />
        <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
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
        <p style={{ margin: 0, ...RT.caption, color: RC.muted, whiteSpace: 'nowrap' }}>العام الدراسي {year}</p>
      </div>
      <Rule margin={`${S.s3} 0 0`} />

      {/* الكتلة الرئيسية — غير متمركزة، محاذاة بداية القراءة */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: S.s8 }}>
        <p style={{ margin: 0, ...RT.caption, color: RC.primaryDeep, letterSpacing: '0.14em' }}>ملف الإنجاز المهني</p>
        <h1 style={{ margin: `${S.s2} 0 0`, ...RT.display, fontSize: '34px', color: RC.ink }}>
          توثيقُ عملٍ<br />وأثرٍ يُقاس
        </h1>
        <div style={{ width: '40mm', height: '1.2mm', background: RC.primary, margin: `${S.s8} 0 ${S.s6}` }} />

        <p style={{ margin: 0, fontSize: '21px', fontWeight: 700, color: RC.primaryDeep, lineHeight: 1.5 }}>{name}</p>
        <p style={{ margin: `${S.s2} 0 0`, ...RT.body, color: RC.muted, fontSize: '12px' }}>
          {subject ? `${teacherLabel} ${subject}` : teacherLabel}{school ? ` — ${school}` : ''}
        </p>

        {/* العنصر الهندسي — دوائر متراكزة ونقطة، بلون واحد */}
        <svg width="150" height="64" viewBox="0 0 150 64" style={{ marginTop: S.s8, display: 'block' }} aria-hidden="true">
          <circle cx="112" cy="32" r="30" fill="none" stroke={RC.primary} strokeWidth="0.8" opacity="0.35" />
          <circle cx="112" cy="32" r="19" fill="none" stroke={RC.primary} strokeWidth="0.8" opacity="0.6" />
          <circle cx="112" cy="32" r="8" fill={RC.primary} opacity="0.9" />
          <line x1="0" y1="32" x2="66" y2="32" stroke={RC.lineStrong} strokeWidth="0.8" />
          <line x1="0" y1="28" x2="34" y2="28" stroke={RC.lineStrong} strokeWidth="0.8" opacity="0.6" />
          <rect x="70" y="29" width="6" height="6" fill={RC.primary} opacity="0.85" />
        </svg>
      </div>

      {/* المقاييس السفلية */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8mm' }}>
        <div style={{ minWidth: '52mm' }}>
          <Metric value={`${formatNumber(completion)}%`} label="اكتمال الملف" accent />
        </div>
        <p style={{ margin: 0, ...RT.caption, color: RC.muted, textAlign: 'left' }}>
          صدر بتاريخ {date}
          <br />
          أُنشئ آليًا من منصة {REPORT_BRAND.appName}
        </p>
      </div>
    </div>
  )
}

/** البطاقة المهنية — صفحة تعريف المعلم بعد الغلاف */
export function ProfileCard({ user }: { user: ReportData["user"] }) {
  const initials = user.name.split(' ').slice(0, 2).map((w) => w[0]).join(' ')
  const teacherLabel = getGenderedLabels(user.gender).teacher
  return (
    <div>
      <div className="print-avoid-break" style={{ display: 'flex', alignItems: 'center', gap: S.s4, padding: S.s4, border: `0.8px solid ${RC.line}`, borderRadius: RR.card, background: RC.wash, pageBreakInside: 'avoid' }}>
        <div style={{ width: '22mm', height: '22mm', borderRadius: '99px', background: RC.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 600, flexShrink: 0, lineHeight: 1 }}>
          {initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0, ...RT.h2, fontSize: '18px', color: RC.ink }}>{user.name}</h2>
          <p style={{ margin: '1.2mm 0 0', ...RT.body, color: RC.muted, fontSize: '11px' }}>
            {user.subject ? `${teacherLabel} ${user.subject}` : teacherLabel}{user.school ? ` — ${user.school}` : ''}{user.stage ? ` — ${user.stage}` : ''}
          </p>
        </div>
      </div>

      {/* مقاييس مهنية ثلاثة */}
      <div style={{ display: 'flex', gap: S.s6, marginTop: S.s4 }}>
        <div style={{ flex: 1, minWidth: 0 }}><Metric value={user.experienceYears ? `${formatNumber(user.experienceYears)} سنة` : '—'} label="سنوات الخبرة" /></div>
        <div style={{ flex: 1, minWidth: 0 }}><Metric value={user.qualification ?? '—'} label="المؤهل العلمي" /></div>
        <div style={{ flex: 1, minWidth: 0 }}><Metric value={user.licenseNumber ?? '—'} label="الرخصة المهنية" /></div>
      </div>

      <Rule margin={`${S.s6} 0 ${S.s4}`} />

      {/* بيانات التكليف — قائمة تسمية/قيمة airy وليست جدولًا */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: S.s8, rowGap: S.s3 }}>
        <LabeledField label="المدرسة" value={user.school} />
        <LabeledField label="التخصص" value={user.subject} />
        <LabeledField label="المرحلة" value={user.stage} />
        <LabeledField label="الصفوف" value={user.classes} />
        <LabeledField label="النصاب الأسبوعي" value={user.weeklyLoad ? `${formatNumber(user.weeklyLoad)} حصة` : undefined} />
        <LabeledField label="المهام" value={user.duties} />
      </div>
    </div>
  )
}

/** الملخص التنفيذي — أجمل صفحات التقرير */
export function ExecSummary({ data, compact = false }: { data: ReportData; compact?: boolean }) {
  const { user, year, completion, achievements, reflection } = data
  const counts = completion.counts
  const scored = achievements.filter((a) => a.preScore != null && a.postScore != null)
  const highlights = [...achievements]
    .filter((a) => a.impact || a.results)
    .sort((a, b) => (b.beneficiariesCount ?? b.studentsCount ?? 0) - (a.beneficiariesCount ?? a.studentsCount ?? 0))
    .slice(0, compact ? 3 : 3)

  const metrics: { value: string; label: string }[] = [
    { value: formatNumber(counts.achievements), label: 'إنجازًا موثقًا' },
    { value: formatNumber(counts.initiatives), label: 'مبادرات' },
    { value: formatNumber(counts.pdHours), label: 'ساعة تطوير مهني' },
    { value: formatNumber(counts.remedial), label: 'خطط علاجية' },
    { value: formatNumber(counts.evidence), label: 'شاهدًا موثقًا' },
    { value: formatNumber(counts.beneficiaries), label: 'مستفيدًا من المبادرات' },
    { value: counts.avgImprovement !== null ? `+${formatNumber(counts.avgImprovement)}%` : '—', label: 'متوسط التحسن' },
    { value: `${formatNumber(counts.completedSections)} / ${SECTIONS.length}`, label: 'مجالًا مكتملًا' },
  ]

  return (
    <div>
      <p style={{ margin: 0, ...RT.body, color: RC.muted, maxWidth: '150mm' }}>
        {compact
          ? `لمحة سريعة عن ملف ${user.name} في ${year.label} — للأطلاع الفوري على حجم العمل وأثره.`
          : `خلاصة عام ${year.label} لملف ${user.name}: حجم التوثيق، وأبرز نتائج القياس القبلي/البعدي، وأثر الممارسات على الطلبة والمجتمع المدرسي.`}
      </p>

      {/* النسبة الرئيسية */}
      <div className="print-avoid-break" style={{ marginTop: S.s4, pageBreakInside: 'avoid' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: S.s4 }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.muted }}>اكتمال ملف الإنجاز</p>
          <p style={{ margin: 0, fontSize: '34px', fontWeight: 800, color: RC.primaryDeep, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{formatNumber(completion.overall)}%</p>
        </div>
        <div style={{ marginTop: S.s2, height: '2.8mm', background: '#E2ECE8', borderRadius: RR.bar }}>
          <div style={{ width: `${Math.min(100, completion.overall)}%`, height: '100%', background: `linear-gradient(to left, ${RC.primary}, ${RC.primaryDeep})`, borderRadius: RR.bar }} />
        </div>
      </div>

      {/* شبكة المقاييس */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: `${S.s3} ${S.s3}`, marginTop: S.s6 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ minWidth: 0 }}>
            <Metric value={m.value} label={m.label} accent={m.label === 'متوسط التحسن' && counts.avgImprovement !== null} />
          </div>
        ))}
      </div>

      {/* أبرز الإنجازات */}
      <div className="print-avoid-break" style={{ marginTop: S.s8, pageBreakInside: 'avoid' }}>
        <h2 style={{ margin: `0 0 ${S.s3}`, ...RT.h2, color: RC.ink, fontSize: '15px' }}>أبرز الإنجازات</h2>
        {highlights.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: S.s4 }}>
            {highlights.map((a) => {
              const diff = improvement(a.preScore, a.postScore)
              return (
                <div key={a.id} style={{ borderRight: `1.6px solid ${RC.primary}`, paddingRight: S.s3 }}>
                  <p style={{ margin: 0, ...RT.bodyStrong, color: RC.ink }}>{a.title}</p>
                  <p style={{ margin: '1mm 0 0', ...RT.caption, color: RC.muted }}>
                    {TYPE_LABEL(a.type)}
                    {a.beneficiariesCount ? ` • ${formatNumber(a.beneficiariesCount)} مستفيدًا` : a.studentsCount ? ` • ${formatNumber(a.studentsCount)} طالبًا` : ''}
                    {diff !== null ? ` • تحسن +${formatNumber(diff)} نقطة` : ''}
                  </p>
                  {a.impact && <p style={{ margin: '1.2mm 0 0', ...RT.body, color: RC.inkSoft }}>{a.impact}</p>}
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ margin: 0, ...RT.body, color: RC.muted }}>لم تُوثَّق إنجازات ذات أثر بعد.</p>
        )}
      </div>

      {/* اقتباس من التأمل المهني */}
      {reflection?.success && (
        <div className="print-avoid-break" style={{ marginTop: S.s6, padding: `${S.s4} ${S.s4}`, background: RC.wash, borderRadius: RR.card, borderRight: `2px solid ${RC.primary}`, pageBreakInside: 'avoid' }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.muted }}>من التأمل المهني — أبرز نجاح حققته</p>
          <p style={{ margin: `${S.s2} 0 0`, ...RT.quote, color: RC.inkSoft }}>«{reflection.success}»</p>
        </div>
      )}

      {scored.length > 0 && (
        <div style={{ marginTop: S.s6, borderTop: `0.6px solid ${RC.line}`, paddingTop: S.s3 }}>
          <p style={{ margin: 0, ...RT.caption, color: RC.muted }}>
            تُفصَّل قياسات الأثر في تقرير الأثر المهني — {scored.length} قياسات قبلي/بعدي موثقة.
          </p>
        </div>
      )}
    </div>
  )
}

/** الفهرس — مرقّم بتراتب هادئ */
export function Toc({ items }: { items: { num: number; title: string; meta?: string }[] }) {
  return (
    <div className="print-page" style={{ paddingTop: S.s6 }}>
      <p style={{ margin: 0, ...RT.caption, color: RC.primaryDeep, letterSpacing: '0.14em' }}>المحتويات</p>
      <h2 style={{ margin: `${S.s2} 0 ${S.s3}`, ...RT.h1, color: RC.ink }}>فهرس الأقسام</h2>
      <div style={{ width: '25mm', height: '1mm', background: RC.primary, marginBottom: S.s6 }} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((it) => (
          <div key={it.num} style={{ display: 'flex', alignItems: 'baseline', gap: S.s3, padding: `${S.s3} 0`, borderBottom: `0.6px solid ${RC.line}` }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: RC.primary, minWidth: '9mm', fontVariantNumeric: 'tabular-nums' }}>{String(it.num).padStart(2, '0')}</span>
            <span style={{ ...RT.bodyStrong, color: RC.ink, fontSize: '12px', flex: 1 }}>{it.title}</span>
            {it.meta && <span style={{ ...RT.caption, color: RC.muted }}>{it.meta}</span>}
          </div>
        ))}
      </div>
      <p style={{ margin: `${S.s4} 0 0`, ...RT.caption, color: RC.muted }}>
        يبدأ كل قسم بصفحة عنوان مستقلة — {REPORT_BRAND.appName}
      </p>
    </div>
  )
}

/** رأس التقرير المختصر — للقوالب 2-5 */
export function ReportHeader({ title, subtitle, metrics }: { title: string; subtitle: string; metrics: { value: string; label: string }[] }) {
  return (
    <div className="print-avoid-break" style={{ marginBottom: S.s6, pageBreakInside: 'avoid' }}>
      <p style={{ margin: 0, ...RT.caption, color: RC.primaryDeep, letterSpacing: '0.14em' }}>{REPORT_BRAND.appName}</p>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: S.s6 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: `${S.s1} 0 0`, ...RT.h1, color: RC.ink }}>{title}</h1>
          <p style={{ margin: `${S.s2} 0 0`, ...RT.body, color: RC.muted }}>{subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: S.s4, flexShrink: 0 }}>
          {metrics.map((m) => (
            <div key={m.label} style={{ textAlign: 'center', minWidth: '22mm' }}>
              <Metric value={m.value} label={m.label} accent />
            </div>
          ))}
        </div>
      </div>
      <Rule margin={`${S.s4} 0 0`} />
    </div>
  )
}

/** التذييل الثابت — يتكرر تلقائيًا في كل صفحة مطبوعة */
export function PrintFooter({ name, year }: { name: string; year: string }) {
  const f = footerLine(name, year)
  return (
    <div className="print-footer" dir="rtl">
      <span style={{ fontWeight: 600, color: RC.primaryDeep }}>{f.right}</span>
      <span>{f.left}</span>
    </div>
  )
}

/** معالجة فراغ البيانات — سطر أنيق واحد لا صفحة كاملة */
export function EmptyNote({ label }: { label: string }) {
  return (
    <p style={{ margin: `${S.s8} 0`, textAlign: 'center', ...RT.caption, color: RC.muted, letterSpacing: '0.08em' }}>
      {label}
    </p>
  )
}

/** صفحة جديدة قسرية */
export function PageBreak() {
  return <div className="print-page" style={{ minHeight: '1mm' }} aria-hidden="true" />
}
/** صف أثر مدمج — لقسم نواتج التعلم: عنوان + أثر + قياس مصغر في سطر واحد */
export function ImpactRow({ a, index }: { a: TAchievement; index: number }) {
  const diff = improvement(a.preScore, a.postScore) ?? 0
  return (
    <div className="print-avoid-break" style={{ display: 'flex', alignItems: 'flex-start', gap: S.s3, padding: `${S.s3} 0`, borderBottom: `0.6px solid ${RC.line}`, pageBreakInside: 'avoid' }}>
      <span style={{ ...RT.caption, color: RC.lineStrong, fontSize: '10px', fontWeight: 700, minWidth: '7mm', paddingTop: '0.4mm' }}>{String(index).padStart(2, '0')}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, ...RT.bodyStrong, color: RC.ink }}>{a.title}</p>
        <p style={{ margin: '0.8mm 0 0', ...RT.caption, color: RC.muted }}>{TYPE_LABEL(a.type)}{a.date ? ` • ${formatDate(a.date)}` : ''}</p>
        {a.impact && <p style={{ margin: '1.2mm 0 0', ...RT.body, color: RC.inkSoft }}>{a.impact}</p>}
      </div>
      <div style={{ width: '48mm', flexShrink: 0, paddingTop: '0.4mm' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ ...RT.caption, color: RC.muted }}>قبل {formatNumber(a.preScore ?? 0)}%</span>
          <span style={{ ...RT.caption, color: RC.primaryDeep, fontWeight: 700 }}>بعد {formatNumber(a.postScore ?? 0)}%</span>
          <span style={{ ...RT.caption, color: RC.success, fontWeight: 800 }}>+{formatNumber(diff)}</span>
        </div>
        <div style={{ marginTop: '1.2mm', height: '1.8mm', background: '#E2ECE8', borderRadius: RR.bar }}>
          <div style={{ width: `${Math.min(100, a.preScore ?? 0)}%`, height: '100%', background: RC.lineStrong, borderRadius: RR.bar }} />
        </div>
        <div style={{ marginTop: '1mm', height: '1.8mm', background: '#DCEDE7', borderRadius: RR.bar }}>
          <div style={{ width: `${Math.min(100, a.postScore ?? 0)}%`, height: '100%', background: RC.primary, borderRadius: RR.bar }} />
        </div>
      </div>
    </div>
  )
}
