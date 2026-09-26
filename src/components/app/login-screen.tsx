'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Icon } from '@/components/shared/icon'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const qc = useQueryClient()

  const login = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (busy) return
    setError(null)
    if (!email.trim() || !password) {
      setError('أدخل البريد الإلكتروني وكلمة المرور')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'تعذر تسجيل الدخول — تحقق من البيانات')
        return
      }
      await qc.invalidateQueries({ queryKey: ['session'] })
    } catch {
      setError('تعذر الاتصال بالخادم — تحقق من اتصالك ثم أعد المحاولة')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-40" />
      <div className="pointer-events-none absolute -top-32 right-1/2 size-[480px] translate-x-1/2 rounded-full bg-primary/6 blur-3xl" />
      <div className="relative w-full max-w-md anim-fade-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-3xl bg-primary shadow-lift">
            <Icon name="GraduationCap" className="size-8 text-primary-foreground" strokeWidth={1.7} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">ملف إنجاز المعلم</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            منصة احترافية توثّق عملك ونتائجك وأثرك المهني،
            <br />
            وتحوّلها إلى تقارير أنيقة جاهزة للطباعة.
          </p>
        </div>

        <form
          onSubmit={login}
          className="rounded-3xl border border-border bg-card/80 p-6 shadow-soft backdrop-blur"
          noValidate
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-sm font-medium text-foreground">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Icon name="Mail" className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="login-email"
                  dir="ltr"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@school.sa"
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-4 pr-10 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-ring"
                  aria-required="true"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-sm font-medium text-foreground">
                كلمة المرور
              </label>
              <div className="relative">
                <Icon name="Lock" className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="login-password"
                  dir="ltr"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
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
              {busy ? <Icon name="Loader2" className="size-4 animate-spin" /> : <Icon name="LogIn" className="size-4" />}
              {busy ? 'جارٍ التحقق…' : 'تسجيل الدخول'}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          كل بياناتك محفوظة على خادم المدرسة — لا يشاركها أحد بدون صلاحية.
        </p>
      </div>
    </div>
  )
}
