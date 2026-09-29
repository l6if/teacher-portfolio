'use client'

/**
 * وثيقة الإنجاز الرسمية v2 — تقرير تنفيذ مدرسي رسمي ديناميكي لإنجاز واحد.
 * ─────────────────────────────────────────────────────────────────
 * الترويسة الرسمية (شعار الوزارة + سطور الجهة الديناميكية + حد ذهبي مزدوج)
 * ثم مسار التصنيف المهني (مجال ← معيار ← معيار فرعي) ثم شبكة المعلومات
 * العامة فالأقسام المشروطة بوجود المحتوى فعليًا (لا عنوان لقسم فارغ أبدًا):
 * الهدف، المشكلة، التنفيذ، مراحل التنفيذ، النتائج، الأثر، التوصيات —
 * ثم الشواهد (معرض ذكي + بطاقات ملفات) فالتوقيعات الواعية بالجنس.
 *
 * يعمل داخل محرك One-Page-First: كل الفراغات من tokens الكثافة —
 * الكثافة الأعلى تقلّص المسافات والصور، لا النص.
 */

import { RC, S, RT, RR, REPORT_BRAND, FIELD_LABELS } from '@/lib/report-tokens'
import {
  Rule, OfficialRule, Badge, Gallery, BeforeAfter, FileEvidenceList,
  OrgHeaderStrip, LabeledField, SectionHeading,
} from './report-blocks'
import { useReportDensity } from './report-engine'
import { TYPE_LABEL } from '@/lib/constants'
import { formatDate, formatNumber } from '@/lib/format'
import { getGenderedLabels } from '@/lib/gender'
import type { TAchievement, TAttachment } from '@/lib/types'
import type { ReportData } from '@/hooks/use-data'

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
  if (numbered >= Math.ceil(lines.length * 0.6)) {
    return { steps: lines.map((l) => l.replace(STEP_PREFIX, '')), isList: true }
  }
  return { steps: [text], isList: false }
}

/* ─── مسار التصنيف المهني — مجال ← معيار ← معيار فرعي ─────── */

function FrameworkBreadcrumb({ a }: { a: TAchievement }) {
  if (!a.domain && !a.criterion && !a.subCriterion) return null
  const crumbs: { label: string; strong?: boolean }[] = []
  if (a.domain) crumbs.push({ label: a.domain.name })
  if (a.criterion) crumbs.push({ label: a.criterion.name })
  if (a.subCriterion) crumbs.push({ label: a.subCriterion.name, strong: true })
  return (
    <div className="print-avoid-break" style={{ display: 'flex', alignItems: 'center', gap: '1.6mm', flexWrap: 'wrap', marginTop: S.s3, pageBreakInside: 'avoid' }}>
      <span style={{ ...RT.metricLabel, color: RC.goldDeep, letterSpacing: '0.08em' }}>المسار المهني:</span>
      {crumbs.map((c, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '1.6mm' }}>
          {i > 0 && <span style={{ color: RC.gold, fontSize: '9px' }} aria-hidden="true">◂</span>}
          <span style={{
            ...RT.caption,
            color: c.strong ? RC.primaryDeep : RC.inkSoft,
            fontWeight: c.strong ? 700 : 500,
            background: c.strong ? RC.tint : RC.wash,
            border: `0.6px solid ${c.strong ? RC.line : RC.line}`,
            borderRadius: RR.chip,
            padding: '0.6mm 2.6mm',
            fontSize: '8.5px',
          }}>
            {c.label}
          </span>
        </span>
      ))}
    </div>
  )
}

/* ─── شبكة المعلومات العامة — ديناميكية، بلا خانات فارغة ──── */

