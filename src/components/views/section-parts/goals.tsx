'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useGoals, useScope } from '@/hooks/use-data'
import { useApp } from '@/store/app-store'
import { Icon } from '@/components/shared/icon'
import { ProgressBar } from '@/components/shared/progress'
import { EmptyState, LoadingState, ErrorState } from '@/components/shared/states'
import { formatDateShort, formatNumber, toDateInput } from '@/lib/format'
import { SCOPE_LABELS } from '@/lib/constants'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { TGoal } from '@/lib/types'

function GoalDialog({ open, onOpenChange, goal }: { open: boolean; onOpenChange: (v: boolean) => void; goal: TGoal | null }) {
  const qc = useQueryClient()
  const { yearId } = useScope()
  const [form, setForm] = useState(() => ({
    title: goal?.title ?? '',
    description: goal?.description ?? '',
    indicator: goal?.indicator ?? '',
    targetValue: goal?.targetValue?.toString() ?? '',
    currentValue: goal?.currentValue?.toString() ?? '',
    startDate: toDateInput(goal?.startDate),
    endDate: toDateInput(goal?.endDate),
    scope: goal?.scope ?? 'YEAR',
  }))
  const [busy, setBusy] = useState(false)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.title.trim()) {
      toast.error('اكتب عنوان الهدف أولًا')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(goal ? `/api/goals/${goal.id}` : '/api/goals', {
        method: goal ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, yearId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await qc.invalidateQueries()
      onOpenChange(false)
      toast.success(goal ? 'تم تحديث الهدف' : 'تمت إضافة الهدف المهني')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر الحفظ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="dialog-sheet max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="text-right">
          <DialogTitle>{goal ? 'تعديل الهدف المهني' : 'هدف مهني جديد'}</DialogTitle>
          <DialogDescription>كلما كان مؤشر القياس واضحًا، سهُل إثبات الأثر لاحقًا في التقارير.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">عنوان الهدف</label>
            <Input dir="rtl" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="مثال: رفع مستوى إتقان مهارة القراءة" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">وصف الهدف</label>
            <Textarea dir="rtl" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="ما الذي تريد تحقيقه ولماذا؟" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">مؤشر القياس</label>
            <Input dir="rtl" value={form.indicator} onChange={(e) => set('indicator', e.target.value)} placeholder="مثال: نسبة إتقان مهارة القراءة في الاختبار البعدي" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">القيمة الحالية</label>
              <Input dir="ltr" type="number" value={form.currentValue} onChange={(e) => set('currentValue', e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">القيمة المستهدفة</label>
              <Input dir="ltr" type="number" value={form.targetValue} onChange={(e) => set('targetValue', e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">تاريخ البداية</label>
              <Input dir="ltr" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">تاريخ النهاية</label>
              <Input dir="ltr" type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">نطاق الهدف</label>
            <Select dir="rtl" value={form.scope} onValueChange={(v) => set('scope', v)}>
              <SelectTrigger dir="rtl" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="YEAR">{SCOPE_LABELS.YEAR}</SelectItem>
                <SelectItem value="TERM1">{SCOPE_LABELS.TERM1}</SelectItem>
                <SelectItem value="TERM2">{SCOPE_LABELS.TERM2}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button onClick={save} disabled={busy} className="gap-2">
            {busy ? <Icon name="Loader2" className="size-4 animate-spin" /> : <Icon name="Check" className="size-4" />}
            {goal ? 'حفظ التعديلات' : 'حفظ الهدف'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GoalsSection({ readonly }: { readonly: boolean }) {
  const { data, isLoading, error, refetch } = useGoals()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TGoal | null>(null)
  const qc = useQueryClient()
  const openForm = useApp((s) => s.openForm)

  if (isLoading) return <LoadingState rows={3} />
  if (error) return <ErrorState message="تعذر تحميل الأهداف." onRetry={() => refetch()} />

  const goals = data?.goals ?? []

  const remove = async (id: string) => {
    if (!confirm('هل تريد حذف هذا الهدف؟\nالإنجازات المرتبطة به ستبقى موجودة دون ارتباط.')) return
    const res = await fetch(`/api/goals/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await qc.invalidateQueries()
      toast.success('تم حذف الهدف')
    } else toast.error('تعذر الحذف')
  }

  if (goals.length === 0) {
    return (
      <EmptyState
        icon="Target"
        title="لا توجد أهداف مهنية بعد"
        description="الأهداف المهنية هي بوصلتك طوال العام — حدد ما تريد تحسينه، وسيرتبط بها كل إنجاز تضيفه لاحقًا تلقائيًا."
        actionLabel={readonly ? undefined : 'إضافة هدف مهني'}
        onAction={readonly ? undefined : () => { setEditing(null); setDialogOpen(true) }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {!readonly && (
        <div className="flex justify-end">
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="gap-2 rounded-full shadow-soft">
            <Icon name="Plus" className="size-4" />
            هدف جديد
          </Button>
        </div>
      )}

      {goals.map((g) => {
        const current = g.currentValue ?? 0
        const target = g.targetValue ?? 100
        const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
        return (
          <div key={g.id} className="anim-fade-up rounded-3xl border border-border bg-card p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3.5">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                  <Icon name="Target" className="size-5" strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold leading-6 text-foreground">{g.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">{SCOPE_LABELS[g.scope] ?? g.scope}</span>
                    {g.startDate && <span>من {formatDateShort(g.startDate)}</span>}
                    {g.endDate && <span>إلى {formatDateShort(g.endDate)}</span>}
                  </div>
                </div>
              </div>
              {!readonly && (
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditing(g); setDialogOpen(true) }} className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary" aria-label="تعديل الهدف">
                    <Icon name="Pencil" className="size-4" />
                  </button>
                  <button onClick={() => remove(g.id)} className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" aria-label="حذف الهدف">
                    <Icon name="Trash2" className="size-4" />
                  </button>
                </div>
              )}
            </div>

            {g.description && <p className="mt-3.5 text-[13px] leading-6 text-muted-foreground">{g.description}</p>}

            {g.indicator && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <Icon name="ClipboardCheck" className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">المؤشر: {g.indicator}</span>
              </div>
            )}

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {g.currentValue != null && g.targetValue != null
                    ? `${formatNumber(g.currentValue)} من ${formatNumber(g.targetValue)}`
                    : 'التقدم'}
                </span>
                <span className="font-bold tabular-nums text-primary">{pct}%</span>
              </div>
              <ProgressBar value={pct} />
            </div>

            {(g.achievements?.length ?? 0) > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Icon name="Link2" className="size-3.5" />
                  الإنجازات المرتبطة بهذا الهدف ({formatNumber(g.achievements?.length ?? 0)})
                </p>
                <div className="flex flex-wrap gap-2">
                  {g.achievements!.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => openForm({ achievementId: a.id })}
                      className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-[11px] transition-colors hover:border-primary/40 hover:bg-secondary"
                    >
                      <Icon name="BookOpen" className="size-3 text-primary" />
                      <span className="max-w-44 truncate">{a.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      <GoalDialog open={dialogOpen} onOpenChange={setDialogOpen} goal={editing} />
    </div>
  )
}
