'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useReflection, useScope } from '@/hooks/use-data'
import { Icon } from '@/components/shared/icon'
import { LoadingState, ErrorState } from '@/components/shared/states'
import { Textarea } from '@/components/ui/textarea'
import { AiAssistButton } from '@/components/shared/ai-assist'
import { toast } from 'sonner'

const QUESTIONS = [
  { key: 'success', label: 'ما أبرز نجاح حققته هذا الفصل؟', icon: 'Trophy', hint: 'فكر في لحظة تشعر فيها أن جهدك أثمر فعلًا.' },
  { key: 'practice', label: 'ما أكثر ممارسة وجدت أنها مؤثرة؟', icon: 'Lightbulb', hint: 'استراتيجية أو أداة لاحظت أثرها على طلابك.' },
  { key: 'develop', label: 'ما المجال الذي ترغب في تطويره؟', icon: 'TrendingUp', hint: 'كون صادقًا — هذا موجه لخطتك القادمة.' },
  { key: 'nextTerm', label: 'ما الذي ستفعله بطريقة مختلفة في الفصل القادم؟', icon: 'Route', hint: 'إجراء واحد محدد أفضل من عشرة عامة.' },
] as const

export function ReflectionSection({ readonly }: { readonly: boolean }) {
  const { data, isLoading, error, refetch } = useReflection()
  const { yearId } = useScope()
  const qc = useQueryClient()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loaded = useRef(false)

  useEffect(() => {
    if (data?.reflection && !loaded.current) {
      loaded.current = true
      setAnswers({
        success: data.reflection.success ?? '',
        practice: data.reflection.practice ?? '',
        develop: data.reflection.develop ?? '',
        nextTerm: data.reflection.nextTerm ?? '',
      })
    }
  }, [data])

  // حفظ تلقائي بعد 1.5 ثانية من التوقف عن الكتابة
  const save = (next: Record<string, string>) => {
    if (readonly) return
    if (timer.current) clearTimeout(timer.current)
    setSaved('saving')
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/reflection', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...next, yearId, term: 'TERM1' }),
        })
        if (!res.ok) throw new Error()
        setSaved('saved')
        setTimeout(() => setSaved('idle'), 2000)
      } catch {
        setSaved('idle')
        toast.error('تعذر الحفظ — سيعاد المحاولة عند الكتابة مجددًا')
      }
    }, 1500)
  }

  const onChange = (key: string, value: string) => {
    const next = { ...answers, [key]: value }
    setAnswers(next)
    save(next)
  }

  if (isLoading) return <LoadingState rows={2} />
  if (error) return <ErrorState message="تعذر تحميل التأمل المهني." onRetry={() => refetch()} />

  const answered = Object.values(answers).filter((v) => v.trim()).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-gradient-to-l from-secondary/70 to-card p-5 anim-fade-up">
        <div>
          <h3 className="text-sm font-bold text-foreground">تأملك المهني — الفصل الدراسي الأول</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            أربعة أسئلة فقط، لا نماذج طويلة. أجابتك تتحول لاحقًا إلى بذرة خطتك التطويرية.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1.5 text-xs">
            <span className="text-muted-foreground">{answered} من 4</span>
            <div className="flex gap-1">
              {QUESTIONS.map((q) => (
                <span key={q.key} className={`size-2 rounded-full ${answers[q.key]?.trim() ? 'bg-primary' : 'bg-border'}`} />
              ))}
            </div>
          </div>
          {!readonly && (
            <span className={`flex items-center gap-1.5 text-[11px] transition-opacity ${saved === 'idle' ? 'opacity-0' : 'opacity-100'}`} aria-live="polite">
              {saved === 'saving' ? (
                <><Icon name="Loader2" className="size-3.5 animate-spin text-muted-foreground" /><span className="text-muted-foreground">جارٍ الحفظ…</span></>
              ) : (
                <><Icon name="CheckCircle2" className="size-3.5 text-emerald-600" /><span className="text-emerald-700">تم الحفظ</span></>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {QUESTIONS.map((q, i) => (
          <div key={q.key} className={`anim-fade-up anim-delay-${Math.min(i + 1, 4)} rounded-3xl border border-border bg-card p-5 shadow-soft`}>
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
                <Icon name={q.icon} className="size-5" strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="block text-sm font-bold leading-6 text-foreground" htmlFor={`refl-${q.key}`}>
                    {q.label}
                  </label>
                  {!readonly && (
                    <span className="flex flex-wrap items-center gap-1">
                      <AiAssistButton
                        action="improveText"
                        label="تحسين"
                        context={{ text: answers[q.key] || undefined, achievementType: 'REFLECTION' }}
                        onApplyText={(v) => onChange(q.key, v)}
                      />
                      {/* «اختصر» — يظهر فقط عند وجود نص فعلي في السؤال (SHORTEN_CONTENT) */}
                      {(answers[q.key] ?? '').trim().length >= 5 && (
                        <AiAssistButton
                          action="shorten"
                          label="اختصر"
                          context={{ text: (answers[q.key] ?? '').trim().slice(0, 4000), fieldTarget: 'reflection', achievementType: 'REFLECTION' }}
                          onApplyText={(v) => onChange(q.key, v)}
                        />
                      )}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 mb-3 text-[11px] text-muted-foreground">{q.hint}</p>
                <Textarea
                  id={`refl-${q.key}`}
                  dir="rtl"
                  rows={4}
                  disabled={readonly}
                  value={answers[q.key] ?? ''}
                  onChange={(e) => onChange(q.key, e.target.value)}
                  placeholder={readonly ? '—' : 'اكتب إجابتك بحرية… تُحفظ تلقائيًا كمسودة'}
                  className="resize-none text-[13px] leading-6"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
