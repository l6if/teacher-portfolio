'use client'

import { useApp } from '@/store/app-store'
import { useDashboard, useScope, useManagerTeachers } from '@/hooks/use-data'
import { ProgressRing, ProgressBar } from '@/components/shared/progress'
import { Icon } from '@/components/shared/icon'
import { StatusBadge } from '@/components/shared/badges'
import { LoadingState, ErrorState } from '@/components/shared/states'
import { SECTIONS, SECTION_MAP, SECTION_ACTION, TYPE_MAP, QUICK_ADD } from '@/lib/constants'
import { relTime, formatDateShort, formatNumber } from '@/lib/format'
import { getGenderedLabels } from '@/lib/gender'
import { COMPLETION_DISCLAIMER } from '@/lib/official-framework-constants'

function greeting() {
  const h = new Date().getHours()
  if (h >= 4 && h < 12) return 'صباح الخير'
  return 'مساء الخير'
}

function firstName(name?: string) {
  if (!name) return ''
  const parts = name.split(' ')
  return parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0]
}

export function DashboardView() {
  const { data, isLoading, error, refetch } = useDashboard()
  const navigate = useApp((s) => s.navigate)
  const openForm = useApp((s) => s.openForm)
  const setViewUser = useApp((s) => s.setViewUser)
  const { readonly } = useScope()

  if (isLoading) return <LoadingState />
  if (error || !data) return <ErrorState message="تعذر تحميل لوحة ملفك." onRetry={() => refetch()} />

  const { user, year, completion, counts, recommendation, recent, drafts } = data
  const recSection = recommendation ? SECTION_MAP[recommendation.section] : null
  const recAction = recommendation ? SECTION_ACTION[recommendation.section as keyof typeof SECTION_ACTION] : null

  const stats = [
    { icon: 'BookOpen', label: 'إنجازًا موثقًا', value: formatNumber(counts.achievements) },
    { icon: 'Rocket', label: 'مبادرات', value: formatNumber(counts.initiatives) },
    { icon: 'GraduationCap', label: 'ساعة تطوير مهني', value: formatNumber(counts.pdHours) },
    { icon: 'HeartPulse', label: 'خطط علاجية', value: formatNumber(counts.remedial) },
  ]
  if (counts.avgImprovement !== null) {
    stats.push({ icon: 'TrendingUp', label: 'متوسط التحسن', value: `+${formatNumber(counts.avgImprovement)}%` })
  }

  return (
    <div className="space-y-5">
      {/* ١ — التحية */}
      <div className="anim-fade-up">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          <span>ملف الإنجاز المهني</span>
        </div>
        <h1 className="text-[24px] font-bold tracking-tight text-foreground sm:text-[1.85rem]">
          {greeting()}، {user.role === 'MANAGER' ? '' : `${getGenderedLabels(user.gender).honorific} `}{firstName(user.name)}
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          {completion.overall >= 85
            ? 'ملف إنجازك لهذا العام يتقدم بشكل رائع — واصل التوثيق.'
            : completion.overall >= 50
            ? 'ملف إنجازك يتقدم بثبات، وكل إنجاز جديد يصنع فرقًا.'
            : 'كل إنجاز صغير تضيفه اليوم يبني ملفك المهني غدًا.'}
          <span className="mx-2 text-border">•</span>
          <span className="text-primary">{year.label}</span>
          {year.archived && <span className="text-muted-foreground"> (مؤرشف)</span>}
        </p>
      </div>

      {/* ٢ — بطاقة الاكتمال ثم التوصية والاختصارات (عمود واحد على الجوال) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* بطاقة الاكتمال الرئيسية */}
        <div className="anim-fade-up anim-delay-1 relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6 lg:col-span-4">
          <div className="pointer-events-none absolute -left-16 -top-16 size-44 rounded-full bg-primary/5 blur-2xl" />
          <div className="relative">
            <div className="mb-1 flex items-center gap-2">
              <Icon name="BadgeCheck" className="size-4.5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">اكتمال ملف الإنجاز</h2>
            </div>
            <p className="mb-4 text-xs leading-5 text-muted-foreground sm:mb-5">
              يُحسب من المحتوى الفعلي في مجالاتك — لا من عدد الملفات.
            </p>
            <div className="flex justify-center py-1 sm:py-2">
              <ProgressRing value={completion.overall} sublabel="اكتمال الملف" />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:gap-2.5">
              <div className="rounded-2xl bg-muted/60 p-2.5 text-center sm:p-3">
                <p className="text-xl font-bold tabular-nums text-foreground">{formatNumber(counts.achievements)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">إنجازًا</p>
              </div>
              <div className="rounded-2xl bg-muted/60 p-2.5 text-center sm:p-3">
                <p className="text-xl font-bold tabular-nums text-foreground">{formatNumber(counts.evidence)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">شاهدًا</p>
              </div>
              <div className="rounded-2xl bg-emerald-50/80 p-2.5 text-center sm:p-3">
                <p className="text-xl font-bold tabular-nums text-emerald-700">{formatNumber(counts.completedSections)}</p>
                <p className="mt-0.5 text-[11px] text-emerald-700/80">مجالًا مكتملًا</p>
              </div>
              <div className="rounded-2xl bg-orange-50/80 p-2.5 text-center sm:p-3">
                <p className="text-xl font-bold tabular-nums text-orange-700">{formatNumber(counts.needsWorkSections)}</p>
                <p className="mt-0.5 text-[11px] text-orange-700/80">تحت استكمالًا</p>
              </div>
            </div>

            <button
              onClick={() => navigate('portfolio')}
              className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-secondary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              عرض ملف الإنجاز كاملًا
              <Icon name="ArrowLeft" className="size-4" />
            </button>
          </div>
        </div>

        <div className="space-y-5 lg:col-span-8">
          {/* توصية واحدة: أكمل ملفك */}
          {recommendation && recSection && (
            <div className="anim-fade-up anim-delay-1 flex flex-wrap items-center gap-4 rounded-3xl border border-orange-200/60 bg-gradient-to-l from-orange-50/90 to-card p-5 shadow-soft">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                <Icon name={recSection.icon} className="size-6" strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-orange-700/90">لديك قسم يحتاج إلى استكمال</p>
                <p className="mt-0.5 text-base font-bold text-foreground">{recSection.title}</p>
                <div className="mt-2 max-w-xs">
                  <ProgressBar value={recommendation.value} thickness="h-1.5" />
                </div>
              </div>
              {readonly ? (
                <button
                  onClick={() => navigate('section', { sectionKey: recommendation.section })}
                  className="flex h-10 items-center gap-2 rounded-full border border-orange-300/70 bg-white px-5 text-sm font-semibold text-orange-800 transition-all hover:bg-orange-50"
                >
                  عرض القسم
                </button>
              ) : recAction?.type ? (
                <button
                  onClick={() => openForm({ type: recAction.type })}
                  className="flex h-10 items-center gap-2 rounded-full bg-orange-600/95 px-5 text-sm font-semibold text-white shadow-soft transition-all hover:bg-orange-600 active:scale-[0.98]"
                >
                  <Icon name="Plus" className="size-4" />
                  إضافة الآن
                </button>
              ) : (
                <button
                  onClick={() => navigate('section', { sectionKey: recommendation.section })}
                  className="flex h-10 items-center gap-2 rounded-full bg-orange-600/95 px-5 text-sm font-semibold text-white shadow-soft transition-all hover:bg-orange-600 active:scale-[0.98]"
                >
                  {recAction?.label ?? 'استكمال القسم'}
                </button>
              )}
            </div>
          )}

          {/* الاختصارات السريعة */}
          {!readonly && (
            <div className="anim-fade-up anim-delay-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">إضافة سريعة</h2>
                <button
                  onClick={() => openForm()}
                  className="flex min-h-9 items-center rounded px-1 text-xs font-medium text-primary transition-colors hover:text-primary/70 focus-visible:outline-2 focus-visible:rounded focus-visible:outline-ring"
                >
                  كل الأنواع
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
                {QUICK_ADD.map((q) => (
                  <button
                    key={q.type}
                    onClick={() => openForm({ type: q.type })}
                    className="group flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-card p-3 text-right transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-0 sm:p-3.5"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon name={q.icon} className="size-4.5" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 text-sm font-medium leading-5 text-foreground">{q.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ٢.٥ — الاكتمال المهني الرسمي (القسم 46): X من الإجمالي + المجالات الثلاثة */}
      {data.professional && data.professional.official.total > 0 && (
        <div className="anim-fade-up anim-delay-1 rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon name="ScrollText" className="size-4.5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">الاكتمال المهني الرسمي</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                <Icon name="BadgeCheck" className="size-3" strokeWidth={2.2} />
                رسمي
              </span>
            </div>
            <button
              onClick={() => navigate('framework')}
              className="flex min-h-9 items-center gap-1.5 rounded px-1 text-xs font-medium text-primary transition-colors hover:text-primary/70 focus-visible:outline-2 focus-visible:rounded focus-visible:outline-ring"
            >
              الإطار المهني
              <Icon name="ArrowLeft" className="size-3.5" />
            </button>
          </div>

          <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl bg-secondary/50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-lg font-bold tabular-nums text-foreground sm:text-xl">
                {formatNumber(data.professional.official.completed)}
                <span className="text-sm font-medium text-muted-foreground"> / {formatNumber(data.professional.official.total)}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">معيارًا فرعيًا مستوفيًا — {COMPLETION_DISCLAIMER}</p>
            </div>
            <div className="shrink-0">
              <ProgressRing value={data.professional.official.percent} size={72} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {data.professional.domains.map((d) => (
              <button
                key={d.id}
                onClick={() => navigate('framework')}
                className="rounded-2xl border border-border bg-card p-3.5 text-right transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <p className="truncate text-[13px] font-bold text-foreground">{d.name}</p>
                <div className="mt-2">
                  <ProgressBar value={d.percent} thickness="h-1.5" />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {formatNumber(d.completedSubs)} من {formatNumber(d.totalSubs)} معايير فرعية · {formatNumber(d.percent)}%
                </p>
              </button>
            ))}
          </div>

          {data.professional.unmappedCount > 0 && (
            <p className="mt-3 rounded-xl bg-amber-50/70 px-3.5 py-2.5 text-[11px] leading-5 text-amber-800">
              <Icon name="ClipboardList" className="ml-1 inline size-3.5 -translate-y-px" />
              <span className="font-bold">{formatNumber(data.professional.unmappedCount)}</span> من إنجازاتك يحتاج تصنيفًا على المعايير — حدّد معيارها ليُحسب في الاكتمال.
            </p>
          )}
        </div>
      )}

      {/* ٤ — النشاط الأخير + المسودات */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="anim-fade-up anim-delay-3 min-w-0 rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5 lg:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">آخر ما أضفته</h2>
            {user.role !== 'MANAGER' && (
              <button
                onClick={() => navigate('journey')}
                className="flex min-h-9 items-center gap-1.5 rounded px-1 text-xs font-medium text-primary transition-colors hover:text-primary/70 focus-visible:outline-2 focus-visible:rounded focus-visible:outline-ring"
              >
                رحلتي المهنية
                <Icon name="ArrowLeft" className="size-3.5" />
              </button>
            )}
          </div>

          {recent.length === 0 ? (
            <div className="py-10 text-center">
              <Icon name="BookOpen" className="mx-auto size-8 text-border" strokeWidth={1.5} />
              <p className="mt-3 text-sm text-muted-foreground">لا توجد إنجازات هنا حتى الآن.</p>
              {!readonly && (
                <button
                  onClick={() => openForm()}
                  className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:shadow-lift"
                >
                  إضافة أول إنجاز
                </button>
              )}
            </div>
          ) : (
            <ol className="relative min-w-0 space-y-1" dir="rtl">
              <span className="absolute bottom-4 right-[19px] top-4 w-px bg-border" aria-hidden="true" />
              {recent.map((a) => {
                const t = TYPE_MAP[a.type as keyof typeof TYPE_MAP]
                return (
                  <li key={a.id} className="min-w-0">
                    <button
                      onClick={() => openForm({ achievementId: a.id })}
                      className="group relative flex w-full items-center gap-3 rounded-2xl p-2.5 text-right transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-xl border bg-card ${t ? 'border-primary/25 text-primary' : 'border-border text-muted-foreground'}`}>
                        <Icon name={t?.icon ?? 'CircleDashed'} className="size-4" strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">{a.title}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {t?.label ?? 'إنجاز'} • {a.date ? relTime(a.date) : relTime(a.createdAt)}
                        </span>
                      </span>
                      <StatusBadge status={a.status} />
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        {/* المسودات */}
        <div className="anim-fade-up anim-delay-4 min-w-0 rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-5 lg:col-span-4">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="SquarePen" className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">مسوداتك غير المكتملة</h2>
          </div>
          {drafts.length === 0 ? (
            <div className="rounded-2xl bg-muted/50 px-4 py-8 text-center">
              <Icon name="CheckCircle2" className="mx-auto size-7 text-emerald-600" strokeWidth={1.7} />
              <p className="mt-2.5 text-xs leading-5 text-muted-foreground">
                لا توجد مسودات معلّقة —
                <br />
                كل إنجازاتك محفوظة مكتملة.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {drafts.map((d) => (
                <button
                  key={d.id}
                  onClick={() => openForm({ achievementId: d.id })}
                  className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-right transition-colors hover:border-primary/40 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{d.title}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">آخر تعديل {relTime(d.updatedAt)}</span>
                  </span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">استكمال</span>
                </button>
              ))}
            </div>
          )}

          {!readonly && year && !year.archived && (
            <div className="mt-5 rounded-2xl bg-secondary/60 p-4">
              <p className="text-xs leading-5 text-secondary-foreground">
                <Icon name="Info" className="ml-1 inline size-3.5 -translate-y-px" />
                يُحفظ عملك تلقائيًا أثناء الكتابة، ويمكنك استكمال أي مسودة لاحقًا دون فقدان شيء.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ٥ — إحصائيات مختصرة: آخر قسم على الجوال، صف كامل على سطح المكتب */}
      <div className="anim-fade-up anim-delay-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0 rounded-2xl border border-border bg-card p-3.5 shadow-soft sm:p-4">
            <Icon name={s.icon} className="size-4.5 text-primary" strokeWidth={1.9} />
            <p className="mt-2 text-lg font-bold tabular-nums tracking-tight text-foreground sm:text-xl">{s.value}</p>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {user.role === 'MANAGER' && !readonly && (
        <ManagerQuickAccess onSelect={(id, name) => { setViewUser(id, name); navigate('dashboard') }} />
      )}
    </div>
  )
}

function ManagerQuickAccess({ onSelect }: { onSelect: (id: string, name: string) => void }) {
  const { data } = useManagerTeachers()
  if (!data?.teachers?.length) return null
  return (
    <div className="anim-fade-up rounded-3xl border border-border bg-card p-5 shadow-soft">
      <h2 className="mb-4 text-sm font-semibold">ملفات إنجاز المعلمين</h2>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {data.teachers.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id, t.name)}
            className="rounded-2xl border border-border bg-card p-4 text-right transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lift"
          >
            <p className="truncate text-sm font-semibold">{t.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.subject}</p>
            <div className="mt-3">
              <ProgressBar value={t.completion} thickness="h-1.5" />
              <p className="mt-1.5 text-[11px] text-muted-foreground">اكتمال {t.completion}%</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
