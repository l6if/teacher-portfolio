'use client'

/**
 * محرك التقارير المطبوعة v2 — منظّم القوالب + مستند الصفحات الموحد
 * ─────────────────────────────────────────────────────────────────
 * ReportBody: شجرة المحتوى الوحيدة (القوالب السبعة) تُقاس ثم تُعرض
 * كصفحات A4 صريحة عبر ReportDocument — نفس المكونات حرفيًا في
 * المعاينة والطباعة وPDF (PREVIEW = PRINT = PDF بنيويًا).
 *
 * ReportPrint: يعرض ReportDocument في #print-root وينتظر جاهزية
 * المحرك (قياس + صور) قبل فتح نافذة الطباعة — فتخرج الصفحات
 * مقسّمة تمامًا كما ظهرت في المعاينة.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useApp } from '@/store/app-store'
import { useReport } from '@/hooks/use-data'
import { SECTIONS, SECTION_MAP, TYPE_LABEL } from '@/lib/constants'
import { formatDate, formatNumber } from '@/lib/format'
import { RC, S, RT, RR, REPORT_BRAND, FIELD_LABELS, schoolLine } from '@/lib/report-tokens'
import {
  Rule, OfficialRule, Metric, Badge, EmptyNote, SectionHeading,
  OrgHeaderStrip, LabeledField, ProgressRing, ProgressBar, FileEvidenceList, Gallery,
} from './report-blocks'
import {
  ReportCover, ProfessionalBio, AchievementSummary, TableOfContents,
  DomainDetail, ApprovalPage, SectionDivider, type TocEntry,
} from './report-sections'
import { OfficialReport, officialTitle, AchievementCase } from './official-report'
import { ReportImageProvider, useReportImages } from './report-image-context'
import {
  useReportPagination, DensityProvider, PageMapProvider,
  CONTENT_W_MM, type PageSlice, type DensityLevel,
} from './report-engine'
import { PageShell, ContentSlice, type ReportVariant } from './report-page'
import { getGenderedLabels } from '@/lib/gender'
import type { PrintConfig } from '@/store/app-store'
import type { ReportData } from '@/hooks/use-data'

/* ═══════════════════════════════════════════════════════════════
   ReportBody — شجرة المحتوى الموحدة (تُقاس وتُقطَّع صفحاتِ صفحات)
   ═══════════════════════════════════════════════════════════════ */

