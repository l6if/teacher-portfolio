'use client'

import { useApp } from '@/store/app-store'
import { useDashboard } from '@/hooks/use-data'
import { SECTION_MAP, SECTION_ACTION } from '@/lib/constants'
import { PageHeader, SectionIcon } from '@/components/shared/page-header'
import { LoadingState, ErrorState } from '@/components/shared/states'
import { ProgressBar } from '@/components/shared/progress'
import { Icon } from '@/components/shared/icon'
import { AchievementList } from './section-parts/achievement-list'
import { GoalsSection } from './section-parts/goals'
import { ReflectionSection } from './section-parts/reflection'
import { DevPlanSection } from './section-parts/devplan'
import { OutcomesSection } from './section-parts/outcomes'
import { AwardsTimeline } from './section-parts/awards'
import { ProfileSection, AssignmentSection } from './section-parts/profile'

export function SectionView() {
  const sectionKey = useApp((s) => s.sectionKey)
  const openForm = useApp((s) => s.openForm)
  const { data, isLoading, error, refetch } = useDashboard()

  if (!sectionKey) return null
  const section = SECTION_MAP[sectionKey]
  if (!section) return null

  if (isLoading) return <LoadingState />
  if (error || !data) return <ErrorState message="تعذر تحميل هذا المجال." onRetry={() => refetch()} />

  const completion = data.completion.sections[sectionKey] ?? 0
  const readonly = Boolean(data.readonly)
  const action = SECTION_ACTION[sectionKey as keyof typeof SECTION_ACTION]

  const header = (
    <PageHeader
      crumbs={[{ label: 'ملف إنجازي', onClick: () => useApp.getState().navigate('portfolio') }, { label: section.title }]}
      title={section.title}
      description={section.desc}
      icon={section.icon}
      actions={
        <>
          <div className="hidden items-center gap-2.5 rounded-full border border-border bg-card px-3.5 py-1.5 sm:flex">
            <span className="text-xs text-muted-foreground">اكتمال المجال</span>
            <span className="text-sm font-bold tabular-nums text-primary">{completion}%</span>
          </div>
          {!readonly && action?.type && (
            <button
              onClick={() => openForm({ type: action.type })}
              className="flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:bg-primary/90 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
            >
              <Icon name="Plus" className="size-4" />
              {action.label}
            </button>
          )}
        </>
      }
    />
  )

  const body = () => {
    switch (sectionKey) {
      case 'profile': return <ProfileSection readonly={readonly} />
      case 'assignment': return <AssignmentSection readonly={readonly} />
      case 'goals': return <GoalsSection readonly={readonly} />
      case 'reflection': return <ReflectionSection readonly={readonly} />
      case 'devplan': return <DevPlanSection readonly={readonly} />
      case 'outcomes': return <OutcomesSection />
      case 'awards': return <AwardsTimeline />
      default:
        return (
          <div className="space-y-4">
            <div className="sm:hidden">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">اكتمال المجال</span>
                <span className="font-bold tabular-nums text-primary">{completion}%</span>
              </div>
              <ProgressBar value={completion} thickness="h-1.5" />
            </div>
            <AchievementList
              types={section.types ?? []}
              emptyIcon={section.icon}
              emptyTitle={`لا توجد عناصر في ${section.title} حتى الآن`}
              emptyDescription="ابدأ بإضافة أول عنصر — الخطوة الأولى دائمًا أصغر مما تتوقع، وكل توثيق يبني ملفك."
              addType={action?.type}
            />
          </div>
        )
    }
  }

  return (
    <div>
      {header}
      {body()}
    </div>
  )
}
