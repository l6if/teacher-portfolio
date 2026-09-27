'use client'

/**
 * منتقي التاريخ الهجري — أم القرى
 * ────────────────────────────────
 * تجربة موحدة لكل حقول التاريخ في التطبيق:
 * زر يعرض القيمة هجريًا («15 ربيع الآخر 1448 هـ») يفتح نافذة «اختر التاريخ»
 * بثلاث خانات (اليوم | الشهر | السنة) وبطاقة معاينة وأزرار تعيين/إلغاء.
 *
 * التخزين: القيمة الداخلة والخارجة ISO «YYYY-MM-DD» — كما يخزنها النظام.
 * التحويل كله عبر الأداة المركزية src/lib/hijri.ts (لا منطق تحويل هنا).
 *
 * سطح المكتب: Dialog صغيرة أنيقة — الجوال: Bottom Sheet (dialog-sheet).
 */

import { useMemo, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/shared/icon'
import {
  HIJRI_MONTHS, hijriToday, storedToHijri, hijriMonthLength, hijriToISOInput,
  hijriYearOptions, isValidHijri,
} from '@/lib/hijri'

interface HijriDateFieldProps {
  /** القيمة المخزنة ISO «YYYY-MM-DD» أو '' */
  value: string
  onChange: (iso: string) => void
  disabled?: boolean
  placeholder?: string
  id?: string
  'aria-label'?: string
}

/** زر الحقل — يشبه Input لكن يعرض التاريخ هجريًا */
export function HijriDateField({ value, onChange, disabled, placeholder = 'اختر التاريخ', id, ...rest }: HijriDateFieldProps) {
  const [open, setOpen] = useState(false)
  const display = useMemo(() => {
    if (!value) return ''
    const h = storedToHijri(value)
    return h ? `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year} هـ` : ''
  }, [value])

  return (
    <>
      <button
        type="button"
        id={id}
        dir="rtl"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-3.5 py-2 text-right text-sm text-foreground shadow-xs transition-all hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-[empty]:text-muted-foreground"
        data-empty={display ? undefined : ''}
        aria-label={rest['aria-label'] ?? 'اختيار التاريخ الهجري'}
      >
        <span className={`truncate ${display ? '' : 'text-muted-foreground'}`}>
          {display || placeholder}
        </span>
        <Icon name="CalendarDays" className="size-4 shrink-0 text-primary" strokeWidth={1.8} />
      </button>

      {/* يُركَّب عند الفتح فقط — تُهيَّأ الحالة من القيمة المحفوظة أو تاريخ اليوم */}
      {open && (
        <HijriDatePickerDialog
          open={open}
          onOpenChange={(v) => { if (!v) setOpen(false) }}
          value={value}
          onPick={onChange}
        />
      )}
    </>
  )
}

/* ─────────────────────────── النافذة ─────────────────────────── */

function HijriDatePickerDialog({
  open, onOpenChange, value, onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  onPick: (iso: string) => void
}) {
  // الحالة الابتدائية: القيمة المحفوظة إن وجدت، وإلا تاريخ اليوم الهجري
  const [{ day, month, year }] = useState(() => {
    const base = (value && storedToHijri(value)) || hijriToday()
    return { day: base.day, month: base.month, year: base.year }
  })
  const [sel, setSel] = useState({ day, month, year })

  const monthLen = useMemo(() => hijriMonthLength(sel.year, sel.month), [sel.year, sel.month])
  const days = useMemo(() => Array.from({ length: monthLen }, (_, i) => i + 1), [monthLen])
  const years = useMemo(() => hijriYearOptions(sel.year), [sel.year])

  const valid = isValidHijri(sel.year, sel.month, sel.day)
  const preview = `${sel.day} ${HIJRI_MONTHS[sel.month - 1]} ${sel.year} هـ`

  // تغيير الشهر/السنة يقصّ اليوم تلقائيًا إلى طول الشهر الجديد (أم القرى)
  const handleMonth = (m: string) => {
    const nm = Number(m)
    setSel((s) => ({ ...s, month: nm, day: Math.min(s.day, hijriMonthLength(s.year, nm)) }))
  }
  const handleYear = (y: string) => {
    const ny = Number(y)
    setSel((s) => ({ ...s, year: ny, day: Math.min(s.day, hijriMonthLength(ny, s.month)) }))
  }

  const confirm = () => {
    const iso = hijriToISOInput(sel.year, sel.month, sel.day)
    if (!iso) return
    onPick(iso)
    onOpenChange(false)
  }

  const selCls = 'h-11 w-full min-w-0 rounded-xl border border-input bg-card text-sm font-medium shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&>span]:min-w-0 [&>span]:truncate [&>span]:text-right [&>span]:font-semibold'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* الجوال: Bottom Sheet مثبتة بجوانب الشاشة كاملة (left/right/bottom = 0، بلا أي translate)
          — تجاوز صريح لقواعد الـ Dialog المتمركز الموروثة (left-[50%] + translate-x-[-50%])
          لأن تعليمة translate:none في .dialog-sheet يُسقطها مُجمِّع CSS، فنحيد الإزاحة من الطبقة نفسها.
          سطح المكتب (sm:): يعود مودالًا متمركزًا كما كان تمامًا. */}
      <DialogContent dir="rtl" className="dialog-sheet left-0 right-0 bottom-0 top-auto translate-x-0 translate-y-0 max-w-[calc(100vw-2rem)] p-0 sm:left-[50%] sm:right-auto sm:bottom-auto sm:top-[20%] sm:max-w-md sm:translate-x-[-50%] sm:translate-y-0">
        <div className="p-5 sm:p-6">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg font-bold">اختر التاريخ</DialogTitle>
            <DialogDescription className="flex items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-primary">
                <Icon name="MoonStar" className="size-3.5" strokeWidth={2} />
                هجري
              </span>
              <span className="text-xs text-muted-foreground">تقويم أم القرى</span>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="min-w-0 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">اليوم</label>
              <Select dir="rtl" value={String(sel.day)} onValueChange={(v) => setSel((s) => ({ ...s, day: Number(v) }))}>
                <SelectTrigger dir="rtl" className={selCls}><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl" className="max-h-64">
                  {days.map((d) => (
                    <SelectItem key={d} value={String(d)} className="h-10 text-sm font-semibold">{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">الشهر</label>
              <Select dir="rtl" value={String(sel.month)} onValueChange={handleMonth}>
                <SelectTrigger dir="rtl" className={selCls}><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl" className="max-h-64">
                  {HIJRI_MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)} className="h-10 text-sm font-semibold">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">السنة</label>
              <Select dir="rtl" value={String(sel.year)} onValueChange={handleYear}>
                <SelectTrigger dir="rtl" className={selCls}><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl" className="max-h-64">
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)} className="h-10 text-sm font-semibold">{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* بطاقة المعاينة */}
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-secondary/60 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">التاريخ المحدد</p>
              <p className="mt-0.5 text-base font-bold text-primary tabular-nums" aria-live="polite">{preview}</p>
            </div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon name="CalendarDays" className="size-5" strokeWidth={1.8} />
            </span>
          </div>

          <DialogFooter className="mt-5 flex-row gap-2.5 sm:justify-start" dir="rtl">
            <Button onClick={confirm} disabled={!valid} className="min-h-11 flex-1 gap-2 rounded-full text-sm font-bold sm:flex-none sm:px-8">
              <Icon name="Check" className="size-4" />
              تعيين
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-11 flex-1 rounded-full text-sm font-semibold sm:flex-none sm:px-8">
              إلغاء
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