export function ReportBody({ config, data }: { config: PrintConfig; data: ReportData }) {
  const { user, year, goals, achievements, reflection, devPlans, completion } = data
  const dateStr = formatDate(new Date())
  const byType = (types: string[]) => achievements.filter((a) => types.includes(a.type))
  const scored = achievements.filter((a) => a.preScore != null && a.postScore != null)
  const pdItems = [...byType(['PD'])].sort((a, b) => (a.date ? +new Date(a.date) : 0) - (b.date ? +new Date(b.date) : 0))
  const pdHours = pdItems.reduce((s, a) => s + (a.hours ?? 0), 0)
  const initItems = byType(['INITIATIVE'])
  const totalBeneficiaries = initItems.reduce((s, a) => s + (a.beneficiariesCount ?? 0), 0)
  const rootStyle: React.CSSProperties = { fontFamily: 'var(--font-plex), Tahoma, sans-serif', color: RC.ink }

  /** هل للقسم محتوى فعلي؟ — الأقسام الفارغة تُستبعد كليًا */
  const hasContent = (key: string): boolean => {
    if (key === 'profile') return true
    if (key === 'goals') return goals.length > 0
    if (key === 'reflection') return Boolean(reflection)
    if (key === 'devplan') return devPlans.length > 0
    if (key === 'outcomes') return scored.length > 0
    const s = SECTION_MAP[key]
    return byType(s?.types ?? []).length > 0
  }

  const requestedSections =
    config.mode === 'custom'
      ? SECTIONS.filter((s) => config.sections.includes(s.key))
      : config.mode === 'pd' ? [SECTION_MAP.development!]
      : config.mode === 'initiatives' ? [SECTION_MAP.initiatives!]
      : config.mode === 'impact' ? [SECTION_MAP.outcomes!]
      : SECTIONS

  const includedSections =
    config.mode === 'full' || config.mode === 'custom'
      ? requestedSections.filter((s) => hasContent(s.key))
      : requestedSections

  /* ═══ القالب 6 — وثيقة الإنجاز الرسمي (إنجاز واحد — One-Page-First) ═══ */
  if (config.mode === 'official') {
    const a = achievements.find((x) => x.id === config.achievementId)
    if (!a) {
      return (
        <div dir="rtl" style={rootStyle}>
          <EmptyNote label="الإنجاز المطلوب غير موجود" />
        </div>
      )
    }
    return (
      <div dir="rtl" style={rootStyle}>
        <OfficialReport a={a} data={data} />
      </div>
    )
  }

  /* ═══ القالب 1 — ملف الإنجاز الكامل + المخصص ═══ */
  if (config.mode === 'full' || config.mode === 'custom') {
    const officialDomains = (data.professional?.domains ?? []).filter((d) => d.isOfficial)
    const evidenceImages = data.attachments.filter((x): x is ReportData['attachments'][number] & { url: string } => x.kind === 'IMAGE' && Boolean(x.url))
    const evidenceFiles = data.attachments.filter((x) => x.kind !== 'IMAGE')
    const hasEvidence = evidenceImages.length + evidenceFiles.length > 0
    /** صفحة السيرة تُعرض مرة واحدة بلا تكرار — قسم «البيانات المهنية» نفسه */
    const includeBio = includedSections.some((s) => s.key === 'profile')
    const contentSections = includedSections.filter((s) => s.key !== 'profile')

    const tocEntries: TocEntry[] = [
      ...(includeBio ? [{ anchor: 'bio', title: 'السيرة الذاتية المهنية', meta: user.subject ?? user.school ?? undefined }] : []),
      { anchor: 'summary', title: 'ملخص الإنجاز', meta: `${formatNumber(completion.overall)}% اكتمال` },
      ...officialDomains.map((d, i) => ({
        anchor: `domain-${d.id}`,
        title: `المجال ${['الأول', 'الثاني', 'الثالث'][i] ?? i + 1}: ${d.name}`,
        meta: `${formatNumber(d.completedSubs)} / ${formatNumber(d.totalSubs)}`,
      })),
      ...contentSections.map((s) => ({
        anchor: `section-${s.key}`,
        title: s.title,
        meta: s.key === 'goals' ? `${goals.length} هدفًا`
          : s.key === 'development' ? pdHours > 0 ? `${formatNumber(pdHours)} ساعة` : undefined
          : s.key === 'outcomes' ? `${scored.length} قياسات`
          : s.key === 'initiatives' ? initItems.length ? `${formatNumber(totalBeneficiaries)} مستفيدًا` : undefined
          : `${byType(s.types ?? []).length} عناصر`,
      })),
      ...(hasEvidence ? [{ anchor: 'evidence', title: 'سجل الشواهد', meta: `${formatNumber(evidenceImages.length + evidenceFiles.length)} شاهدًا` }] : []),
      { anchor: 'approval', title: 'الإقرار والاعتماد', meta: 'خاتمة الملف' },
    ]

    return (
      <div dir="rtl" style={rootStyle}>
        <ReportCover data={data} dateStr={dateStr} />
        {includeBio && <ProfessionalBio data={data} />}
        <AchievementSummary data={data} />
        <TableOfContents entries={tocEntries} />

        {/* المجالات الرسمية — صفحة تفاصيل لكل مجال */}
        {officialDomains.map((d, i) => (
          <DomainDetail key={d.id} domain={d} ordinal={i} />
        ))}

        {/* أقسام المحتوى — كل قسم بفاصل صفحة عنوان (السيرة صفحة مستقلة سابقًا) */}
        {contentSections.map((s, i) => {
          const num = i + 1
          const stats: { label: string; value: string }[] = []
          let content: ReactNode = null

          if (s.key === 'profile') {
            stats.push({ label: 'المجال', value: 'بيانات رسمية' })
            content = (
              <>
                <div style={{ paddingTop: S.s4 }}>
                  <ProfessionalBio data={data} />
                </div>
              </>
            )
          } else if (s.key === 'goals') {
            stats.push({ label: 'الأهداف', value: String(goals.length) })
            content = goals.length ? (
              <div style={{ paddingTop: S.s4 }}>
                {goals.map((g, idx) => {
                  const pct = g.targetValue && g.targetValue > 0 ? Math.min(100, Math.round(((g.currentValue ?? 0) / g.targetValue) * 100)) : 0
                  return (
                    <div key={g.id} className="print-avoid-break" style={{ marginBottom: S.s6, pageBreakInside: 'avoid' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: S.s3 }}>
                        <span style={{ ...RT.caption, color: RC.gold, fontSize: '10px', fontWeight: 700 }}>{String(idx + 1).padStart(2, '0')}</span>
                        <h3 style={{ margin: 0, ...RT.h3, color: RC.ink, flex: 1 }}>{g.title}</h3>
                        <span style={{ ...RT.caption, color: RC.primaryDeep, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                      </div>
                      <div style={{ marginTop: S.s2 }}>
                        <ProgressBar pct={pct} />
                      </div>
                      <p style={{ margin: `${S.s2} 0 0`, ...RT.caption, color: RC.muted, fontVariantNumeric: 'tabular-nums' }}>
                        التقدم: {formatNumber(g.currentValue ?? 0)} / {formatNumber(g.targetValue ?? 0)}
                        {g.indicator ? ` — المؤشر: ${g.indicator}` : ''}
                      </p>
                      {g.description && <p style={{ margin: `${S.s2} 0 0`, ...RT.body, color: RC.inkSoft }}>{g.description}</p>}
                      {g.achievements && g.achievements.length > 0 && (
                        <p style={{ margin: `${S.s2} 0 0`, ...RT.caption, color: RC.muted }}>
                          إنجازات مرتبطة ({g.achievements.length}): {g.achievements.map((a) => a.title).join(' • ')}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : <EmptyNote label="لا توجد أهداف مهنية موثقة" />
          } else if (s.key === 'reflection') {
            const answered = reflection ? [reflection.success, reflection.practice, reflection.develop, reflection.nextTerm] : []
            stats.push({ label: 'الأسئلة المجابة', value: `${answered.filter(Boolean).length} / 4` })
            content = reflection ? (
              <div style={{ paddingTop: S.s4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S.s4 }}>
                {([
                  ['أبرز نجاح حققته', reflection.success],
                  ['أكثر ممارسة مؤثرة', reflection.practice],
                  ['المجال المرغوب تطويره', reflection.develop],
                  ['ما سأفعله بشكل مختلف', reflection.nextTerm],
                ] as [string, string | undefined | null][]).map(([label, val]) => (
                  <div key={label} className="print-avoid-break" style={{ border: `0.8px solid ${RC.goldLine}`, borderRadius: RR.card, padding: S.s4, background: RC.paper, pageBreakInside: 'avoid' }}>
                    <p style={{ margin: 0, ...RT.metricLabel, color: RC.goldDeep }}>{label}</p>
                    <p style={{ margin: `${S.s2} 0 0`, ...RT.body, color: RC.inkSoft }}>{val || '—'}</p>
                  </div>
                ))}
              </div>
            ) : <EmptyNote label="لم تُجب أسئلة التأمل المهني بعد" />
          } else if (s.key === 'devplan') {
            stats.push({ label: 'بنود الخطة', value: String(devPlans.length) })
            content = devPlans.length ? (
              <div style={{ paddingTop: S.s4 }}>
                <PlanTable devPlans={devPlans} />
              </div>
            ) : <EmptyNote label="لا توجد خطة تطويرية موثقة" />
          } else if (s.key === 'outcomes') {
            stats.push(
              { label: 'قياسات موثقة', value: String(scored.length) },
              { label: 'متوسط التحسن', value: completion.counts.avgImprovement !== null ? `+${formatNumber(completion.counts.avgImprovement)}%` : '—' },
            )
            content = scored.length ? (
              <div style={{ paddingTop: S.s4 }}>
                <p style={{ margin: `0 0 ${S.s3}`, ...RT.body, color: RC.muted, maxWidth: '150mm' }}>
                  قياسات القبلي/البعدي لكل تدخل — التفاصيل الكاملة في أقسامها، وهنا مقارنة النتائج والأثر.
                </p>
                {scored.map((a, idx) => (
                  <ImpactRow key={a.id} a={a} index={idx + 1} />
                ))}
              </div>
            ) : <EmptyNote label="لا توجد قياسات قبلي/بعدي موثقة" />
          } else {
            const items = byType(s.types ?? [])
            stats.push({ label: 'العناصر', value: String(items.length) })
            if (s.key === 'development' && pdHours > 0) stats.push({ label: 'إجمالي الساعات', value: `${formatNumber(pdHours)} ساعة` })
            if (s.key === 'initiatives') stats.push({ label: 'إجمالي المستفيدين', value: formatNumber(totalBeneficiaries) })
            content = items.length ? (
              <div style={{ paddingTop: S.s4 }}>
                {items.map((a, idx) => (
                  <ReportDocumentSection
                    key={a.id}
                    first={idx === 0}
                    user={user}
                    year={year.label}
                    title={officialTitle(a.type)}
                    dateText={a.date ? formatDate(a.date) : undefined}
                  >
                    <AchievementCase a={a} index={idx + 1} />
                  </ReportDocumentSection>
                ))}
              </div>
            ) : <EmptyNote label={`لا توجد عناصر موثقة في ${s.title}`} />
          }

          return (
            <section key={s.key}>
              <SectionDivider num={num} title={s.title} desc={s.desc} stats={stats} anchor={`section-${s.key}`} />
              <div style={{ paddingBottom: S.s6 }}>{content}</div>
            </section>
          )
        })}

        {/* سجل الشواهد — معرض موحد لكل شواهد العام */}
        {hasEvidence && <EvidenceLedger images={evidenceImages} files={evidenceFiles} />}

        {/* الإقرار والاعتماد — خاتمة الملف دائمًا */}
        <ApprovalPage data={data} dateStr={dateStr} />
      </div>
    )
  }

  /* ═══ القالب 2 — الملخص التنفيذي ═══ */
  if (config.mode === 'summary') {
    return (
      <div dir="rtl" style={rootStyle}>
        <div className="print-page" style={{ paddingTop: 0 }}>
          <OrgHeaderStrip user={user} year={year.label} compact />
          <ReportHeaderV2
            title="ملخص ملف الإنجاز"
            subtitle={`${user.name} — ${user.subject ? `${getGenderedLabels(user.gender).teacher} ${user.subject} — ` : ''}${user.school ?? ''} — ${year.label}`}
            metrics={[
              { value: `${formatNumber(completion.overall)}%`, label: 'اكتمال الملف' },
              { value: formatNumber(completion.counts.achievements), label: 'إنجازًا موثقًا' },
            ]}
          />
          <SummaryBody data={data} />
        </div>
      </div>
    )
  }

  /* ═══ القالب 3 — تقرير الأثر المهني ═══ */
  if (config.mode === 'impact') {
    return (
      <div dir="rtl" style={rootStyle}>
        <div className="print-page" style={{ paddingTop: 0 }}>
          <OrgHeaderStrip user={user} year={year.label} compact />
          <ReportHeaderV2
            title="تقرير الأثر المهني"
            subtitle={`${user.name} — ${user.subject ? `${getGenderedLabels(user.gender).teacher} ${user.subject} — ` : ''}${year.label} — أثر الممارسات مقيسًا بالقياس القبلي والبعدي`}
            metrics={[
              { value: String(scored.length), label: 'قياسات موثقة' },
              { value: completion.counts.avgImprovement !== null ? `+${formatNumber(completion.counts.avgImprovement)}%` : '—', label: 'متوسط التحسن' },
            ]}
          />
          {scored.length === 0 ? (
            <EmptyNote label="لا توجد قياسات قبلي/بعدي موثقة بعد" />
          ) : (
            <div>
              <p style={{ margin: `0 0 ${S.s6}`, ...RT.body, color: RC.muted, maxWidth: '150mm' }}>
                لكل تدخل تعليمي: المشكلة وخط الأساس، ثم التدخل، فالنتيجة المقيسة والدليل — {scored.length} قياسات بمتوسط تحسن {completion.counts.avgImprovement !== null ? `+${formatNumber(completion.counts.avgImprovement)}%` : 'غير محدد'}.
              </p>
              {scored.map((a, idx) => (
                <ReportDocumentSection
                  key={a.id}
                  first={idx === 0}
                  headerMode={idx === 0 ? 'title' : 'full'}
                  user={user}
                  year={year.label}
                  title={officialTitle(a.type)}
                  dateText={a.date ? formatDate(a.date) : undefined}
                >
                  <AchievementCase a={a} index={idx + 1} fields={['problem', 'goalText', 'execution', 'results', 'impact']} />
                </ReportDocumentSection>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ═══ القالب 4 — تقرير التطوير المهني ═══ */
  if (config.mode === 'pd') {
    const appliedCount = pdItems.filter((a) => a.impact || a.results).length
    return (
      <div dir="rtl" style={rootStyle}>
        <div className="print-page" style={{ paddingTop: 0 }}>
          <OrgHeaderStrip user={user} year={year.label} compact />
          <ReportHeaderV2
            title="تقرير التطوير المهني"
            subtitle={`${user.name} — ${schoolLine(user.school) ?? ''} — ${year.label} — البرامج التدريبية وساعاتها وأثرها على الممارسة`}
            metrics={[
              { value: formatNumber(pdHours), label: 'إجمالي الساعات' },
              { value: String(pdItems.length), label: 'برنامجًا' },
            ]}
          />
          {pdItems.length === 0 ? (
            <EmptyNote label="لا توجد أنشطة تطوير مهني موثقة بعد" />
          ) : (
            <>
              <p style={{ margin: `0 0 ${S.s6}`, ...RT.body, color: RC.muted, maxWidth: '150mm' }}>
                رحلة التطوير المهني خلال العام مرتبة زمنيًا — {pdItems.length} برنامجًا، {formatNumber(pdHours)} ساعة تدريب، وأثر موثق بالتطبيق في {appliedCount} منها.
              </p>
              <PdTimeline pdItems={pdItems} />
              <div style={{ marginTop: S.s8, display: 'flex', gap: S.s8 }}>
                <div style={{ flex: 1 }}><Metric value={formatNumber(pdItems.length)} label="برنامجًا تدريبيًا" /></div>
                <div style={{ flex: 1 }}><Metric value={formatNumber(pdHours)} label="إجمالي الساعات" accent /></div>
                <div style={{ flex: 1 }}><Metric value={String(appliedCount)} label="بأثر موثق على الممارسة" /></div>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  /* ═══ القالب 5 — تقرير المبادرات ═══ */
  if (config.mode === 'initiatives') {
    return (
      <div dir="rtl" style={rootStyle}>
        <div className="print-page" style={{ paddingTop: 0 }}>
          <OrgHeaderStrip user={user} year={year.label} compact />
          <ReportHeaderV2
            title="تقرير المبادرات"
            subtitle={`${user.name} — ${schoolLine(user.school) ?? ''} — ${year.label} — المبادرات القيادية وأثرها على المجتمع المدرسي`}
            metrics={[
              { value: String(initItems.length), label: 'مبادرة' },
              { value: formatNumber(totalBeneficiaries), label: 'مستفيدًا' },
            ]}
          />
          {initItems.length === 0 ? (
            <EmptyNote label="لا توجد مبادرات موثقة بعد" />
          ) : (
            <div>
              <p style={{ margin: `0 0 ${S.s6}`, ...RT.body, color: RC.muted, maxWidth: '150mm' }}>
                {initItems.length} مبادرات استفاد منها {formatNumber(totalBeneficiaries)} من الطلبة وأولياء الأمور والمجتمع المدرسي — لكل مبادرة: المشكلة والهدف والتنفيذ والأثر مع الشواهد.
              </p>
              {initItems.map((a, idx) => (
                <ReportDocumentSection
                  key={a.id}
                  first={idx === 0}
                  headerMode={idx === 0 ? 'title' : 'full'}
                  user={user}
                  year={year.label}
                  title={officialTitle(a.type)}
                  dateText={a.date ? formatDate(a.date) : undefined}
                >
                  <AchievementCase a={a} index={idx + 1} fields={['problem', 'goalText', 'execution', 'results', 'impact', 'notes']} />
                </ReportDocumentSection>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}

/* ═══ مكوّنات مساندة للقوالب المركزة ═════════════════════════ */

/** رأس التقرير المختصر — للقوالب 2-5 بالهوية الجديدة */
function ReportHeaderV2({ title, subtitle, metrics }: { title: string; subtitle: string; metrics: { value: string; label: string }[] }) {
  return (
    <div className="print-avoid-break" style={{ marginBottom: S.s6, pageBreakInside: 'avoid' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: S.s6 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, ...RT.caption, color: RC.goldDeep, letterSpacing: '0.14em' }}>{REPORT_BRAND.appName}</p>
          <h1 style={{ margin: `${S.s1} 0 0`, ...RT.h1, color: RC.primaryDeep }}>{title}</h1>
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
      <Rule margin={`${S.s4} 0 0`} color={RC.goldLine} weight="0.8px" />
    </div>
  )
}

/** جسم الملخص التنفيذي المختصر */
function SummaryBody({ data }: { data: ReportData }) {
  const { user, year, completion, achievements, reflection } = data
  const counts = completion.counts
  const scored = achievements.filter((a) => a.preScore != null && a.postScore != null)
  const highlights = [...achievements]
    .filter((a) => a.impact || a.results)
    .sort((a, b) => (b.beneficiariesCount ?? b.studentsCount ?? 0) - (a.beneficiariesCount ?? a.studentsCount ?? 0))
    .slice(0, 3)

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
        لمحة سريعة عن ملف {user.name} في {year.label} — للاطلاع الفوري على حجم العمل وأثره.
      </p>

      <div className="print-avoid-break" style={{ marginTop: S.s4, pageBreakInside: 'avoid' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: S.s4 }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.muted }}>اكتمال ملف الإنجاز</p>
          <p style={{ margin: 0, fontSize: '34px', fontWeight: 800, color: RC.primaryDeep, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{formatNumber(completion.overall)}%</p>
        </div>
        <div style={{ marginTop: S.s2 }}>
          <ProgressBar pct={completion.overall} height="2.8mm" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: `${S.s3} ${S.s3}`, marginTop: S.s6 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ minWidth: 0 }}>
            <Metric value={m.value} label={m.label} accent={m.label === 'متوسط التحسن' && counts.avgImprovement !== null} />
          </div>
        ))}
      </div>

      {highlights.length > 0 && (
        <div className="print-avoid-break" style={{ marginTop: S.s8, pageBreakInside: 'avoid' }}>
          <h2 style={{ margin: `0 0 ${S.s3}`, ...RT.h2, color: RC.ink, fontSize: '15px' }}>أبرز الإنجازات</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: S.s4 }}>
            {highlights.map((a) => {
              const diff = a.preScore != null && a.postScore != null ? Math.round(a.postScore - a.preScore) : null
              return (
                <div key={a.id} style={{ borderRight: `1.6px solid ${RC.gold}`, paddingRight: S.s3 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: S.s2 }}>
                    <p style={{ margin: 0, ...RT.bodyStrong, color: RC.ink, flex: 1, minWidth: 0 }}>{a.title}</p>
                    <Badge tone="green">{TYPE_LABEL(a.type)}</Badge>
                  </div>
                  <p style={{ margin: '1mm 0 0', ...RT.caption, color: RC.muted }}>
                    {a.beneficiariesCount ? ` • ${formatNumber(a.beneficiariesCount)} مستفيدًا` : a.studentsCount ? ` • ${formatNumber(a.studentsCount)} طالبًا` : ''}
                    {diff !== null ? ` • تحسن +${formatNumber(diff)} نقطة` : ''}
                  </p>
                  {a.impact && <p style={{ margin: '1.2mm 0 0', ...RT.body, color: RC.inkSoft }}>{a.impact}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {reflection?.success && (
        <div className="print-avoid-break" style={{ marginTop: S.s6, padding: `${S.s4} ${S.s4}`, background: RC.goldWash, borderRadius: RR.card, borderRight: `2px solid ${RC.gold}`, pageBreakInside: 'avoid' }}>
          <p style={{ margin: 0, ...RT.metricLabel, color: RC.goldDeep }}>من التأمل المهني — أبرز نجاح حققته</p>
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

/** جدول الخطة التطويرية — رأس أخضر ونص أبيض */
function PlanTable({ devPlans }: { devPlans: ReportData['devPlans'] }) {
  const head = ['#', 'الهدف التطويري', 'الإجراء', 'الفترة', 'مؤشر النجاح', 'النتيجة']
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: S.s4, ...RT.body, color: RC.inkSoft }}>
      <thead>
        <tr style={{ display: 'none' }} aria-hidden="true" />
        <tr>
          {head.map((h, hi) => (
            <th key={h} style={{ textAlign: 'right', padding: `${S.s2} ${S.s2}`, background: RC.primaryDeep, color: '#FFFFFF', ...RT.metricLabel, width: hi === 0 ? '6mm' : hi === 1 ? '34mm' : hi === 2 ? '40mm' : undefined }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {devPlans.map((p, pi) => (
          <tr key={p.id} style={{ pageBreakInside: 'avoid', background: pi % 2 === 1 ? RC.wash : RC.paper }}>
            <td style={{ padding: S.s2, borderBottom: `0.6px solid ${RC.line}`, ...RT.caption, color: RC.muted }}>{pi + 1}</td>
            <td style={{ padding: S.s2, borderBottom: `0.6px solid ${RC.line}`, ...RT.bodyStrong, color: RC.ink }}>{p.goal}</td>
            <td style={{ padding: S.s2, borderBottom: `0.6px solid ${RC.line}`, ...RT.body, color: RC.inkSoft }}>{p.action || '—'}</td>
            <td style={{ padding: S.s2, borderBottom: `0.6px solid ${RC.line}`, ...RT.body, color: RC.inkSoft, whiteSpace: 'nowrap' }}>{p.period || '—'}</td>
            <td style={{ padding: S.s2, borderBottom: `0.6px solid ${RC.line}`, ...RT.body, color: RC.inkSoft }}>{p.indicator || '—'}</td>
            <td style={{ padding: S.s2, borderBottom: `0.6px solid ${RC.line}`, ...RT.body, color: RC.inkSoft }}>{p.result || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** خط زمني التطوير المهني */
function PdTimeline({ pdItems }: { pdItems: ReportData['achievements'] }) {
  return (
    <div>
      {pdItems.map((a) => (
        <div key={a.id} className="print-avoid-break" style={{ display: 'flex', gap: S.s4, marginBottom: S.s8, pageBreakInside: 'avoid' }}>
          <div style={{ width: '26mm', flexShrink: 0, textAlign: 'left', paddingTop: '0.5mm' }}>
            <p style={{ margin: 0, ...RT.caption, color: RC.primaryDeep, fontWeight: 700 }}>{a.date ? formatDate(a.date) : 'بدون تاريخ'}</p>
            {a.hours ? <p style={{ margin: '1mm 0 0', ...RT.caption, color: RC.muted, fontVariantNumeric: 'tabular-nums' }}>{formatNumber(a.hours)} ساعة</p> : null}
          </div>
          <div style={{ flex: 1, minWidth: 0, borderRight: `0.8px solid ${RC.goldLine}`, paddingRight: S.s4 }}>
            <p style={{ margin: 0, ...RT.h3, color: RC.ink }}>{a.title}</p>
            <p style={{ margin: '1mm 0 0', ...RT.caption, color: RC.muted }}>
              {a.provider ?? 'جهة غير محددة'}{a.durationText ? ` • ${a.durationText}` : ''}
            </p>
            {(a.impact || a.results) && (
              <div style={{ marginTop: S.s2, padding: `${S.s3} ${S.s4}`, background: RC.goldWash, borderRadius: RR.card, border: `0.6px solid ${RC.goldLine}` }}>
                <p style={{ margin: 0, ...RT.metricLabel, color: RC.goldDeep }}>الأثر على الممارسة</p>
                <p style={{ margin: '1mm 0 0', ...RT.body, color: RC.inkSoft }}>{a.impact || a.results}</p>
              </div>
            )}
            {a.attachments && a.attachments.length > 0 && (
              <p style={{ margin: '1.5mm 0 0', ...RT.caption, color: RC.muted }}>
                الدليل: {a.attachments.map((x) => x.title).join(' • ')}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/** صف أثر مدمج */
function ImpactRow({ a, index }: { a: ReportData['achievements'][number]; index: number }) {
  const diff = a.preScore != null && a.postScore != null ? Math.round(a.postScore - a.preScore) : 0
  return (
    <div className="print-avoid-break" style={{ display: 'flex', alignItems: 'flex-start', gap: S.s3, padding: `${S.s3} 0`, borderBottom: `0.6px solid ${RC.line}`, pageBreakInside: 'avoid' }}>
      <span style={{ ...RT.caption, color: RC.gold, fontSize: '10px', fontWeight: 700, minWidth: '7mm', paddingTop: '0.4mm' }}>{String(index).padStart(2, '0')}</span>
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
        <div style={{ marginTop: '1.2mm' }}>
          <ProgressBar pct={a.preScore ?? 0} height="1.8mm" color={RC.lineStrong} />
        </div>
        <div style={{ marginTop: '1mm' }}>
          <ProgressBar pct={a.postScore ?? 0} height="1.8mm" />
        </div>
      </div>
    </div>
  )
}

/** سجل الشواهد — معرض موحد لشواهد العام كافة */
function EvidenceLedger({ images, files }: { images: (ReportData['attachments'][number] & { url: string })[]; files: ReportData['attachments'][number][] }) {
  if (!images.length && !files.length) return null
  return (
    <div data-anchor="evidence" className="print-page" style={{ paddingTop: 0 }}>
      <SectionDivider
        num={0}
        anchor="evidence"
        title="سجل الشواهد"
        desc="أرشيف موحد لكل الشواهد والمرفقات الموثقة خلال العام الدراسي — الصور والملفات والروابط."
        stats={[
          { label: 'صورًا موثقة', value: formatNumber(images.length) },
          { label: 'ملفات وروابط', value: formatNumber(files.length) },
        ]}
      />
      {images.length > 0 && (
        <GalleryDense images={images} />
      )}
      {files.length > 0 && (
        <div style={{ marginTop: S.s4 }}>
          <p style={{ margin: `0 0 ${S.s2}`, ...RT.metricLabel, color: RC.goldDeep }}>الملفات والروابط</p>
          <FileListDense files={files} />
        </div>
      )}
    </div>
  )
}

function GalleryDense({ images }: { images: (ReportData['attachments'][number] & { url: string })[] }) {
  // شبكة كثيفة ثابتة لسجل الشواهد — معرض النظام نفسه بكثافة مدمجة
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: S.s3 }}>
      {images.map((img) => (
        <GalleryCell key={img.id} img={img} />
      ))}
    </div>
  )
}

function GalleryCell({ img }: { img: ReportData['attachments'][number] & { url: string } }) {
  const { toImgUrl } = useReportImages()
  return (
    <figure className="print-avoid-break" style={{ margin: 0, minWidth: 0, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
      <img
        src={toImgUrl(img.url)}
        alt={img.title}
        style={{ width: '100%', maxHeight: '52mm', objectFit: 'contain', borderRadius: RR.img, border: `0.7px solid ${RC.line}`, background: RC.paper, display: 'block' }}
      />
      <figcaption style={{ marginTop: '1mm', textAlign: 'center', ...RT.caption, color: RC.muted, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {img.title}
      </figcaption>
    </figure>
  )
}

function FileListDense({ files }: { files: ReportData['attachments'][number][] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: S.s2 }}>
      {files.map((f) => (
        <div key={f.id} className="print-avoid-break" style={{ display: 'flex', alignItems: 'center', gap: '2mm', border: `0.7px solid ${RC.goldLine}`, borderRadius: RR.card, padding: '1.6mm 3.5mm', background: RC.paper, pageBreakInside: 'avoid' }}>
          <span style={{ width: '1.6mm', height: '1.6mm', borderRadius: RR.chip, background: RC.gold, flexShrink: 0 }} aria-hidden="true" />
          <span style={{ ...RT.bodyStrong, fontSize: '9.5px', color: RC.ink, flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{f.title}</span>
          {f.kind === 'LINK' && f.url ? (
            <a href={f.url} target="_blank" rel="noopener noreferrer" dir="ltr" style={{ ...RT.caption, color: RC.primaryDeep, textDecoration: 'none', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '40mm' }}>
              {f.url.replace(/^https?:\/\//, '')}
            </a>
          ) : (
            <span style={{ ...RT.caption, color: RC.muted }}>{f.fileName ?? ''}</span>
          )}
        </div>
      ))}
    </div>
  )
}

/** غلاف كل تقرير مستقل داخل قائمة — صفحة جديدة كاملة */
function ReportDocumentSection({ first = false, headerMode = 'full', user, year, title, dateText, children }: {
  first?: boolean
  headerMode?: 'full' | 'title' | 'none'
  user: ReportData['user']
  year: string
  title?: string
  dateText?: string
  children: ReactNode
}) {
  return (
    <section className={first ? undefined : 'print-report-start'} style={first ? undefined : { pageBreakBefore: 'always', breakBefore: 'page' }}>
      {headerMode !== 'none' && (
        <IndependentDocHeader user={user} year={year} title={title} dateText={dateText} mode={headerMode === 'title' ? 'title' : 'full'} />
      )}
      {children}
    </section>
  )
}

/** ترويسة تقرير مستقل داخل قائمة (مختصرة عن النسخة الكاملة) */
function IndependentDocHeader({ user, year, title, dateText, mode }: {
  user: ReportData['user']
  year: string
  title?: string
  dateText?: string
  mode: 'full' | 'title'
}) {
  const labels = getGenderedLabels(user.gender)
  return (
    <div className="print-avoid-break" style={{ pageBreakInside: 'avoid', pageBreakAfter: 'avoid' }}>
      {mode !== 'title' && <OrgHeaderStrip user={user} year={year} compact />}
      {title && (
        <div style={{ textAlign: 'center', marginTop: mode === 'title' ? 0 : S.s4 }}>
          <p style={{ margin: 0, ...RT.caption, color: RC.goldDeep, letterSpacing: '0.16em' }}>تقرير تنفيذ رسمي</p>
          <h2 style={{ margin: `${S.s2} 0 0`, ...RT.h2, color: RC.primaryDeep, fontSize: '19px' }}>{title}</h2>
          <p style={{ margin: `${S.s2} 0 0`, ...RT.caption, color: RC.muted }}>
            {user.subject ? `${labels.teacher} ${user.subject}` : labels.teacher}:{' '}
            <span style={{ color: RC.inkSoft, fontWeight: 700 }}>{user.name}</span>
            <span> • </span>العام الدراسي {year}
            {dateText ? (<><span> • </span>{dateText}</>) : null}
          </p>
        </div>
      )}
      <Rule margin={`${S.s4} 0 0`} weight="0.6px" color={RC.goldLine} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ReportDocument — مستند الصفحات الموحد (المعاينة والطباعة معًا)
   ═══════════════════════════════════════════════════════════════ */

export interface ReportDocumentProps {
  config: PrintConfig
  data: ReportData
  variant: ReportVariant
  /** تغليف كل صفحة (المعاينة: تكبير/قياسات) — الافتراضي: كما هي */
  pageWrapper?: (index: number, total: number, page: ReactNode) => ReactNode
  /** أي الصفحات تُركّب فعليًا (المعاينة: المرئية ± 1) — الافتراضي: كلها */
  mountedPredicate?: (index: number) => boolean
  /** إشعار الجاهزية للطباعة */
  onReady?: (info: { pages: number; density: DensityLevel }) => void
}

export function ReportDocument({
  config,
  data,
  variant,
  pageWrapper,
  mountedPredicate,
  onReady,
}: ReportDocumentProps) {
  const onePageFirst = config.mode === 'official'
  const initialDensity: DensityLevel = config.mode === 'full' || config.mode === 'custom' ? 'compact' : 'normal'

  const { measureRef, density, pages, anchors, status } = useReportPagination({
    deps: [config, data],
    enabled: true,
    onePageFirst,
    initialDensity,
  })

  useEffect(() => {
    if (status === 'ready' && pages && onReady) onReady({ pages: pages.length, density })
  }, [status, pages, density, onReady])  

  const hasCover = config.mode === 'full' || config.mode === 'custom'
  const chrome = { name: data.user.name, year: data.year.label, school: schoolLine(data.user.school) }

  const contentTree = (variant === 'preview') ? (
    <ReportImageProvider variant="preview">
      <ReportBody config={config} data={data} />
    </ReportImageProvider>
  ) : (
    <ReportImageProvider variant="print">
      <ReportBody config={config} data={data} />
    </ReportImageProvider>
  )

  return (
    <>
      {/* طبقة القياس المخفية — بعرض منطقة المحتوى نفسها */}
      <div ref={measureRef} aria-hidden="true" className="rp-measure" style={{ width: `${CONTENT_W_MM}mm` }}>
        <DensityProvider level={density}>
          <PageMapProvider map={anchors}>
            {contentTree}
          </PageMapProvider>
        </DensityProvider>
      </div>

      {/* الصفحات الصريحة — كل صفحة A4 بنافذة شريحة من التدفق المقيس */}
      {pages && (
        <div className="rp-pages" style={{ display: 'flex', flexDirection: 'column', gap: '10mm', alignItems: 'center' }}>
          {pages.map((p: PageSlice, i: number) => {
            const mounted = mountedPredicate ? mountedPredicate(i) : true
            const page = (
              <PageShell
                slice={p}
                index={i}
                total={pages.length}
                variant={variant}
                mounted={mounted}
                chrome={chrome}
                cover={hasCover && i === 0}
              >
                <ContentSlice slice={p}>
                  <DensityProvider level={density}>
                    <PageMapProvider map={anchors}>
                      {contentTree}
                    </PageMapProvider>
                  </DensityProvider>
                </ContentSlice>
              </PageShell>
            )
            return (
              <div key={i} data-rp-wrapper={i} style={{ position: 'relative' }}>
                {pageWrapper ? pageWrapper(i, pages.length, page) : page}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

/* ═══ اسم ملف PDF ذكي ═════════════════════════════════════════ */

function slugify(s: string): string {
  return s.trim().replace(/[\s/\\:]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function reportFileName(config: PrintConfig, data: ReportData): string {
  const y = slugify(data.year.label ?? '')
  let base = 'report'
  if (config.mode === 'official') {
    const a = data.achievements.find((x) => x.id === config.achievementId)
    base = a ? slugify(officialTitle(a.type)) : 'تقرير-إنجاز'
  } else {
    base = {
      full: 'ملف-إنجاز',
      summary: 'ملخص-ملف-الإنجاز',
      impact: 'تقرير-الأثر-المهني',
      pd: 'تقرير-التطوير-المهني',
      initiatives: 'تقرير-المبادرات',
      custom: slugify(config.title) || 'تقرير-مخصص',
      official: 'تقرير',
    }[config.mode] ?? 'report'
  }
  return y ? `${base}-${y}` : base
}

/* ═══ غلاف الطباعة — ينتظر جاهزية المحرك ثم يفتح نافذة الطباعة ═══ */

export function ReportPrint() {
  const config = useApp((s) => s.printConfig)
  const setPrintConfig = useApp((s) => s.setPrintConfig)
  const { data, isLoading, error } = useReport()
  const [ready, setReady] = useState(false)

  // عزل مستند الطباعة
  useEffect(() => {
    if (!config || !data || error) return
    document.body.classList.add('pf-printing')
    return () => {
      document.body.classList.remove('pf-printing')
    }
  }, [config, data, error])

  // فتح الطباعة بعد اكتمال القياس والصور
  useEffect(() => {
    if (!config || !data || error || isLoading || !ready) return
    let cancelled = false
    let prevTitle: string | null = null

    const t = setTimeout(async () => {
      const root = document.getElementById('print-root')
      const imgs = Array.from(root?.querySelectorAll('img') ?? [])
      await Promise.all(
        imgs.map((img) =>
          img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res() }),
        ),
      )
      if (cancelled) return
      prevTitle = document.title
      document.title = reportFileName(config, data)
      window.print()
    }, 500)

    const after = () => {
      if (prevTitle !== null) { document.title = prevTitle; prevTitle = null }
      setTimeout(() => { if (!cancelled) setPrintConfig(null) }, 600)
    }
    window.addEventListener('afterprint', after)
    return () => {
      cancelled = true
      if (prevTitle !== null) document.title = prevTitle
      clearTimeout(t)
      window.removeEventListener('afterprint', after)
    }
  }, [config, data, error, isLoading, ready, setPrintConfig])

  if (!config) return null
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-gray-600">جارٍ تجهيز التقرير…</p>
        </div>
      </div>
    )
  }
  if (error || !data) return null

  return (
    <ReportDocument
      config={config}
      data={data}
      variant="print"
      onReady={() => setReady(true)}
    />
  )
}
