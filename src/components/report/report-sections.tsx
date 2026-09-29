'use client'

/**
 * كتل مستند ملف الإنجاز — الغلاف، السيرة المهنية، ملخص الإنجاز،
 * الفهرس (بأرقام صفحات حقيقية)، تفاصيل المجال، والإقرار والاعتماد.
 * كلها ديناميكية بالكامل من بيانات المستخدم — لا Hardcode إطلاقًا،
 * والخانات الفارغة تُخفى أو تُعالج بصريًا.
 */

import {
  RC, S, RT, RR, REPORT_BRAND,
  schoolLine, educationAdminLine, educationOfficeLine, footerLine,
} from '@/lib/report-tokens'
import {
  Rule, OfficialRule, Metric, ProgressBar, ProgressRing, Badge, EmptyNote,
  OrgHeaderStrip, orgHeaderLines, MinistryLogo, PageBreak, SectionHeading,
  teacherLine, subStatus, LabeledField, CoverMedallion,
} from './report-blocks'
import { usePageMap, useReportDensity } from './report-engine'
import { getGenderedLabels } from '@/lib/gender'
import { formatDate, formatNumber, improvement } from '@/lib/format'
import { SECTIONS, TYPE_LABEL } from '@/lib/constants'
import type { ReportData } from '@/hooks/use-data'
import type { TDomainNode } from '@/lib/types'

/* ═══ 1 — الغلاف ═══════════════════════════════════════════════ */

