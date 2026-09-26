'use client'

/**
 * التقرير الرسمي للإنجاز — تقرير تنفيذ مدرسي رسمي ديناميكي لإنجاز واحد
 * ─────────────────────────────────────────────────────────────────
 * مستوحى من هيكل التقرير المدرسي الرسمي (ترويسة الجهة، معلومات عامة،
 * أهداف، وصف التنفيذ، النتائج والأثر، صور البرنامج، التوقيع) لكن بجودة
 * نظام التصميم التحريري الحالي — لا خلفيات مصورة ولا نسخ بكسلي.
 *
 * ديناميكي بالكامل:
 * - كل خانة بلا بيانات تُستبعد ويعاد توزيع البقية تلقائيًا.
 * - يتوسع لصفحات إضافية دون قص (قواعد الفواصل المعتمدة في النظام).
 *
 * يُبنى حصرًا من مكوّنات النظام المشتركة: Gallery / BeforeAfter / DocChip /
 * LabeledField / Rule / PrintFooter + رموز التصميم RC/S/RT/RR.
 */

import { TYPE_LABEL } from '@/lib/constants'
import { formatDate, formatNumber } from '@/lib/format'
import { RC, S, RT, RR, REPORT_BRAND } from '@/lib/report-tokens'
import { Rule, Gallery, BeforeAfter, DocChip } from './report-parts'
import { useReportImages } from './report-image-context'
import type { TAchievement, TAttachment } from '@/lib/types'
import type { ReportData } from '@/hooks/use-data'
import { getGenderedLabels } from '@/lib/gender'

/* ─── عنوان التقرير حسب نوع الإنجاز ─────────────────────────── */

const OFFICIAL_TITLES: Record<string, string> = {
  PRACTICE: 'تقرير ممارسة تعليمية',
  REMEDIAL: 'تقرير خطة علاجية',
  ENRICHMENT: 'تقرير برنامج إثرائي',
  PD: 'تقرير برنامج تدريبي',
  INITIATIVE: 'تقرير مبادرة',
  AWARD: 'تقرير إنجاز وتكريم',
  PARTICIPATION: 'تقرير مشاركة',
  CERTIFICATE: 'تقرير شهادة',
  ACTIVITY: 'تقرير نشاط',
  ASSESSMENT: 'تقرير تقويم وقياس',
  COOP: 'تقرير تعاون مهني',
  PLAN: 'تقرير خطة',
  OTHER: 'تقرير إنجاز',
}

export function officialTitle(type: string): string {
  return OFFICIAL_TITLES[type] ?? `تقرير ${TYPE_LABEL(type)}`
}

/* ─── كشف الخطوات المرقّمة في نص التنفيذ ───────────────────── */

const STEP_PREFIX = /^(?:\d+\s*[.)\-]|[•\-–—])\s+/

function parseSteps(text: string): { steps: string[]; isList: boolean } {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return { steps: [text], isList: false }
  const numbered = lines.filter((l) => STEP_PREFIX.test(l)).length
  // أغلبية الأسطر مرقّمة أو منقّطة → قائمة خطوات
  if (numbered >= Math.ceil(lines.length * 0.6)) {
    return { steps: lines.map((l) => l.replace(STEP_PREFIX, '')), isList: true }
  }
  return { steps: [text], isList: false }
}

/* ─── عنوان قسم رسمي ───────────────────────────────────────── */

function SectionTitle({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div className="print-avoid-break" style={{ marginTop: first ? 0 : S.s6, pageBreakInside: 'avoid', pageBreakAfter: 'avoid' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: S.s2 }}>
        <span style={{ width: '1.4mm', height: '4.6mm', background: RC.primary, borderRadius: '99px', flexShrink: 0 }} aria-hidden="true" />
        <h2 style={{ margin: 0, ...RT.h2, color: RC.ink, fontSize: '14.5px' }}>{children}</h2>
      </div>
      <Rule margin={`${S.s1} 0 ${S.s3}`} color={RC.lineStrong} weight="0.8px" />
    </div>
  )
}

/* ─── الترويسة الرسمية ─────────────────────────────────────── */

