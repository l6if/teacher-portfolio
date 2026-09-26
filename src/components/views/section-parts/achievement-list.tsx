'use client'

import { useApp } from '@/store/app-store'
import { useAchievements } from '@/hooks/use-data'
import { TYPE_MAP, STATUS_LABEL } from '@/lib/constants'
import { Icon } from '@/components/shared/icon'
import { StatusBadge, TypeChip } from '@/components/shared/badges'
import { AttachmentThumb, ImpactBars } from '@/components/shared/attachment-ui'
import { EmptyState, LoadingState, ErrorState } from '@/components/shared/states'
import { formatDateShort, formatNumber } from '@/lib/format'
import type { TAchievement } from '@/lib/types'

/** بطاقة إنجاز واحدة */
export function AchievementCard({ a, onOpen }: { a: TAchievement; onOpen: () => void }) {
  const t = TYPE_MAP[a.type as keyof typeof TYPE_MAP]
  const attachments = a.attachments ?? []
  const hasScores = a.preScore != null && a.postScore != null

  return (
    <article
      className="group anim-fade-up cursor-pointer rounded-3xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
      aria-label={`فتح ${a.title}`}
    >
      <div className="flex items-start gap-3.5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon name={t?.icon ?? 'CircleDashed'} className="size-5" strokeWidth={1.85} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold leading-6 text-foreground group-hover:text-primary">{a.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Icon name="Calendar" className="size-3" />
              {a.date ? formatDateShort(a.date) : 'بدون تاريخ'}
            </span>
            <TypeChip type={a.type} />
            {a.hours ? (
              <span className="flex items-center gap-1">
                <Icon name="Clock" className="size-3" />
                {formatNumber(a.hours)} ساعة
              </span>
            ) : null}
            {a.beneficiariesCount ? (
              <span className="flex items-center gap-1">
                <Icon name="Users" className="size-3" />
                {formatNumber(a.beneficiariesCount)} مستفيدًا
              </span>
            ) : a.studentsCount ? (
              <span className="flex items-center gap-1">
                <Icon name="Users" className="size-3" />
                {formatNumber(a.studentsCount)} طالبًا
              </span>
            ) : null}
            {a.durationText && (
              <span className="flex items-center gap-1">
                <Icon name="CalendarDays" className="size-3" />
                {a.durationText}
              </span>
            )}
          </div>
        </div>
        <StatusBadge status={a.status} />
      </div>

      {a.description && (
        <p className="mt-3.5 line-clamp-2 text-[13px] leading-6 text-muted-foreground">{a.description}</p>
      )}

      {hasScores && (
        <div className="mt-4 max-w-md">
          <ImpactBars pre={a.preScore as number} post={a.postScore as number} compact />
        </div>
      )}

      {a.goal && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-[11px] text-secondary-foreground">
          <Icon name="Target" className="size-3.5 shrink-0" />
          <span className="truncate">مرتبط بالهدف: {a.goal.title}</span>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mt-4 flex items-center gap-2.5">
          {attachments.slice(0, 4).map((att) => (
            <AttachmentThumb key={att.id} attachment={att} className="size-11" />
          ))}
          {attachments.length > 4 && (
            <span className="text-[11px] font-medium text-muted-foreground">+{attachments.length - 4} شواهد أخرى</span>
          )}
          <span className="mr-auto flex items-center gap-1 text-[11px] text-muted-foreground">
            <Icon name="Paperclip" className="size-3" />
            {attachments.length}
          </span>
        </div>
      )}
    </article>
  )
}

/** قائمة إنجازات مجال معين */
export function AchievementList({
  types,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  addType,
}: {
  types: string[]
  emptyIcon?: string
  emptyTitle: string
  emptyDescription: string
  addType?: string
}) {
  const openForm = useApp((s) => s.openForm)
  const type = types.length === 1 ? types[0] : undefined
  const { data, isLoading, error, refetch } = useAchievements(type ? { type } : {})

  if (isLoading) return <LoadingState rows={4} />
  if (error) return <ErrorState onRetry={() => refetch()} message="تعذر تحميل العناصر." />

  const achievements = (data?.achievements ?? [])
    .filter((a) => (types.length ? types.includes(a.type) : true))
    .sort((a, b) => (b.date ? +new Date(b.date) : 0) - (a.date ? +new Date(a.date) : 0))

  if (achievements.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon ?? 'BookOpen'}
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={addType ? 'إضافة أول عنصر' : undefined}
        onAction={addType ? () => openForm({ type: addType as never }) : undefined}
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {achievements.map((a) => (
        <AchievementCard key={a.id} a={a} onOpen={() => openForm({ achievementId: a.id })} />
      ))}
    </div>
  )
}

export { STATUS_LABEL }
