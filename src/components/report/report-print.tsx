'use client'

import { useEffect } from 'react'
import { useApp } from '@/store/app-store'
import { useReport } from '@/hooks/use-data'
import { SECTIONS, SECTION_MAP, TYPE_LABEL, STATUS_LABEL } from '@/lib/constants'
import { formatDate, formatNumber, improvement } from '@/lib/format'
import { LoadingState, ErrorState } from '@/components/shared/states'
import type { TAchievement, TAttachment } from '@/lib/types'

/* ألوان الطباعة الثابتة */
const C = {
  primary: '#0e7f6e',
  primaryDark: '#0a5d51',
  primaryLight: '#e3f2ef',
  ink: '#1f2d2a',
  muted: '#5f6f6a',
  border: '#d7e0dd',
  bg: '#f6faf9',
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <tr>
      <td style={{ width: '34mm', padding: '2.2mm 0 2.2mm 4mm', color: C.muted, fontSize: '10px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
        {label}
      </td>
      <td style={{ padding: '2.2mm 0', fontSize: '11px', color: C.ink, lineHeight: 1.7 }}>{value}</td>
    </tr>
  )
}

/** بطاقة إنجاز داخل التقرير */
function AchievementBlock({ a }: { a: TAchievement }) {
  const attachments = a.attachments ?? []
  const images = attachments.filter((x): x is TAttachment & { url: string } => x.kind === 'IMAGE' && Boolean(x.url))
  const files = attachments.filter((x) => x.kind !== 'IMAGE')
  const diff = improvement(a.preScore, a.postScore)

  return (
    <div className="print-avoid-break" style={{ border: `0.7px solid ${C.border}`, borderRadius: '5mm', padding: '6mm 6.5mm', marginBottom: '5mm', pageBreakInside: 'avoid' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6mm', borderBottom: `0.7px solid ${C.border}`, paddingBottom: '3mm', marginBottom: '3mm' }}>
        <div>
          <span style={{ display: 'inline-block', background: C.primaryLight, color: C.primaryDark, borderRadius: '99px', padding: '1mm 3.5mm', fontSize: '8.5px', fontWeight: 700 }}>
            {TYPE_LABEL(a.type)}
          </span>
          <h3 style={{ margin: '2mm 0 1mm', fontSize: '14px', fontWeight: 700, color: C.ink, lineHeight: 1.5 }}>{a.title}</h3>
          <p style={{ fontSize: '9.5px', color: C.muted }}>
            {a.date ? formatDate(a.date) : ''} {a.date && ' • '} {STATUS_LABEL(a.status)}
            {a.provider ? ` • ${a.provider}` : ''}
            {a.hours ? ` • ${formatNumber(a.hours)} ساعة` : ''}
          </p>
        </div>
        {diff !== null && (
          <div style={{ textAlign: 'center', background: '#ecf7f2', border: '0.7px solid #bfe3d5', borderRadius: '3mm', padding: '2mm 4mm', minWidth: '24mm' }}>
            <p style={{ fontSize: '13px', fontWeight: 800, color: '#0b6b4f', margin: 0 }}>+{formatNumber(diff)}</p>
            <p style={{ fontSize: '7.5px', color: '#3d8a6f', margin: 0 }}>نقطة مئوية</p>
          </div>
        )}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <FieldRow label="الوصف" value={a.description} />
          <FieldRow label="المشكلة / الحاجة" value={a.problem} />
          <FieldRow label="الهدف" value={a.goalText} />
          <FieldRow label="التنفيذ" value={a.execution} />
          <FieldRow label="الفئة المستفيدة" value={a.beneficiaries ?? (a.studentsCount ? `${formatNumber(a.studentsCount)} طالبًا` : undefined) ?? (a.beneficiariesCount ? `${formatNumber(a.beneficiariesCount)} مستفيدًا` : undefined)} />
          <FieldRow label="المدة" value={a.durationText} />
          <FieldRow label="النتائج" value={a.results} />
          <FieldRow label="الأثر" value={a.impact} />
          <FieldRow label="مرتبط بهدف" value={a.goal?.title} />
          <FieldRow label="ملاحظات" value={a.notes} />
        </tbody>
      </table>

      {/* القياس القبلي والبعدي */}
      {a.preScore != null && a.postScore != null && (
        <div style={{ marginTop: '3mm', padding: '3mm 4mm', background: C.bg, borderRadius: '3mm' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: C.muted, marginBottom: '1mm' }}>
            <span>القياس القبلي: <b style={{ color: C.ink }}>{formatNumber(a.preScore)}%</b></span>
            <span>القياس البعدي: <b style={{ color: C.primaryDark }}>{formatNumber(a.postScore)}%</b></span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5mm' }}>
            <div style={{ height: '2.6mm', background: '#e8ede9', borderRadius: '99px' }}>
              <div style={{ width: `${Math.min(100, a.preScore)}%`, height: '100%', background: '#b7c9c2', borderRadius: '99px' }} />
            </div>
            <div style={{ height: '2.6mm', background: '#e0efea', borderRadius: '99px' }}>
              <div style={{ width: `${Math.min(100, a.postScore)}%`, height: '100%', background: C.primary, borderRadius: '99px' }} />
            </div>
          </div>
        </div>
      )}

      {/* معرض الصور */}
      {images.length > 0 && (
        <div style={{ display: 'flex', gap: '3mm', marginTop: '4mm', flexWrap: 'wrap' }}>
          {images.map((img) => (
            <div key={img.id} style={{ width: images.length === 1 ? '60mm' : images.length === 2 ? '55mm' : '36mm' }}>
              <img src={img.url} alt={img.title} style={{ width: '100%', height: images.length === 1 ? '40mm' : '26mm', objectFit: 'cover', borderRadius: '2.5mm', border: `0.7px solid ${C.border}` }} />
              <p style={{ fontSize: '7.5px', color: C.muted, marginTop: '1mm', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{img.title}</p>
            </div>
          ))}
        </div>
      )}

      {/* الملفات والروابط */}
      {files.length > 0 && (
        <div style={{ marginTop: '3mm', display: 'flex', flexWrap: 'wrap', gap: '2mm' }}>
          {files.map((f) => (
            <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '1.5mm', border: `0.7px solid ${C.border}`, borderRadius: '99px', padding: '1mm 3.5mm', fontSize: '8.5px', color: C.muted }}>
              {f.kind === 'LINK' ? '🔗' : '📄'} {f.title}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** صفحة الغلاف */
function Cover({ name, school, subject, year, completion, date }: { name: string; school?: string | null; subject?: string | null; year: string; completion: number; date: string }) {
  return (
    <div className="print-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '230mm' }}>
      <div style={{ width: '100%', borderBottom: `1px solid ${C.border}`, paddingBottom: '6mm', marginBottom: '18mm' }}>
        <p style={{ fontSize: '11px', color: C.muted, margin: 0 }}>المملكة العربية السعودية</p>
        <p style={{ fontSize: '13px', color: C.ink, fontWeight: 700, margin: '1mm 0 0' }}>وزارة التعليم {school ? `— ${school}` : ''}</p>
      </div>

      <div style={{ width: '30mm', height: '30mm', borderRadius: '8mm', background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10mm' }}>
        <span style={{ fontSize: '38px', color: '#ffffff', fontWeight: 200 }}>م</span>
      </div>

      <h1 style={{ fontSize: '34px', fontWeight: 300, color: C.ink, margin: 0, letterSpacing: '0.5px' }}>ملف إنجاز المعلم</h1>
      <div style={{ width: '40mm', height: '0.8mm', background: C.primary, margin: '8mm 0' }} />

      <p style={{ fontSize: '20px', fontWeight: 700, color: C.primaryDark, margin: 0 }}>{name}</p>
      <div style={{ fontSize: '12px', color: C.muted, marginTop: '4mm', lineHeight: 2 }}>
        {subject && <p style={{ margin: 0 }}>معلم {subject}</p>}
        {school && <p style={{ margin: 0 }}>{school}</p>}
        <p style={{ margin: 0 }}>العام الدراسي {year}</p>
      </div>

      <div style={{ marginTop: '14mm', display: 'inline-block', border: `1px solid ${C.border}`, borderRadius: '99px', padding: '3mm 8mm', background: C.bg }}>
        <span style={{ fontSize: '11px', color: C.muted }}>اكتمال الملف </span>
        <span style={{ fontSize: '14px', fontWeight: 800, color: C.primaryDark }}>{completion}%</span>
      </div>

      <p style={{ marginTop: 'auto', fontSize: '9.5px', color: C.muted }}>
        صدر بتاريخ {date} — أُنشئ آليًا من منصة ملف إنجاز المعلم
      </p>
    </div>
  )
}

/** صفحة الفهرس */
function Toc({ items }: { items: { num: number; title: string }[] }) {
  return (
    <div className="print-page" style={{ paddingTop: '10mm' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: C.ink, margin: '0 0 3mm' }}>الفهرس</h2>
      <div style={{ width: '25mm', height: '0.8mm', background: C.primary, marginBottom: '10mm' }} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((it) => (
          <div key={it.num} style={{ display: 'flex', alignItems: 'baseline', gap: '3mm', padding: '3mm 0', borderBottom: `0.5px dotted ${C.border}` }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: C.primary, minWidth: '8mm' }}>{it.num}.</span>
            <span style={{ fontSize: '12.5px', color: C.ink, fontWeight: 500 }}>{it.title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** صفحة عنوان المجال */
function SectionCover({ num, title, desc, stats }: { num: number; title: string; desc: string; stats?: { label: string; value: string }[] }) {
  return (
    <div className="print-section-cover print-avoid-break" style={{ minHeight: '120mm', display: 'flex', flexDirection: 'column', justifyContent: 'center', pageBreakBefore: 'always' }}>
      <span style={{ fontSize: '60px', fontWeight: 200, color: C.primaryLight, lineHeight: 1, WebkitTextStroke: `1px ${C.primary}` }}>{String(num).padStart(2, '0')}</span>
      <h2 style={{ fontSize: '26px', fontWeight: 700, color: C.ink, margin: '4mm 0 3mm' }}>{title}</h2>
      <div style={{ width: '30mm', height: '1mm', background: C.primary, margin: '2mm 0 6mm' }} />
      <p style={{ fontSize: '12px', color: C.muted, lineHeight: 2, maxWidth: '120mm' }}>{desc}</p>
      {stats && stats.length > 0 && (
        <div style={{ display: 'flex', gap: '4mm', marginTop: '10mm' }}>
          {stats.map((s) => (
            <div key={s.label} style={{ border: `0.7px solid ${C.border}`, borderRadius: '3mm', padding: '3mm 6mm', background: C.bg }}>
              <p style={{ fontSize: '15px', fontWeight: 800, color: C.primaryDark, margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: '9px', color: C.muted, margin: '1mm 0 0' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ReportPrint() {
  const config = useApp((s) => s.printConfig)
  const setPrintConfig = useApp((s) => s.setPrintConfig)
  const { data, isLoading, error, refetch } = useReport()

  useEffect(() => {
    if (!config || !data || error) return
    let cancelled = false

    const t = setTimeout(async () => {
      const root = document.getElementById('print-root')
      const imgs = Array.from(root?.querySelectorAll('img') ?? [])
      await Promise.all(
        imgs.map((img) =>
          img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res() }),
        ),
      )
      if (cancelled) return
      window.print()
    }, 900)

    const after = () => {
      setTimeout(() => { if (!cancelled) setPrintConfig(null) }, 600)
    }
    window.addEventListener('afterprint', after)
    return () => {
      cancelled = true
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

  const { user, year, goals, achievements, attachments, reflection, devPlans, completion } = data
  const dateStr = formatDate(new Date())
  const byType = (types: string[]) => achievements.filter((a) => types.includes(a.type))
  const scored = achievements.filter((a) => a.preScore != null && a.postScore != null)
  const pdItems = byType(['PD'])
  const pdHours = pdItems.reduce((s, a) => s + (a.hours ?? 0), 0)
  const initItems = byType(['INITIATIVE'])

  const includedSections =
    config.mode === 'custom'
      ? SECTIONS.filter((s) => config.sections.includes(s.key))
      : config.mode === 'pd' ? [SECTION_MAP.development!]
      : config.mode === 'initiatives' ? [SECTION_MAP.initiatives!]
      : config.mode === 'impact' ? [SECTION_MAP.outcomes!]
      : SECTIONS

  const footer = (
    <div className="print-footer">
      <span style={{ fontWeight: 600, color: C.primaryDark }}>{user.name} — {year.label}</span>
      <span>ملف إنجاز المعلم الإلكتروني</span>
    </div>
  )

  /* ═══ التقرير الكامل / المخصص ═══ */
  if (config.mode === 'full' || config.mode === 'custom') {
    const tocItems = includedSections.map((s, i) => ({ num: i + 1, title: s.title }))
    return (
      <div dir="rtl" style={{ fontFamily: 'var(--font-readex), Tahoma, sans-serif', color: C.ink }}>
        {footer}
        <Cover name={user.name} school={user.school} subject={user.subject} year={year.label} completion={completion.overall} date={dateStr} />
        <Toc items={tocItems} />

        {includedSections.map((s, i) => {
          const stats: { label: string; value: string }[] = []
          let content: React.ReactNode = null

          if (s.key === 'profile') {
            stats.push({ label: 'المؤهل', value: user.qualification ?? '—' }, { label: 'سنوات الخبرة', value: user.experienceYears ? `${user.experienceYears} سنة` : '—' })
            content = (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '4mm' }}>
                <tbody>
                  <FieldRow label="الاسم" value={user.name} />
                  <FieldRow label="المدرسة" value={user.school} />
                  <FieldRow label="التخصص" value={user.subject} />
                  <FieldRow label="المؤهل" value={user.qualification} />
                  <FieldRow label="سنوات الخبرة" value={user.experienceYears ? `${formatNumber(user.experienceYears)} سنة` : undefined} />
                  <FieldRow label="المرحلة" value={user.stage} />
                  <FieldRow label="الصفوف" value={user.classes} />
                  <FieldRow label="الرخصة المهنية" value={user.licenseNumber} />
                  <FieldRow label="المهام" value={user.duties} />
                  <FieldRow label="النصاب الأسبوعي" value={user.weeklyLoad ? `${formatNumber(user.weeklyLoad)} حصة` : undefined} />
                </tbody>
              </table>
            )
          } else if (s.key === 'goals') {
            stats.push({ label: 'الأهداف', value: String(goals.length) })
            content = goals.length ? goals.map((g) => {
              const pct = g.targetValue && g.targetValue > 0 ? Math.min(100, Math.round(((g.currentValue ?? 0) / g.targetValue) * 100)) : 0
              return (
                <div key={g.id} className="print-avoid-break" style={{ border: `0.7px solid ${C.border}`, borderRadius: '5mm', padding: '5mm 6mm', marginBottom: '4mm', pageBreakInside: 'avoid' }}>
                  <h3 style={{ margin: '0 0 1.5mm', fontSize: '13px', fontWeight: 700, color: C.ink }}>{g.title}</h3>
                  {g.description && <p style={{ fontSize: '10.5px', color: C.muted, lineHeight: 1.8, margin: '0 0 2mm' }}>{g.description}</p>}
                  {g.indicator && <p style={{ fontSize: '9.5px', color: C.primaryDark, margin: '0 0 2.5mm' }}>المؤشر: {g.indicator}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
                    <div style={{ flex: 1, height: '3mm', background: '#e8ede9', borderRadius: '99px' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: C.primary, borderRadius: '99px' }} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: C.primaryDark }}>{g.currentValue ?? 0} / {g.targetValue ?? '—'} ({pct}%)</span>
                  </div>
                  {g.achievements && g.achievements.length > 0 && (
                    <p style={{ fontSize: '9px', color: C.muted, margin: '2.5mm 0 0' }}>
                      الإنجازات المرتبطة ({g.achievements.length}): {g.achievements.map((a) => a.title).join(' • ')}
                    </p>
                  )}
                </div>
              )
            }) : <Empty label="لا توجد أهداف مهنية موثقة." />
          } else if (s.key === 'reflection') {
            const answered = reflection ? [reflection.success, reflection.practice, reflection.develop, reflection.nextTerm] : []
            stats.push({ label: 'الأسئلة المجابة', value: `${answered.filter(Boolean).length} من 4` })
            content = reflection ? (
              <div className="print-avoid-break" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4mm' }}>
                {[
                  ['أبرز نجاح حققته', reflection.success],
                  ['أكثر ممارسة مؤثرة', reflection.practice],
                  ['المجال المرغوب تطويره', reflection.develop],
                  ['ما سأفعله بشكل مختلف', reflection.nextTerm],
                ].map(([label, val]) => (
                  <div key={label} style={{ border: `0.7px solid ${C.border}`, borderRadius: '4mm', padding: '4mm 5mm' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: C.primaryDark, margin: '0 0 2mm' }}>{label}</p>
                    <p style={{ fontSize: '10.5px', color: C.ink, lineHeight: 1.8, margin: 0 }}>{val || '—'}</p>
                  </div>
                ))}
              </div>
            ) : <Empty label="لم تُجب أسئلة التأمل المهني بعد." />
          } else if (s.key === 'devplan') {
            stats.push({ label: 'بنود الخطة', value: String(devPlans.length) })
            content = devPlans.length ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    {['الهدف التطويري', 'الإجراء', 'الفترة', 'مؤشر النجاح', 'النتيجة'].map((h) => (
                      <th key={h} style={{ textAlign: 'right', padding: '2.5mm 3mm', borderBottom: `1px solid ${C.border}`, color: C.primaryDark, fontSize: '9.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {devPlans.map((p) => (
                    <tr key={p.id} style={{ pageBreakInside: 'avoid' }}>
                      <td style={{ padding: '2.5mm 3mm', borderBottom: `0.5px solid ${C.border}`, fontWeight: 600 }}>{p.goal}</td>
                      <td style={{ padding: '2.5mm 3mm', borderBottom: `0.5px solid ${C.border}`, color: C.muted }}>{p.action || '—'}</td>
                      <td style={{ padding: '2.5mm 3mm', borderBottom: `0.5px solid ${C.border}`, color: C.muted }}>{p.period || '—'}</td>
                      <td style={{ padding: '2.5mm 3mm', borderBottom: `0.5px solid ${C.border}`, color: C.muted }}>{p.indicator || '—'}</td>
                      <td style={{ padding: '2.5mm 3mm', borderBottom: `0.5px solid ${C.border}`, color: C.muted }}>{p.result || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty label="لا توجد خطة تطويرية موثقة." />
          } else if (s.key === 'outcomes') {
            stats.push(
              { label: 'قياسات موثقة', value: String(scored.length) },
              { label: 'متوسط التحسن', value: completion.counts.avgImprovement !== null ? `+${completion.counts.avgImprovement}%` : '—' },
            )
            content = scored.length ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    {['الإنجاز', 'قبل', 'بعد', 'التحسن', 'الأثر'].map((h) => (
                      <th key={h} style={{ textAlign: 'right', padding: '2.5mm 3mm', borderBottom: `1px solid ${C.border}`, color: C.primaryDark, fontSize: '9.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scored.map((a) => {
                    const diff = improvement(a.preScore, a.postScore)
                    return (
                      <tr key={a.id} style={{ pageBreakInside: 'avoid' }}>
                        <td style={{ padding: '2.5mm 3mm', borderBottom: `0.5px solid ${C.border}`, fontWeight: 600 }}>{a.title}</td>
                        <td style={{ padding: '2.5mm 3mm', borderBottom: `0.5px solid ${C.border}` }}>{formatNumber(a.preScore)}%</td>
                        <td style={{ padding: '2.5mm 3mm', borderBottom: `0.5px solid ${C.border}`, color: C.primaryDark, fontWeight: 700 }}>{formatNumber(a.postScore)}%</td>
                        <td style={{ padding: '2.5mm 3mm', borderBottom: `0.5px solid ${C.border}`, color: '#0b6b4f', fontWeight: 800 }}>+{formatNumber(diff ?? 0)}</td>
                        <td style={{ padding: '2.5mm 3mm', borderBottom: `0.5px solid ${C.border}`, color: C.muted, maxWidth: '60mm' }}>{a.impact || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : <Empty label="لا توجد قياسات قبلي/بعدي موثقة." />
          } else {
            const items = byType(s.types ?? [])
            stats.push({ label: 'العناصر', value: String(items.length) })
            if (s.key === 'development' && pdHours > 0) stats.push({ label: 'إجمالي الساعات', value: `${formatNumber(pdHours)} ساعة` })
            if (s.key === 'initiatives') stats.push({ label: 'إجمالي المستفيدين', value: formatNumber(items.reduce((sum, a) => sum + (a.beneficiariesCount ?? 0), 0)) })
            content = items.length
              ? items.map((a) => <AchievementBlock key={a.id} a={a} />)
              : <Empty label={`لا توجد عناصر موثقة في ${s.title} حتى الآن.`} />
          }

          return (
            <section key={s.key}>
              <SectionCover num={i + 1} title={s.title} desc={s.desc} stats={stats} />
              <div style={{ paddingBottom: '6mm' }}>{content}</div>
            </section>
          )
        })}
      </div>
    )
  }

  /* ═══ التقرير الملخص ═══ */
  if (config.mode === 'summary') {
    const highlights = [...achievements]
      .filter((a) => a.impact || a.results)
      .sort((a, b) => (b.beneficiariesCount ?? b.studentsCount ?? 0) - (a.beneficiariesCount ?? a.studentsCount ?? 0))
      .slice(0, 5)
    return (
      <div dir="rtl" style={{ fontFamily: 'var(--font-readex), Tahoma, sans-serif', color: C.ink }}>
        {footer}
        <div className="print-page" style={{ paddingTop: '4mm' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${C.border}`, paddingBottom: '4mm', marginBottom: '7mm' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>ملخص ملف الإنجاز</h1>
              <p style={{ fontSize: '11px', color: C.muted, margin: '2mm 0 0' }}>{user.name} — {user.school} — {year.label}</p>
            </div>
            <div style={{ textAlign: 'center', background: C.bg, border: `0.7px solid ${C.border}`, borderRadius: '4mm', padding: '2.5mm 5mm' }}>
              <p style={{ fontSize: '18px', fontWeight: 800, color: C.primaryDark, margin: 0 }}>{completion.overall}%</p>
              <p style={{ fontSize: '8px', color: C.muted, margin: 0 }}>اكتمال الملف</p>
            </div>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3mm', marginBottom: '8mm' }}>
            {[
              ['إنجازًا موثقًا', formatNumber(completion.counts.achievements)],
              ['مبادرات', formatNumber(completion.counts.initiatives)],
              ['ساعة تطوير مهني', formatNumber(completion.counts.pdHours)],
              ['خطط علاجية', formatNumber(completion.counts.remedial)],
              ['شواهد موثقة', formatNumber(completion.counts.evidence)],
              ['مستفيدًا من المبادرات', formatNumber(completion.counts.beneficiaries)],
              ['متوسط التحسن', completion.counts.avgImprovement !== null ? `+${completion.counts.avgImprovement}%` : '—'],
              ['مجالات مكتملة', `${completion.counts.completedSections} / 16`],
            ].map(([label, value]) => (
              <div key={label} style={{ border: `0.7px solid ${C.border}`, borderRadius: '3.5mm', padding: '3.5mm 3mm', textAlign: 'center', background: C.bg }}>
                <p style={{ fontSize: '16px', fontWeight: 800, color: C.primaryDark, margin: 0 }}>{value}</p>
                <p style={{ fontSize: '8.5px', color: C.muted, margin: '1mm 0 0' }}>{label}</p>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4mm', color: C.primaryDark }}>أبرز الإنجازات</h2>
          {highlights.length ? highlights.map((a) => {
            const diff = improvement(a.preScore, a.postScore)
            return (
              <div key={a.id} className="print-avoid-break" style={{ border: `0.7px solid ${C.border}`, borderRadius: '4mm', padding: '4mm 5mm', marginBottom: '3.5mm', pageBreakInside: 'avoid' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4mm' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700 }}>{a.title}</p>
                    <p style={{ margin: '1.5mm 0 0', fontSize: '9.5px', color: C.muted }}>
                      {TYPE_LABEL(a.type)} {a.date ? ` • ${formatDate(a.date)}` : ''}
                      {a.beneficiariesCount ? ` • ${formatNumber(a.beneficiariesCount)} مستفيدًا` : a.studentsCount ? ` • ${formatNumber(a.studentsCount)} طالبًا` : ''}
                    </p>
                  </div>
                  {diff !== null && <span style={{ fontSize: '12px', fontWeight: 800, color: '#0b6b4f', whiteSpace: 'nowrap' }}>+{formatNumber(diff)} نقطة</span>}
                </div>
                {a.impact && <p style={{ margin: '2mm 0 0', fontSize: '10px', color: C.muted, lineHeight: 1.7 }}>{a.impact}</p>}
              </div>
            )
          }) : <Empty label="لا توجد إنجازات ذات أثر موثق بعد." />}
        </div>
      </div>
    )
  }

  /* ═══ تقرير الأثر المهني ═══ */
  if (config.mode === 'impact') {
    return (
      <div dir="rtl" style={{ fontFamily: 'var(--font-readex), Tahoma, sans-serif', color: C.ink }}>
        {footer}
        <div className="print-page" style={{ paddingTop: '4mm' }}>
          <header style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: '4mm', marginBottom: '7mm' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>تقرير الأثر المهني</h1>
            <p style={{ fontSize: '11px', color: C.muted, margin: '2mm 0 0' }}>{user.name} — {user.subject} — {year.label}</p>
          </header>

          {scored.length === 0 ? (
            <Empty label="لا توجد قياسات قبلي/بعدي موثقة بعد." />
          ) : (
            <>
              <p style={{ fontSize: '11px', color: C.muted, lineHeight: 1.9, marginBottom: '6mm' }}>
                يعرض هذا التقرير أثر الممارسات المهنية مقيسًا بالقياس القبلي والبعدي لكل تدخل تعليمي — {scored.length} قياسات، بمتوسط تحسن {completion.counts.avgImprovement !== null ? `+${completion.counts.avgImprovement}%` : '—'}.
              </p>
              {scored.map((a) => {
                const diff = improvement(a.preScore, a.postScore)
                return (
                  <div key={a.id} className="print-avoid-break" style={{ border: `0.7px solid ${C.border}`, borderRadius: '5mm', padding: '5mm 6mm', marginBottom: '4.5mm', pageBreakInside: 'avoid' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4mm', marginBottom: '3mm' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>{a.title}</p>
                        <p style={{ margin: '1mm 0 0', fontSize: '9.5px', color: C.muted }}>{TYPE_LABEL(a.type)} {a.date ? ` • ${formatDate(a.date)}` : ''} {a.durationText ? ` • ${a.durationText}` : ''}</p>
                      </div>
                      <div style={{ textAlign: 'center', background: '#ecf7f2', border: '0.7px solid #bfe3d5', borderRadius: '3mm', padding: '2mm 4.5mm' }}>
                        <p style={{ fontSize: '15px', fontWeight: 800, color: '#0b6b4f', margin: 0 }}>+{formatNumber(diff ?? 0)}</p>
                        <p style={{ fontSize: '7.5px', color: '#3d8a6f', margin: 0 }}>نقطة مئوية</p>
                      </div>
                    </div>
                    {a.goalText && <p style={{ margin: '0 0 2.5mm', fontSize: '10px', color: C.muted, lineHeight: 1.7 }}><b style={{ color: C.primaryDark }}>الهدف:</b> {a.goalText}</p>}
                    {a.execution && <p style={{ margin: '0 0 3mm', fontSize: '10px', color: C.muted, lineHeight: 1.7 }}><b style={{ color: C.primaryDark }}>الإجراء:</b> {a.execution}</p>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5mm' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
                        <span style={{ fontSize: '9px', color: C.muted, minWidth: '14mm' }}>قبل: {formatNumber(a.preScore)}%</span>
                        <div style={{ flex: 1, height: '3.5mm', background: '#e8ede9', borderRadius: '99px' }}>
                          <div style={{ width: `${Math.min(100, a.preScore ?? 0)}%`, height: '100%', background: '#b7c9c2', borderRadius: '99px' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
                        <span style={{ fontSize: '9px', color: C.primaryDark, minWidth: '14mm', fontWeight: 700 }}>بعد: {formatNumber(a.postScore)}%</span>
                        <div style={{ flex: 1, height: '3.5mm', background: '#e0efea', borderRadius: '99px' }}>
                          <div style={{ width: `${Math.min(100, a.postScore ?? 0)}%`, height: '100%', background: C.primary, borderRadius: '99px' }} />
                        </div>
                      </div>
                    </div>
                    {a.impact && <p style={{ margin: '3mm 0 0', fontSize: '10px', color: C.ink, lineHeight: 1.8, background: C.bg, borderRadius: '2.5mm', padding: '2.5mm 3.5mm' }}><b style={{ color: C.primaryDark }}>الأثر:</b> {a.impact}</p>}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    )
  }

  /* ═══ تقرير التطوير المهني ═══ */
  if (config.mode === 'pd') {
    return (
      <div dir="rtl" style={{ fontFamily: 'var(--font-readex), Tahoma, sans-serif', color: C.ink }}>
        {footer}
        <div className="print-page" style={{ paddingTop: '4mm' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${C.border}`, paddingBottom: '4mm', marginBottom: '7mm' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>تقرير التطوير المهني</h1>
              <p style={{ fontSize: '11px', color: C.muted, margin: '2mm 0 0' }}>{user.name} — {user.school} — {year.label}</p>
            </div>
            <div style={{ textAlign: 'center', background: C.bg, border: `0.7px solid ${C.border}`, borderRadius: '4mm', padding: '2.5mm 5mm' }}>
              <p style={{ fontSize: '18px', fontWeight: 800, color: C.primaryDark, margin: 0 }}>{formatNumber(pdHours)}</p>
              <p style={{ fontSize: '8px', color: C.muted, margin: 0 }}>إجمالي الساعات</p>
            </div>
          </header>

          {pdItems.length === 0 ? (
            <Empty label="لا توجد أنشطة تطوير مهني موثقة بعد." />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  {['البرنامج', 'الجهة', 'التاريخ', 'الساعات', 'الأثر على الممارسة'].map((h) => (
                    <th key={h} style={{ textAlign: 'right', padding: '3mm', borderBottom: `1px solid ${C.border}`, color: C.primaryDark, fontSize: '9.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pdItems.map((a) => (
                  <tr key={a.id} style={{ pageBreakInside: 'avoid' }}>
                    <td style={{ padding: '3mm', borderBottom: `0.5px solid ${C.border}`, fontWeight: 600 }}>{a.title}</td>
                    <td style={{ padding: '3mm', borderBottom: `0.5px solid ${C.border}`, color: C.muted }}>{a.provider || '—'}</td>
                    <td style={{ padding: '3mm', borderBottom: `0.5px solid ${C.border}`, color: C.muted }}>{a.date ? formatDate(a.date) : '—'}</td>
                    <td style={{ padding: '3mm', borderBottom: `0.5px solid ${C.border}`, fontWeight: 700, color: C.primaryDark }}>{a.hours ? formatNumber(a.hours) : '—'}</td>
                    <td style={{ padding: '3mm', borderBottom: `0.5px solid ${C.border}`, color: C.muted, maxWidth: '55mm', lineHeight: 1.6 }}>{a.impact || a.results || '—'}</td>
                  </tr>
                ))}
                <tr style={{ background: C.bg }}>
                  <td colSpan={3} style={{ padding: '3mm', fontWeight: 800, color: C.primaryDark }}>الإجمالي</td>
                  <td style={{ padding: '3mm', fontWeight: 800, color: C.primaryDark }}>{formatNumber(pdHours)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  /* ═══ تقرير المبادرات ═══ */
  if (config.mode === 'initiatives') {
    const totalBeneficiaries = initItems.reduce((s, a) => s + (a.beneficiariesCount ?? 0), 0)
    return (
      <div dir="rtl" style={{ fontFamily: 'var(--font-readex), Tahoma, sans-serif', color: C.ink }}>
        {footer}
        <div className="print-page" style={{ paddingTop: '4mm' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${C.border}`, paddingBottom: '4mm', marginBottom: '7mm' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>تقرير المبادرات</h1>
              <p style={{ fontSize: '11px', color: C.muted, margin: '2mm 0 0' }}>{user.name} — {user.school} — {year.label}</p>
            </div>
            <div style={{ display: 'flex', gap: '3mm' }}>
              <div style={{ textAlign: 'center', background: C.bg, border: `0.7px solid ${C.border}`, borderRadius: '4mm', padding: '2.5mm 5mm' }}>
                <p style={{ fontSize: '18px', fontWeight: 800, color: C.primaryDark, margin: 0 }}>{formatNumber(initItems.length)}</p>
                <p style={{ fontSize: '8px', color: C.muted, margin: 0 }}>مبادرة</p>
              </div>
              <div style={{ textAlign: 'center', background: C.bg, border: `0.7px solid ${C.border}`, borderRadius: '4mm', padding: '2.5mm 5mm' }}>
                <p style={{ fontSize: '18px', fontWeight: 800, color: C.primaryDark, margin: 0 }}>{formatNumber(totalBeneficiaries)}</p>
                <p style={{ fontSize: '8px', color: C.muted, margin: 0 }}>مستفيدًا</p>
              </div>
            </div>
          </header>

          {initItems.length === 0 ? (
            <Empty label="لا توجد مبادرات موثقة بعد." />
          ) : (
            initItems.map((a) => (
              <AchievementBlock key={a.id} a={a} />
            ))
          )}
        </div>
      </div>
    )
  }

  return null
}

function Empty({ label }: { label: string }) {
  return (
    <p style={{ textAlign: 'center', color: C.muted, fontSize: '11px', padding: '14mm 0', border: `0.7px dashed ${C.border}`, borderRadius: '4mm' }}>
      {label}
    </p>
  )
}