export function ReportCover({ data, dateStr }: { data: ReportData; dateStr: string }) {
  const { user, year, completion } = data
  const labels = getGenderedLabels(user.gender)
  const org = orgHeaderLines(user)
  const infoRows: { label: string; value?: string | null }[] = [
    { label: labels.teacherName, value: user.name },
    { label: 'التخصص', value: user.subject },
    { label: 'المرحلة', value: user.stage },
    { label: 'المدرسة', value: schoolLine(user.school) },
  ].filter((r) => Boolean(r.value))

  return (
    <div data-anchor="cover" className="print-page" style={{ display: 'flex', flexDirection: 'column', minHeight: '255mm', paddingTop: 0 }}>
      {/* ترويسة الجهة الرسمية */}
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
        <p style={{ margin: 0, ...RT.caption, color: RC.muted, whiteSpace: 'nowrap' }}>العام الدراسي {year.label}</p>
      </div>
      <div style={{ marginTop: S.s3 }}>
        <OfficialRule />
      </div>

      {/* العنصر البصري المركزي */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: S.s4, paddingBottom: S.s6 }}>
        <CoverMedallion size={124} />

        <div>
          <h1 style={{ margin: 0, ...RT.display, fontSize: '38px', color: RC.primaryDeep, fontWeight: 700 }}>
            ملف الإنجاز المهني
          </h1>
          <p style={{ margin: `${S.s3} 0 0`, fontSize: '16px', fontWeight: 600, color: RC.goldDeep, letterSpacing: '0.22em' }}>
            {labels.teacher === 'معلمة' ? 'للمعلمة' : labels.teacher === 'معلم' ? 'للمعلم' : 'للمعلم/ـة'}
          </p>
        </div>

        {/* العام الدراسي الهجري — ضمن شارة ذهبية هادئة */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: S.s2, border: `0.8px solid ${RC.goldLine}`, borderRadius: RR.chip, padding: `${S.s2} ${S.s6}`, background: RC.goldWash }}>
          <span style={{ ...RT.caption, color: RC.goldDeep, fontWeight: 700, letterSpacing: '0.1em' }}>العام الدراسي</span>
          <span style={{ ...RT.h3, color: RC.primaryDeep, fontVariantNumeric: 'tabular-nums' }}>{year.label}</span>
        </div>

        {/* بطاقة معلومات المعلم/ة — بيضاء بحد ذهبي */}
        <div style={{ width: '118mm', background: RC.paper, border: `0.9px solid ${RC.goldLine}`, borderRadius: RR.card, padding: `${S.s4} ${S.s6}`, boxShadow: 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: S.s4, rowGap: S.s2, textAlign: 'right' }}>
            {infoRows.map((r) => (
              <div key={r.label} style={{ display: 'contents' }}>
                <span style={{ ...RT.metricLabel, color: RC.goldDeep, alignSelf: 'center' }}>{r.label}</span>
                <span style={{ ...RT.bodyStrong, color: RC.ink, fontSize: '11.5px' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* المقاييس السفلية — اكتمال الملف + إصدار */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8mm' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.s4 }}>
          <ProgressRing pct={completion.overall} size={46} stroke={3} />
          <div>
            <p style={{ margin: 0, ...RT.metricLabel, color: RC.muted }}>اكتمال ملف الإنجاز المهني</p>
            <p style={{ margin: '1mm 0 0', ...RT.caption, color: RC.muted }}>
              وفق الإطار المهني الرسمي للمعلمين — {formatNumber(data.professional?.official.total ?? 39)} معيارًا فرعيًا
            </p>
          </div>
        </div>
        <p style={{ margin: 0, ...RT.caption, color: RC.muted, textAlign: 'left' }}>
          صدر بتاريخ {dateStr}
          <br />
          أُنشئ آليًا من منصة {REPORT_BRAND.appName}
        </p>
      </div>
    </div>
  )
}

/* ═══ 2 — السيرة الذاتية المهنية ══════════════════════════════ */

export function ProfessionalBio({ data }: { data: ReportData }) {
  const { t } = useReportDensity()
  const { user } = data
  const labels = getGenderedLabels(user.gender)
  const initials = user.name.split(' ').slice(0, 2).map((w) => w[0]).join(' ')

  const profileRows: { label: string; value?: string | null }[] = [
    { label: 'المدرسة', value: schoolLine(user.school) },
    { label: 'الإدارة التعليمية', value: educationAdminLine(user.educationAdmin) },
    { label: 'مكتب التعليم', value: educationOfficeLine(user.educationOffice) },
    { label: 'التخصص', value: user.subject },
    { label: 'المرحلة', value: user.stage },
    { label: 'الصفوف المسندة', value: user.classes },
    { label: 'النصاب الأسبوعي', value: user.weeklyLoad ? `${formatNumber(user.weeklyLoad)} حصة` : undefined },
    { label: 'المهام والمسؤوليات', value: user.duties },
  ].filter((r) => Boolean(r.value))

  const pdItems = data.achievements
    .filter((a) => (a.type === 'PD' || a.type === 'CERTIFICATE') && a.title)
    .sort((a, b) => (a.date && b.date ? +new Date(b.date) - +new Date(a.date) : 0))
    .slice(0, 6)

  return (
    <div data-anchor="bio" className="print-page" style={{ paddingTop: 0 }}>
      <SectionHeading kicker="وثيقة تعريف رسمية" first>السيرة الذاتية المهنية</SectionHeading>

      {/* بطاقة الهوية */}
      <div className="print-avoid-break" style={{ display: 'flex', alignItems: 'center', gap: S.s4, padding: t.cardPadY + ' ' + t.cardPadX, border: `0.9px solid ${RC.goldLine}`, borderRadius: RR.card, background: RC.paper, pageBreakInside: 'avoid' }}>
        <div style={{ width: '20mm', height: '20mm', borderRadius: '99px', background: `linear-gradient(135deg, ${RC.primary}, ${RC.primaryDeep})`, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 600, flexShrink: 0, lineHeight: 1, border: `0.8px solid ${RC.gold}` }}>
          {initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0, ...RT.h2, fontSize: '17px', color: RC.ink }}>{user.name}</h2>
          <p style={{ margin: '1.2mm 0 0', ...RT.body, color: RC.muted, fontSize: '11px' }}>
            {teacherLine(user, labels)}{user.school ? ` — ${user.school}` : ''}
          </p>
        </div>
      </div>

      {/* المقاييس المهنية */}
      <div style={{ display: 'flex', gap: S.s6, marginTop: t.sectionGap }}>
        <div style={{ flex: 1, minWidth: 0 }}><Metric value={user.experienceYears ? `${formatNumber(user.experienceYears)} سنة` : '—'} label="سنوات الخبرة" /></div>
        <div style={{ flex: 1, minWidth: 0 }}><Metric value={user.qualification ?? '—'} label="المؤهل العلمي" /></div>
        <div style={{ flex: 1, minWidth: 0 }}><Metric value={user.licenseNumber ?? '—'} label="الرخصة المهنية" /></div>
      </div>

      <Rule margin={`${t.sectionGap} 0 ${t.sectionGap}`} color={RC.goldLine} weight="0.8px" />

      {/* بيانات التكليف — بطاقة موحدة */}
      <div className="print-avoid-break" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: S.s8, rowGap: t.blockGap }}>
        {profileRows.map((r) => (
          <LabeledField key={r.label} label={r.label} value={r.value} />
        ))}
      </div>

      {/* الدورات والمؤهلات — من بيانات التطوير المهني الفعلية فقط */}
      {pdItems.length > 0 && (
        <div style={{ marginTop: t.sectionGap }}>
          <SectionHeading>الدورات والمؤهلات المهنية</SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: t.blockGap }}>
            {pdItems.map((a) => (
              <div key={a.id} className="print-avoid-break" style={{ display: 'flex', alignItems: 'baseline', gap: S.s3, borderBottom: `0.6px solid ${RC.line}`, paddingBottom: t.blockGap, pageBreakInside: 'avoid' }}>
                <span style={{ ...RT.caption, color: RC.goldDeep, fontWeight: 700, minWidth: '16mm', fontVariantNumeric: 'tabular-nums' }}>{a.date ? formatDate(a.date) : '—'}</span>
                <span style={{ ...RT.bodyStrong, color: RC.ink, flex: 1, minWidth: 0 }}>{a.title}</span>
                <span style={{ ...RT.caption, color: RC.muted, whiteSpace: 'nowrap' }}>
                  {a.provider ?? ''}{a.hours ? ` • ${formatNumber(a.hours)} ساعة` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══ 3 — ملخص الإنجاز ═════════════════════════════════════════ */

export function AchievementSummary({ data }: { data: ReportData }) {
  const { t } = useReportDensity()
  const { user, year, completion, achievements, professional } = data
  const evidenceCount = completion.counts.evidence
  const official = professional?.official
  const domains = (professional?.domains ?? []).filter((d) => d.isOfficial)

  const statCards: { value: string; label: string; accent?: boolean }[] = [
    { value: `${formatNumber(completion.overall)}%`, label: 'اكتمال الملف', accent: true },
    { value: formatNumber(completion.counts.achievements), label: 'إنجازًا موثقًا' },
    { value: formatNumber(evidenceCount), label: 'شاهدًا موثقًا' },
    { value: official ? `${formatNumber(official.completed)} / ${formatNumber(official.total)}` : '—', label: 'معيارًا فرعيًا مستوفى' },
  ]

  const extraStats: { value: string; label: string }[] = [
    { value: formatNumber(completion.counts.initiatives), label: 'مبادرات' },
    { value: formatNumber(completion.counts.pdHours), label: 'ساعة تطوير مهني' },
    { value: completion.counts.avgImprovement !== null ? `+${formatNumber(completion.counts.avgImprovement)}%` : '—', label: 'متوسط التحسن' },
    { value: formatNumber(completion.counts.beneficiaries), label: 'مستفيدًا من المبادرات' },
  ]

  return (
    <div data-anchor="summary" className="print-page" style={{ paddingTop: 0 }}>
      <SectionHeading kicker={`خلاصة ${year.label}`} first>ملخص الإنجاز</SectionHeading>

      {/* بطاقات إحصائية أنيقة */}
      <div className="print-avoid-break" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: S.s3 }}>
        {statCards.map((c) => (
          <div key={c.label} style={{ background: RC.paper, border: `0.8px solid ${RC.goldLine}`, borderRadius: RR.card, padding: `${t.cardPadY} ${t.cardPadX}`, textAlign: 'center', minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: c.accent ? RC.primaryDeep : RC.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>{c.value}</p>
            <p style={{ margin: '1mm 0 0', ...RT.metricLabel, color: RC.muted }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* توزيع الإنجازات على المجالات الرسمية */}
      <div style={{ marginTop: t.sectionGap }}>
        <SectionHeading>توزيع الإنجاز على المجالات المهنية</SectionHeading>
        {domains.length > 0 ? (
          <div className="print-avoid-break" style={{ display: 'flex', flexDirection: 'column', gap: t.blockGap }}>
            {domains.map((d, i) => (
              <div key={d.id} className="print-avoid-break" style={{ display: 'flex', alignItems: 'center', gap: S.s4, padding: `${t.cardPadY} ${t.cardPadX}`, background: RC.paper, border: `0.8px solid ${RC.line}`, borderRadius: RR.card, pageBreakInside: 'avoid' }}>
                <ProgressRing pct={d.percent} size={44} stroke={3} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: S.s2, flexWrap: 'wrap' }}>
                    <span style={{ ...RT.caption, color: RC.goldDeep, fontWeight: 700 }}>المجال {['الأول', 'الثاني', 'الثالث'][i] ?? i + 1}</span>
                    <p style={{ margin: 0, ...RT.bodyStrong, color: RC.ink, fontSize: '11px' }}>{d.name}</p>
                  </div>
                  <div style={{ marginTop: '1.6mm' }}>
                    <ProgressBar pct={d.percent} />
                  </div>
                  <p style={{ margin: '1.2mm 0 0', ...RT.caption, color: RC.muted, fontVariantNumeric: 'tabular-nums' }}>
                    {formatNumber(d.completedSubs)} / {formatNumber(d.totalSubs)} معيارًا فرعيًا — {d.criteriaCount} معايير رئيسية
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyNote label="لم يُبنَ الإطار المهني بعد" />
        )}
      </div>

      {/* إحصاءات مساندة */}
      <div style={{ marginTop: t.sectionGap }}>
        <SectionHeading>مؤشرات مساندة</SectionHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: `${S.s2} ${S.s3}` }}>
          {extraStats.map((m) => (
            <Metric key={m.label} value={m.value} label={m.label} />
          ))}
        </div>
      </div>

      {/* أبرز الإنجازات */}
      {(() => {
        const highlights = [...achievements]
          .filter((a) => a.impact || a.results)
          .sort((a, b) => (b.beneficiariesCount ?? b.studentsCount ?? 0) - (a.beneficiariesCount ?? a.studentsCount ?? 0))
          .slice(0, 3)
        if (!highlights.length) return null
        return (
          <div style={{ marginTop: t.sectionGap }}>
            <SectionHeading>أبرز الإنجازات وأثرها</SectionHeading>
            <div style={{ display: 'flex', flexDirection: 'column', gap: t.blockGap }}>
              {highlights.map((a) => {
                const diff = improvement(a.preScore, a.postScore)
                return (
                  <div key={a.id} className="print-avoid-break" style={{ borderRight: `1.6px solid ${RC.gold}`, paddingRight: S.s3, pageBreakInside: 'avoid' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: S.s2 }}>
                      <p style={{ margin: 0, ...RT.bodyStrong, color: RC.ink, flex: 1, minWidth: 0 }}>{a.title}</p>
                      <Badge tone="green">{TYPE_LABEL(a.type)}</Badge>
                    </div>
                    <p style={{ margin: '1mm 0 0', ...RT.caption, color: RC.muted }}>
                      {a.beneficiariesCount ? `${formatNumber(a.beneficiariesCount)} مستفيدًا` : a.studentsCount ? `${formatNumber(a.studentsCount)} طالبًا` : ''}
                      {diff !== null ? ` • تحسن +${formatNumber(diff)} نقطة` : ''}
                    </p>
                    {a.impact && <p style={{ margin: '1.2mm 0 0', ...RT.body, color: RC.inkSoft }}>{a.impact}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* فقرة ختامية */}
      <p style={{ margin: `${t.sectionGap} 0 0`, ...RT.body, color: RC.muted, textAlign: 'justify' }}>
        يوثّق هذا الملف ممارسات {getGenderedLabels(user.gender).theTeacher} خلال العام الدراسي {year.label} موزعةً على مجالات الإطار المهني الثلاثة، مع الشواهد الداعمة لكل ممارسة وقياس أثرها على الطلبة والمجتمع المدرسي.
      </p>
    </div>
  )
}

/* ═══ 4 — الفهرس (أرقام صفحات حقيقية من المحرك) ══════════════ */

export interface TocEntry {
  anchor: string
  title: string
  meta?: string
}

export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  const pageMap = usePageMap()
  const total = Math.max(...entries.map((e) => pageMap[e.anchor] ?? 0), 0) + 1
  return (
    <div data-anchor="toc" className="print-page" style={{ paddingTop: 0 }}>
      <SectionHeading kicker="المحتويات" first>فهرس المحتويات</SectionHeading>

      {/* رأس الجدول */}
      <div style={{ display: 'flex', gap: S.s3, padding: `${S.s2} ${S.s3}`, background: RC.primaryDeep, borderRadius: `${RR.card} ${RR.card} 0 0` }}>
        <span style={{ ...RT.metricLabel, color: 'rgba(255,255,255,0.75)', width: '8mm' }}>#</span>
        <span style={{ ...RT.metricLabel, color: '#FFFFFF', flex: 1 }}>المحتوى</span>
        <span style={{ ...RT.metricLabel, color: 'rgba(255,255,255,0.75)', width: '34mm', textAlign: 'right' }}>البيان</span>
        <span style={{ ...RT.metricLabel, color: 'rgba(255,255,255,0.75)', width: '12mm', textAlign: 'center' }}>الصفحة</span>
      </div>

      <div style={{ border: `0.7px solid ${RC.line}`, borderTop: 'none', borderRadius: `0 0 ${RR.card} ${RR.card}`, background: RC.paper, overflow: 'hidden' }}>
        {entries.map((e, i) => {
          const page = pageMap[e.anchor]
          return (
            <div key={e.anchor} style={{ display: 'flex', alignItems: 'baseline', gap: S.s3, padding: `${S.s2} ${S.s3}`, borderBottom: i === entries.length - 1 ? 'none' : `0.6px solid ${RC.line}`, background: i % 2 === 1 ? RC.wash : 'transparent' }}>
              <span style={{ ...RT.caption, color: RC.goldDeep, fontWeight: 700, width: '8mm', fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ ...RT.bodyStrong, color: RC.ink, fontSize: '11px', flex: 1, minWidth: 0 }}>{e.title}</span>
              <span style={{ ...RT.caption, color: RC.muted, width: '34mm', textAlign: 'right', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{e.meta ?? '—'}</span>
              <span style={{ ...RT.bodyStrong, color: RC.primaryDeep, width: '12mm', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {page !== undefined ? formatNumber(page + 1) : '—'}
              </span>
            </div>
          )
        })}
      </div>

      <p style={{ margin: `${S.s4} 0 0`, ...RT.caption, color: RC.muted }}>
        أرقام الصفحات فعلية وفق ترقيم المستند ({formatNumber(total)} صفحة) — يبدأ كل مجال بصفحة مستقلة.
      </p>
    </div>
  )
}

/* ═══ 5 — تفاصيل المجال ════════════════════════════════════════ */

const DOMAIN_ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس']

export function DomainDetail({ domain, ordinal }: { domain: TDomainNode; ordinal: number }) {
  const { t } = useReportDensity()
  const allSubs = domain.criteria.flatMap((c) => c.subs)
  const withAchievement = allSubs.filter((s) => s.achievementsCount > 0).length

  return (
    <div data-anchor={`domain-${domain.id}`} className="print-page" style={{ paddingTop: 0 }}>
      {/* ترويسة المجال */}
      <div className="print-avoid-break" style={{ display: 'flex', alignItems: 'center', gap: S.s4, pageBreakInside: 'avoid', pageBreakAfter: 'avoid' }}>
        <ProgressRing pct={domain.percent} size={56} stroke={3.6} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, ...RT.caption, color: RC.goldDeep, fontWeight: 700, letterSpacing: '0.12em' }}>
            المجال {DOMAIN_ORDINALS[ordinal] ?? ordinal + 1}{domain.officialCode ? ` — ${domain.officialCode}` : ''}
          </p>
          <h2 style={{ margin: '1mm 0 0', ...RT.h2, fontSize: '18px', color: RC.primaryDeep }}>{domain.name}</h2>
          {domain.description && (
            <p style={{ margin: '1.6mm 0 0', ...RT.body, color: RC.muted, fontSize: '10px', lineHeight: 1.7 }}>{domain.description}</p>
          )}
        </div>
      </div>

      <OfficialRule margin={`${S.s3} 0 ${t.sectionGap}`} />

      {/* مقاييس المجال */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: `${S.s2} ${S.s3}`, marginBottom: t.sectionGap }}>
        <Metric value={`${formatNumber(domain.percent)}%`} label="اكتمال المجال" accent />
        <Metric value={formatNumber(domain.criteriaCount)} label="معايير رئيسية" />
        <Metric value={formatNumber(domain.completedSubs)} label="مستوفى" />
        <Metric value={formatNumber(domain.totalSubs - domain.completedSubs)} label="غير مستوفى" />
      </div>

      {/* جدول المعايير الفرعية — رأس أخضر ونص أبيض */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: t.blockGap }}>
        {domain.criteria.map((c) => (
          <div key={c.id} className="print-avoid-break" style={{ pageBreakInside: 'avoid' }}>
            {/* عنوان المعيار */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: S.s2, padding: `${S.s2} ${S.s3}`, background: RC.primary, borderRadius: `${RR.card} ${RR.card} 0 0` }}>
              <span style={{ ...RT.caption, color: RC.goldWash, fontWeight: 700 }}>{c.officialCode ?? ''}</span>
              <span style={{ ...RT.bodyStrong, color: '#FFFFFF', fontSize: '10.5px', flex: 1, minWidth: 0 }}>{c.name}</span>
              <span style={{ ...RT.caption, color: RC.goldWash, fontVariantNumeric: 'tabular-nums' }}>
                {formatNumber(c.completedSubs)} / {formatNumber(c.totalSubs)}
              </span>
            </div>
            {/* صفوف المعايير الفرعية */}
            <div style={{ border: `0.7px solid ${RC.line}`, borderTop: 'none', borderRadius: `0 0 ${RR.card} ${RR.card}`, background: RC.paper, overflow: 'hidden' }}>
              {c.subs.map((sub, si) => {
                const st = subStatus(sub)
                return (
                  <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: S.s2, padding: `${S.s2} ${S.s3}`, borderBottom: si === c.subs.length - 1 ? 'none' : `0.6px solid ${RC.line}` }}>
                    <span style={{ ...RT.caption, color: RC.muted, width: '13mm', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{sub.officialCode ?? ''}</span>
                    <span style={{ ...RT.body, color: RC.inkSoft, flex: 1, minWidth: 0, fontSize: '10px' }}>{sub.name}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* خلاصة المجال */}
      <p style={{ margin: `${t.sectionGap} 0 0`, ...RT.caption, color: RC.muted, textAlign: 'center' }}>
        {withAchievement > 0
          ? `وثّق في هذا المجال ${formatNumber(withAchievement)} معيارًا فرعيًا بإنجازات فعلية — التفاصيل الكاملة في صفحات الإنجازات.`
          : 'لم تُوثَّق ممارسات في هذا المجال بعد.'}
      </p>
    </div>
  )
}

/* ═══ 6 — الإقرار والاعتماد ════════════════════════════════════ */

export function ApprovalPage({ data, dateStr }: { data: ReportData; dateStr: string }) {
  const { t } = useReportDensity()
  const { user, year } = data
  const labels = getGenderedLabels(user.gender)

  return (
    <div data-anchor="approval" className="print-page" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column' }}>
      <SectionHeading kicker="خاتمة الملف" first>الإقرار والاعتماد</SectionHeading>

      {/* نص الإقرار */}
      <div className="print-avoid-break" style={{ background: RC.paper, border: `0.9px solid ${RC.goldLine}`, borderRadius: RR.card, padding: `${t.cardPadY} ${t.cardPadX}`, pageBreakInside: 'avoid' }}>
        <p style={{ margin: 0, ...RT.quote, color: RC.inkSoft, textAlign: 'justify' }}>
          أقرّ أنا {labels.theTeacher} <span style={{ fontWeight: 700, color: RC.ink }}>{user.name}</span> بأن جميع ما ورد في هذا الملف من إنجازات وممارسات وشواهد وقياسات يعكس عملي الفعلي خلال العام الدراسي {year.label}، وأنه أُعدّ ووثّق بإرادتي ووفق الإطار المهني الرسمي للمعلمين، وأن جميع البيانات صحيحة ومطابقة للواقع.
        </p>
      </div>

      {/* توقيع المعلم/ة */}
      <div style={{ marginTop: parseFloat(t.sectionGap) * 1.6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S.s8 }}>
        <div className="print-avoid-break" style={{ textAlign: 'center', background: RC.paper, border: `0.8px solid ${RC.line}`, borderRadius: RR.card, padding: t.cardPadY + ' ' + t.cardPadX, pageBreakInside: 'avoid' }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.goldDeep, letterSpacing: '0.1em' }}>{labels.teacherName}</p>
          <p style={{ margin: `${S.s2} 0 0`, ...RT.bodyStrong, color: RC.ink, fontSize: '12px' }}>{user.name}</p>
          <div style={{ marginTop: '11mm', borderTop: `0.8px solid ${RC.lineStrong}`, paddingTop: '1.4mm' }}>
            <p style={{ margin: 0, ...RT.caption, color: RC.muted }}>{labels.teacherSignature} — التاريخ {dateStr}</p>
          </div>
        </div>

        {/* قائد/ة المدرسة */}
        <div className="print-avoid-break" style={{ textAlign: 'center', background: RC.paper, border: `0.8px solid ${RC.line}`, borderRadius: RR.card, padding: t.cardPadY + ' ' + t.cardPadX, pageBreakInside: 'avoid' }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.goldDeep, letterSpacing: '0.1em' }}>{labels.principal}</p>
          <p style={{ margin: `${S.s2} 0 0`, ...RT.bodyStrong, color: RC.ink, fontSize: '12px' }}>
            {user.principalName ?? <span style={{ color: RC.muted, fontWeight: 400 }}>..............................</span>}
          </p>
          <div style={{ marginTop: '11mm', borderTop: `0.8px solid ${RC.lineStrong}`, paddingTop: '1.4mm' }}>
            <p style={{ margin: 0, ...RT.caption, color: RC.muted }}>التوقيع والختم — التاريخ ......................</p>
          </div>
        </div>
      </div>

      {/* ملاحظات قائد/ة المدرسة — سطور فارغة أنيقة بلا محتوى وهمي */}
      <div style={{ marginTop: parseFloat(t.sectionGap) * 1.6 }}>
        <SectionHeading>ملاحظات {user.principalName ? getGenderedLabels(user.gender).principal.replace('اسم ', '') : 'قائد/ة المدرسة'}</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9mm', padding: `${S.s2} 0` }} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ borderBottom: `0.7px solid ${RC.line}`, height: '1mm' }} />
          ))}
        </div>
      </div>

      {/* ختم الملف */}
      <div style={{ marginTop: 'auto', paddingTop: t.sectionGap, display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.s3, color: RC.muted }}>
          <div style={{ width: '10mm', height: '0.5mm', background: RC.goldLine }} />
          <p style={{ margin: 0, ...RT.caption, letterSpacing: '0.14em' }}>
            {REPORT_BRAND.appName} — {year.label}
          </p>
          <div style={{ width: '10mm', height: '0.5mm', background: RC.goldLine }} />
        </div>
      </div>
    </div>
  )
}

/* ═══ فاصل قسم تقليدي داخل الملخصات ═══════════════════════════ */

export function SectionDivider({ num, title, desc, stats, anchor }: { num: number; title: string; desc: string; stats?: { label: string; value: string }[]; anchor?: string }) {
  const { t } = useReportDensity()
  return (
    <div data-anchor={anchor} className="print-section-cover print-avoid-break" style={{ minHeight: '100mm', display: 'flex', flexDirection: 'column', justifyContent: 'center', pageBreakBefore: 'always', pageBreakInside: 'avoid' }}>
      <span aria-hidden="true" style={{ fontSize: '54px', fontWeight: 200, lineHeight: 1, color: 'transparent', WebkitTextStroke: `1px ${RC.gold}`, letterSpacing: '0.04em' }}>
        {String(num).padStart(2, '0')}
      </span>
      <h2 style={{ margin: `${S.s3} 0 ${S.s2}`, ...RT.h1, color: RC.primaryDeep, fontSize: '23px' }}>{title}</h2>
      <div style={{ width: '30mm', height: '1.1mm', background: RC.gold, marginBottom: S.s4 }} />
      <p style={{ margin: 0, ...RT.body, color: RC.muted, maxWidth: '130mm' }}>{desc}</p>
      {stats && stats.length > 0 && (
        <div style={{ display: 'flex', gap: '3mm', marginTop: S.s6, flexWrap: 'wrap' }}>
          {stats.map((s) => (
            <div key={s.label} style={{ border: `0.8px solid ${RC.goldLine}`, borderRadius: RR.card, padding: `${S.s2} ${S.s4}`, minWidth: '30mm', background: RC.paper }}>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: RC.primaryDeep, fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
              <p style={{ margin: '0.8mm 0 0', ...RT.metricLabel, color: RC.muted }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: t.sectionGap }} />
    </div>
  )
}
