'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useApp } from '@/store/app-store'
import { useSession } from '@/hooks/use-data'
import { Icon } from '@/components/shared/icon'
import { YearSwitcher } from './year-switcher'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface NavItem {
  view: 'dashboard' | 'portfolio' | 'evidence' | 'framework' | 'reports' | 'journey' | 'manager'
  label: string
  icon: string
}

const NAV: NavItem[] = [
  { view: 'dashboard', label: 'الرئيسية', icon: 'LayoutDashboard' },
  { view: 'portfolio', label: 'ملف إنجازي', icon: 'FolderOpen' },
  { view: 'framework', label: 'الإطار المهني', icon: 'ScrollText' },
  { view: 'evidence', label: 'الشواهد', icon: 'LibraryBig' },
  { view: 'reports', label: 'التقارير', icon: 'FileText' },
  { view: 'journey', label: 'رحلتي المهنية', icon: 'Route' },
]

const MANAGER_NAV: NavItem = { view: 'manager', label: 'ملفات المعلمين', icon: 'Users' }

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const view = useApp((s) => s.view)
  const navigate = useApp((s) => s.navigate)
  const openForm = useApp((s) => s.openForm)
  const setSearchOpen = useApp((s) => s.setSearchOpen)
  const viewUserId = useApp((s) => s.viewUserId)
  const setViewUser = useApp((s) => s.setViewUser)
  const viewUserName = useApp((s) => s.viewUserName)
  const qc = useQueryClient()

  const user = session?.user
  const isManager = user?.role === 'MANAGER'
  const readonly = Boolean(viewUserId)
  const nav = isManager && !readonly
    ? [{ view: 'dashboard' as const, label: 'الرئيسية', icon: 'LayoutDashboard' }, MANAGER_NAV]
    : NAV
  const mobileNav = isManager && !readonly
    ? [{ view: 'dashboard' as const, label: 'الرئيسية', icon: 'LayoutDashboard' }, MANAGER_NAV]
    : NAV.slice(0, 5)

  const logout = async () => {
    await fetch('/api/session', { method: 'DELETE' })
    await qc.invalidateQueries()
    toast('تم تسجيل الخروج')
  }

  // إخفاء زر الإضافة العائم عند فتح نموذج الإنجاز حتى لا يغطي الحقول (اشتقاق مباشر)
  const formOpen = useApp((s) => s.formOpen)
  const fabVisible = !formOpen

  const NavButton = ({ item, mobile = false }: { item: NavItem; mobile?: boolean }) => {
    const active = view === item.view
    if (mobile) {
      return (
        <button
          onClick={() => navigate(item.view)}
          className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl pb-1.5 pt-2 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
            active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-current={active ? 'page' : undefined}
        >
          <span className={`flex size-8 items-center justify-center rounded-xl transition-colors ${active ? 'bg-primary/10' : ''}`}>
            <Icon name={item.icon} className="size-[18px]" strokeWidth={active ? 2.2 : 1.8} />
          </span>
          {item.label}
        </button>
      )
    }
    return (
      <button
        onClick={() => navigate(item.view)}
        className={`group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          active ? 'bg-secondary font-semibold text-secondary-foreground' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
        }`}
        aria-current={active ? 'page' : undefined}
      >
        {active && <span className="absolute inset-y-2 -right-1.5 w-1 rounded-full bg-primary" />}
        <Icon name={item.icon} className={`size-[18px] ${active ? 'text-primary' : ''}`} strokeWidth={1.9} />
        {item.label}
      </button>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* الشريط الجانبي — يسار الشاشة في RTL */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-l border-sidebar-border bg-sidebar lg:flex">
        <div className="flex items-center gap-3 px-5 pb-5 pt-6">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary shadow-soft">
            <Icon name="GraduationCap" className="size-5.5 text-primary-foreground" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold tracking-tight">ملف إنجاز المعلم</p>
            <p className="truncate text-[11px] text-muted-foreground">{user?.school ?? 'المدرسة'}</p>
          </div>
        </div>

        <nav className="scrollbar-slim flex-1 space-y-1 overflow-y-auto px-3" aria-label="التنقل الرئيسي">
          {nav.map((item) => <NavButton key={item.view} item={item} />)}
        </nav>

        <div className="space-y-3 border-t border-sidebar-border p-3">
          <YearSwitcher />
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl p-2 text-right transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-bold text-primary">
                  {user?.name?.slice(0, 1) ?? 'م'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{user?.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {isManager ? 'مديرة المدرسة' : user?.subject ?? 'معلم'}
                  </p>
                </div>
                <Icon name="ChevronDown" className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">الحساب</DropdownMenuLabel>
              <DropdownMenuItem onClick={logout} className="gap-2 text-destructive focus:text-destructive">
                <Icon name="LogOut" className="size-4" />
                تسجيل الخروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* الشريط العلوي */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
          {readonly && (
            <div className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
              <Icon name="Eye" className="size-3.5" />
              <span>وضع القراءة — ملف {viewUserName}</span>
              <button
                onClick={() => { setViewUser(null); navigate('manager') }}
                className="mr-2 rounded-full border border-amber-300 bg-white/70 px-3 py-0.5 transition-colors hover:bg-white"
              >
                عودة لملفات المعلمين
              </button>
            </div>
          )}
          <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-2 px-3 sm:gap-3 sm:px-6">
            {/* شعار الجوال */}
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary shadow-soft">
                <Icon name="GraduationCap" className="size-4.5 text-primary-foreground" strokeWidth={1.8} />
              </div>
              <span className="hidden text-sm font-bold min-[390px]:inline">ملف إنجازي</span>
            </div>

            {/* مبدّل السنوات — للجوال فقط (يبقى في الشريط الجانبي على سطح المكتب) */}
            <div className="mr-auto lg:hidden">
              <YearSwitcher compact />
            </div>

            <div className="hidden flex-1 lg:block" />

            {/* البحث */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:border-primary/40 hover:shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto sm:gap-2.5 sm:px-4 sm:text-sm sm:hover:gap-2.5 md:w-80"
              aria-label="بحث شامل"
            >
              <Icon name="Search" className="size-4.5 shrink-0" />
              <span className="hidden sm:inline">ابحث في ملفك…</span>
              <kbd className="mr-auto hidden rounded-md border border-border bg-muted px-1.5 text-[10px] text-muted-foreground md:block" dir="ltr">/</kbd>
            </button>

            {/* إضافة إنجاز — للمعلم فقط، على سطح المكتب (على الجوال زر عائم) */}
            {user?.role === 'TEACHER' && (
              <button
                onClick={() => openForm()}
                className="hidden h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:bg-primary/90 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98] lg:flex"
              >
                <Icon name="Plus" className="size-4.5" />
                <span>إضافة إنجاز</span>
              </button>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-36 pt-5 sm:px-6 sm:pt-6 lg:pb-12">
          {children}
        </main>
      </div>

      {/* زر الإضافة العائم — الجوال فقط، فوق شريط التنقل مباشرة */}
      {user?.role === 'TEACHER' && !readonly && fabVisible && (
        <button
          onClick={() => openForm()}
          className="fab-add fixed z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform hover:bg-primary/95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95 lg:hidden"
          aria-label="إضافة إنجاز جديد"
        >
          <Icon name="Plus" className="size-6" strokeWidth={2.2} />
        </button>
      )}

      {/* شريط التنقل السفلي — الجوال */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md lg:hidden" aria-label="التنقل السفلي" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch px-1.5 pt-1">
          {mobileNav.map((item) => <NavButton key={item.view} item={item} mobile />)}
        </div>
      </nav>
    </div>
  )
}


