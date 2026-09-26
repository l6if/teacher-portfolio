'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/shared/icon'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

// ═══ عقد مكوّن المساعد الذكي ═════════════════════════════════

export interface AiAssistContext {
  title?: string
  field?: string
  stage?: string
  subject?: string
  grade?: string
  problem?: string
  goal?: string
  generalGoal?: string
  text?: string
  objectives?: string[]
  achievementType?: string
}

type AiResult =
  | { kind: 'text'; value: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'draft'; fields: Record<string, string> }

/** تحويل استجابة API (المتحقق منها خادميًا) إلى شكل العرض */
function toDisplayResult(action: string, result: unknown): AiResult {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>
    if (action === 'suggestObjectives' && Array.isArray(obj.objectives)) {
      return { kind: 'list', items: (obj.objectives as unknown[]).map(String) }
    }
    if (action === 'suggestRecommendations' && Array.isArray(obj.recommendations)) {
      return { kind: 'list', items: (obj.recommendations as unknown[]).map(String) }
    }
    if (typeof obj.generalObjective === 'string') {
      return { kind: 'text', value: obj.generalObjective }
    }
    if (typeof obj.execution === 'string') {
      return { kind: 'text', value: obj.execution }
    }
    // مسودات كاملة (مبادرة/خطة علاجية)
    const fields: Record<string, string> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && v.trim()) fields[k] = v.trim()
      else if (Array.isArray(v)) fields[k] = v.map(String).filter(Boolean).join('\n')
    }
    if (Object.keys(fields).length) return { kind: 'draft', fields }
  }
  return { kind: 'text', value: String(result ?? '') }
}

const DRAFT_FIELD_LABELS: Record<string, string> = {
  name: 'اسم المبادرة',
  idea: 'الفكرة',
  problem: 'المشكلة/الحاجة',
  generalGoal: 'الهدف العام',
  objectives: 'الأهداف',
  targetGroup: 'الفئة المستهدفة',
  phases: 'مراحل التنفيذ',
  resources: 'الموارد المقترحة',
  successIndicators: 'مؤشرات النجاح',
  measurement: 'طرق القياس',
  expectedImpact: 'الأثر المتوقع',
  recommendations: 'توصيات',
  diagnosis: 'تشخيص المشكلة',
  skill: 'المهارة المستهدفة',
  goal: 'الهدف',
  duration: 'المدة المقترحة',
  actions: 'الإجراءات',
  activities: 'الأنشطة',
  assessmentTools: 'أدوات التقويم',
  postAssessment: 'القياس البعدي المقترح',
  title: 'العنوان',
}

// ═══ نافذة المعاينة ══════════════════════════════════════════

interface DialogProps {
  open: boolean
  action: string
  loading: boolean
  error: string | null
  result: AiResult | null
  /** يتغير مع كل طلب — يعيد تركيب الجسم التفاعلي بحالة نظيفة */
  requestId: number
  onClose: () => void
  onApplyText: (value: string) => void
  onApplyList: (items: string[]) => void
  onApplyDraft: (fields: Record<string, string>) => void
  onRegenerate: () => void
}

function AiSuggestionDialog({
  open, action, loading, error, result, requestId, onClose, onApplyText, onApplyList, onApplyDraft, onRegenerate,
}: DialogProps) {
  if (!open) return null

  // الجزء التفاعلي يُعاد تركيبه مع كل نتيجة جديدة (key) — حالة نظيفة بلا effects
  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="معاينة اقتراح المساعد الذكي">
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-border bg-card shadow-lift anim-fade-up sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-5 py-3.5 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Icon name="Sparkles" className="size-4.5" strokeWidth={1.8} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">اقتراح المساعد الذكي</h3>
              <p className="text-[11px] text-muted-foreground">معاينة قبل الاستخدام — لا يُحفظ شيء تلقائيًا</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="إغلاق"
          >
            <Icon name="X" className="size-4.5" />
          </button>
        </div>

        <div className="px-5 py-4">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Icon name="Loader2" className="size-7 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">جاري إعداد الاقتراح…</p>
              <p className="text-xs text-muted-foreground">يستغرق عادة بضع ثوانٍ</p>
            </div>
          )}

          {!loading && error && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-destructive/10">
                <Icon name="CircleAlert" className="size-5 text-destructive" />
              </div>
              <p className="text-sm font-medium text-foreground">تعذر إنشاء الاقتراح الآن. حاول مرة أخرى.</p>
              <p className="mt-1 text-xs text-muted-foreground">نصك المحفوظ في الحقل لم يُمس.</p>
              <div className="mt-5 flex items-center justify-center gap-2">
                <Button onClick={onRegenerate} variant="outline" className="rounded-full">
                  <Icon name="RotateCcw" className="size-4" />
                  إعادة المحاولة
                </Button>
                <Button onClick={onClose} variant="ghost" className="rounded-full">إلغاء</Button>
              </div>
            </div>
          )}

          {!loading && !error && result && (
            <PreviewBody key={requestId} result={result} onClose={onClose} onApplyText={onApplyText} onApplyList={onApplyList} onApplyDraft={onApplyDraft} onRegenerate={onRegenerate} />
          )}
        </div>
      </div>
    </div>
  )
}

