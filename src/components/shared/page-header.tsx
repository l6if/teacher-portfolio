'use client'

import { Fragment } from 'react'
import { SECTIONS, SECTION_MAP } from '@/lib/constants'
import { useApp } from '@/store/app-store'
import { Icon } from './icon'

/** رأس الصفحة الداخلية مع Breadcrumb بسيط */
export function PageHeader({
  crumbs,
  title,
  description,
  actions,
  icon,
}: {
  crumbs: { label: string; sectionKey?: string; onClick?: () => void }[]
  title: string
  description?: string
  actions?: React.ReactNode
  icon?: string
}) {
  return (
    <div className="mb-6 anim-fade-up">
      <nav aria-label="مسار التنقل" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && <Icon name="ChevronLeft" className="size-3 text-border" />}
            {c.onClick || c.sectionKey ? (
              <button
                onClick={c.onClick ?? (() => useApp.getState().navigate('section', { sectionKey: c.sectionKey as never }))}
                className="transition-colors hover:text-primary focus-visible:outline-2 focus-visible:rounded focus-visible:outline-ring"
              >
                {c.label}
              </button>
            ) : (
              <span aria-current="page" className="font-medium text-foreground/70">{c.label}</span>
            )}
          </Fragment>
        ))}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          {icon && (
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary">
              <Icon name={icon} className="size-5.5 text-primary" strokeWidth={1.9} />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-[1.35rem]">{title}</h1>
            {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </div>
  )
}

/** عنوان مجال + أيقونته */
export function SectionIcon({ sectionKey, className = 'size-5' }: { sectionKey: string; className?: string }) {
  const s = SECTION_MAP[sectionKey]
  return <Icon name={s?.icon ?? 'CircleDashed'} className={className} strokeWidth={1.9} />
}

export const ALL_SECTION_KEYS = SECTIONS.map((s) => s.key)
