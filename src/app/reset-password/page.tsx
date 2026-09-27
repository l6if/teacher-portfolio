'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Icon } from '@/components/shared/icon'

function ResetPasswordInner() {
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (busy || done) return
    setError(null)
    if (!password || !confirmPassword) {
      setError('أدخل كلمة المرور الجديدة وتأكيدها')
      return
    }
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }
    if (password.length < 8) {
      setError('كلمة المرور قصيرة جدًا — 8 أحرف على الأقل')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'تعذر تحديث كلمة المرور — حاول مرة أخرى')
        return
      }
      setDone(true)
    } catch {
      setError('تعذر الاتصال بالخادم — تحقق من اتصالك ثم أعد المحاولة')
    } finally {
      setBusy(false)
    }
  }

  const goToLogin = () => {
    window.location.href = '/'
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-40" />
      <div className="pointer-events-none absolute -top-32 right-1/2 size-[480px] translate-x-1/2 rounded-full bg-primary/6 blur-3xl" />
      <div className="relative w-full max-w-md anim-fade-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-3xl bg-primary shadow-lift">
            <Icon name="ShieldCheck" className="size-8 text-primary-foreground" strokeWidth={1.7} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">كلمة مرور جديدة</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {done ? 'تم تحديث كلمة المرور بنجاح.' : 'اختر كلمة مرور قوية لحسابك — الرابط يعمل مرة واحدة فقط.'}
          </p>
        </div>

        {done ? (
          <div className="rounded-3xl border border-border bg-card/80 p-6 text-center shadow-soft backdrop-blur">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Icon name="CheckCircle2" className="size-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">تم تحديث كلمة المرور بنجاح.</p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              أُبطلت كل الجلسات السابقة لأمان حسابك — سجّل دخولك بالكلمة الجديدة.
            </p>
            <button
              type="button"
              onClick={goToLogin}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:bg-primary/90"
            >
              <Icon name="LogIn" className="size-4" />
              تسجيل الدخول
            </button>
          </div>
        ) : !token ? (
          <div className="rounded-3xl border border-border bg-card/80 p-6 text-center shadow-soft backdrop-blur">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <Icon name="CircleAlert" className="size-6 text-destructive" />
            </div>
            <p className="text-sm font-medium text-foreground">رابط الاستعادة غير صالح.</p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              الرابط ناقص أو تالف — اطلب رابط استعادة جديدًا من صفحة الدخول.
            </p>
            <button
              type="button"
              onClick={goToLogin}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:bg-primary/90"
            >
              <Icon name="ArrowRight" className="size-4" />
              العودة لتسجيل الدخول
            </button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="rounded-3xl border border-border bg-card/80 p-6 shadow-soft backdrop-blur"
            noValidate
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="new-password" className="block text-sm font-medium text-foreground">
                  كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <Icon name="Lock" className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="new-password"
                    dir="ltr"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-11 pr-10 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-ring"
                    aria-required="true"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    <Icon name={showPassword ? 'EyeOff' : 'Eye'} className="size-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">8 أحرف على الأقل — اجمع بين الحروف والأرقام</p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="new-password-confirm" className="block text-sm font-medium text-foreground">
                  تأكيد كلمة المرور
                </label>
                <div className="relative">
                  <Icon name="Lock" className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="new-password-confirm"
                    dir="ltr"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-4 pr-10 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-ring"
                    aria-required="true"
                  />
                </div>
              </div>

              {error && (
                <p className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-xs font-medium text-destructive anim-fade-in" role="alert" aria-live="polite">
                  <Icon name="CircleAlert" className="size-4 shrink-0" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:bg-primary/90 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? <Icon name="Loader2" className="size-4 animate-spin" /> : <Icon name="ShieldCheck" className="size-4" />}
                {busy ? 'جارٍ التحديث…' : 'تحديث كلمة المرور'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  )
}