function OfficialHeader({ user, year, title, dateText }: {
  user: ReportData['user']
  year: string
  title: string
  dateText: string
}) {
  // سطور الجهة اليمنى — كل سطر اختياري ويُحذف مع بياناته الفارغة
  const orgLines = [
    'المملكة العربية السعودية',
    'وزارة التعليم',
    user.educationAdmin,
    user.educationOffice,
    user.school,
  ].filter((x): x is string => Boolean(x))

  return (
    <div className="print-avoid-break" style={{ pageBreakInside: 'avoid', pageBreakAfter: 'avoid' }}>
      {/* صف الجهة + الشعار الهندسي */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: S.s6 }}>
        <div style={{ textAlign: 'right' }}>
          {orgLines.map((line, i) => (
            <p key={i} style={{
              margin: 0,
              ...RT.caption,
              fontSize: i === 0 ? '9.5px' : '9px',
              fontWeight: i === 4 || (i === orgLines.length - 1 && user.school) ? 700 : 500,
              color: i === 0 ? RC.ink : RC.muted,
              lineHeight: 1.9,
            }}>
              {line}
            </p>
          ))}
        </div>
        {/* الشعار — عنصر هندسي بروح رسمية (نقطة استبدال REPORT_BRAND.logo) */}
        {REPORT_BRAND.logo ? (
          <img src={REPORT_BRAND.logo} alt="" style={{ width: '17mm', height: '17mm', objectFit: 'contain' }} />
        ) : (
          <svg width="62" height="62" viewBox="0 0 62 62" aria-hidden="true" style={{ flexShrink: 0 }}>
            <circle cx="31" cy="31" r="29" fill="none" stroke={RC.primary} strokeWidth="1" opacity="0.5" />
            <circle cx="31" cy="31" r="22" fill="none" stroke={RC.primary} strokeWidth="0.9" opacity="0.8" />
            {/* كتاب مفتوح مبسط */}
            <path d="M18 37 Q25 33 31 37 Q37 33 44 37 L44 25 Q37 21 31 25 Q25 21 18 25 Z" fill={RC.primary} opacity="0.9" />
            <line x1="31" y1="25" x2="31" y2="37" stroke="#fff" strokeWidth="1.1" />
            <circle cx="31" cy="15" r="2.2" fill={RC.primary} />
          </svg>
        )}
      </div>

      {/* حد مزدوج رسمي */}
      <div style={{ marginTop: S.s3 }}>
        <Rule weight="1.6px" color={RC.primaryDeep} />
        <div style={{ height: '0.8mm' }} />
        <Rule weight="0.6px" color={RC.lineStrong} />
      </div>

      {/* عنوان التقرير + سطر التعريف */}
      <div style={{ textAlign: 'center', marginTop: S.s4 }}>
        <p style={{ margin: 0, ...RT.caption, color: RC.primaryDeep, letterSpacing: '0.16em' }}>تقرير تنفيذ رسمي</p>
        <h1 style={{ margin: `${S.s2} 0 0`, ...RT.h1, color: RC.ink, fontSize: '23px' }}>{title}</h1>
        <p style={{ margin: `${S.s2} 0 0`, ...RT.caption, color: RC.muted }}>
          {user.subject ? `${getGenderedLabels(user.gender).teacher} ${user.subject}` : getGenderedLabels(user.gender).teacher}:{' '}
          <span style={{ color: RC.inkSoft, fontWeight: 700 }}>{user.name}</span>
          <span> • </span>
          العام الدراسي {year}
          <span> • </span>
          {dateText}
        </p>
      </div>

      <Rule margin={`${S.s4} 0 0`} weight="0.6px" color={RC.lineStrong} />
    </div>
  )
}

/* ─── شبكة المعلومات العامة — ديناميكية، بلا خانات فارغة ──── */

