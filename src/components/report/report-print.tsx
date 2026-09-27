'use client'

import { useEffect } from 'react'
import { useApp } from '@/store/app-store'
import { useReport } from '@/hooks/use-data'
import { SECTIONS, SECTION_MAP } from '@/lib/constants'
import { formatDate, formatNumber } from '@/lib/format'
import { LoadingState, ErrorState } from '@/components/shared/states'
import { RC, S, RT, RR } from '@/lib/report-tokens'
import {
  Cover, ProfileCard, ExecSummary, Toc, SectionDivider,
  AchievementCase, ReportHeader, PrintFooter, EmptyNote, PageBreak,
  Metric, ImpactRow, OfficialDocHeader, ReportDocumentSection,
} from './report-parts'
import { OfficialReport, officialTitle } from './official-report'
import { ReportImageProvider } from './report-image-context'
import { getGenderedLabels } from '@/lib/gender'
import type { PrintConfig } from '@/store/app-store'
import type { ReportData } from '@/hooks/use-data'

/* ═══════════════════════════════════════════════════════════════
   محرك التقارير المطبوعة — القوالب الخمسة + المخصص + الرسمي
   ReportBody: نفس مكونات التقرير للطباعة والمعاينة معًا (WYSIWYG)
   يُعرض فقط أثناء الطباعة (#print-root) ويحتفظ بمنطق التفعيل كما هو
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

  /** هل للقسم محتوى فعلي؟ — الأقسام الفارغة تُستبعد كليًا من التقرير الكامل */
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

  /** الأقسام المضمّنة فعلًا — التقرير المخصص يتكيف تلقائيًا ولا يترك صفحات فارغة */
  const includedSections =
    config.mode === 'full' || config.mode === 'custom'
      ? requestedSections.filter((s) => hasContent(s.key))
      : requestedSections

  const footer = <PrintFooter name={user.name} year={year.label} />
  const rootStyle: React.CSSProperties = { fontFamily: 'var(--font-readex), Tahoma, sans-serif', color: RC.ink }
  /** ترويسة الجهة الرسمية أعلى أول صفحة — بلا كتلة عنوان (العنوان يأتي من قالب التقرير نفسه) */
  const orgHeader = <OfficialDocHeader user={user} year={year.label} mode="org" />

  /* ═══ القالب 6 — التقرير الرسمي للإنجاز (إنجاز واحد) ═══ */
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
        {footer}
        <OfficialReport a={a} data={data} />
      </div>
    )
  }

  /* ═══ القالب 1 — ملف الإنجاز الكامل + المخصص ═══ */
  if (config.mode === 'full' || config.mode === 'custom') {
    const tocItems = includedSections.map((s, i) => ({
      num: i + 1,
      title: s.title,
      meta: s.key === 'goals' ? `${goals.length} هدفًا`
        : s.key === 'development' ? pdHours > 0 ? `${formatNumber(pdHours)} ساعة` : undefined
        : s.key === 'outcomes' ? `${scored.length} قياسات`
        : s.key === 'initiatives' ? initItems.length ? `${formatNumber(totalBeneficiaries)} مستفيدًا` : undefined
        : undefined,
    }))

    return (
      <div dir="rtl" style={rootStyle}>
        {footer}
        <Cover name={user.name} school={user.school} subject={user.subject} year={year.label} completion={completion.overall} date={dateStr} gender={user.gender} educationAdmin={user.educationAdmin} educationOffice={user.educationOffice} />
        <Toc items={tocItems} />

        {includedSections.map((s, i) => {
          const num = i + 1
          const stats: { label: string; value: string }[] = []
          let content: React.ReactNode = null

          if (s.key === 'profile') {
            stats.push({ label: 'المجال', value: 'بيانات رسمية' })
            content = (
              <>
                <div style={{ paddingTop: S.s4 }}>
                  <ProfileCard user={user} />
                </div>
                <PageBreak />
                {/* الملخص التنفيذي — صفحة مستقلة بعد البطاقة المهنية */}
                <div className="print-page" style={{ paddingTop: S.s6 }}>
                  <p style={{ margin: 0, ...RT.caption, color: RC.primaryDeep, letterSpacing: '0.14em' }}>الملخص التنفيذي</p>
                  <h2 style={{ margin: `${S.s2} 0 ${S.s3}`, ...RT.h1, color: RC.ink }}>خلاصة عام {year.label}</h2>
                  <div style={{ width: '25mm', height: '1mm', background: RC.primary, marginBottom: S.s6 }} />
                  <ExecSummary data={data} />
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
                        <span style={{ ...RT.caption, color: RC.lineStrong, fontSize: '10px', fontWeight: 700 }}>{String(idx + 1).padStart(2, '0')}</span>
                        <h3 style={{ margin: 0, ...RT.h3, color: RC.ink, flex: 1 }}>{g.title}</h3>
                        <span style={{ ...RT.caption, color: RC.primaryDeep, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                      </div>
                      <div style={{ width: '100%', height: '2.2mm', background: '#E2ECE8', borderRadius: RR.bar, margin: `${S.s2} 0` }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: RC.primary, borderRadius: RR.bar }} />
                      </div>
                      <p style={{ margin: 0, ...RT.caption, color: RC.muted, fontVariantNumeric: 'tabular-nums' }}>
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
                  <div key={label} className="print-avoid-break" style={{ border: `0.7px solid ${RC.line}`, borderRadius: RR.card, padding: S.s4, pageBreakInside: 'avoid' }}>
                    <p style={{ margin: 0, ...RT.metricLabel, color: RC.primaryDeep }}>{label}</p>
                    <p style={{ margin: `${S.s2} 0 0`, ...RT.body, color: RC.inkSoft }}>{val || '—'}</p>
                  </div>
                ))}
              </div>
            ) : <EmptyNote label="لم تُجب أسئلة التأمل المهني بعد" />
          } else if (s.key === 'devplan') {
            stats.push({ label: 'بنود الخطة', value: String(devPlans.length) })
            content = devPlans.length ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: S.s4, ...RT.body, color: RC.inkSoft }}>
                <thead>
                  <tr style={{ display: 'none' }} aria-hidden="true" />
                  <tr>
                    {['#', 'الهدف التطويري', 'الإجراء', 'الفترة', 'مؤشر النجاح', 'النتيجة'].map((h, hi) => (
                      <th key={h} style={{ textAlign: 'right', padding: `${S.s2} ${S.s2}`, borderBottom: `1px solid ${RC.lineStrong}`, ...RT.metricLabel, color: RC.primaryDeep, width: hi === 0 ? '6mm' : hi === 1 ? '34mm' : hi === 2 ? '40mm' : undefined }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {devPlans.map((p, pi) => (
                    <tr key={p.id} style={{ pageBreakInside: 'avoid' }}>
                      <td style={{ padding: `${S.s2} ${S.s2}`, borderBottom: `0.6px solid ${RC.line}`, ...RT.caption, color: RC.muted }}>{pi + 1}</td>
                      <td style={{ padding: S.s2, borderBottom: `0.6px solid ${RC.line}`, ...RT.bodyStrong, color: RC.ink }}>{p.goal}</td>
                      <td style={{ padding: S.s2, borderBottom: `0.6px solid ${RC.line}`, ...RT.body, color: RC.inkSoft }}>{p.action || '—'}</td>
                      <td style={{ padding: S.s2, borderBottom: `0.6px solid ${RC.line}`, ...RT.body, color: RC.inkSoft, whiteSpace: 'nowrap' }}>{p.period || '—'}</td>
                      <td style={{ padding: S.s2, borderBottom: `0.6px solid ${RC.line}`, ...RT.body, color: RC.inkSoft }}>{p.indicator || '—'}</td>
                      <td style={{ padding: S.s2, borderBottom: `0.6px solid ${RC.line}`, ...RT.body, color: RC.inkSoft }}>{p.result || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyNote label="لا توجد خطة تطويرية موثقة" />
          } else if (s.key === 'outcomes') {
            stats.push(
              { label: 'قياسات موثقة', value: String(scored.length) },
              { label: 'متوسط التحسن', value: completion.counts.avgImprovement !== null ? `+${completion.counts.avgImprovement}%` : '—' },
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
                {/* كل إنجاز = تقرير مستقل: يبدأ أعلى صفحة A4 جديدة بترويسته الرسمية —
                    عدا الأول الذي يتبع فاصل القسم مباشرة — ومحتواه الطويل يتدفق طبيعيًا */}
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
              <SectionDivider num={num} title={s.title} desc={s.desc} stats={stats} />
              <div style={{ paddingBottom: S.s6 }}>{content}</div>
            </section>
          )
        })}
      </div>
    )
  }

  /* ═══ القالب 2 — الملخص التنفيذي (1-3 صفحات) ═══ */
  if (config.mode === 'summary') {
    return (
      <div dir="rtl" style={rootStyle}>
        {footer}
        <div className="print-page" style={{ paddingTop: S.s4 }}>
          {orgHeader}
          <ReportHeader
            title="ملخص ملف الإنجاز"
            subtitle={`${user.name} — ${user.subject ? `${getGenderedLabels(user.gender).teacher} ${user.subject} — ` : ''}${user.school ?? ''} — ${year.label}`}
            metrics={[
              { value: `${formatNumber(completion.overall)}%`, label: 'اكتمال الملف' },
              { value: formatNumber(completion.counts.achievements), label: 'إنجازًا' },
            ]}
          />
          <ExecSummary data={data} compact />
        </div>
      </div>
    )
  }

  /* ═══ القالب 3 — تقرير الأثر المهني ═══ */
  if (config.mode === 'impact') {
    return (
      <div dir="rtl" style={rootStyle}>
        {footer}
        <div className="print-page" style={{ paddingTop: S.s4 }}>
          {orgHeader}
          <ReportHeader
            title="تقرير الأثر المهني"
            subtitle={`${user.name} — ${user.subject ? `${getGenderedLabels(user.gender).teacher} ${user.subject} — ` : ''}${year.label} — أثر الممارسات مقيسًا بالقياس القبلي والبعدي`}
            metrics={[
              { value: String(scored.length), label: 'قياسات موثقة' },
              { value: completion.counts.avgImprovement !== null ? `+${completion.counts.avgImprovement}%` : '—', label: 'متوسط التحسن' },
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
        {footer}
        <div className="print-page" style={{ paddingTop: S.s4 }}>
          {orgHeader}
          <ReportHeader
            title="تقرير التطوير المهني"
            subtitle={`${user.name} — ${user.school ?? ''} — ${year.label} — البرامج التدريبية وساعاتها وأثرها على الممارسة`}
            metrics={[
              { value: formatNumber(pdHours), label: 'إجمالي الساعات' },
              { value: String(pdItems.length), label: 'برنامجًا' },
            ]}
          />
          {pdItems.length === 0 ? (
            <EmptyNote label="لا توجد أنشطة تطوير مهني موثقة بعد" />
          ) : (
            <>
              {/* خط زمني تحريري للبرامج — ليس جدول شهادات */}
              <p style={{ margin: `0 0 ${S.s6}`, ...RT.body, color: RC.muted, maxWidth: '150mm' }}>
                رحلة التطوير المهني خلال العام مرتبة زمنيًا — {pdItems.length} برنامجًا، {formatNumber(pdHours)} ساعة تدريب، وأثر موثق بالتطبيق في {appliedCount} منها.
              </p>

              <div>
                {pdItems.map((a, idx) => (
                  <div key={a.id} className="print-avoid-break" style={{ display: 'flex', gap: S.s4, marginBottom: S.s8, pageBreakInside: 'avoid' }}>
                    {/* عمود التاريخ */}
                    <div style={{ width: '26mm', flexShrink: 0, textAlign: 'left', paddingTop: '0.5mm' }}>
                      <p style={{ margin: 0, ...RT.caption, color: RC.primaryDeep, fontWeight: 700 }}>{a.date ? formatDate(a.date) : 'بدون تاريخ'}</p>
                      {a.hours ? <p style={{ margin: '1mm 0 0', ...RT.caption, color: RC.muted, fontVariantNumeric: 'tabular-nums' }}>{formatNumber(a.hours)} ساعة</p> : null}
                    </div>
                    {/* المحتوى */}
                    <div style={{ flex: 1, minWidth: 0, borderRight: `0.8px solid ${RC.lineStrong}`, paddingRight: S.s4 }}>
                      <p style={{ margin: 0, ...RT.h3, color: RC.ink }}>{a.title}</p>
                      <p style={{ margin: '1mm 0 0', ...RT.caption, color: RC.muted }}>
                        {a.provider ?? 'جهة غير محددة'}{a.durationText ? ` • ${a.durationText}` : ''}
                      </p>
                      {(a.impact || a.results) && (
                        <div style={{ marginTop: S.s2, padding: `${S.s3} ${S.s4}`, background: RC.wash, borderRadius: RR.card }}>
                          <p style={{ margin: 0, ...RT.metricLabel, color: RC.primaryDeep }}>الأثر على الممارسة</p>
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

              {/* خلاصة */}
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
        {footer}
        <div className="print-page" style={{ paddingTop: S.s4 }}>
          {orgHeader}
          <ReportHeader
            title="تقرير المبادرات"
            subtitle={`${user.name} — ${user.school ?? ''} — ${year.label} — المبادرات القيادية وأثرها على المجتمع المدرسي`}
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

/* ═══ اسم ملف PDF ذكي — تقرير-خطة-علاجية-1448هـ بدل report.pdf ═══ */

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

/* ═══ غلاف الطباعة — يفعّل نافذة الطباعة بعد اكتمال الصور ═══ */

export function ReportPrint() {
  const config = useApp((s) => s.printConfig)
  const setPrintConfig = useApp((s) => s.setPrintConfig)
  const { data, isLoading, error, refetch } = useReport()

  useEffect(() => {
    if (!config || !data || error) return
    let cancelled = false
    let prevTitle: string | null = null

    // عزل مستند الطباعة: طوال هذا الأثر تحمل body صنف pf-printing،
    // وضمن @media print يختفي كل أبناء body عدا #print-root — فلا تطبع
    // واجهة التحرير ولا النوافذ المنبثقة، فقط مستند التقرير نفسه
    // (المصدر الموحد: نفس ReportBody المستخدمة في المعاينة وPDF).
    document.body.classList.add('pf-printing')

    const t = setTimeout(async () => {
      const root = document.getElementById('print-root')
      const imgs = Array.from(root?.querySelectorAll('img') ?? [])
      await Promise.all(
        imgs.map((img) =>
          img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res() }),
        ),
      )
      if (cancelled) return
      // اسم ملف ذكي لحفظ PDF (المتصفح يضيف الامتداد تلقائيًا) — يُستعاد العنوان الأصلي بعد الطباعة
      prevTitle = document.title
      document.title = reportFileName(config, data)
      window.print()
    }, 900)

    const after = () => {
      if (prevTitle !== null) { document.title = prevTitle; prevTitle = null }
      setTimeout(() => { if (!cancelled) setPrintConfig(null) }, 600)
    }
    window.addEventListener('afterprint', after)
    return () => {
      cancelled = true
      document.body.classList.remove('pf-printing')
      if (prevTitle !== null) document.title = prevTitle
      clearTimeout(t)
      window.removeEventListener('afterprint', after)
    }
  }, [config, data, error, setPrintConfig])

  if (!config) return null
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm text-gray-600">جارٍ تجهيز التقرير…</p>
        </div>
      </div>
    )
  }
  if (error || !data) return null

  return (
    <ReportImageProvider variant="print">
      <ReportBody config={config} data={data} />
    </ReportImageProvider>
  )
}
