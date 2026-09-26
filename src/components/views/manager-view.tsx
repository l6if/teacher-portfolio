'use client'

import { useState } from 'react'
import { useApp } from '@/store/app-store'
import { useManagerTeachers } from '@/hooks/use-data'
import { Icon } from '@/components/shared/icon'
import { ProgressBar } from '@/components/shared/progress'
import { LoadingState, ErrorState, EmptyState } from '@/components/shared/states'
import { PageHeader } from '@/components/shared/page-header'
import { relTime } from '@/lib/format'

/** عرض المدير — ملفات إنجاز المعلمين */
export function ManagerView() {
  const { data, isLoading, error, refetch } = useManagerTeachers()
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('')
  const setViewUser = useApp((s) => s.setViewUser)
  const navigate = useApp((s) => s.navigate)

  if (isLoading) return <LoadingState rows={4} />
  if (error || !data) return <ErrorState message="تعذر تحميل ملفات المعلمين." onRetry={() => refetch()} />

  const allSubjects = [...new Set(data.teachers.map((t) => t.subject).filter(Boolean))] as string[]
  const teachers = data.teachers.filter(
    (t) =>
      (!q || t.name.includes(q) || (t.subject ?? '').includes(q)) &&
      (!subject || t.subject === subject),
  )

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'ملفات المعلمين' }]}
        title="ملفات إنجاز المعلمين"
        description="اطّلع على ملف كل معلم بنمط قراءة احترافي — لا يمكنك تعديل ملفاتهم، والصلاحيات محققة من جهة الخادم."
        icon="Users"
      />

      <div className="mb-5 flex flex-wrap items-center gap-2.5 anim-fade-up">
        <div className="relative min-w-52 flex-1">
          <Icon name="Search" className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            dir="rtl"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم المعلم أو التخصص…"
            className="h-10 w-full rounded-xl border border-input bg-card pr-10 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
            aria-label="البحث عن معلم"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSubject('')}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${!subject ? 'border-primary bg-secondary font-medium text-secondary-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}
          >
            كل التخصصات
          </button>
          {allSubjects.map((s) => (
            <button
              key={s}
              onClick={() => setSubject(subject === s ? '' : s)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${subject === s ? 'border-primary bg-secondary font-medium text-secondary-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {teachers.length === 0 ? (
        <EmptyState
          icon="Search"
          title="لا يوجد معلمون مطابقون"
          description="جرّب تعديل البحث أو إلغاء الفلاتر."
          secondaryLabel="مسح الفلاتر"
          onSecondary={() => { setQ(''); setSubject('') }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {teachers.map((t, i) => (
            <button
              key={t.id}
              onClick={() => { setViewUser(t.id, t.name); navigate('dashboard') }}
              className={`group anim-fade-up anim-delay-${Math.min(i + 1, 4)} rounded-3xl border border-border bg-card p-5 text-right shadow-soft transition-all hover:-translate-y-1 hover:border-primary/35 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/12 text-base font-bold text-primary">
                    {t.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-bold text-foreground group-hover:text-primary">{t.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.subject ?? 'معلم'} — {t.yearLabel}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ${t.completion >= 80 ? 'bg-emerald-50 text-emerald-700' : t.completion >= 50 ? 'bg-secondary text-secondary-foreground' : 'bg-orange-50 text-orange-700'}`}>
                  {t.completion}%
                </span>
              </div>

              <div className="mt-4">
                <ProgressBar value={t.completion} thickness="h-1.5" />
              </div>

              <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Icon name="BookOpen" className="size-3.5" />
                  {t.achievements} إنجازًا
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="Clock" className="size-3.5" />
                  {t.lastUpdate ? `آخر تحديث ${relTime(t.lastUpdate)}` : 'لم يبدأ التوثيق'}
                </span>
              </div>

              <div className="mt-3.5 flex items-center justify-end gap-1 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                فتح الملف بنمط القراءة
                <Icon name="ArrowLeft" className="size-3.5" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
