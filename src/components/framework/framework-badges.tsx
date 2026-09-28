'use client'

// ═══ شارات الإطار المهني المشتركة (رسمي/مخصص + الحالات + تفاصيل الاكتمال) ═══

import { useState } from 'react'
import { Icon } from '@/components/shared/icon'
import { ProgressBar } from '@/components/shared/progress'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  COMPLETION_TOOLTIP, COMPLETION_DISCLAIMER,
} from '@/lib/official-framework-constants'
import type { TCriterionNode, TDomainNode, TSubCriterionNode } from '@/lib/types'
import { useApp } from '@/store/app-store'

/** شارة «رسمي» — لون هادئ (القسم 42) */
export function OfficialBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70 ${compact ? '' : 'shrink-0'}`}>
      <Icon name="BadgeCheck" className="size-3" strokeWidth={2.2} />
      رسمي
    </span>
  )
}

/** شارة «مخصص» — لون مختلف ومميز (القسم 22/42) */
export function CustomBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200/70 ${compact ? '' : 'shrink-0'}`}>
      <Icon name="Puzzle" className="size-3" strokeWidth={2.2} />
      مخصص
    </span>
  )
}

/** شارة النوع حسب isOfficial */
export function FrameworkBadge({ isOfficial }: { isOfficial: boolean }) {
  return isOfficial ? <OfficialBadge /> : <CustomBadge />
}

/** رمز حالة المعيار الفرعي (القسم 16): ✓ مكتمل / ○ يحتاج توثيق / ◐ قيد العمل */
export function SubStatusIcon({ sub }: { sub: TSubCriterionNode }) {
  if (sub.archived) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon name="Archive" className="size-4" strokeWidth={2} />
        مؤرشف
      </span>
    )
  }
  if (sub.completed) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
        <Icon name="CheckCircle2" className="size-4" strokeWidth={2.2} />
        مكتمل
      </span>
    )
  }
  if (sub.completedNoEvidence || sub.achievementsCount > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
        <Icon name="FileCheck2" className="size-4" strokeWidth={2.2} />
        {sub.completedNoEvidence ? 'يحتاج توثيقًا' : 'قيد العمل'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="flex size-4 items-center justify-center rounded-full border-2 border-muted-foreground/30" aria-hidden="true" />
      لم يوثق بعد
    </span>
  )
}

/** نص الشارة القياسي — «اكتمال المجال 80% — 4 من 5 معايير فرعية» (القسم 11) */
export function completionLabel(level: 'domain' | 'criterion' | 'official' | 'custom', completed: number, total: number) {
  const pct = total <= 0 ? 0 : Math.round((completed / total) * 100)
  const noun = level === 'domain' ? 'المجال' : level === 'criterion' ? 'المعيار' : level === 'official' ? 'الاكتمال الرسمي' : 'المخصص'
  return `اكتمال ${noun} ${pct}% — ${completed} من ${total} ${total === 1 ? 'معيار فرعي' : 'معايير فرعية'}`
}

/** زر إضافة إنجاز لمعيار فرعي — يفتح نموذج الإنجاز معبأ التصنيف (القسم 13) */
export function AddAchievementButton({
  sub, criterion, domain, size = 'sm',
}: {
  sub: TSubCriterionNode
  criterion: TCriterionNode
  domain: TDomainNode
  size?: 'sm' | 'md'
}) {
  const openForm = useApp((s) => s.openForm)
  return (
    <button
      onClick={() => openForm({ subCriterionId: sub.id, domainName: domain.name, criterionName: criterion.name, subName: sub.name })}
      className={`inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/5 font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
        size === 'sm' ? 'min-h-9 px-3 text-[11px]' : 'min-h-11 px-4 text-xs'
      }`}
    >
      <Icon name="Plus" className={size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={2.4} />
      إضافة إنجاز لهذا المعيار
    </button>
  )
}

/** أيقونة معلومات النسبة — Tooltip بطريقة الحساب (القسم 44) */
export function CompletionInfoHint() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="كيف تُحسب النسبة؟"
        >
          <Icon name="Info" className="size-3.5" strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-72 text-right" dir="rtl">
        <p className="text-xs leading-6 text-foreground">{COMPLETION_TOOLTIP}</p>
        <p className="mt-2 border-t border-border pt-2 text-[11px] leading-5 text-muted-foreground">{COMPLETION_DISCLAIMER}</p>
      </PopoverContent>
    </Popover>
  )
}

/**
 * تفاصيل الاكتمال القابلة للضغط (القسم 12): Popover يشرح المكتمل والناقص،
 * مع زر «إضافة إنجاز لهذا المعيار» لكل متطلب غير مكتمل.
 */
export function CompletionDetailsPopover({
  title, completed, total, subs, criterion, domain, showHeader = true,
}: {
  title: string
  completed: number
  total: number
  subs: TSubCriterionNode[]
  criterion?: TCriterionNode
  domain: TDomainNode
  showHeader?: boolean
}) {
  const [open, setOpen] = useState(false)
  const pct = total <= 0 ? 0 : Math.round((completed / total) * 100)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="min-h-9 rounded-xl px-1 text-xs font-semibold text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label={completionLabel('criterion', completed, total)}
        >
          {completed} من {total} معايير فرعية · {pct}%
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-80 p-0 text-right" dir="rtl">
        <div className="border-b border-border bg-muted/40 px-4 py-3">
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            اكتملت <span className="font-bold text-primary">{completed}</span> من أصل <span className="font-bold">{total}</span> {total === 1 ? 'معيار فرعي' : 'معايير فرعية'}
          </p>
          <div className="mt-2"><ProgressBar value={pct} thickness="h-1.5" /></div>
        </div>
        <ul className="max-h-72 overflow-y-auto scrollbar-slim px-2 py-2">
          {subs.map((s) => (
            <li key={s.id} className="rounded-xl px-2.5 py-2 transition-colors hover:bg-muted/50">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0">
                  {s.completed ? (
                    <Icon name="CheckCircle2" className="size-4 text-emerald-600" strokeWidth={2.2} />
                  ) : (
                    <span className="flex size-4 items-center justify-center rounded-full border-2 border-muted-foreground/25" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs leading-5 ${s.completed ? 'text-foreground' : 'text-muted-foreground'}`}>{s.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <FrameworkBadge isOfficial={s.isOfficial} />
                    {s.achievementsCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {s.achievementsCount} {s.achievementsCount === 1 ? 'إنجاز' : 'إنجازات'} · {s.evidenceCount} {s.evidenceCount === 1 ? 'شاهد' : 'شواهد'}
                      </span>
                    )}
                    {!s.completed && criterion && !s.archived && (
                      <AddAchievementButton sub={s} criterion={criterion} domain={domain} />
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
          {subs.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">لا توجد معايير فرعية بعد</li>
          )}
        </ul>
        {showHeader && (
          <p className="border-t border-border px-4 py-2.5 text-[10px] leading-4 text-muted-foreground">{COMPLETION_DISCLAIMER}</p>
        )}
      </PopoverContent>
    </Popover>
  )
}
