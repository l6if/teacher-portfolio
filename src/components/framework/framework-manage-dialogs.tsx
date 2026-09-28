'use client'

// ═══ نماذج إضافة/تعديل عناصر الهيكل المخصص (مجال/معيار/معيار فرعي) ═════
// القسم 53/54/55: اسم + وصف اختياري + ترتيب عرض. العناصر المنشأة هنا
// مخصصة (isOfficial=false) دائمًا — لا يمكن إنشاء رسمي من الواجهة.

import { useState } from 'react'
import { toast } from 'sonner'
import { Icon } from '@/components/shared/icon'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useFrameworkManage } from '@/hooks/use-data'

export interface ItemFormTarget {
  level: 'domain' | 'criterion' | 'subCriterion'
  mode: 'create' | 'edit'
  id?: string
  name?: string
  description?: string
  domainId?: string
  criterionId?: string
  parentLabel?: string
}

const LEVEL_NOUN: Record<ItemFormTarget['level'], string> = {
  domain: 'مجال',
  criterion: 'معيار',
  subCriterion: 'معيار فرعي',
}

/** صيغة المعرفة للرسائل: «المجال المخصص» / «المعيار المخصص» / «المعيار الفرعي المخصص» */
const LEVEL_NOUN_DEF: Record<ItemFormTarget['level'], string> = {
  domain: 'المجال',
  criterion: 'المعيار',
  subCriterion: 'المعيار الفرعي',
}

export function ItemFormDialog({
  target, onClose,
}: {
  target: ItemFormTarget
  onClose: () => void
}) {
  const manage = useFrameworkManage()
  const [name, setName] = useState(target.name ?? '')
  const [description, setDescription] = useState(target.description ?? '')
  const [busy, setBusy] = useState(false)
  const noun = LEVEL_NOUN[target.level]
  const isEdit = target.mode === 'edit'

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('الاسم مطلوب')
      return
    }
    setBusy(true)
    try {
      const payload: Record<string, unknown> =
        isEdit
          ? { level: target.level, action: 'update', id: target.id, name: trimmed, description }
          : { level: target.level, action: 'create', name: trimmed, description, ...(target.domainId ? { domainId: target.domainId } : {}), ...(target.criterionId ? { criterionId: target.criterionId } : {}) }
      await manage(payload)
      toast.success(isEdit ? `تم تعديل ${LEVEL_NOUN_DEF[target.level]} المخصص` : `تمت إضافة ${LEVEL_NOUN_DEF[target.level]} المخصص`)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `تعذر ${isEdit ? 'تعديل' : 'إضافة'} ${LEVEL_NOUN_DEF[target.level]} المخصص`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose() }}>
      <DialogContent dir="rtl" className="w-full max-w-md bg-background p-0 sm:rounded-3xl">
        <DialogHeader className="border-b border-border bg-card/70 px-5 pb-4 pt-5 text-right">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <Icon name="Puzzle" className="size-4.5" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base leading-6">
                {isEdit ? `تعديل ${noun} المخصص` : `إضافة ${noun} مخصص`}
              </DialogTitle>
              {target.parentLabel && !isEdit && (
                <DialogDescription className="mt-0.5 text-xs">
                  ضمن: {target.parentLabel} — سيحمل شارة «مخصص»
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 py-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              اسم {noun} <span className="text-destructive">*</span>
            </label>
            <Input
              dir="rtl"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                target.level === 'domain'
                  ? 'مثال: الابتكار والتحول الرقمي'
                  : target.level === 'criterion'
                    ? 'مثال: التوظيف المتقدم للتقنيات التعليمية'
                    : 'مثال: تنظيم معارض الأعمال الطلابية'
              }
              maxLength={200}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              وصف <span className="text-[11px] font-normal text-muted-foreground">(اختياري)</span>
            </label>
            <Textarea
              dir="rtl"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف مختصر يوضح نطاق هذا العنصر…"
              className="resize-none"
            />
          </div>
          <p className="rounded-2xl bg-muted/50 px-3.5 py-3 text-[11px] leading-5 text-muted-foreground">
            العناصر المخصصة تخص مدرستك فقط ولا تؤثر في النسبة الرسمية — تُحسب في بطاقة
            «المجالات المخصصة» المستقلة.
          </p>
        </div>

        <DialogFooter className="flex-row-reverse gap-2 border-t border-border bg-card/70 px-5 py-4">
          <Button onClick={submit} disabled={busy} className="min-h-11 flex-1 bg-primary text-primary-foreground sm:flex-none sm:px-6">
            {busy ? <Icon name="Loader2" className="size-4 animate-spin" /> : <Icon name="Check" className="size-4" strokeWidth={2.4} />}
            {isEdit ? 'حفظ التعديل' : 'حفظ'}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={busy} className="min-h-11 flex-1 border-border sm:flex-none sm:px-6">
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
