'use client'

import { useAchievements } from '@/hooks/use-data'
import { useApp } from '@/store/app-store'
import { Icon } from '@/components/shared/icon'
import { ImpactBars } from '@/components/shared/attachment-ui'
import { EmptyState, LoadingState, ErrorState } from '@/components/shared/states'
import { formatDateShort, improvement, formatNumber } from '@/lib/format'
import { TYPE_LABEL } from '@/lib/constants'

/** نواتج التعلم — أثر المعلم مقيسًا (قبلي/بعدي) */
export function OutcomesSection() {
  const { data, isLoading, error, refetch } = useAchievements()
  const openForm = useApp((s) => s.openForm)

  if (isLoading) return <LoadingState rows={3} />
  if (error) return <ErrorState message="تعذر تحميل نواتج التعلم." onRetry={() => refetch()} />

  const scored = (data?.achievements ?? [])
    .filter((a) => a.preScore != null && a.postScore != null)
    .sort((a, b) => (b.date ? +new Date(b.date) : 0) - (a.date ? +new Date(a.date) : 0))

  const avg = scored.length
    ? Math.round((scored.reduce((s, a) => s + ((a.postScore as number) - (a.preScore as number)), 0) / scored.length) * 10) / 10
    : null

  if (scored.length === 0) {
    return (
      <EmptyState
        icon="TrendingUp"
        title="لم توثّق قياسات قبلي/بعدي بعد"
        description="أثر التعليم يُثبت بالأرقام: أضف قياسًا قبليًا وبعديًا لأي خطة علاجية أو برنامج أو ممارسة، وسيظهر التحسن هنا تلقائيًا برسم واضح."
        actionLabel="أضف أول قياس"
        onAction={() => openForm({ type: 'REMEDIAL' })}
      />
    )
  }

  return (
    <div className="space-y-4">
      {avg !== null && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-3xl border border-border bg-gradient-to-l from-emerald-50/90 to-card p-5 anim-fade-up">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-soft">
              <Icon name="TrendingUp" className="size-5.5" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-emerald-700">+{formatNumber(avg)}%</p>
              <p className="text-xs text-muted-foreground">متوسط التحسن عبر {formatNumber(scored.length)} قياسات</p>
            </div>
          </div>
          <div className="h-8 w-px bg-border sm:block" />
          <p className="flex-1 text-xs leading-5 text-muted-foreground">
            هذه القياسات مبنية على بياناتك الفعلية — كل قياس يظهر أين كان الطلاب قبل تدخلك، وأين وصلوا بعده.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {scored.map((a, i) => {
          const diff = improvement(a.preScore, a.postScore)
          return (
            <div key={a.id} className={`anim-fade-up anim-delay-${Math.min(i + 1, 4)} cursor-pointer rounded-3xl border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/30 hover:shadow-lift`} onClick={() => openForm({ achievementId: a.id })} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openForm({ achievementId: a.id })}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold leading-6 text-foreground">{a.title}</h3>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {TYPE_LABEL(a.type)} • {a.date ? formatDateShort(a.date) : '—'}
                  </p>
                </div>
                {diff !== null && (
                  <div className="flex shrink-0 flex-col items-center rounded-2xl bg-emerald-50/80 px-3 py-2">
                    <span className="text-lg font-bold tabular-nums text-emerald-700">+{formatNumber(diff)}</span>
                    <span className="text-[9px] text-emerald-700/70">نقطة مئوية</span>
                  </div>
                )}
              </div>
              {a.impact && <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-muted-foreground">{a.impact}</p>}
              <div className="mt-4">
                <ImpactBars pre={a.preScore as number} post={a.postScore as number} compact />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