function InfoGrid({ a, user }: { a: TAchievement; user: ReportData['user'] }) {
  const rows: { label: string; value: string }[] = []

  if (a.title) rows.push({ label: 'اسم الإنجاز / البرنامج', value: a.title })
  if (a.field) rows.push({ label: 'المجال / المسار', value: a.field })
  if (a.date) rows.push({ label: 'التاريخ', value: formatDate(a.date) })
  rows.push({ label: getGenderedLabels(user.gender).executorTitle, value: user.name })
  const audience = a.beneficiaries ?? (a.studentsCount ? `${formatNumber(a.studentsCount)} طالبًا` : undefined)
  if (audience) rows.push({ label: 'الفئة المستهدفة', value: audience })
  const benCount = a.beneficiariesCount ?? a.studentsCount
  if (benCount != null) rows.push({ label: 'عدد المستفيدين', value: `${formatNumber(benCount)} مستفيدًا` })
  if (a.durationText) rows.push({ label: 'مدة التنفيذ', value: a.durationText })
  else if (a.hours) rows.push({ label: 'مدة التنفيذ', value: `${formatNumber(a.hours)} ساعة` })
  if (a.provider) rows.push({ label: 'الجهة', value: a.provider })

  return (
    <div className="print-avoid-break" style={{ pageBreakInside: 'avoid', display: 'grid', gridTemplateColumns: '1fr 1fr', border: `0.8px solid ${RC.lineStrong}`, borderRadius: RR.card, overflow: 'hidden', marginTop: S.s4 }}>
      {rows.map((r, i) => {
        // صف أخير مكتمل = آخر عنصرين (أو الأخير وحده إذا كان العدد فرديًا)
        const isLastRow = i >= rows.length - (rows.length % 2 === 0 ? 2 : 1)
        return (
          <div
            key={r.label}
            style={{
              padding: `${S.s2} ${S.s3}`,
              background: i % 2 === 0 ? RC.wash : 'transparent',
              borderBottom: isLastRow ? undefined : `0.6px solid ${RC.line}`,
              borderInlineStart: i % 2 === 1 ? `0.6px solid ${RC.line}` : undefined,
            }}
          >
            <p style={{ margin: 0, ...RT.metricLabel, color: RC.primaryDeep }}>{r.label}</p>
            <p style={{ margin: '0.8mm 0 0', ...RT.bodyStrong, color: RC.ink, fontSize: '11px' }}>{r.value}</p>
          </div>
        )
      })}
    </div>
  )
}

/* ─── قسم الأهداف ─────────────────────────────────────────── */

function Objectives({ a }: { a: TAchievement }) {
  const hasGeneral = Boolean(a.goalText?.trim())
  const hasLinked = Boolean(a.goal?.title)
  if (!hasGeneral && !hasLinked) return null

  return (
    <div>
      <SectionTitle>الأهداف</SectionTitle>
      <div className="print-avoid-break" style={{ pageBreakInside: 'avoid', padding: `${S.s3} ${S.s4}`, background: RC.wash, borderRadius: RR.card, borderRight: `2px solid ${RC.primary}` }}>
        <p style={{ margin: 0, ...RT.metricLabel, color: RC.muted }}>الهدف العام</p>
        <p style={{ margin: `${S.s1} 0 0`, ...RT.body, color: RC.ink, fontSize: '11.5px' }}>{a.goalText}</p>
        {hasLinked && (
          <p style={{ margin: `${S.s2} 0 0`, ...RT.caption, color: RC.muted }}>
            مرتبط بهدف مهني موثق: <span style={{ color: RC.primaryDeep, fontWeight: 700 }}>{a.goal?.title}</span>
          </p>
        )}
      </div>
    </div>
  )
}

/* ─── وصف التنفيذ — فقرة أو قائمة خطوات تلقائيًا ─────────── */

function ExecutionSection({ a }: { a: TAchievement }) {
  const source = a.execution?.trim() || a.actions?.trim()
  if (!source) return null
  const { steps, isList } = parseSteps(source)

  return (
    <div>
      <SectionTitle>وصف التنفيذ</SectionTitle>
      {isList ? (
        <ol style={{ margin: 0, paddingInlineStart: '7mm', display: 'flex', flexDirection: 'column', gap: '1.8mm' }}>
          {steps.map((s, i) => (
            <li key={i} className="print-avoid-break" style={{ ...RT.body, color: RC.inkSoft, pageBreakInside: 'avoid' }}>
              <span style={{ color: RC.primaryDeep, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{i + 1}. </span>
              {s}
            </li>
          ))}
        </ol>
      ) : (
        <p style={{ margin: 0, ...RT.body, color: RC.inkSoft, textAlign: 'justify' as const }}>{source}</p>
      )}
      {/* الإجراءات حقل مستقل إن وُجد مع التنفيذ */}
      {a.execution?.trim() && a.actions?.trim() && !isList && (
        <div className="print-avoid-break" style={{ marginTop: S.s3, pageBreakInside: 'avoid' }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.primaryDeep }}>مراحل التنفيذ</p>
          <p style={{ margin: '1mm 0 0', ...RT.body, color: RC.inkSoft, whiteSpace: 'pre-line' }}>{a.actions}</p>
        </div>
      )}
    </div>
  )
}

/* ─── النتائج والأثر — قياس قبل/بعد أو وصف نصي فقط ───────── */

function ResultsSection({ a }: { a: TAchievement }) {
  const scored = a.preScore != null && a.postScore != null
  const hasText = Boolean(a.results?.trim() || a.impact?.trim())
  if (!scored && !hasText) return null

  return (
    <div>
      <SectionTitle>النتائج والأثر</SectionTitle>
      {scored && <BeforeAfter pre={a.preScore!} post={a.postScore!} />}
      {a.results?.trim() && (
        <div className="print-avoid-break" style={{ marginTop: scored ? S.s3 : 0, pageBreakInside: 'avoid' }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.primaryDeep }}>النتائج</p>
          <p style={{ margin: '1mm 0 0', ...RT.body, color: RC.inkSoft }}>{a.results}</p>
        </div>
      )}
      {a.impact?.trim() && (
        <div className="print-avoid-break" style={{ marginTop: S.s2, pageBreakInside: 'avoid', padding: `${S.s2} ${S.s4}`, background: RC.tint, borderRadius: RR.card }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.primaryDeep }}>الأثر</p>
          <p style={{ margin: '1mm 0 0', ...RT.body, color: RC.ink }}>{a.impact}</p>
        </div>
      )}
    </div>
  )
}