function InfoGrid({ a, user }: { a: TAchievement; user: ReportData['user'] }) {
  const { t } = useReportDensity()
  const rows: { label: string; value: string }[] = []

  if (a.title) rows.push({ label: 'اسم الإنجاز / البرنامج', value: a.title })
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
    <div className="print-avoid-break" style={{ pageBreakInside: 'avoid', display: 'grid', gridTemplateColumns: '1fr 1fr', border: `0.9px solid ${RC.goldLine}`, borderRadius: RR.card, overflow: 'hidden', marginTop: S.s4, background: RC.paper }}>
      {rows.map((r, i) => {
        const isLastRow = i >= rows.length - (rows.length % 2 === 0 ? 2 : 1)
        return (
          <div
            key={r.label}
            style={{
              padding: `${t.cardPadY} ${t.cardPadX}`,
              background: i % 2 === 0 ? RC.wash : 'transparent',
              borderBottom: isLastRow ? undefined : `0.6px solid ${RC.line}`,
              borderInlineStart: i % 2 === 1 ? `0.6px solid ${RC.line}` : undefined,
            }}
          >
            <p style={{ margin: 0, ...RT.metricLabel, color: RC.goldDeep }}>{r.label}</p>
            <p style={{ margin: '0.8mm 0 0', ...RT.bodyStrong, color: RC.ink, fontSize: '11px' }}>{r.value}</p>
          </div>
        )
      })}
    </div>
  )
}

/* ─── الأهداف ──────────────────────────────────────────────── */

function Objectives({ a }: { a: TAchievement }) {
  const { t } = useReportDensity()
  const hasGeneral = Boolean(a.goalText?.trim())
  const hasLinked = Boolean(a.goal?.title)
  if (!hasGeneral && !hasLinked) return null

  return (
    <div>
      <SectionHeading>الأهداف</SectionHeading>
      <div className="print-avoid-break" style={{ pageBreakInside: 'avoid', padding: `${t.cardPadY} ${t.cardPadX}`, background: RC.paper, borderRadius: RR.card, borderRight: `2px solid ${RC.primary}` }}>
        <p style={{ margin: 0, ...RT.metricLabel, color: RC.goldDeep }}>الهدف العام</p>
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
  const { t } = useReportDensity()
  const source = a.execution?.trim() || a.actions?.trim()
  if (!source) return null
  const { steps, isList } = parseSteps(source)

  return (
    <div>
      <SectionHeading>وصف التنفيذ</SectionHeading>
      {isList ? (
        <ol style={{ margin: 0, paddingInlineStart: '7mm', display: 'flex', flexDirection: 'column', gap: t.listGap }}>
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
      {/* مراحل التنفيذ حقل مستقل إن وُجد مع التنفيذ */}
      {a.execution?.trim() && a.actions?.trim() && !isList && (
        <div className="print-avoid-break" style={{ marginTop: S.s3, pageBreakInside: 'avoid' }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.goldDeep }}>مراحل التنفيذ</p>
          <p style={{ margin: '1mm 0 0', ...RT.body, color: RC.inkSoft, whiteSpace: 'pre-line' }}>{a.actions}</p>
        </div>
      )}
    </div>
  )
}

/* ─── النتائج والأثر ────────────────────────────────────────── */

function ResultsSection({ a }: { a: TAchievement }) {
  const { t } = useReportDensity()
  const scored = a.preScore != null && a.postScore != null
  const hasText = Boolean(a.results?.trim() || a.impact?.trim())
  if (!scored && !hasText) return null

  return (
    <div>
      <SectionHeading>النتائج والأثر</SectionHeading>
      {scored && <BeforeAfter pre={a.preScore!} post={a.postScore!} />}
      {a.results?.trim() && (
        <div className="print-avoid-break" style={{ marginTop: scored ? S.s3 : 0, pageBreakInside: 'avoid' }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.goldDeep }}>النتائج</p>
          <p style={{ margin: '1mm 0 0', ...RT.body, color: RC.inkSoft }}>{a.results}</p>
        </div>
      )}
      {a.impact?.trim() && (
        <div className="print-avoid-break" style={{ marginTop: t.blockGap, pageBreakInside: 'avoid', padding: `${t.cardPadY} ${t.cardPadX}`, background: RC.goldWash, borderRadius: RR.card, border: `0.7px solid ${RC.goldLine}` }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.goldDeep }}>الأثر</p>
          <p style={{ margin: '1mm 0 0', ...RT.body, color: RC.ink }}>{a.impact}</p>
        </div>
      )}
    </div>
  )
}

/* ─── التوصيات والملاحظات ───────────────────────────────────── */

