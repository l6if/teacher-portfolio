'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApp } from '@/store/app-store'
import { useScope, useAchievements, useSession } from '@/hooks/use-data'
import { TYPES, TYPE_MAP, TYPE_FIELDS, STATUS_META, type AchievementType, type AchievementStatus } from '@/lib/constants'
import { Icon } from '@/components/shared/icon'
import { AiAssistButton, type AiAssistContext } from '@/components/shared/ai-assist'
import { AttachmentsEditor } from './attachments-editor'
import { HijriDateField } from '@/components/shared/hijri-date-picker'
import { improvement, formatNumber, toDateInput } from '@/lib/format'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { TAttachment, TAchievement } from '@/lib/types'

type FormState = Record<string, string>

const STATUS_OPTIONS: AchievementStatus[] = ['DRAFT', 'NEEDS_WORK', 'COMPLETED', 'APPROVED']

/** شاشة اختيار النوع — الخطوة الأولى */
function TypePicker({ onPick }: { onPick: (t: AchievementType) => void }) {
  return (
    <div className="anim-fade-in">
      <div className="mb-5 text-center">
        <h3 className="text-lg font-bold text-foreground">ماذا تريد أن توثق؟</h3>
        <p className="mt-1 text-sm text-muted-foreground">اختر النوع وستظهر لك الحقول المناسبة فقط — لا نماذج طويلة.</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => onPick(t.key)}
            className="group flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-card p-4 text-center transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon name={t.icon} className="size-5.5" strokeWidth={1.8} />
            </span>
            <span className="text-sm font-semibold text-foreground">{t.label}</span>
            <span className="text-[10px] leading-4 text-muted-foreground">{t.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** سجل إجراءات المساعد لكل حقل — لا تُعرض كل الخيارات في كل حقل */
const FIELD_AI_ACTIONS: Record<string, { action: string; label: string; needsText?: boolean; needsContext?: boolean }[]> = {
  title: [{ action: 'improveTitle', label: 'تحسين العنوان', needsText: true }],
  description: [
    { action: 'improveText', label: 'تحسين الصياغة', needsText: true },
    { action: 'expand', label: 'توسيع', needsText: true },
    { action: 'summarize', label: 'تلخيص', needsText: true },
  ],
  goalText: [
    { action: 'suggestGeneralObjective', label: 'اقتراح الهدف العام', needsContext: true },
    { action: 'improveText', label: 'تحسين', needsText: true },
  ],
  problem: [{ action: 'improveText', label: 'تحسين الصياغة', needsText: true }],
  execution: [
    { action: 'suggestExecution', label: 'اقتراح تفاصيل التنفيذ', needsContext: true },
    { action: 'improveText', label: 'تحسين', needsText: true },
  ],
  actions: [
    { action: 'toBullets', label: 'تحويل إلى نقاط', needsText: true },
    { action: 'improveText', label: 'تحسين', needsText: true },
  ],
  results: [
    { action: 'toBullets', label: 'تحويل إلى نقاط', needsText: true },
    { action: 'improveText', label: 'تحسين', needsText: true },
  ],
  impact: [
    { action: 'suggestImpact', label: 'صياغة الأثر', needsText: true },
    { action: 'improveText', label: 'تحسين', needsText: true },
  ],
  notes: [
    { action: 'proofread', label: 'تدقيق لغوي', needsText: true },
    { action: 'improveText', label: 'تحسين', needsText: true },
  ],
}

export function AchievementSheet() {
  const open = useApp((s) => s.formOpen)
  const closeForm = useApp((s) => s.closeForm)
  const formType = useApp((s) => s.formType)
  const formAchievementId = useApp((s) => s.formAchievementId)
  const { yearId, readonly } = useScope()
  const qc = useQueryClient()

  const [type, setType] = useState<AchievementType | null>(null)
  const [id, setId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({})
  const [attachments, setAttachments] = useState<TAttachment[]>([])
  const [goalId, setGoalId] = useState('')
  const [status, setStatus] = useState<AchievementStatus>('DRAFT')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [viewMode, setViewMode] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // حارس السباق: طلب إنشاء مسودة واحد فقط مهما تتابعت الكتابة المتزامنة
  const draftPromise = useRef<Promise<string | null> | null>(null)

  const { data: goalsData } = useAchievements()
  const goals = goalsData?.goals ?? []
  const { data: sessionData } = useSession()

  /** سياق المساعد الذكي المشترك — من بيانات المستخدم والنموذج الحالي */
  const aiContext = useCallback((key?: string): AiAssistContext => ({
    title: form.title || undefined,
    achievementType: type ?? undefined,
    subject: sessionData?.user?.subject ?? undefined,
    stage: sessionData?.user?.stage ?? undefined,
    problem: form.problem || undefined,
    goal: goals.find((g) => g.id === goalId)?.title,
    text: key ? form[key] || undefined : undefined,
  }), [form.title, form.problem, type, sessionData?.user?.subject, sessionData?.user?.stage, goals, goalId])

  // فتح الورقة: إعداد الحالة
  useEffect(() => {
    if (!open) return
    setLoaded(false)
    if (formAchievementId) {
      // وضع العرض/التعديل — جلب البيانات
      setId(formAchievementId)
      fetch(`/api/achievements/${formAchievementId}`)
        .then((r) => r.json())
        .then((d) => {
          const a = d.achievement as TAchievement & { links?: { attachment?: TAttachment }[] }
          if (!a) return
          setType(a.type as AchievementType)
          const f: FormState = {}
          for (const [k, v] of Object.entries(a)) {
            if (k === 'date') f.date = toDateInput(a.date)
            else if (typeof v === 'string' || typeof v === 'number') f[k] = v?.toString() ?? ''
          }
          setForm(f)
          setAttachments((a.links ?? []).map((l) => l.attachment).filter((x): x is TAttachment => Boolean(x)))
          setGoalId(a.goalId ?? '')
          setStatus(a.status as AchievementStatus)
          setViewMode(Boolean(readonly)) // المدير يقرأ فقط
          setLoaded(true)
        })
        .catch(() => toast.error('تعذر تحميل الإنجاز'))
    } else {
      // إضافة جديدة
      setId(null)
      setType(formType)
      setForm({})
      setAttachments([])
      setGoalId('')
      setStatus('DRAFT')
      setViewMode(false)
      setLoaded(true)
    }
  }, [open, formAchievementId, formType, readonly])
  const fields = useMemo(() => (type ? TYPE_FIELDS[type] : []), [type])

  /** إنشاء مسودة فورًا عند بدء الكتابة — حارس يمنع تكرار المسودات عند الكتابة المتزامنة */
  const ensureDraft = useCallback(async (): Promise<string | null> => {
    if (id) return id
    if (!type) return null
    if (draftPromise.current) return draftPromise.current
    draftPromise.current = (async () => {
      const res = await fetch('/api/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title: form.title || 'إنجاز بدون عنوان', status: 'DRAFT', yearId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'تعذر إنشاء المسودة')
        return null
      }
      setId(data.achievement.id)
      return data.achievement.id as string
    })()
    try {
      return await draftPromise.current
    } finally {
      draftPromise.current = null
    }
  }, [id, type, form.title, yearId])

  /** حفظ تلقائي بعد 1.5 ثانية من التوقف */
  const persist = useCallback((nextForm: FormState, nextStatus?: AchievementStatus, nextGoalId?: string, nextAttachments?: TAttachment[]) => {
    if (viewMode) return
    const targetId = id
    const doPatch = async (aid: string) => {
      setSaveState('saving')
      try {
        const body: Record<string, unknown> = { ...nextForm, status: nextStatus ?? status, goalId: nextGoalId !== undefined ? nextGoalId : goalId }
        if (nextAttachments) body.attachmentIds = nextAttachments.map((a) => a.id)
        else body.attachmentIds = attachments.map((a) => a.id)
        const res = await fetch(`/api/achievements/${aid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error()
        setSaveState('saved')
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => setSaveState('idle'), 2000)
      } catch {
        setSaveState('error')
        setTimeout(() => setSaveState('idle'), 3000)
      }
    }
    if (targetId) {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => doPatch(targetId), 1500)
    } else {
      // أول كتابة: انتظر توقف الكتابة ثم أنشئ المسودة واحفظ — يمنع طلبات متزامنة متكررة
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        const aid = await ensureDraft()
        if (aid) doPatch(aid)
      }, 1500)
    }
  }, [id, status, goalId, attachments, viewMode, ensureDraft])

  const setField = (key: string, value: string) => {
    const next = { ...form, [key]: value }
    setForm(next)
    persist(next)
  }

  /** الحفظ النهائي وإغلاق النافذة */
  const finish = async (finalStatus?: AchievementStatus) => {
    const st = finalStatus ?? status
    if (!viewMode) {
      let aid = id
      if (!aid) aid = await ensureDraft()
      if (aid) {
        setSaveState('saving')
        try {
          const res = await fetch(`/api/achievements/${aid}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, status: st, goalId, attachmentIds: attachments.map((a) => a.id) }),
          })
          if (!res.ok) throw new Error()
        } catch {
          toast.error('تعذر الحفظ — بياناتك محفوظة كمسودة، حاول مرة أخرى.')
          return
        }
      }
    }
    await qc.invalidateQueries()
    closeForm()
    toast.success(
      finalStatus === 'COMPLETED' || (finalStatus === undefined && status === 'COMPLETED')
        ? 'تم حفظ الإنجاز وإضافته إلى ملفك'
        : 'تم الحفظ'
    )
  }

  const remove = async () => {
    if (!id) { closeForm(); return }
    if (!confirm('هل تريد حذف هذا الإنجاز؟\nسيُحذف الإنجاز من ملفك ومن أي هدف مرتبط به — الشواهد نفسها تبقى في مكتبة الشواهد.')) return
    const res = await fetch(`/api/achievements/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await qc.invalidateQueries()
      closeForm()
      toast.success('تم حذف الإنجاز')
    } else toast.error('تعذر الحذف')
  }

  const pre = parseFloat(form.preScore)
  const post = parseFloat(form.postScore)
  const diff = !isNaN(pre) && !isNaN(post) ? Math.round((post - pre) * 10) / 10 : null

  const typeDef = type ? TYPE_MAP[type] : null

  const renderField = (key: string) => {
    const def = fields.find((f) => f.key === key)
    if (!def) return null
    const value = form[key] ?? ''
    const common = 'bg-card text-[13px] leading-6'
    const disabled = viewMode && key !== 'status'
    // إجراءات المساعد لهذا الحقل — Action Registry وليست مبعثرة
    const aiActions = (FIELD_AI_ACTIONS[key] ?? []).filter((a) => {
      if (viewMode) return false
      if (a.needsText && (form[key] ?? '').trim().length < 5) return false
      if (a.needsContext && !form.title?.trim()) return false
      return true
    })

    if (def.type === 'textarea') {
      return (
        <div key={key} className={`space-y-1.5 ${def.span === 2 ? 'sm:col-span-2' : ''}`}>
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <label className="text-sm font-medium text-foreground">
              {def.label}
              {def.optional && <span className="mr-1.5 text-[11px] font-normal text-muted-foreground">(اختياري)</span>}
            </label>
            <div className="flex flex-wrap items-center gap-1">
              {aiActions.map((a) => (
                <AiAssistButton
                  key={a.action}
                  action={a.action}
                  label={a.label}
                  context={aiContext(key)}
                  onApplyText={(v) => setField(key, v)}
                />
              ))}
            </div>
          </div>
          <Textarea
            dir="rtl" rows={def.key === 'description' ? 2 : 3}
            disabled={disabled}
            value={value}
            onChange={(e) => setField(key, e.target.value)}
            placeholder={def.placeholder}
            className={`${common} resize-none`}
          />
          {def.hint && <p className="text-[11px] text-muted-foreground">{def.hint}</p>}
        </div>
      )
    }

    if (def.type === 'score-pair') {
      return (
        <div key={key} className={`space-y-2 sm:col-span-2 ${viewMode ? '' : 'rounded-2xl border border-border bg-muted/30 p-4'}`}>
          <label className="text-sm font-medium text-foreground">{def.label} <span className="text-[11px] font-normal text-muted-foreground">(اختياري — يظهر الرسم تلقائيًا)</span></label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">النتيجة قبل التنفيذ %</label>
              <Input dir="ltr" type="number" min={0} max={100} disabled={disabled} value={form.preScore ?? ''} onChange={(e) => setField('preScore', e.target.value)} placeholder="مثال: 57" className="bg-card text-center" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">النتيجة بعد التنفيذ %</label>
              <Input dir="ltr" type="number" min={0} max={100} disabled={disabled} value={form.postScore ?? ''} onChange={(e) => setField('postScore', e.target.value)} placeholder="مثال: 82" className="bg-card text-center" />
            </div>
          </div>
          {diff !== null && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50/80 px-3 py-2 text-xs font-semibold text-emerald-700 anim-fade-in">
              <Icon name="TrendingUp" className="size-4" />
              نسبة التحسن: +{formatNumber(diff)} نقطة مئوية
            </div>
          )}
        </div>
      )
    }

    return (
      <div key={key} className={`space-y-1.5 ${def.span === 2 ? 'sm:col-span-2' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <label className="text-sm font-medium text-foreground">
            {def.label}
            {def.optional && <span className="mr-1.5 text-[11px] font-normal text-muted-foreground">(اختياري)</span>}
          </label>
          <div className="flex flex-wrap items-center gap-1">
            {aiActions.map((a) => (
              <AiAssistButton
                key={a.action}
                action={a.action}
                label={a.label}
                context={aiContext(key)}
                onApplyText={(v) => setField(key, v)}
              />
            ))}
          </div>
        </div>
        {def.type === 'date' ? (
          <HijriDateField
            value={form.date ?? ''}
            onChange={(iso) => setField('date', iso)}
            disabled={disabled}
            placeholder={def.placeholder ?? 'اختر التاريخ'}
          />
        ) : (
          <div className="relative">
            <Input
              dir="rtl"
              type={def.type === 'number' || def.type === 'hours' ? 'number' : 'text'}
              disabled={disabled}
              value={value}
              onChange={(e) => setField(key, e.target.value)}
              placeholder={def.placeholder}
              className={def.type === 'hours' ? 'bg-card pl-14' : 'bg-card'}
            />
            {def.type === 'hours' && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ساعة</span>}
          </div>
        )}
        {def.hint && <p className="text-[11px] text-muted-foreground">{def.hint}</p>}
      </div>
    )
  }

  const fieldKeys = fields.map((f) => f.key)

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { closeForm() } }}>
      <SheetContent
        side="left"
        dir="rtl"
        className="scrollbar-slim flex w-full flex-col gap-0 overflow-y-auto border-r bg-background p-0 sm:max-w-2xl"
      >
        {!type && !formAchievementId ? (
          /* الخطوة 1: اختيار النوع */
          <div className="flex h-full flex-col p-4 sm:p-6">
            <button onClick={closeForm} className="mb-4 flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted" aria-label="إغلاق">
              <Icon name="X" className="size-4.5" />
            </button>
            <SheetTitle className="sr-only">اختيار نوع التوثيق</SheetTitle>
            <SheetDescription className="sr-only">اختر ماذا تريد أن توثقه</SheetDescription>
            <div className="flex-1">
              <TypePicker onPick={(t) => { setType(t); setLoaded(true) }} />
            </div>
          </div>
        ) : !loaded ? (
          <div className="flex h-full items-center justify-center">
            <SheetTitle className="sr-only">جارٍ تحميل الإنجاز</SheetTitle>
            <Icon name="Loader2" className="size-7 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* الرأس */}
            <SheetHeader className="border-b border-border bg-card/60 px-5 pb-4 pt-5 text-right">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                    <Icon name={typeDef?.icon ?? 'CircleDashed'} className="size-5.5" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="truncate text-right text-base leading-6">
                      {formAchievementId ? (viewMode ? 'عرض الإنجاز' : 'تعديل الإنجاز') : `توثيق: ${typeDef?.label ?? ''}`}
                    </SheetTitle>
                    <SheetDescription className="mt-0.5 text-xs">
                      {viewMode ? 'وضع القراءة — لا يمكنك التعديل' : 'يُحفظ تلقائيًا أثناء الكتابة'}
                    </SheetDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {id && !viewMode && (
                    <button onClick={remove} className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" aria-label="حذف الإنجاز">
                      <Icon name="Trash2" className="size-4.5" />
                    </button>
                  )}
                  <button onClick={closeForm} className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted" aria-label="إغلاق">
                    <Icon name="X" className="size-4.5" />
                  </button>
                </div>
              </div>

              {/* مؤشر الحفظ التلقائي */}
              {!viewMode && (
                <div className="mt-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] anim-fade-in" aria-live="polite">
                    {saveState === 'saving' && (<><Icon name="Loader2" className="size-3.5 animate-spin text-muted-foreground" /><span className="text-muted-foreground">جارٍ الحفظ…</span></>)}
                    {saveState === 'saved' && (<><Icon name="CheckCircle2" className="size-3.5 text-emerald-600" /><span className="text-emerald-700">تم الحفظ</span></>)}
                    {saveState === 'error' && (<><Icon name="CircleAlert" className="size-3.5 text-destructive" /><span className="text-destructive">تعذر الحفظ — سيُعاد تلقائيًا عند الكتابة</span></>)}
                  </span>
                  {id && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">مسودة قائمة — لن تفقد عملك</span>}
                </div>
              )}
            </SheetHeader>

            {/* المحتوى */}
            <div className="flex-1 space-y-6 px-5 py-5">
              {/* مولّد المسودة الكاملة — للمبادرات والخطط العلاجية فقط */}
              {!viewMode && (type === 'INITIATIVE' || type === 'REMEDIAL') && (
                <div className="rounded-3xl border border-primary/30 bg-primary/6 p-4 anim-fade-up">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                        <Icon name="Sparkles" className="size-5" strokeWidth={1.8} />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {type === 'INITIATIVE' ? 'اقتراح مبادرة كاملة' : 'اقتراح خطة علاجية كاملة'}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                          مسودة أولية من عنوان ونوع العمل — عدّلها بحرية قبل الحفظ، ولا يُحفظ شيء تلقائيًا.
                        </p>
                      </div>
                    </div>
                    <AiAssistButton
                      action={type === 'INITIATIVE' ? 'suggestInitiative' : 'suggestRemedialPlan'}
                      label={type === 'INITIATIVE' ? '✦ اقتراح مبادرة' : '✦ اقتراح خطة علاجية'}
                      context={aiContext()}
                      onApplyDraft={(draft) => {
                        // تعبئة حقول النموذج من المسودة — الأرقام والقياسات لا تُلمس
                        const next = { ...form }
                        const map: Record<string, string> = type === 'INITIATIVE'
                          ? {
                              name: 'title', idea: 'description', problem: 'problem', generalGoal: 'goalText',
                              targetGroup: 'beneficiaries', phases: 'actions', expectedImpact: 'impact',
                            }
                          : {
                              title: 'title', diagnosis: 'problem', skill: 'description', goal: 'goalText',
                              targetGroup: 'beneficiaries', duration: 'durationText', actions: 'actions',
                              activities: 'execution', assessmentTools: 'notes',
                            }
                        for (const [draftKey, formKey] of Object.entries(map)) {
                          if (draft[draftKey]?.trim()) next[formKey] = draft[draftKey].trim()
                        }
                        // الأهداف التفصيلية تُلحق بالهدف العام
                        const objectives = draft.objectives?.trim()
                        if (objectives && type === 'INITIATIVE') {
                          next.goalText = `${next.goalText ?? ''}\n\nالأهداف التفصيلية:\n- ${objectives.split('\n').join('\n- ')}`.trim()
                        }
                        // مؤشرات النجاح والقياس تُلحق بالملاحظات
                        const extras: string[] = []
                        if (draft.successIndicators?.trim()) extras.push(`مؤشرات النجاح: ${draft.successIndicators.trim()}`)
                        if (draft.measurement?.trim()) extras.push(`طرق القياس: ${draft.measurement.trim()}`)
                        if (draft.resources?.trim()) extras.push(`الموارد المقترحة: ${draft.resources.trim()}`)
                        if (draft.recommendations?.trim()) extras.push(`توصيات: ${draft.recommendations.trim()}`)
                        if (draft.postAssessment?.trim()) extras.push(`القياس البعدي المقترح: ${draft.postAssessment.trim()}`)
                        if (extras.length) next.notes = `${next.notes ?? ''}\n\n${extras.join('\n')}`.trim()
                        setForm(next)
                        persist(next)
                      }}
                      className="!px-4 !py-2 !text-xs"
                    />
                  </div>
                </div>
              )}

              {/* الحالة */}
              <div className="space-y-2">
                <label className="text-sm font-medium">حالة الإنجاز</label>
                {viewMode ? (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm">
                    <Icon name={status === 'COMPLETED' ? 'CheckCircle2' : status === 'DRAFT' ? 'SquarePen' : 'CircleAlert'} className="size-4 text-primary" />
                    {STATUS_META[status]?.label}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="حالة الإنجاز">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        role="radio"
                        aria-checked={status === s}
                        onClick={() => { setStatus(s); persist(form, s) }}
                        className={`min-h-10 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors ${
                          status === s
                            ? s === 'COMPLETED' ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : s === 'NEEDS_WORK' ? 'border-orange-300 bg-orange-50 text-orange-700'
                            : s === 'APPROVED' ? 'border-teal-300 bg-teal-50 text-teal-700'
                            : 'border-border bg-muted font-medium text-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted/60'
                        }`}
                      >
                        {STATUS_META[s].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* الحقول الديناميكية */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {fieldKeys.map((k) => renderField(k))}
              </div>

              {/* ربط بهدف */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon name="Target" className="size-4 text-primary" />
                  الربط بهدف مهني
                </label>
                {viewMode ? (
                  <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                    {goals.find((g) => g.id === goalId)?.title ?? 'غير مرتبط بهدف'}
                  </div>
                ) : goals.length ? (
                  <Select dir="rtl" value={goalId || 'none'} onValueChange={(v) => { const g = v === 'none' ? '' : v; setGoalId(g); persist(form, undefined, g) }}>
                    <SelectTrigger dir="rtl" className="w-full bg-card"><SelectValue placeholder="اختر هدفًا مهنيًا (اختياري)" /></SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="none">بدون ربط</SelectItem>
                      {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="rounded-xl bg-muted/50 px-3.5 py-2.5 text-xs leading-5 text-muted-foreground">
                    لا توجد أهداف مهنية بعد — عند إضافتها سيظهر الإنجاز داخل هدفه تلقائيًا.
                  </p>
                )}
              </div>

              {/* الشواهد */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-sm font-medium">
                    <Icon name="Paperclip" className="size-4 text-primary" />
                    الشواهد والمرفقات
                  </label>
                  {attachments.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">{attachments.length} شاهدًا</span>
                  )}
                </div>
                {viewMode ? (
                  attachments.length ? (
                    <div className="space-y-2">
                      {attachments.map((a) => (
                        <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                            {a.kind === 'IMAGE' && a.url ? (
                              <img src={a.url} alt={a.title} className="size-12 object-cover" />
                            ) : (
                              <Icon name="FileText" className="size-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{a.title}</p>
                            <p className="text-[11px] text-muted-foreground">{a.kind === 'LINK' ? 'رابط' : a.fileName ?? ''}</p>
                          </div>
                          {a.url && (
                            <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary" aria-label="فتح">
                              <Icon name="ExternalLink" className="size-4" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl bg-muted/50 px-3.5 py-3 text-xs text-muted-foreground">لا توجد شواهد مرتبطة بهذا الإنجاز.</p>
                  )
                ) : (
                  <AttachmentsEditor
                    attachments={attachments}
                    onChange={(next) => { setAttachments(next); persist(form, undefined, undefined, next) }}
                  />
                )}
              </div>
            </div>

            {/* التذييل — ثابت أسفل الشاشة فوق لوحة المفاتيح وشريط النظام */}
            {!viewMode && (
              <div
                className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-5 sm:py-4"
                style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
              >
                <button
                  onClick={() => finish('DRAFT')}
                  className="min-h-11 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                  حفظ كمسودة
                </button>
                <button
                  onClick={() => finish('COMPLETED')}
                  className="flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:bg-primary/90 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
                >
                  <Icon name="Check" className="size-4" />
                  حفظ الإنجاز
                </button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