/* ─── قسم الصور — معرض النظام نفسه (1/2/3/4+) ───────────── */

function PhotosSection({ images }: { images: (TAttachment & { url: string })[] }) {
  const { toImgUrl } = useReportImages()
  if (!images.length) return null
  return (
    <div>
      <SectionTitle>صور من التنفيذ</SectionTitle>
      <Gallery images={images} />
    </div>
  )
}

/* ─── المرفقات الأخرى ─────────────────────────────────────── */

function AttachmentsSection({ files }: { files: TAttachment[] }) {
  if (!files.length) return null
  return (
    <div>
      <SectionTitle>المرفقات والشواهد</SectionTitle>
      <div className="print-avoid-break" style={{ display: 'flex', flexWrap: 'wrap', gap: '2mm', pageBreakInside: 'avoid' }}>
        {files.map((f) => <DocChip key={f.id} a={f} />)}
      </div>
    </div>
  )
}

/* ─── التوقيعات ───────────────────────────────────────────── */

function Signatures({ user }: { user: ReportData['user'] }) {
  const labels = getGenderedLabels(user.gender)
  return (
    <div className="print-avoid-break" style={{ marginTop: S.s8, pageBreakInside: 'avoid' }}>
      <Rule color={RC.lineStrong} weight="0.8px" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S.s6, marginTop: S.s4 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.muted }}>{labels.teacher} المادة</p>
          <p style={{ margin: '1.5mm 0 0', ...RT.bodyStrong, color: RC.ink }}>{user.name}</p>
          <div style={{ marginTop: '9mm', borderTop: `0.7px solid ${RC.lineStrong}`, paddingTop: '1.2mm' }}>
            <p style={{ margin: 0, ...RT.caption, color: RC.muted }}>{labels.teacherSignature}</p>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.muted }}>{labels.principal}</p>
          <p style={{ margin: '1.5mm 0 0', ...RT.bodyStrong, color: RC.ink }}>
            {user.principalName ?? <span style={{ color: RC.muted, fontWeight: 400 }}>..............................</span>}
          </p>
          <div style={{ marginTop: '9mm', borderTop: `0.7px solid ${RC.lineStrong}`, paddingTop: '1.2mm' }}>
            <p style={{ margin: 0, ...RT.caption, color: RC.muted }}>التوقيع والختم</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══ التقرير الرسمي الكامل — إنجاز واحد ═════════════════════ */

export function OfficialReport({ a, data }: { a: TAchievement; data: ReportData }) {
  const { user, year } = data
  const attachments = a.attachments ?? []
  const images = attachments.filter((x): x is TAttachment & { url: string } => x.kind === 'IMAGE' && Boolean(x.url))
  const files = attachments.filter((x) => x.kind !== 'IMAGE')
  const dateText = a.date ? formatDate(a.date) : formatDate(new Date())

  return (
    <div className="print-page" style={{ paddingTop: S.s2 }}>
      <OfficialHeader user={user} year={year.label} title={officialTitle(a.type)} dateText={dateText} />
      <InfoGrid a={a} user={user} />
      <Objectives a={a} />
      <ExecutionSection a={a} />
      <ResultsSection a={a} />
      <PhotosSection images={images} />
      <AttachmentsSection files={files} />
      <Signatures user={user} />
      <p style={{ margin: `${S.s4} 0 0`, textAlign: 'center', ...RT.caption, color: RC.muted }}>
        أُنشئ آليًا من منصة {REPORT_BRAND.appName} — {formatDate(new Date())}
      </p>
    </div>
  )
}
