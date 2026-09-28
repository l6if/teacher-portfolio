'use client'

import Image from 'next/image'
import { Icon } from './icon'
import { ATTACHMENT_KINDS } from '@/lib/constants'
import { formatSize } from '@/lib/format'
import type { TAttachment } from '@/lib/types'

/** هل الصورة بوضع «أصلي» في التقرير؟ (COMPACT هو الافتراضي للأرث والقيم غير المضبوطة) */
export function isOriginalSize(a: TAttachment): boolean {
  return (a.reportDisplaySize ?? 'COMPACT').toUpperCase() === 'ORIGINAL'
}

/** مصغّر شاهد: معاينة للصور، وأيقونة لبقية الأنواع */
export function AttachmentThumb({
  attachment,
  className = 'size-12',
  rounded = 'rounded-xl',
}: {
  attachment: TAttachment
  className?: string
  rounded?: string
}) {
  const meta = ATTACHMENT_KINDS[attachment.kind] ?? ATTACHMENT_KINDS.OTHER
  if (attachment.kind === 'IMAGE' && attachment.url) {
    return (
      <div className={`relative overflow-hidden bg-muted ${rounded} ${className}`}>
        <Image
          src={attachment.url}
          alt={attachment.title}
          fill
          sizes="120px"
          className="object-cover"
          unoptimized
        />
      </div>
    )
  }
  if (attachment.kind === 'LINK' && attachment.url) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex ${rounded} ${className} items-center justify-center bg-primary/8 transition-colors hover:bg-primary/15`}
        aria-label={`فتح الرابط: ${attachment.title}`}
      >
        <Icon name="Link2" className="size-5 text-primary" />
      </a>
    )
  }
  return (
    <div className={`flex ${rounded} ${className} items-center justify-center bg-muted`} aria-hidden="true">
      <Icon name={meta.icon} className="size-5 text-muted-foreground" />
    </div>
  )
}

export function AttachmentCard({
  attachment,
  onRemove,
  compact = false,
  onReportSizeChange,
  sizeBusy = false,
}: {
  attachment: TAttachment
  onRemove?: () => void
  compact?: boolean
  /** تغيير حجم عرض هذه الصورة داخل التقرير (COMPACT/ORIGINAL) — صور فقط */
  onReportSizeChange?: (size: 'COMPACT' | 'ORIGINAL') => void
  /** جارٍ حفظ حجم العرض لهذا الشاهد */
  sizeBusy?: boolean
}) {
  const isImage = attachment.kind === 'IMAGE'
  const isOriginal = isOriginalSize(attachment)
  return (
    <div className={`group rounded-xl border border-border bg-card ${compact ? 'p-2.5' : 'p-3'} transition-shadow hover:shadow-soft`}>
      <div className="flex items-center gap-3">
        <AttachmentThumb attachment={attachment} className={compact ? 'size-10' : 'size-12'} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{attachment.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {ATTACHMENT_KINDS[attachment.kind]?.label ?? 'ملف'}
            {attachment.fileSize ? ` • ${formatSize(attachment.fileSize)}` : ''}
          </p>
        </div>
        {attachment.kind === 'LINK' && attachment.url ? (
          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
            aria-label="فتح الرابط"
          >
            <Icon name="ExternalLink" className="size-4" />
          </a>
        ) : attachment.url ? (
          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
            aria-label="معاينة الملف"
          >
            <Icon name="Eye" className="size-4" />
          </a>
        ) : null}
        {onRemove && (
          <button
            onClick={onRemove}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label={`إزالة ${attachment.title}`}
          >
            <Icon name="X" className="size-4" />
          </button>
        )}
      </div>
      {/* الحجم في التقرير — تحكم مستقل لكل صورة شاهد/تنفيذ (عرض فقط، لا يمس الملف الأصلي) */}
      {isImage && onReportSizeChange && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Icon name={sizeBusy ? 'Loader2' : 'Image'} className={`size-3.5 ${sizeBusy ? 'animate-spin' : ''}`} />
            الحجم في التقرير
          </span>
          <div className="flex items-center gap-1" role="radiogroup" aria-label={`حجم ${attachment.title} في التقرير`}>
            <button
              type="button"
              role="radio"
              aria-checked={!isOriginal}
              disabled={sizeBusy}
              onClick={() => onReportSizeChange('COMPACT')}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                !isOriginal ? 'border-primary bg-secondary text-secondary-foreground' : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              مصغّر
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={isOriginal}
              disabled={sizeBusy}
              onClick={() => onReportSizeChange('ORIGINAL')}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                isOriginal ? 'border-primary bg-secondary text-secondary-foreground' : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              أصلي
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** شريطا القياس القبلي والبعدي */
export function ImpactBars({
  pre,
  post,
  compact = false,
}: {
  pre: number
  post: number
  compact?: boolean
}) {
  const diff = Math.round((post - pre) * 10) / 10
  const width = (v: number) => `${Math.max(3, Math.min(100, v))}%`
  return (
    <div className={`rounded-xl border border-border bg-card ${compact ? 'p-3' : 'p-4'}`} dir="rtl">
      <div className="space-y-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">قبل التنفيذ</span>
            <span className="font-semibold tabular-nums text-muted-foreground">{pre}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-muted-foreground/35" style={{ width: width(pre) }} />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-foreground">بعد التنفيذ</span>
            <span className="font-semibold tabular-nums text-primary">{post}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary/10">
            <div
              className="h-full rounded-full bg-gradient-to-l from-[#12907c] to-[#0a5d51]"
              style={{ width: width(post) }}
            />
          </div>
        </div>
      </div>
      <div className="mt-3.5 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">
        <Icon name="TrendingUp" className="size-4" />
        <span className="text-xs font-semibold">
          نسبة التحسن: +{diff} <span className="text-emerald-600/80">نقطة مئوية</span>
        </span>
      </div>
    </div>
  )
}
