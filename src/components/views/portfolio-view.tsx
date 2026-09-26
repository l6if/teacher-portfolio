'use client'

import { useApp } from '@/store/app-store'
import { useDashboard } from '@/hooks/use-data'
import { SECTIONS } from '@/lib/constants'
import { ProgressBar } from '@/components/shared/progress'
import { Icon } from '@/components/shared/icon'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState, ErrorState } from '@/components/shared/states'
import { formatNumber } from '@/lib/format'

const COMPLETION_TONE = (v: number) =>
  v >= 100 ? 'text-emerald-700' : v >= 50 ? 'text-primary' : 'text-muted-foreground'

export function PortfolioView() {
  const { data, isLoading, error, refetch } = useDashboard()
  const navigate = useApp((s) => s.navigate)

  if (isLoading) return <LoadingState rows={0} />
  if (error || !data) return <ErrorState message="تعذر تحميل مجالات ملفك." onRetry={() => refetch()} />

  const { completion, year, counts } = data

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'ملف إنجازي' }]}
        title="مجالات ملف الإنجاز"
        description={`${SECTIONS.length} مجالًا يبنى ملفك المهني عليها — ${year.label}`}
        icon="FolderOpen"
      />

      {/* ملخص علوي */}
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-border bg-card px-5 py-4 anim-fade-up">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl font-bold tabular-nums text-primary">{completion.overall}%</span>
          <span className="text-xs text-muted-foreground leading-4">اكتمال<br />الملف</span>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex items-center gap-2 text-sm">
          <Icon name="BookOpen" className="size-4 text-muted-foreground" />
          <span className="font-semibold tabular-nums">{formatNumber(counts.achievements)}</span>
          <span className="text-muted-foreground">إنجازًا</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Icon name="LibraryBig" className="size-4 text-muted-foreground" />
          <span className="font-semibold tabular-nums">{formatNumber(counts.evidence)}</span>
          <span className="text-muted-foreground">شاهدًا</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Icon name="CheckCircle2" className="size-4 text-emerald-600" />
          <span className="font-semibold tabular-nums">{formatNumber(counts.completedSections)}</span>
          <span className="text-muted-foreground">مجالًا مكتملًا</span>
        </div>
      </div>

      {/* بطاقات المجالات */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {SECTIONS.map((s, i) => {
          const value = completion.sections[s.key] ?? 0
          return (
            <button
              key={s.key}
              onClick={() => navigate('section', { sectionKey: s.key })}
              className={`group anim-fade-up rounded-3xl border border-border bg-card p-4 text-right transition-all hover:-translate-y-1 hover:border-primary/35 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5 ${i < 6 ? `anim-delay-${Math.min(i + 1, 4)}` : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon name={s.icon} className="size-5.5" strokeWidth={1.8} />
                </div>
                <div className="flex flex-col items-end">
                  <span className={`text-lg font-bold tabular-nums ${COMPLETION_TONE(value)}`}>{value}%</span>
                  <span className="text-[10px] text-muted-foreground">مجال {SECTIONS.findIndex((x) => x.key === s.key) + 1}</span>
                </div>
              </div>
              <h3 className="mt-4 text-base font-bold text-foreground group-hover:text-primary">{s.title}</h3>
              <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">{s.desc}</p>
              <div className="mt-4">
                <ProgressBar value={value} thickness="h-1.5" />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className={`rounded-full px-2 py-0.5 ${value >= 100 ? 'bg-emerald-50 text-emerald-700' : value > 0 ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {value >= 100 ? 'مكتمل' : value > 0 ? 'قيد البناء' : 'لم يبدأ بعد'}
                </span>
                <span className="flex min-h-6 items-center gap-1 font-medium text-primary opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  فتح المجال
                  <Icon name="ArrowLeft" className="size-3.5" />
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
