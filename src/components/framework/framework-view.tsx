'use client'

// ═══ الإطار المهني — المجالات الرسمية الثلاثة + المخصص + محرك العرض ══════
// القسم 46/47: بطاقة الاكتمال الرسمي (X من الإجمالي) + بطاقات المجالات،
// القسم 26-28: فصل صارم بين الاكتمال الرسمي والاكتمال المخصص،
// القسم 39/41: شارة «يحتاج تصنيفًا» + الفلاتر (رسمي/مخصص/مكتمل/غير مكتمل).

import { useMemo, useState } from 'react'
import { useApp } from '@/store/app-store'
import { useFramework, useFrameworkManage } from '@/hooks/use-data'
import { Icon } from '@/components/shared/icon'
import { ProgressBar, ProgressRing } from '@/components/shared/progress'
import { LoadingState, ErrorState } from '@/components/shared/states'
import {
  FrameworkBadge, CompletionInfoHint, completionLabel,
} from './framework-badges'
import { FrameworkDomainDialog } from './framework-domain-dialog'
import { ItemFormDialog, type ItemFormTarget } from './framework-manage-dialogs'
import { COMPLETION_DISCLAIMER, COMPLETION_TOOLTIP } from '@/lib/official-framework-constants'
import { formatNumber } from '@/lib/format'
import type { TDomainNode } from '@/lib/types'

type FilterKey = 'all' | 'official' | 'custom' | 'completed' | 'incomplete'

const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'all', label: 'الكل', icon: 'LayoutGrid' },
  { key: 'official', label: 'رسمي', icon: 'BadgeCheck' },
  { key: 'custom', label: 'مخصص', icon: 'Puzzle' },
  { key: 'completed', label: 'مكتمل', icon: 'CheckCircle2' },
  { key: 'incomplete', label: 'غير مكتمل', icon: 'CircleDashed' },
]

/** تطبيق الفلتر على مجال: يُبقي المجال إن وافق أي جزء منه الفلتر */
function domainMatchesFilter(d: TDomainNode, filter: FilterKey): boolean {
  if (filter === 'all') return true
  if (filter === 'official') return d.isOfficial || d.criteria.some((c) => c.isOfficial)
  if (filter === 'custom') return !d.isOfficial || d.criteria.some((c) => !c.isOfficial)
  if (filter === 'completed') return d.completedSubs > 0
  return d.completedSubs < d.totalSubs
}

