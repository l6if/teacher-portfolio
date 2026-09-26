'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession, useScope } from '@/hooks/use-data'
import { Icon } from '@/components/shared/icon'
import { LoadingState, ErrorState } from '@/components/shared/states'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface ProfileForm {
  name: string; school: string; subject: string; qualification: string
  experienceYears: string; stage: string; classes: string; licenseNumber: string; duties: string
}

const PROFILE_FIELDS: { key: keyof ProfileForm; label: string; placeholder?: string; type?: string }[] = [
  { key: 'name', label: 'الاسم الكامل', placeholder: 'الاسم الرباعي' },
  { key: 'school', label: 'المدرسة', placeholder: 'مثال: متوسطة الملك عبدالعزيز' },
  { key: 'subject', label: 'التخصص', placeholder: 'مثال: اللغة العربية' },
  { key: 'qualification', label: 'المؤهل العلمي', placeholder: 'مثال: بكالوريوس اللغة العربية' },
  { key: 'experienceYears', label: 'سنوات الخبرة', type: 'number', placeholder: '0' },
  { key: 'stage', label: 'المرحلة', placeholder: 'مثال: المرحلة المتوسطة' },
  { key: 'classes', label: 'الصفوف التي تدرسها', placeholder: 'مثال: أول متوسط (1، 3) — ثاني متوسط (2)' },
  { key: 'licenseNumber', label: 'الرخصة المهنية', placeholder: 'رقم الرخصة أو وصفها' },
  { key: 'duties', label: 'المهام المكلف بها', placeholder: 'مثال: معلم أول — مشرف ركن القراءة' },
]

type UserLike = NonNullable<ReturnType<typeof useSession>['data']>['user']

function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return null
  return (
    <span className="flex items-center gap-1.5 text-[11px] anim-fade-in" aria-live="polite">
      {state === 'saving' && (<><Icon name="Loader2" className="size-3.5 animate-spin text-muted-foreground" /><span className="text-muted-foreground">جارٍ الحفظ…</span></>)}
      {state === 'saved' && (<><Icon name="CheckCircle2" className="size-3.5 text-emerald-600" /><span className="text-emerald-700">تم الحفظ</span></>)}
      {state === 'error' && (<><Icon name="CircleAlert" className="size-3.5 text-destructive" /><span className="text-destructive">تعذر الحفظ — أعد المحاولة</span></>)}
    </span>
  )
}

/** حفظ تلقائي مشترك — يلتقط أحدث حالة عبر ref */
function useAutoSave(url: string, method: 'PUT' | 'PATCH', build: () => unknown, enabled: boolean) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const buildRef = useRef(build)
  buildRef.current = build
  const qc = useQueryClient()

  const trigger = () => {
    if (!enabled) return
    if (timer.current) clearTimeout(timer.current)
    setState('saving')
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildRef.current()),
        })
        if (!res.ok) throw new Error()
        setState('saved')
        qc.invalidateQueries({ queryKey: ['session'] })
        qc.invalidateQueries({ queryKey: ['dashboard'] })
        setTimeout(() => setState('idle'), 2200)
      } catch {
        setState('error')
        setTimeout(() => setState('idle'), 3000)
      }
    }, 1400)
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return { state, trigger }
}

function ProfileFieldsForm({ user }: { user: UserLike }) {
  const [form, setForm] = useState<ProfileForm>(() => ({
    name: user.name ?? '', school: user.school ?? '', subject: user.subject ?? '',
    qualification: user.qualification ?? '', experienceYears: user.experienceYears?.toString() ?? '',
    stage: user.stage ?? '', classes: user.classes ?? '', licenseNumber: user.licenseNumber ?? '', duties: user.duties ?? '',
  }))
  const auto = useAutoSave('/api/profile', 'PUT', () => form, true)

  const set = (key: keyof ProfileForm, value: string) => {
    const next = { ...form, [key]: value }
    setForm(next)
    auto.trigger()
  }

  const filled = PROFILE_FIELDS.filter((f) => form[f.key]?.trim()).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-gradient-to-l from-secondary/70 to-card p-5 anim-fade-up">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/12 text-xl font-bold text-primary">
            {form.name?.slice(0, 1) || 'م'}
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">{form.name || 'اسمك الكريم'}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {filled} من {PROFILE_FIELDS.length} حقولًا مكتملة — يُحفظ تلقائيًا أثناء الكتابة
            </p>
          </div>
        </div>
        <SaveIndicator state={auto.state} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROFILE_FIELDS.map((f) => (
          <div key={f.key} className={`space-y-1.5 ${f.key === 'classes' || f.key === 'duties' ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
            <label htmlFor={`pf-${f.key}`} className="text-sm font-medium text-foreground">{f.label}</label>
            <Input
              id={`pf-${f.key}`}
              dir="rtl"
              type={f.type === 'number' ? 'number' : 'text'}
              value={form[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="bg-card"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-secondary/50 px-4 py-3 text-xs leading-5 text-secondary-foreground">
        <Icon name="Info" className="size-4 shrink-0" />
        بياناتك المهنية تنتقل معك تلقائيًا إلى أي عام دراسي جديد تنشئه — لا تحتاج لإعادة إدخالها كل عام.
      </div>
    </div>
  )
}

export function ProfileSection({ readonly }: { readonly: boolean }) {
  const { data: session, isLoading, refetch } = useSession()
  const { viewUserId } = useScope()
  const [viewUser, setViewUser] = useState<UserLike | null>(null)

  useEffect(() => {
    if (!viewUserId) return
    let cancelled = false
    fetch(`/api/profile?userId=${viewUserId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.user) setViewUser(d.user) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [viewUserId])

  if (isLoading) return <LoadingState rows={2} />
  if (!session?.user) return <ErrorState message="تعذر تحميل بياناتك." onRetry={() => refetch()} />

  const user = viewUserId ? viewUser : session.user
  if (!user) return <LoadingState rows={1} />

  if (readonly) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROFILE_FIELDS.map((f) => (
          <div key={f.key} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] text-muted-foreground">{f.label}</p>
            <p className="mt-1.5 text-sm font-medium leading-6 text-foreground">{String((user as unknown as Record<string, unknown>)?.[f.key] ?? '') || '—'}</p>
          </div>
        ))}
      </div>
    )
  }

  return <ProfileFieldsForm key={user.id} user={user} />
}

