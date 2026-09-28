'use client'

// ═══ تفاصيل المجال: المعايير التابعة + صفوف المعايير الفرعية + إدارة المخصص ═══

import { useState } from 'react'
import { toast } from 'sonner'
import { Icon } from '@/components/shared/icon'
import { ProgressBar } from '@/components/shared/progress'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  FrameworkBadge, SubStatusIcon, AddAchievementButton, CompletionDetailsPopover,
  CompletionInfoHint, completionLabel,
} from './framework-badges'
import { ItemFormDialog, type ItemFormTarget } from './framework-manage-dialogs'
import { relTime } from '@/lib/format'
import { useFrameworkManage } from '@/hooks/use-data'
import { useApp } from '@/store/app-store'
import { COMPLETION_TOOLTIP } from '@/lib/official-framework-constants'
import type { TDomainNode, TCriterionNode } from '@/lib/types'

export function FrameworkDomainDialog({
  domain, canManage, onClose,
}: {
  domain: TDomainNode | null
  canManage: boolean
  onClose: () => void
}) {
  const manage = useFrameworkManage()
  const openForm = useApp((s) => s.openForm)
  const readonly = useApp((s) => s.viewUserId) !== null
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [formTarget, setFormTarget] = useState<ItemFormTarget | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ level: 'domain' | 'criterion' | 'subCriterion'; id: string; name: string } | null>(null)

  if (!domain) return null
  const isCustomDomain = !domain.isOfficial

  const doAction = async (payload: Record<string, unknown>, successMsg: string) => {
    try {
      await manage(payload)
      toast.success(successMsg)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر تنفيذ الإجراء')
    }
  }

  return (
    <Dialog open={!!domain} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        dir="rtl"
        className="scrollbar-slim flex max-h-[92dvh] w-full max-w-3xl flex-col gap-0 overflow-hidden bg-background p-0 sm:rounded-3xl"
      >
        {/* رأس المجال (القسم 14/47) */}
        <DialogHeader className="border-b border-border bg-card/70 px-5 pb-4 pt-5 text-right">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-lg font-bold leading-7">{domain.name}</DialogTitle>
                <FrameworkBadge isOfficial={domain.isOfficial} />
                {domain.archived && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">مؤرشف</span>
                )}
              </div>
              {domain.description && (
                <DialogDescription className="mt-1.5 max-w-xl text-xs leading-6">{domain.description}</DialogDescription>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted"
              aria-label="إغلاق"
            >
              <Icon name="X" className="size-4.5" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="font-semibold text-foreground">
                {completionLabel('domain', domain.completedSubs, domain.totalSubs)}
              </span>
              <CompletionInfoHint />
            </div>
            <span className="text-[11px] text-muted-foreground">
              {domain.criteriaCount} {domain.criteriaCount === 1 ? 'معيارًا' : 'معايير'} · {domain.totalSubs} {domain.totalSubs === 1 ? 'معيارًا فرعيًا' : 'معايير فرعية'}
            </span>
          </div>
          <div className="mt-2.5">
            <ProgressBar value={domain.percent} thickness="h-2" />
          </div>
        </DialogHeader>

        {/* المعايير (القسم 15) */}
        <div className="scrollbar-slim flex-1 space-y-2.5 overflow-y-auto bg-muted/20 px-4 py-4 sm:px-5">
          {domain.criteria.map((c) => {
            const cIsOpen = expanded[c.id] !== false
            const hasCustomSubs = c.subs.some((s) => !s.isOfficial)
            return (
              <section
                key={c.id}
                className={`overflow-hidden rounded-2xl border bg-card shadow-soft ${c.archived ? 'opacity-60' : ''}`}
              >
                {/* بطاقة المعيار (القسم 15) — div قابل للضغط وليس button:
                    بداخلها زر تفاصيل الاكتمال الحقيقي (button) ولا يجوز تداخل أزرار */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpanded((s) => ({ ...s, [c.id]: !cIsOpen }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setExpanded((s) => ({ ...s, [c.id]: !cIsOpen }))
                    }
                  }}
                  className="flex w-full cursor-pointer items-start gap-3 p-4 text-right transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  aria-expanded={cIsOpen}
                >
                  <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${c.isOfficial ? 'bg-secondary text-primary' : 'bg-violet-50 text-violet-700'}`}>
                    <Icon name={c.isOfficial ? 'ScrollText' : 'Puzzle'} className="size-4.5" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold leading-6 text-foreground">{c.name}</span>
                      <FrameworkBadge isOfficial={c.isOfficial} />
                      {c.officialCode && <span className="text-[10px] tabular-nums text-muted-foreground">{c.officialCode}</span>}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      <CompletionDetailsPopover
                        title={c.name}
                        completed={c.completedSubs}
                        total={c.totalSubs}
                        subs={c.subs}
                        criterion={c}
                        domain={domain}
                      />
                      <span aria-hidden="true">·</span>
                      <span>{c.subs.length} {c.subs.length === 1 ? 'فرعيًا' : 'فرعية'}</span>
                    </span>
                    <span className="mt-2 block max-w-xs">
                      <ProgressBar value={c.percent} thickness="h-1.5" />
                    </span>
                  </span>
                  <Icon
                    name="ChevronDown"
                    className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${cIsOpen ? '' : '-rotate-90'}`}
                  />
                </div>

                {/* صفوف المعايير الفرعية (القسم 16) */}
                {cIsOpen && (
                  <div className="border-t border-border/70 bg-card">
                    {c.subs.map((s) => (
                      <div
                        key={s.id}
                        className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/50 px-4 py-3 last:border-0 sm:flex-nowrap ${s.archived ? 'opacity-55' : ''}`}
                      >
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
                          <SubStatusIcon sub={s} />
                          <p className={`min-w-0 text-[13px] font-medium leading-5 ${s.completed ? 'text-foreground' : 'text-foreground/90'}`}>
                            {s.name}
                          </p>
                          {!s.isOfficial && <FrameworkBadge isOfficial={false} />}
                          {s.officialCode && (
                            <span className="text-[10px] tabular-nums text-muted-foreground">{s.officialCode}</span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-[10px] text-muted-foreground">
                          <span>{s.achievementsCount} {s.achievementsCount === 1 ? 'إنجاز' : 'إنجازات'}</span>
                          <span>{s.evidenceCount} {s.evidenceCount === 1 ? 'شاهد' : 'شواهد'}</span>
                          {s.lastUpdatedAt && <span className="hidden sm:inline">{relTime(s.lastUpdatedAt)}</span>}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {!s.completed && !s.archived && !readonly && (
                            <AddAchievementButton sub={s} criterion={c} domain={domain} />
                          )}
                          {!s.isOfficial && canManage && (
                            <ItemMenu
                              onEdit={() => setFormTarget({ level: 'subCriterion', mode: 'edit', id: s.id, name: s.name, description: s.description ?? '', parentLabel: c.name })}
                              onArchive={() => s.archived
                                ? doAction({ level: 'subCriterion', action: 'restore', id: s.id }, 'تمت الاستعادة')
                                : doAction({ level: 'subCriterion', action: 'archive', id: s.id }, 'تمت الأرشفة')}
                              onDelete={() => setConfirmDelete({ level: 'subCriterion', id: s.id, name: s.name })}
                              archived={s.archived}
                            />
                          )}
                        </div>
                      </div>
                    ))}

                    {/* إدارة المخصص داخل المعيار (القسم 55) — إدارة هيكل على مستوى
                        المدرسة: متاحة للمدير حتى أثناء تصفح ملف معلم (readonly للبيانات فقط) */}
                    {canManage && (
                      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/30 px-4 py-2.5">
                        <button
                          onClick={() => setFormTarget({ level: 'subCriterion', mode: 'create', criterionId: c.id, parentLabel: c.name })}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50/60 px-3 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-50"
                        >
                          <Icon name="Plus" className="size-3.5" strokeWidth={2.4} />
                          إضافة معيار فرعي مخصص
                        </button>
                        {hasCustomSubs && <span className="text-[10px] text-muted-foreground">المعايير المخصصة تحمل شارة «مخصص» ولا تدخل النسبة الرسمية</span>}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )
          })}

          {domain.criteria.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center">
              <Icon name="Puzzle" className="mx-auto size-7 text-border" strokeWidth={1.7} />
              <p className="mt-2.5 text-sm text-muted-foreground">لا توجد معايير في هذا المجال بعد</p>
              {canManage && (
                <button
                  onClick={() => setFormTarget({ level: 'criterion', mode: 'create', domainId: domain.id, parentLabel: domain.name })}
                  className="mt-3 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:shadow-lift"
                >
                  + إضافة معيار
                </button>
              )}
            </div>
          )}
        </div>

        {/* شريط إدارة المخصص للمجال (القسم 19-24/53-57) — هيكل المدرسة لا بيانات المعلم */}
        {canManage && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-card px-5 py-3">
            <button
              onClick={() => setFormTarget({ level: 'criterion', mode: 'create', domainId: domain.id, parentLabel: domain.name })}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-soft transition-all hover:shadow-lift"
            >
              <Icon name="Plus" className="size-4" strokeWidth={2.4} />
              {isCustomDomain ? 'إضافة معيار' : 'إضافة معيار مخصص داخل المجال الرسمي'}
            </button>
            {isCustomDomain && (
              <>
                <button
                  onClick={() => setFormTarget({ level: 'domain', mode: 'edit', id: domain.id, name: domain.name, description: domain.description ?? '' })}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  <Icon name="Pencil" className="size-3.5" strokeWidth={2} />
                  تعديل المجال
                </button>
                <button
                  onClick={() => domain.archived
                    ? doAction({ level: 'domain', action: 'restore', id: domain.id }, 'تمت الاستعادة')
                    : doAction({ level: 'domain', action: 'archive', id: domain.id }, 'تمت الأرشفة')}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  <Icon name={domain.archived ? 'ArchiveRestore' : 'Archive'} className="size-3.5" strokeWidth={2} />
                  {domain.archived ? 'استعادة' : 'أرشفة'}
                </button>
                <button
                  onClick={() => setConfirmDelete({ level: 'domain', id: domain.id, name: domain.name })}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-destructive/30 bg-card px-4 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/5"
                >
                  <Icon name="Trash2" className="size-3.5" strokeWidth={2} />
                  حذف المجال
                </button>
              </>
            )}
            <span className="mr-auto hidden text-[10px] leading-4 text-muted-foreground lg:block">
              {COMPLETION_TOOLTIP}
            </span>
          </div>
        )}
      </DialogContent>

      {/* نماذج الإضافة/التعديل */}
      {formTarget && (
        <ItemFormDialog
          target={formTarget}
          onClose={() => setFormTarget(null)}
        />
      )}

      {/* تأكيد الحذف — مع تحذير الإنجازات المرتبطة (القسم 24) */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => { if (!v) setConfirmDelete(null) }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>حذف «{confirmDelete?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              الحذف نهائي. إن كانت هناك إنجازات مرتبطة فسيُمنع الحذف ويُقترح الأرشفة —
              لن يُسمح بفقد أي إنجاز أو شاهد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel className="min-h-11">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDelete) return
                await doAction(
                  { level: confirmDelete.level, action: 'delete', id: confirmDelete.id },
                  'تم الحذف',
                )
                setConfirmDelete(null)
              }}
            >
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

/** قائمة إدارة عنصر مخصص (تعديل/أرشفة/حذف) */
function ItemMenu({
  onEdit, onArchive, onDelete, archived,
}: {
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
  archived: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted"
        aria-label="خيارات العنصر المخصص"
        aria-expanded={open}
      >
        <Icon name="MoreHorizontal" className="size-4" />
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden="true" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-50 w-40 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lift" role="menu">
            <button onClick={() => { setOpen(false); onEdit() }} className="flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs hover:bg-muted" role="menuitem">
              <Icon name="Pencil" className="size-3.5" /> تعديل
            </button>
            <button onClick={() => { setOpen(false); onArchive() }} className="flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs hover:bg-muted" role="menuitem">
              <Icon name={archived ? 'ArchiveRestore' : 'Archive'} className="size-3.5" /> {archived ? 'استعادة' : 'أرشفة'}
            </button>
            <button onClick={() => { setOpen(false); onDelete() }} className="flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs text-destructive hover:bg-destructive/5" role="menuitem">
              <Icon name="Trash2" className="size-3.5" /> حذف
            </button>
          </div>
        </>
      )}
    </div>
  )
}
