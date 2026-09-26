'use client'

import { useMemo } from 'react'
import { useApp } from '@/store/app-store'
import { useReport } from '@/hooks/use-data'
import { Icon } from '@/components/shared/icon'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState, ErrorState, EmptyState } from '@/components/shared/states'
import { TYPE_MAP } from '@/lib/constants'
import { formatDateShort, formatMonth, relTime } from '@/lib/format'
import { AR_MONTHS } from '@/lib/format'

/** رحلتي المهنية — خط زمني لطول العام */
export function JourneyView() {
  const { data, isLoading, error, refetch } = useReport()
  const openForm = useApp((s) => s.openForm)

  const byMonth = useMemo(() => {
    if (!data) return []
    const groups = new Map<string, { year: number; month: number; items: typeof data.achievements }>()
    for (const a of data.achievements) {
      const d = a.date ? new Date(a.date) : new Date(a.createdAt)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!groups.has(key)) groups.set(key, { year: d.getFullYear(), month: d.getMonth(), items: [] })
      groups.get(key)!.items.push(a)
    }
    return [...groups.values()]
      .sort((x, y) => y.year * 12 + y.month - (x.year * 12 + x.month))
      .map((g) => ({ ...g, items: g.items.sort((a, b) => (b.date ? +new Date(b.date) : 0) - (a.date ? +new Date(a.date) : 0)) }))
  }, [data])

  if (isLoading) return <LoadingState rows={4} />
  if (error || !data) return <ErrorState message="تعذر تحميل رحلتك المهنية." onRetry={() => refetch()} />

  const { user, year, completion } = data

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'رحلتي المهنية' }]}
        title={`رحلة ${user.name.split(' ').slice(0, 2).join(' ')} المهنية`}
        description={`خط زمني لكل ما وثّقته في ${year.label} — شاهد كيف تراكم أثرك شهرًا بشهر.`}
        icon="Route"
        actions={
          <div className="hidden items-center gap-2.5 rounded-full border border-border bg-card px-3.5 py-1.5 sm:flex">
            <span className="text-xs text-muted-foreground">اكتمال الرحلة</span>
            <span className="text-sm font-bold tabular-nums text-primary">{completion.overall}%</span>
          </div>
        }
      />

      {byMonth.length === 0 ? (
        <EmptyState
          icon="Route"
          title="رحلتك تبدأ بأول توثيق"
          description="عند إضافة الإنجازات سيتحول هذا الخط الزمني إلى سجل جميل يُظهر تطورك طوال العام — شهرًا بشهر."
          actionLabel="ابدأ أول إنجاز"
          onAction={() => openForm()}
        />
      ) : (
        <div className="space-y-8">
          {byMonth.map((g, gi) => (
            <section key={`${g.year}-${g.month}`} className={`anim-fade-up anim-delay-${Math.min(gi + 1, 4)}`}>
              {/* رأس الشهر */}
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 items-center gap-2 rounded-2xl border border-border bg-card px-4 shadow-soft">
                  <Icon name="CalendarDays" className="size-4 text-primary" />
                  <span className="text-sm font-bold">{AR_MONTHS[g.month]}</span>
                  <span className="text-xs text-muted-foreground" dir="ltr">{g.year}</span>
                </div>
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-muted-foreground">{g.items.length} إنجازًا</span>
              </div>

              {/* عناصر الشهر */}
              <ol className="relative space-y-3" dir="rtl">
                <span className="absolute bottom-4 right-[23px] top-4 w-0.5 rounded-full bg-gradient-to-b from-primary/40 to-border" aria-hidden="true" />
                {g.items.map((a) => {
                  const t = TYPE_MAP[a.type as keyof typeof TYPE_MAP]
                  return (
                    <li key={a.id} className="relative pr-14">
                      <span className="absolute right-1.5 top-4 flex size-9 items-center justify-center rounded-xl bg-card shadow-soft ring-1 ring-border" aria-hidden="true">
                        <Icon name={t?.icon ?? 'CircleDashed'} className="size-4 text-primary" strokeWidth={1.9} />
                      </span>
                      <button
                        onClick={() => openForm({ achievementId: a.id })}
                        className="w-full rounded-2xl border border-border bg-card/80 p-4 text-right transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-bold text-foreground">{a.title}</h3>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {t?.label} • {a.date ? formatDateShort(a.date) : relTime(a.createdAt)}
                            </p>
                          </div>
                          {a.preScore != null && a.postScore != null && (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                              +{Math.round(((a.postScore - a.preScore) * 10) / 10)}%
                            </span>
                          )}
                        </div>
                        {a.description && <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{a.description}</p>}
                      </button>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