function NotesSection({ a }: { a: TAchievement }) {
  if (!a.notes?.trim()) return null
  return (
    <div>
      <SectionHeading>التوصيات والملاحظات</SectionHeading>
      <p style={{ margin: 0, ...RT.body, color: RC.inkSoft, textAlign: 'justify' as const }}>{a.notes}</p>
    </div>
  )
}

/* ─── الشواهد الداعمة — صور + ملفات ────────────────────────── */

function EvidenceSection({ images, files }: { images: (TAttachment & { url: string })[]; files: TAttachment[] }) {
  const { t } = useReportDensity()
  if (!images.length && !files.length) return null
  return (
    <div>
      <SectionHeading>الشواهد الداعمة</SectionHeading>
      {images.length > 0 && <Gallery images={images} />}
      {images.length > 0 && files.length > 0 && <div style={{ height: t.blockGap }} />}
      {files.length > 0 && <FileEvidenceList files={files} />}
    </div>
  )
}

/* ─── التوقيعات ────────────────────────────────────────────── */

function Signatures({ user }: { user: ReportData['user'] }) {
  const { t, level } = useReportDensity()
  const labels = getGenderedLabels(user.gender)
  const sigTop = level === 'tight' ? parseFloat(t.sectionGap) : parseFloat(t.sectionGap) * 1.4
  const sigSpace = level === 'tight' ? '7mm' : '9mm'
  return (
    <div className="print-avoid-break" style={{ marginTop: sigTop, pageBreakInside: 'avoid' }}>
      <OfficialRule />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S.s6, marginTop: S.s4 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.goldDeep, letterSpacing: '0.1em' }}>{labels.teacher} المادة</p>
          <p style={{ margin: '1.5mm 0 0', ...RT.bodyStrong, color: RC.ink }}>{user.name}</p>
          <div style={{ marginTop: sigSpace, borderTop: `0.7px solid ${RC.lineStrong}`, paddingTop: '1.2mm' }}>
            <p style={{ margin: 0, ...RT.caption, color: RC.muted }}>{labels.teacherSignature}</p>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.goldDeep, letterSpacing: '0.1em' }}>{labels.principal}</p>
          <p style={{ margin: '1.5mm 0 0', ...RT.bodyStrong, color: RC.ink }}>
            {user.principalName ?? <span style={{ color: RC.muted, fontWeight: 400 }}>..............................</span>}
          </p>
          <div style={{ marginTop: sigSpace, borderTop: `0.7px solid ${RC.lineStrong}`, paddingTop: '1.2mm' }}>
            <p style={{ margin: 0, ...RT.caption, color: RC.muted }}>التوقيع والختم</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══ وثيقة الإنجاز الكاملة — إنجاز واحد ═════════════════════ */

