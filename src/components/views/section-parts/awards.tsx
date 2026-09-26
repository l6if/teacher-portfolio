'use client'

import { useAchievements } from '@/hooks/use-data'
import { useApp } from '@/store/app-store'
import { Icon } from '@/components/shared/icon'
import { EmptyState, LoadingState, ErrorState } from '@/components/shared/states'
import { AttachmentThumb } from '@/components/shared/attachment-ui'
import { formatDateShort, relTime } from '@/lib/format'

const YEARS = [2026, 2025]

/** الإنجازات والتكريم — Timeline جميل */
export function AwardsTimeline() {
  const { data, isLoading, error, refetch } = useAchievements()
  const openForm = useApp((s) => s.openForm)

  if (isLoading) return <LoadingState rows={3} />
  if (error) return <ErrorState message="تعذر تحميل الإنجازات والتكريم." onRetry={() => refetch()} />

  const awards = (data?.achievements ?? [])
    .filter((a) => ['AWARD', 'CERTIFICATE'].includes(a.type))
    .sort((a, b) => (b.date ? +new Date(b.date) : 0) - (a.date ? +new Date(a.date) : 0))

  if (awards.length === 0) {
    return (
      <EmptyState
        icon="Trophy"
        title="لا توجد إنجازات أو تكريم موثقة بعد"
        description="شهادة شكر، فوز بمسابقة، أو تقدير من الإدارة — وثّقها هنا مع صورتها، وستظهر في تقريرك وملفك بخط زمني جميل."
        actionLabel="توثيق إنجاز"
        onAction={() => openForm({ type: 'AWARD' })}
      />
    )
  }

  // تجميع حسب السنة الميلادية
  const byYear = new Map<number, typeof awards>()
  for (const a of awards) {
    const y = a.date ? new Date(a.date).getFullYear() : new Date(a.createdAt).getFullYear()
    if (!byYear.has(y)) byYear.set(y, [])
    byYear.get(y)!.push(a)
  }
  const years = [...byYear.keys()].sort((a, b) => b - a)

  return (
    <div className="space-y-8">
      {years.map((year) => {
        const items = byYear.get(year)!
        return (
          <section key={year} className="anim-fade-up">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 min-w-14 items-center justify-center rounded-2xl bg-primary px-3 text-sm font-bold text-primary-foreground shadow-soft" dir="ltr">{year}</span>
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">{items.length} تكريمًا وإنجازًا</span>
            </div>

            <ol className="relative space-y-4" dir="rtl">
              <span className="absolute bottom-5 right-[21px] top-5 w-0.5 rounded-full bg-border" aria-hidden="true" />
              {items.map((a) => {
                const attachments = a.attachments ?? []
                const cert = attachments[0]
                return (
                  <li key={a.id} className="relative pr-12">
                    <span className="absolute right-0 top-5 flex size-11 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-50 text-amber-700 shadow-soft" aria-hidden="true">
                      <Icon name="Trophy" className="size-5" strokeWidth={1.8} />
                    </span>
                    <button
                      onClick={() => openForm({ achievementId: a.id })}
                      className="w-full rounded-3xl border border-border bg-card p-5 text-right shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[15px] font-bold leading-6 text-foreground">{a.title}</h3>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            {a.date && <span className="flex items-center gap-1"><Icon name="Calendar" className="size-3" />{formatDateShort(a.date)} <span className="text-border">•</span> {relTime(a.date)}</span>}
                            {a.provider && <span className="flex items-center gap-1"><Icon name="Building2" className="size-3" />{a.provider}</span>}
                          </div>
                        </div>
                        {cert && <AttachmentThumb attachment={cert} className="size-14 shrink-0" rounded="rounded-2xl" />}
                      </div>
                      {a.description && <p className="mt-3 text-[13px] leading-6 text-muted-foreground">{a.description}</p>}
                      {attachments.length > 1 && (
                        <div className="mt-3 flex items-center gap-2">
                          {attachments.slice(1, 5).map((att) => <AttachmentThumb key={att.id} attachment={att} className="size-10" />)}
                          {attachments.length > 5 && <span className="text-[11px] text-muted-foreground">+{attachments.length - 5}</span>}
                        </div>
                      )}
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}
    </div>
  )
}
