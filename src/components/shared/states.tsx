'use client'

import { Icon } from './icon'

export function EmptyState({
  icon = 'BookOpen',
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  icon?: string
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center anim-fade-up">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-primary/8 blur-xl" />
        <div className="relative flex size-16 items-center justify-center rounded-2xl bg-secondary">
          <Icon name={icon} className="size-7 text-primary" strokeWidth={1.8} />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground text-balance">{description}</p>
      {(actionLabel || secondaryLabel) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:bg-primary/90 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
            >
              <Icon name="Plus" className="size-4" />
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              onClick={onSecondary}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-6">
            <div className="h-5 w-2/5 animate-pulse rounded-full bg-muted" />
            <div className="mt-4 h-3 w-4/5 animate-pulse rounded-full bg-muted/70" />
            <div className="mt-2.5 h-3 w-3/5 animate-pulse rounded-full bg-muted/50" />
            <div className="mt-6 h-9 w-full animate-pulse rounded-full bg-muted/60" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <div className="size-11 shrink-0 animate-pulse rounded-xl bg-muted" />
          <div className="flex-1 space-y-2.5">
            <div className="h-4 w-2/5 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-3/5 animate-pulse rounded-full bg-muted/60" />
          </div>
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted/70" />
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ message = 'حدث خطأ غير متوقع.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-12 text-center anim-fade-in">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
        <Icon name="CircleAlert" className="size-6 text-destructive" strokeWidth={1.8} />
      </div>
      <h3 className="text-base font-semibold text-foreground">{message}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">لم يتأثر أي من بياناتك المحفوظة.</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Icon name="RefreshCw" className="size-4" />
          إعادة المحاولة
        </button>
      )}
    </div>
  )
}