interface ScheduleRow { day: string; grade: string; periods: string }
interface CommitteeRow { name: string; role: string }

function AssignmentFieldsForm({ user }: { user: UserLike }) {
  const [load, setLoad] = useState(() => user.weeklyLoad?.toString() ?? '')
  const [schedule, setSchedule] = useState<ScheduleRow[]>(() => {
    try { return user.schedule ? JSON.parse(user.schedule) : [] } catch { return [] }
  })
  const [committees, setCommittees] = useState<CommitteeRow[]>(() => {
    try { return user.committees ? JSON.parse(user.committees) : [] } catch { return [] }
  })
  const [extraDuties, setExtraDuties] = useState<string[]>(() => {
    try { return user.extraDuties ? JSON.parse(user.extraDuties) : [] } catch { return [] }
  })
  const auto = useAutoSave('/api/profile', 'PUT', () => ({ weeklyLoad: load, schedule, committees, extraDuties }), true)

  const setScheduleRow = (i: number, key: keyof ScheduleRow, value: string) => {
    setSchedule((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)))
    auto.trigger()
  }
  const setCommitteeRow = (i: number, key: keyof CommitteeRow, value: string) => {
    setCommittees((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)))
    auto.trigger()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-3xl border border-border bg-gradient-to-l from-secondary/70 to-card p-5 anim-fade-up">
        <div>
          <h3 className="text-sm font-bold">التكليف والنصاب</h3>
          <p className="mt-1 text-xs text-muted-foreground">يُحدّث تلقائيًا مع كل تعديل</p>
        </div>
        <SaveIndicator state={auto.state} />
      </div>

      {/* النصاب */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-primary">
              <Icon name="CalendarDays" className="size-5" strokeWidth={1.8} />
            </div>
            <div>
              <label htmlFor="weekly-load" className="text-sm font-medium">النصاب الأسبوعي</label>
              <p className="text-[11px] text-muted-foreground">عدد الحصص المكلف بها</p>
            </div>
          </div>
          <Input
            id="weekly-load"
            dir="ltr"
            type="number"
            className="w-28 bg-card text-center text-lg font-bold"
            value={load}
            onChange={(e) => { setLoad(e.target.value); auto.trigger() }}
            placeholder="0"
          />
          <span className="text-sm text-muted-foreground">حصة</span>
        </div>
      </div>

      {/* الجدول الدراسي */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-bold">
            <Icon name="CalendarDays" className="size-4 text-primary" />
            الجدول الدراسي
          </h4>
          <Button
            variant="outline" size="sm" className="gap-1.5 rounded-full"
            onClick={() => { setSchedule([...schedule, { day: '', grade: '', periods: '' }]); auto.trigger() }}
          >
            <Icon name="Plus" className="size-3.5" />
            إضافة صف
          </Button>
        </div>
        {schedule.length === 0 ? (
          <p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-xs text-muted-foreground">
            لا توجد صفوف في الجدول بعد — أضف أول صف لتوثيق جدولك.
          </p>
        ) : (
          <div className="space-y-2.5">
            {schedule.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1.2fr_1fr_auto] items-center gap-2">
                <Input dir="rtl" placeholder="اليوم" value={row.day} onChange={(e) => setScheduleRow(i, 'day', e.target.value)} className="bg-card text-sm" />
                <Input dir="rtl" placeholder="الصف" value={row.grade} onChange={(e) => setScheduleRow(i, 'grade', e.target.value)} className="bg-card text-sm" />
                <Input dir="rtl" placeholder="الحصص" value={row.periods} onChange={(e) => setScheduleRow(i, 'periods', e.target.value)} className="bg-card text-sm" />
                <button
                  onClick={() => { setSchedule(schedule.filter((_, idx) => idx !== i)); auto.trigger() }}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="حذف الصف"
                >
                  <Icon name="Trash2" className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* اللجان */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-bold">
            <Icon name="Users" className="size-4 text-primary" />
            اللجان
          </h4>
          <Button
            variant="outline" size="sm" className="gap-1.5 rounded-full"
            onClick={() => { setCommittees([...committees, { name: '', role: 'عضو' }]); auto.trigger() }}
          >
            <Icon name="Plus" className="size-3.5" />
            إضافة لجنة
          </Button>
        </div>
        {committees.length === 0 ? (
          <p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-xs text-muted-foreground">لا توجد لجان مسجلة بعد.</p>
        ) : (
          <div className="space-y-2.5">
            {committees.map((row, i) => (
              <div key={i} className="grid grid-cols-[1.6fr_1fr_auto] items-center gap-2">
                <Input dir="rtl" placeholder="اسم اللجنة" value={row.name} onChange={(e) => setCommitteeRow(i, 'name', e.target.value)} className="bg-card text-sm" />
                <Input dir="rtl" placeholder="الدور" value={row.role} onChange={(e) => setCommitteeRow(i, 'role', e.target.value)} className="bg-card text-sm" />
                <button
                  onClick={() => { setCommittees(committees.filter((_, idx) => idx !== i)); auto.trigger() }}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="حذف اللجنة"
                >
                  <Icon name="Trash2" className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* المهام الإضافية */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-bold">
            <Icon name="ClipboardList" className="size-4 text-primary" />
            المهام الإضافية
          </h4>
          <Button
            variant="outline" size="sm" className="gap-1.5 rounded-full"
            onClick={() => { setExtraDuties([...extraDuties, '']); auto.trigger() }}
          >
            <Icon name="Plus" className="size-3.5" />
            إضافة مهمة
          </Button>
        </div>
        {extraDuties.length === 0 ? (
          <p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-xs text-muted-foreground">لا توجد مهام إضافية مسجلة.</p>
        ) : (
          <div className="space-y-2.5">
            {extraDuties.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  dir="rtl" placeholder="المهمة" value={d} className="bg-card text-sm"
                  onChange={(e) => {
                    setExtraDuties(extraDuties.map((x, idx) => (idx === i ? e.target.value : x)))
                    auto.trigger()
                  }}
                />
                <button
                  onClick={() => { setExtraDuties(extraDuties.filter((_, idx) => idx !== i)); auto.trigger() }}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="حذف المهمة"
                >
                  <Icon name="Trash2" className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function AssignmentSection({ readonly }: { readonly: boolean }) {
  const { data: session, isLoading, refetch } = useSession()
  const { viewUserId } = useScope()
  const [viewUser, setViewUser] = useState<UserLike | null>(null)

  useEffect(() => {
    if (!viewUserId) return
    let cancelled = false
    fetch(`/api/profile?userId=${viewUserId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.user) setViewUser(d.user) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [viewUserId])

  if (isLoading) return <LoadingState rows={2} />
  if (!session?.user) return <ErrorState message="تعذر تحميل التكليف." onRetry={() => refetch()} />

  const user = viewUserId ? viewUser : session.user
  if (!user) return <LoadingState rows={1} />

  if (readonly) {
    let sch: ScheduleRow[] = [], com: CommitteeRow[] = [], ex: string[] = []
    try { sch = user.schedule ? JSON.parse(user.schedule) : [] } catch {}
    try { com = user.committees ? JSON.parse(user.committees) : [] } catch {}
    try { ex = user.extraDuties ? JSON.parse(user.extraDuties) : [] } catch {}
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">النصاب الأسبوعي</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
            {user.weeklyLoad ?? '—'} <span className="text-sm font-normal text-muted-foreground">حصة</span>
          </p>
        </div>
        {sch.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><th className="p-3 text-right font-medium">اليوم</th><th className="p-3 text-right font-medium">الصف</th><th className="p-3 text-right font-medium">الحصص</th></tr></thead>
              <tbody>{sch.map((r, i) => <tr key={i} className="border-b border-border/60 last:border-0"><td className="p-3 font-medium">{r.day}</td><td className="p-3 text-muted-foreground">{r.grade}</td><td className="p-3 text-muted-foreground">{r.periods}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {(com.length > 0 || ex.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {com.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-5">
                <p className="mb-3 text-xs font-semibold text-muted-foreground">اللجان</p>
                <div className="space-y-2">
                  {com.map((c, i) => (
                    <p key={i} className="text-sm"><span className="font-medium">{c.name}</span> <span className="text-muted-foreground">— {c.role}</span></p>
                  ))}
                </div>
              </div>
            )}
            {ex.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-5">
                <p className="mb-3 text-xs font-semibold text-muted-foreground">المهام الإضافية</p>
                <ul className="space-y-2">
                  {ex.map((d, i) => <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground"><Icon name="Check" className="size-3.5 text-primary" />{d}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return <AssignmentFieldsForm key={user.id} user={user} />
}
