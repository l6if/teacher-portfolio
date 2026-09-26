'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApp } from '@/store/app-store'
import { useSession, useDashboard } from '@/hooks/use-data'
import { Icon } from '@/components/shared/icon'
import { toast } from 'sonner'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** مبدّل السنوات الدراسية + الأرشفة + إنشاء عام جديد */
export function YearSwitcher({ compact = false }: { compact?: boolean }) {
  const { data: session } = useSession()
  const viewUserId = useApp((s) => s.viewUserId)
  const { data: dashboard } = useDashboard()
  const yearId = useApp((s) => s.yearId)
  const setYear = useApp((s) => s.setYear)
  const qc = useQueryClient()
  const [newYearOpen, setNewYearOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const years = viewUserId ? (dashboard?.years ?? []) : (session?.years ?? [])
  const active = years.find((y) => y.id === (yearId ?? (viewUserId ? dashboard?.year?.id : session?.year?.id)))
  const canManage = !viewUserId

  const createYear = async () => {
    if (!label.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await qc.invalidateQueries()
      setYear(data.year.id)
      setNewYearOpen(false)
      setLabel('')
      toast.success('تم إنشاء العام الدراسي الجديد', {
        description: 'بياناتك المهنية الأساسية تنتقل معك تلقائيًا، وإنجازاتك السابقة تبقى في عامها.',
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر إنشاء العام')
    } finally {
      setBusy(false)
    }
  }

  const archiveYear = async () => {
    if (!active) return
    setBusy(true)
    try {
      const res = await fetch('/api/years', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yearId: active.id, archived: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await qc.invalidateQueries()
      setArchiveOpen(false)
      toast.success('تمت أرشفة ملف الإنجاز', {
        description: 'يبقى الملف قابلًا للعرض والتصدير في أي وقت من مبدّل السنوات.',
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذرت الأرشفة')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DropdownMenu dir="rtl">
        <DropdownMenuTrigger asChild>
          {compact ? (
            <button
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="تبديل العام الدراسي"
            >
              <Icon name="CalendarDays" className="size-3.5 shrink-0 text-primary" />
              <span className="max-w-24 truncate">{active?.label ?? 'العام'}</span>
              {active?.archived && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">مؤرشف</span>}
              <Icon name="ChevronDown" className="size-3 shrink-0 text-muted-foreground" />
            </button>
          ) : (
            <button
              className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="تبديل العام الدراسي"
            >
              <Icon name="CalendarDays" className="size-4 shrink-0 text-primary" />
              <span className="flex-1 text-right font-medium text-foreground">
                {active?.label ?? 'اختر العام'}
              </span>
              {active?.archived && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">مؤرشف</span>
              )}
              <Icon name="ChevronDown" className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={compact ? 'end' : 'start'} className="w-60">
          <DropdownMenuLabel className="text-xs text-muted-foreground">العام الدراسي</DropdownMenuLabel>
          {years.map((y) => (
            <DropdownMenuItem
              key={y.id}
              onClick={() => setYear(y.id === (viewUserId ? dashboard?.year?.id : session?.year?.id) ? null : y.id)}
              className="gap-2"
            >
              <Icon name={y.archived ? 'Archive' : 'CalendarDays'} className={`size-4 ${y.archived ? 'text-muted-foreground' : 'text-primary'}`} />
              <span className="flex-1">{y.label}</span>
              {y.archived && <span className="text-[10px] text-muted-foreground">مؤرشف</span>}
              {(y.id === (yearId ?? (viewUserId ? dashboard?.year?.id : session?.year?.id))) && <Icon name="Check" className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {canManage && <DropdownMenuItem onClick={() => setNewYearOpen(true)} className="gap-2">
            <Icon name="Plus" className="size-4 text-primary" />
            عام دراسي جديد
          </DropdownMenuItem>}
          {canManage && active && !active.archived && (
            <DropdownMenuItem onClick={() => setArchiveOpen(true)} className="gap-2">
              <Icon name="Archive" className="size-4 text-muted-foreground" />
              إنهاء وأرشفة هذا العام
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* عام جديد */}
      <Dialog open={newYearOpen} onOpenChange={setNewYearOpen}>
        <DialogContent dir="rtl" className="dialog-sheet sm:max-w-md">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>عام دراسي جديد</DialogTitle>
            <DialogDescription className="leading-6">
              يبدأ ملف إنجاز جديد من الصفر، وتبقى بياناتك المهنية الأساسية (المؤهل، التخصص، الخبرة) كما هي.
              إنجازات الأعوام السابقة لن تُحذف — يمكنك الرجوع إليها وتصديرها من مبدّل السنوات.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="year-label" className="text-sm font-medium">اسم العام الدراسي</label>
            <Input
              id="year-label"
              dir="rtl"
              placeholder="مثال: 1449هـ"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createYear()}
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button onClick={createYear} disabled={busy || !label.trim()} className="gap-2">
              {busy ? <Icon name="Loader2" className="size-4 animate-spin" /> : <Icon name="Plus" className="size-4" />}
              إنشاء العام
            </Button>
            <Button variant="outline" onClick={() => setNewYearOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* أرشفة */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent dir="rtl" className="dialog-sheet sm:max-w-md">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>إنهاء وأرشفة ملف الإنجاز؟</DialogTitle>
            <DialogDescription className="leading-6">
              سيُؤرشف ملف «{active?.label}» كاملًا. يبقى الملف قابلًا للعرض والتصدير في أي وقت،
              ولن تتمكن من إضافة إنجازات جديدة فيه. يمكنك بعدها إنشاء ملف للعام التالي.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="destructive" onClick={archiveYear} disabled={busy} className="gap-2">
              {busy ? <Icon name="Loader2" className="size-4 animate-spin" /> : <Icon name="Archive" className="size-4" />}
              نعم، أرشف الملف
            </Button>
            <Button variant="outline" onClick={() => setArchiveOpen(false)}>تراجع</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
