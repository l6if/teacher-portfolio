'use client'

import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useApp } from '@/store/app-store'
import { useSession } from '@/hooks/use-data'
import { LoginScreen } from './login-screen'
import { AppShell } from './app-shell'
import { DashboardView } from '@/components/views/dashboard-view'
import { PortfolioView } from '@/components/views/portfolio-view'
import { SectionView } from '@/components/views/section-view'
import { EvidenceView } from '@/components/views/evidence-view'
import { ReportsView } from '@/components/views/reports-view'
import { JourneyView } from '@/components/views/journey-view'
import { ManagerView } from '@/components/views/manager-view'
import { ProfileView } from '@/components/views/profile-view'
import { SearchOverlay } from '@/components/views/search-overlay'
import { AchievementSheet } from '@/components/achievement/achievement-sheet'
import { ReportPrint } from '@/components/report/report-print'
import { ReportPreview } from '@/components/report/report-preview'
import { Icon } from '@/components/shared/icon'

function ViewRouter() {
  const view = useApp((s) => s.view)
  switch (view) {
    case 'portfolio': return <PortfolioView />
    case 'section': return <SectionView />
    case 'evidence': return <EvidenceView />
    case 'reports': return <ReportsView />
    case 'journey': return <JourneyView />
    case 'manager': return <ManagerView />
    case 'profile': return <ProfileView />
    default: return <DashboardView />
  }
}

function SplashScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="flex size-14 animate-pulse items-center justify-center rounded-3xl bg-primary/10">
        <Icon name="GraduationCap" className="size-7 text-primary" strokeWidth={1.6} />
      </div>
      <p className="text-sm text-muted-foreground">جارٍ تحميل ملفك…</p>
    </div>
  )
}

function AppInner() {
  const { data: session, isLoading, error } = useSession()
  const searchOpen = useApp((s) => s.searchOpen)
  const setSearchOpen = useApp((s) => s.setSearchOpen)
  const view = useApp((s) => s.view)
  const viewUserId = useApp((s) => s.viewUserId)
  const navigate = useApp((s) => s.navigate)

  // توجيه المدير إلى ملفات المعلمين افتراضيًا
  useEffect(() => {
    if (session?.user?.role === 'MANAGER' && !viewUserId && view !== 'manager') {
      navigate('manager')
    }
  }, [session, viewUserId, view, navigate])

  // اختصار لوحة المفاتيح للبحث
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target as HTMLElement)?.closest('input, textarea, [contenteditable]')) {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSearchOpen])

  if (isLoading) return <SplashScreen />
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div>
          <p className="font-semibold text-foreground">تعذر الاتصال بالخادم</p>
          <button onClick={() => location.reload()} className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
            إعادة المحاولة
          </button>
        </div>
      </div>
    )
  }
  if (!session?.user) return <LoginScreen />

  return (
    <>
      <div id="app-shell">
        <AppShell>
          <ViewRouter />
        </AppShell>
      </div>
      <AchievementSheet />
      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
      {/* معاينة التقرير — طبقة مستقلة فوق التطبيق؛ الإعداد يبقى محمّلاً بحالته */}
      <ReportPreview />
      <div id="print-root">
        <ReportPrint />
      </div>
    </>
  )
}

export function AppRoot() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  )
}
