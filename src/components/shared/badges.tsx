'use client'

import { STATUS_META, TYPE_LABEL, ATTACHMENT_KINDS } from '@/lib/constants'
import { Icon } from './icon'

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as keyof typeof STATUS_META] ?? { label: status, tone: 'muted' }
  const styles: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
    warning: 'bg-orange-50 text-orange-700 border-orange-200/70',
    info: 'bg-teal-50 text-teal-700 border-teal-200/70',
    muted: 'bg-muted text-muted-foreground border-border',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[meta.tone]}`}>
      {status === 'COMPLETED' && <Icon name="Check" className="size-3" />}
      {status === 'NEEDS_WORK' && <Icon name="CircleAlert" className="size-3" />}
      {status === 'DRAFT' && <Icon name="SquarePen" className="size-3" />}
      {status === 'APPROVED' && <Icon name="BadgeCheck" className="size-3" />}
      {meta.label}
    </span>
  )
}

export function TypeChip({ type, className = '' }: { type: string; className?: string }) {
  const label = TYPE_LABEL(type)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground ${className}`}>
      {label}
    </span>
  )
}

export function AttachmentIcon({ kind, className = 'size-4' }: { kind: string; className?: string }) {
  const meta = ATTACHMENT_KINDS[kind] ?? ATTACHMENT_KINDS.OTHER
  return <Icon name={meta.icon} className={className} />
}

export function KindBadge({ kind }: { kind: string }) {
  const meta = ATTACHMENT_KINDS[kind] ?? ATTACHMENT_KINDS.OTHER
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground">
      <Icon name={meta.icon} className="size-3" />
      {meta.label}
    </span>
  )
}
