'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Icon } from '@/components/shared/icon'

export function LoginScreen() {
  const [users, setUsers] = useState<{ id: string; name: string; role: string; subject?: string | null; school?: string | null }[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const qc = useQueryClient()

  useState(() => {
    fetch('/api/session')
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .catch(() => {})
  })

  const login = async (userId: string) => {
    setLoadingId(userId)
    try {
      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      await qc.invalidateQueries({ queryKey: ['session'] })
    } finally {
      setLoadingId(false)
    }
  }

  const teachers = users.filter((u) => u.role === 'TEACHER')
  const managers = users.filter((u) => u.role === 'MANAGER')

  const AccountCard = ({ u }: { u: (typeof users)[number] }) => (
    <button
      onClick={() => login(u.id)}
      disabled={loadingId === u.id}
      className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-right transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
    >
      <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${u.role === 'MANAGER' ? 'bg-amber-50 text-amber-700' : 'bg-secondary text-primary'}`}>
        <Icon name={u.role === 'MANAGER' ? 'Building2' : 'UserRound'} className="size-6" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{u.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {u.role === 'MANAGER' ? 'مديرة المدرسة' : u.subject ?? 'معلم'} {u.school ? `• ${u.school}` : ''}
        </p>
      </div>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
        {loadingId === u.id ? <Icon name="Loader2" className="size-4 animate-spin" /> : <Icon name="ArrowLeft" className="size-4" />}
      </div>
    </button>
  )

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

        <div className="rounded-3xl border border-border bg-card/80 p-4 shadow-soft backdrop-blur">
          <p className="mb-3 px-1 text-xs font-medium text-muted-foreground">الدخول بصفة تجريبية — اختر حسابًا:</p>
          <div className="space-y-2.5">
            {teachers.map((u) => <AccountCard key={u.id} u={u} />)}
            {managers.length > 0 && (
              <>
                <div className="flex items-center gap-3 px-1 pt-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] text-muted-foreground">حساب الإدارة</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {managers.map((u) => <AccountCard key={u.id} u={u} />)}
              </>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          كل بياناتك تبقى محفوظة على خادم المدرسة — لا يشاركها أحد بدون صلاحية.
        </p>
      </div>
    </div>
  )
}
