'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDevPlans, useScope } from '@/hooks/use-data'
import { Icon } from '@/components/shared/icon'
import { EmptyState, LoadingState, ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { TDevPlan } from '@/lib/types'

function PlanDialog({ open, onOpenChange, plan }: { open: boolean; onOpenChange: (v: boolean) => void; plan: TDevPlan | null }) {
  const qc = useQueryClient()
  const { yearId } = useScope()
  const [form, setForm] = useState(() => ({
    goal: plan?.goal ?? '',
    action: plan?.action ?? '',
    period: plan?.period ?? '',
    indicator: plan?.indicator ?? '',
    result: plan?.result ?? '',
  }))
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.goal.trim()) {
      toast.error('اكتب الهدف التطويري أولًا')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(plan ? `/api/devplan/${plan.id}` : '/api/devplan', {
        method: plan ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, yearId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await qc.invalidateQueries()
      onOpenChange(false)
      toast.success(plan ? 'تم تحديث الخطة' : 'تمت إضافة البند لخطتك التطويرية')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر الحفظ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="text-right">
          <DialogTitle>{plan ? 'تعديل بند الخطة' : 'بند جديد في الخطة التطويرية'}</DialogTitle>
          <DialogDescription>ابنِ خطتك من تأملك المهني — هدف واضح وإجراء قابل للتنفيذ.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">الهدف التطويري</label>
            <Input dir="rtl" value={form.goal} onChange={(e) => set('goal', e.target.value)} placeholder="مثال: إتقان تحليل بيانات التقويم الرقمي" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">الإجراء</label>
            <Textarea dir="rtl" rows={2} value={form.action} onChange={(e) => set('action', e.target.value)} placeholder="ماذا ستفعل تحديدًا؟" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">الفترة</label>
              <Input dir="rtl" value={form.period} onChange={(e) => set('period', e.target.value)} placeholder="الفصل الثاني" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">مؤشر النجاح</label>
              <Input dir="rtl" value={form.indicator} onChange={(e) => set('indicator', e.target.value)} placeholder="كيف تعرف أنك نجحت؟" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">النتيجة (تُستكمل لاحقًا)</label>
            <Input dir="rtl" value={form.result} onChange={(e) => set('result', e.target.value)} placeholder="اختياري — يُملأ عند التنفيذ" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button onClick={save} disabled={busy} className="gap-2">
            {busy ? <Icon name="Loader2" className="size-4 animate-spin" /> : <Icon name="Check" className="size-4" />}
            حفظ
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DevPlanSection({ readonly }: { readonly: boolean }) {
  const { data, isLoading, error, refetch } = useDevPlans()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TDevPlan | null>(null)
  const qc = useQueryClient()

  if (isLoading) return <LoadingState rows={2} />
  if (error) return <ErrorState message="تعذر تحميل الخطة التطويرية." onRetry={() => refetch()} />

  const plans = data?.plans ?? []

  const remove = async (id: string) => {
    if (!confirm('هل تريد حذف هذا البند من خطتك التطويرية؟')) return
    const res = await fetch(`/api/devplan/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await qc.invalidateQueries()
      toast.success('تم الحذف')
    } else toast.error('تعذر الحذف')
  }

  if (plans.length === 0) {
    return (
      <EmptyState
        icon="Map"
        title="خطتك التطويرية فارغة حتى الآن"
        description="أجاب تأملك المهني عن أربعة أسئلة — حوّلها الآن إلى أهداف تطويرية ببند واحد لكل اتجاه تريد تطويره."
        actionLabel={readonly ? undefined : 'إضافة بند للخطة'}
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
            بند جديد
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((p, i) => (
          <div key={p.id} className={`anim-fade-up anim-delay-${Math.min(i + 1, 4)} relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-soft`}>
            <span className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-primary to-primary/20" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{i + 1}</span>
                <h3 className="text-[15px] font-bold leading-6 text-foreground">{p.goal}</h3>
              </div>
              {!readonly && (
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditing(p); setDialogOpen(true) }} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary" aria-label="تعديل">
                    <Icon name="Pencil" className="size-4" />
                  </button>
                  <button onClick={() => remove(p.id)} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" aria-label="حذف">
                    <Icon name="Trash2" className="size-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2.5 text-[13px]">
              {p.action && (
                <div className="flex gap-2.5">
                  <Icon name="Send" className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p className="leading-6 text-muted-foreground">{p.action}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-[11px]">
                {p.period && (
                  <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                    <Icon name="CalendarDays" className="size-3" />
                    {p.period}
                  </span>
                )}
                {p.indicator && (
                  <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                    <Icon name="ClipboardCheck" className="size-3" />
                    {p.indicator}
                  </span>
                )}
              </div>
              {p.result && (
                <div className="rounded-xl bg-emerald-50/80 px-3 py-2.5 text-emerald-800">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                    <Icon name="CheckCircle2" className="size-3.5" />
                    النتيجة
                  </span>
                  <p className="mt-1 leading-6">{p.result}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <PlanDialog open={dialogOpen} onOpenChange={setDialogOpen} plan={editing} />
    </div>
  )
}