export function OfficialReport({ a, data }: { a: TAchievement; data: ReportData }) {
  const { user, year } = data
  const { t, level } = useReportDensity()
  const attachments = a.attachments ?? []
  const images = attachments.filter((x): x is TAttachment & { url: string } => x.kind === 'IMAGE' && Boolean(x.url))
  const files = attachments.filter((x) => x.kind !== 'IMAGE')
  const dateText = a.date ? formatDate(a.date) : formatDate(new Date())
  const labels = getGenderedLabels(user.gender)

  return (
    <div data-anchor="achievement" className="print-page" style={{ paddingTop: 0 }}>
      {/* الترويسة الرسمية + عنوان التقرير */}
      <OrgHeaderStrip user={user} year={year.label} compact />
      <div className="print-avoid-break" style={{ textAlign: 'center', marginTop: t.sectionGap, pageBreakInside: 'avoid', pageBreakAfter: 'avoid' }}>
        <p style={{ margin: 0, ...RT.caption, color: RC.goldDeep, letterSpacing: '0.2em' }}>تقرير تنفيذ رسمي</p>
        <h1 style={{ margin: `${S.s2} 0 0`, ...RT.h1, color: RC.primaryDeep, fontSize: '23px' }}>{officialTitle(a.type)}</h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: S.s2, marginTop: S.s2 }}>
          <Badge tone="green">{TYPE_LABEL(a.type)}</Badge>
          <span style={{ ...RT.caption, color: RC.muted }}>
            {labels.theTeacher}: <span style={{ color: RC.inkSoft, fontWeight: 700 }}>{user.name}</span>
            <span> • </span>العام الدراسي {year.label}
            {dateText ? (<><span> • </span>{dateText}</>) : null}
          </span>
        </div>
      </div>

      {/* مسار التصنيف المهني */}
      <FrameworkBreadcrumb a={a} />

      {/* شبكة المعلومات العامة */}
      <InfoGrid a={a} user={user} />

      {/* الأقسام المشروطة — لا عنوان لقسم فارغ أبدًا (عنوان كل قسم يوفر تباعده بmarginTopه) */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {a.description?.trim() && (
          <div>
            <SectionHeading>نبذة عن الإنجاز</SectionHeading>
            <p style={{ margin: 0, ...RT.body, color: RC.inkSoft, textAlign: 'justify' as const }}>{a.description}</p>
          </div>
        )}
        {a.problem?.trim() && (
          <div>
            <SectionHeading>المشكلة أو الحاجة</SectionHeading>
            <p style={{ margin: 0, ...RT.body, color: RC.inkSoft, textAlign: 'justify' as const }}>{a.problem}</p>
          </div>
        )}
        <Objectives a={a} />
        <ExecutionSection a={a} />
        <ResultsSection a={a} />
        <NotesSection a={a} />
        <EvidenceSection images={images} files={files} />
      </div>

      <Signatures user={user} />

      <p style={{ margin: `${level === 'tight' ? S.s1 : S.s4} 0 0`, textAlign: 'center', ...RT.caption, color: RC.muted }}>
        أُنشئ آليًا من منصة {REPORT_BRAND.appName} — {formatDate(new Date())}
      </p>
    </div>
  )
}

/* ═══ بطاقة إنجاز مدمجة — داخل ملف كامل أو قوائم ═════════════ */

export function AchievementCase({ a, index, fields }: { a: TAchievement; index?: number; fields?: string[] }) {
  const { t } = useReportDensity()
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
    <article style={{ marginBottom: t.sectionGap }}>
      {/* الرأس + أول حقل معًا — يمنع عنوانًا يتيمًا أسفل الصفحة */}
      <div className="print-avoid-break" style={{ pageBreakInside: 'avoid' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2.5mm', flexWrap: 'wrap', marginBottom: '1.6mm' }}>
          {index !== undefined && (
            <span style={{ ...RT.caption, color: RC.gold, fontSize: '10px', fontWeight: 700 }}>{String(index).padStart(2, '0')}</span>
          )}
          <Badge tone="green">{TYPE_LABEL(a.type)}</Badge>
          <span style={{ ...RT.caption, color: RC.muted }}>{a.date ? formatDate(a.date) : ''}</span>
          <span style={{ ...RT.caption, color: RC.muted }}>•</span>
          <span style={{ ...RT.caption, color: RC.muted }}>{a.subCriterion?.name ?? ''}</span>
        </div>
        <h3 style={{ margin: 0, ...RT.h3, color: RC.ink, fontSize: '14px' }}>{a.title}</h3>
        <Rule margin={`${S.s2} 0 ${S.s3}`} color={RC.goldLine} weight="0.8px" />
        {firstField}
      </div>
      {rendered.slice(1)}
      {a.durationText && <LabeledField label={FIELD_LABELS.durationText} value={a.durationText} />}
      {scored && <BeforeAfter pre={a.preScore!} post={a.postScore!} />}
      {(images.length > 0 || files.length > 0) && (
        <div style={{ marginTop: S.s3 }}>
          <p style={{ margin: `0 0 ${S.s2}`, ...RT.metricLabel, color: RC.goldDeep, pageBreakAfter: 'avoid' }}>الشواهد والمرفقات</p>
          {images.length > 0 && <Gallery images={images} />}
          {files.length > 0 && <FileEvidenceList files={files} />}
        </div>
      )}
      <Rule margin={`${S.s4} 0 0`} color={RC.line} />
    </article>
  )
}