// ═══ الجسم التفاعلي — يُعاد تركيبه مع كل نتيجة جديدة (حالة نظيفة) ═══

function PreviewBody({
  result, onClose, onApplyText, onApplyList, onApplyDraft, onRegenerate,
}: {
  result: NonNullable<AiResult>
  onClose: () => void
  onApplyText: (v: string) => void
  onApplyList: (items: string[]) => void
  onApplyDraft: (fields: Record<string, string>) => void
  onRegenerate: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(result.kind === 'list' ? result.items.map((_, i) => i) : []),
  )
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({})
  const editRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (editing && editRef.current) editRef.current.focus()
  }, [editing])

  const apply = () => {
    if (!result) return
    if (result.kind === 'text') {
      onApplyText(editing !== null ? editValue : result.value)
    } else if (result.kind === 'list') {
      const items = result.items.filter((_, i) => selected.has(i))
      if (!items.length) {
        toast.info('اختر هدفًا واحدًا على الأقل')
        return
      }
      onApplyList(items)
    } else {
      onApplyDraft({ ...result.fields, ...draftEdits })
    }
    onClose()
  }

  // ─── نتيجة نصية واحدة ───
  if (result.kind === 'text') {
    return (
      <div className="space-y-4">
        {editing === null ? (
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{result.value}</p>
          </div>
        ) : (
          <Textarea
            ref={editRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            dir="rtl"
            className="min-h-40 bg-background text-sm leading-7"
            aria-label="تعديل الاقتراح"
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (editing === null) {
                setEditing(result.value)
                setEditValue(result.value)
              } else {
                setEditing(null)
              }
            }}
            className="rounded-full text-xs"
          >
            <Icon name={editing === null ? 'Pencil' : 'Eye'} className="size-3.5" />
            {editing === null ? 'تعديل' : 'عرض النهائي'}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onRegenerate} className="rounded-full text-xs">
              <Icon name="RotateCcw" className="size-3.5" />
              إعادة التوليد
            </Button>
            <Button variant="outline" size="sm" onClick={onClose} className="rounded-full text-xs">إلغاء</Button>
            <Button size="sm" onClick={apply} className="rounded-full text-xs">
              <Icon name="Check" className="size-3.5" />
              استخدام الاقتراح
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─── قائمة (أهداف/توصيات) — اختيار فردي أو الكل ───
  if (result.kind === 'list') {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          {result.items.map((item, i) => (
            <label
              key={i}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors ${
                selected.has(i) ? 'border-primary/50 bg-primary/6' : 'border-border bg-background hover:border-primary/30'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(i)}
                onChange={() => {
                  const next = new Set(selected)
                  if (next.has(i)) next.delete(i)
                  else next.add(i)
                  setSelected(next)
                }}
                className="mt-1 size-4 accent-[var(--primary)]"
                aria-label={`اختيار ${i + 1}`}
              />
              <span className="text-sm leading-7 text-foreground">{item}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {selected.size} من {result.items.length} محددًا
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onRegenerate} className="rounded-full text-xs">
              <Icon name="RotateCcw" className="size-3.5" />
              إعادة التوليد
            </Button>
            <Button variant="outline" size="sm" onClick={onClose} className="rounded-full text-xs">إلغاء</Button>
            <Button size="sm" onClick={apply} className="rounded-full text-xs" disabled={!selected.size}>
              <Icon name="Check" className="size-3.5" />
              {selected.size === result.items.length ? 'تطبيق الكل' : `تطبيق المحدد (${selected.size})`}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─── مسودة كاملة (مبادرة/خطة علاجية) — حقول قابلة للتعديل ───
  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {Object.entries(result.fields).map(([key, value]) => {
          const edited = key in draftEdits
          return (
            <div key={key} className="rounded-2xl border border-border bg-background p-3.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-primary">{DRAFT_FIELD_LABELS[key] ?? key}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (edited) {
                      const next = { ...draftEdits }
                      delete next[key]
                      setDraftEdits(next)
                    } else {
                      setDraftEdits((d) => ({ ...d, [key]: value }))
                    }
                  }}
                  className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  <Icon name={edited ? 'X' : 'Pencil'} className="size-3" />
                  {edited ? 'تراجع' : 'تعديل'}
                </button>
              </div>
              {edited ? (
                <Textarea
                  value={draftEdits[key]}
                  onChange={(e) => setDraftEdits((d) => ({ ...d, [key]: e.target.value }))}
                  dir="rtl"
                  className="min-h-24 text-sm leading-7"
                  aria-label={`تعديل ${DRAFT_FIELD_LABELS[key] ?? key}`}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{value}</p>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onRegenerate} className="rounded-full text-xs">
          <Icon name="RotateCcw" className="size-3.5" />
          إعادة التوليد
        </Button>
        <Button variant="outline" size="sm" onClick={onClose} className="rounded-full text-xs">إلغاء</Button>
        <Button size="sm" onClick={apply} className="rounded-full text-xs">
          <Icon name="Check" className="size-3.5" />
          استخدام المسودة
        </Button>
      </div>
    </div>
  )
}

// ═══ زر المساعد + إدارة الطلب ════════════════════════════════

export interface AiAssistButtonProps {
  action: string
  label?: string
  context: AiAssistContext
  /** تطبيق نص واحد على الحقل */
  onApplyText?: (value: string) => void
  /** تطبيق قائمة (أهداف/توصيات) */
  onApplyList?: (items: string[]) => void
  /** تطبيق مسودة كاملة على عدة حقول */
  onApplyDraft?: (fields: Record<string, string>) => void
  /** تعطيل (مثلا: حقل readonly) */
  disabled?: boolean
  className?: string
}

export function AiAssistButton({
  action, label, context, onApplyText, onApplyList, onApplyDraft, disabled, className,
}: AiAssistButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiResult | null>(null)
  const [requestId, setRequestId] = useState(0)
  const contextRef = useRef(context)
  contextRef.current = context

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setRequestId((n) => n + 1)
    setOpen(true)
    try {
      const res = await fetch(`/api/ai/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: contextRef.current }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'تعذر إنشاء الاقتراح الآن. حاول مرة أخرى.')
        return
      }
      setResult(toDisplayResult(action, data.result))
    } catch {
      setError('تعذر الاتصال بالخادم — تحقق من اتصالك.')
    } finally {
      setLoading(false)
    }
  }, [action])

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={disabled || loading}
        className={`flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50 ${className ?? ''}`}
        title="مساعد ذكي — اقتراح مهني لهذا الحقل"
      >
        <Icon name={loading && open ? 'Loader2' : 'Sparkles'} className={`size-3 ${loading && open ? 'animate-spin' : ''}`} />
        ✦ {label ?? 'مساعد ذكي'}
      </button>

      <AiSuggestionDialog
        open={open}
        action={action}
        loading={loading}
        error={error}
        result={result}
        requestId={requestId}
        onClose={() => setOpen(false)}
        onApplyText={(v) => { onApplyText?.(v); toast.success('تم إدخال الاقتراح — يمكنك تعديله بحرية') }}
        onApplyList={(items) => { onApplyList?.(items); toast.success('تم إدخال الاقتراح — يمكنك تعديله بحرية') }}
        onApplyDraft={(fields) => { onApplyDraft?.(fields); toast.success('تمت تعبئة المسودة في الحقول — عدّلها بحرية') }}
        onRegenerate={run}
      />
    </>
  )
}
