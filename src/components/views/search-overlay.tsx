'use client'

import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/store/app-store'
import { useScope } from '@/hooks/use-data'
import { Icon } from '@/components/shared/icon'
import { TYPE_MAP } from '@/lib/constants'
import { formatDateShort } from '@/lib/format'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { TAchievement } from '@/lib/types'

interface SearchResults {
  achievements: { id: string; title: string; type: string; date: string | null; status: string; description?: string | null }[]
  goals: { id: string; title: string; currentValue?: number | null; targetValue?: number | null }[]
  attachments: { id: string; title: string; kind: string; url?: string | null }[]
}

/** البحث الشامل — ينتهي إلى كل ما يخص الكلمة في ملفك */
export function SearchOverlay({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useApp((s) => s.navigate)
  const openForm = useApp((s) => s.openForm)
  const { yearId, viewUserId } = useScope()

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
    else { setQ(''); setResults(null) }
  }, [open])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 1) { setResults(null); setLoading(false); return }
    setLoading(true)
    timer.current = setTimeout(async () => {
      try {
        const p = new URLSearchParams({ q })
        if (yearId) p.set('yearId', yearId)
        if (viewUserId) p.set('userId', viewUserId)
        const res = await fetch(`/api/search?${p}`)
        if (res.ok) setResults(await res.json())
      } catch { /* تجاهل */ }
      finally { setLoading(false) }
    }, 300)
  }, [q, yearId, viewUserId])

  const go = (fn: () => void) => {
    onOpenChange(false)
    fn()
  }

  const empty = !loading && results && q.trim() &&
    results.achievements.length === 0 && results.goals.length === 0 && results.attachments.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>البحث الشامل</DialogTitle>
          <DialogDescription>ابحث في إنجازاتك وأهدافك وشواهدك</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <Icon name="Search" className="size-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            dir="rtl"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="اكتب كلمة مثل: قراءة…"
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            aria-label="البحث الشامل"
          />
          {loading && <Icon name="Loader2" className="size-4 animate-spin text-primary" />}
          <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground" dir="ltr">Esc</kbd>
        </div>

        <div className="scrollbar-slim max-h-[55vh] overflow-y-auto p-3">
          {!q.trim() ? (
            <div className="px-3 py-8 text-center">
              <Icon name="Search" className="mx-auto size-6 text-border" />
              <p className="mt-3 text-sm text-muted-foreground">
                البحث يشمل الإنجازات والأهداف والشواهد —
                <br />
                بعنوانها ووصفها وكلماتها المفتاحية.
              </p>
            </div>
          ) : empty ? (
            <div className="px-3 py-10 text-center">
              <p className="text-sm font-medium text-foreground">لا توجد نتائج لـ «{q}»</p>
              <p className="mt-1.5 text-xs text-muted-foreground">جرّب كلمة أعم مثل اسم المهارة أو نوع النشاط.</p>
            </div>
          ) : results ? (
            <div className="space-y-5">
              {results.achievements.length > 0 && (
                <section>
                  <p className="mb-1.5 px-2 text-[11px] font-semibold text-muted-foreground">الإنجازات ({results.achievements.length})</p>
                  <div className="space-y-1">
                    {results.achievements.map((a) => {
                      const t = TYPE_MAP[a.type as keyof typeof TYPE_MAP]
                      return (
                        <button
                          key={a.id}
                          onClick={() => go(() => openForm({ achievementId: a.id }))}
                          className="flex w-full items-center gap-3 rounded-xl p-2.5 text-right transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                            <Icon name={t?.icon ?? 'CircleDashed'} className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">{a.title}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {t?.label} • {a.date ? formatDateShort(a.date) : 'بدون تاريخ'}
                            </span>
                          </span>
                          <Icon name="ArrowLeft" className="size-4 shrink-0 text-border" />
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {results.goals.length > 0 && (
                <section>
                  <p className="mb-1.5 px-2 text-[11px] font-semibold text-muted-foreground">الأهداف المهنية ({results.goals.length})</p>
                  <div className="space-y-1">
                    {results.goals.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => go(() => navigate('section', { sectionKey: 'goals' }))}
                        className="flex w-full items-center gap-3 rounded-xl p-2.5 text-right transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                          <Icon name="Target" className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{g.title}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {g.currentValue ?? 0} / {g.targetValue ?? '—'}
                          </span>
                        </span>
                        <Icon name="ArrowLeft" className="size-4 shrink-0 text-border" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {results.attachments.length > 0 && (
                <section>
                  <p className="mb-1.5 px-2 text-[11px] font-semibold text-muted-foreground">الشواهد ({results.attachments.length})</p>
                  <div className="space-y-1">
                    {results.attachments.map((att) => (
                      <button
                        key={att.id}
                        onClick={() => go(() => navigate('evidence'))}
                        className="flex w-full items-center gap-3 rounded-xl p-2.5 text-right transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                          <Icon name="Paperclip" className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{att.title}</span>
                        <Icon name="ArrowLeft" className="size-4 shrink-0 text-border" />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : loading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5">
                  <div className="size-9 animate-pulse rounded-lg bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-1/2 animate-pulse rounded-full bg-muted" />
                    <div className="h-3 w-1/3 animate-pulse rounded-full bg-muted/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