export function FrameworkView() {
  const { data, isLoading, error, refetch } = useFramework()
  const navigate = useApp((s) => s.navigate)
  const openForm = useApp((s) => s.openForm)
  const readonly = useApp((s) => s.viewUserId) !== null
  const [filter, setFilter] = useState<FilterKey>('all')
  const [openDomainId, setOpenDomainId] = useState<string | null>(null)
  const [formTarget, setFormTarget] = useState<ItemFormTarget | null>(null)

  const manage = useFrameworkManage()

  const visibleDomains = useMemo(() => {
    if (!data) return []
    return data.domains.filter((d) => domainMatchesFilter(d, filter))
  }, [data, filter])
  const officialDomains = useMemo(
    () => data?.domains.filter((d) => d.isOfficial && !d.archived) ?? [],
    [data],
  )
  const customDomains = useMemo(
    () => data?.domains.filter((d) => !d.isOfficial) ?? [],
    [data],
  )

  if (isLoading) return <LoadingState />
  if (error || !data) return <ErrorState message="تعذر تحميل الإطار المهني." onRetry={() => refetch()} />

  const openDomain = data.domains.find((d) => d.id === openDomainId) ?? null

  return (
    <div className="space-y-5">
      {/* ١ — الترويسة + المصدر الرسمي */}
      <div className="anim-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-[22px] font-bold tracking-tight text-foreground sm:text-[1.7rem]">
              الإطار المهني
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                <Icon name="BadgeCheck" className="size-3" strokeWidth={2.2} />
                رسمي
              </span>
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              {data.source.document} — {data.source.authority}
            </p>
          </div>
          <button
            onClick={() => navigate('portfolio')}
            className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-secondary/50"
          >
            <Icon name="FolderOpen" className="size-4" />
            ملف الإنجاز
          </button>
        </div>
      </div>

      {/* ٢ — بطاقة الاكتمال الرسمي + المجالات الثلاثة (القسم 46) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="anim-fade-up anim-delay-1 relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6 lg:col-span-4">
          <div className="pointer-events-none absolute -left-16 -top-16 size-44 rounded-full bg-primary/5 blur-2xl" />
          <div className="relative">
            <div className="mb-1 flex items-center gap-2">
              <Icon name="ScrollText" className="size-4.5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">الاكتمال المهني الرسمي</h2>
              <CompletionInfoHint />
            </div>
            <div className="flex justify-center py-1 sm:py-2">
              <ProgressRing value={data.official.percent} sublabel="رسمي" />
            </div>
            <p className="mt-3 text-center text-sm font-bold text-foreground">
              {formatNumber(data.official.completed)} من {formatNumber(data.official.total)} معيارًا فرعيًا
            </p>
            <p className="mt-1 text-center text-[11px] leading-5 text-muted-foreground">{COMPLETION_DISCLAIMER}</p>
          </div>
        </div>

        <div className="space-y-2.5 lg:col-span-8">
          {/* المجالات الثلاثة الرسمية */}
          {officialDomains.map((d) => (
            <button
              key={d.id}
              onClick={() => setOpenDomainId(d.id)}
              className="anim-fade-up anim-delay-1 flex w-full flex-wrap items-center gap-3 rounded-3xl border border-border bg-card p-4 text-right shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                <Icon name={domainIcon(d.sortOrder)} className="size-5.5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-foreground sm:text-base">{d.name}</span>
                  <FrameworkBadge isOfficial />
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {completionLabel('domain', d.completedSubs, d.totalSubs)}
                </span>
                <span className="mt-2 block max-w-sm">
                  <ProgressBar value={d.percent} thickness="h-1.5" />
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                {d.criteriaCount} معايير
                <Icon name="ChevronLeft" className="size-3.5" />
              </span>
            </button>
          ))}

          {/* إنجازات بانتظار التصنيف (القسم 39) — تصنّف من بطاقة الإنجاز نفسها */}
          {data.unmappedCount > 0 && (
            <div className="anim-fade-up flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Icon name="ClipboardList" className="size-4.5" strokeWidth={1.9} />
              </span>
              <p className="min-w-0 flex-1 text-xs leading-5 text-amber-900">
                <span className="font-bold">{formatNumber(data.unmappedCount)}</span> من إنجازاتك يحتاج تصنيفًا
                على المعايير — حدّد معيارها من بطاقة الإنجاز (زر «تحديد المعيار») لتُحسب في الاكتمال.
              </p>
            </div>
          )}

          {/* بطاقة المجالات المخصصة المستقلة (القسم 28) */}
          {data.custom && (
            <div className="anim-fade-up rounded-3xl border border-violet-200/60 bg-gradient-to-l from-violet-50/80 to-card p-4 shadow-soft sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                    <Icon name="Puzzle" className="size-5.5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground sm:text-base">المجالات المخصصة</h3>
                      <FrameworkBadge isOfficial={false} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatNumber(data.custom.completed)} من {formatNumber(data.custom.total)} متطلبات مكتملة — منفصلة عن النسبة الرسمية
                    </p>
                  </div>
                </div>
                <span className="text-lg font-bold tabular-nums text-violet-700">{formatNumber(data.custom.percent)}%</span>
              </div>
              <div className="mt-3">
                <ProgressBar value={data.custom.percent} thickness="h-1.5" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ٣ — الفلاتر (القسم 41) */}
      <div className="anim-fade-up anim-delay-2 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              filter === f.key
                ? 'border-primary bg-primary text-primary-foreground shadow-soft'
                : 'border-border bg-card text-foreground hover:border-primary/35 hover:bg-secondary/50'
            }`}
            aria-pressed={filter === f.key}
          >
            <Icon name={f.icon} className="size-3.5" strokeWidth={2.2} />
            {f.label}
          </button>
        ))}
        {data.unmappedCount > 0 && (
          <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50/80 px-3.5 text-xs font-semibold text-amber-800">
            <Icon name="ClipboardList" className="size-3.5" strokeWidth={2.2} />
            يحتاج تصنيفًا ({formatNumber(data.unmappedCount)})
          </span>
        )}
      </div>

      {/* ٤ — بطاقات المجالات (رسمية + مخصصة) (القسم 14) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleDomains.map((d, i) => (
          <button
            key={d.id}
            onClick={() => setOpenDomainId(d.id)}
            className={`anim-fade-up group flex flex-col rounded-3xl border p-5 text-right shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              d.isOfficial ? 'border-border bg-card' : 'border-violet-200/60 bg-card'
            } ${d.archived ? 'opacity-60' : ''}`}
            style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${d.isOfficial ? 'bg-secondary text-primary' : 'bg-violet-100 text-violet-700'}`}>
                <Icon name={d.isOfficial ? domainIcon(d.sortOrder) : 'Puzzle'} className="size-5.5" strokeWidth={1.8} />
              </span>
              <div className="flex flex-col items-end gap-1.5">
                <FrameworkBadge isOfficial={d.isOfficial} />
                {d.archived && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">مؤرشف</span>}
              </div>
            </div>
            <h3 className="mt-3 text-base font-bold leading-7 text-foreground">{d.name}</h3>
            {d.description && <p className="mt-1.5 line-clamp-2 text-[11px] leading-5 text-muted-foreground">{d.description}</p>}
            <div className="mt-3">
              <ProgressBar value={d.percent} thickness="h-1.5" />
              <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                {completionLabel('domain', d.completedSubs, d.totalSubs)}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {formatNumber(d.criteriaCount)} معايير · {formatNumber(d.totalSubs)} معايير فرعية
              </p>
            </div>
          </button>
        ))}

        {/* زر إضافة مجال مخصص (القسم 53) */}
        {data.canManage && (
          <button
            onClick={() => setFormTarget({ level: 'domain', mode: 'create' })}
            className="anim-fade-up flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-violet-200 bg-violet-50/30 p-5 text-center transition-all hover:-translate-y-1 hover:border-violet-300 hover:bg-violet-50/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <Icon name="Plus" className="size-6" strokeWidth={2.2} />
            </span>
            <span className="text-sm font-bold text-violet-800">إضافة مجال مخصص</span>
            <span className="max-w-[220px] text-[11px] leading-5 text-violet-700/80">
              مثل «الابتكار والتحول الرقمي» — يظهر لمدرستك فقط بشارة «مخصص»
            </span>
          </button>
        )}
      </div>

      {customDomains.length > 0 && (
        <p className="anim-fade-up rounded-2xl bg-muted/40 px-4 py-3 text-[11px] leading-5 text-muted-foreground">
          <Icon name="Info" className="ml-1 inline size-3.5 -translate-y-px" />
          المجالات والمعايير المخصصة خاصة بمدرستك ({data.schoolName ?? 'مدرستك'}) — لا تظهر لمدارس أخرى،
          ولا تدخل في النسبة الرسمية إطلاقًا. {COMPLETION_TOOLTIP}
        </p>
      )}

      {/* نافذة تفاصيل المجال */}
      <FrameworkDomainDialog
        domain={openDomain}
        canManage={data.canManage}
        onClose={() => setOpenDomainId(null)}
      />

      {/* نموذج إضافة مجال مخصص */}
      {formTarget && formTarget.mode === 'create' && formTarget.level === 'domain' && (
        <ItemFormDialog target={formTarget} onClose={() => setFormTarget(null)} />
      )}
    </div>
  )
}

/** أيقونة المجال الرسمي حسب ترتيبه */
function domainIcon(sortOrder: number): string {
  if (sortOrder === 1) return 'Landmark' // القيم والمسؤوليات المهنية
  if (sortOrder === 2) return 'BookOpen' // المعرفة المهنية
  return 'SquarePen' // الممارسة المهنية
}
