'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '@/components/shared/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

// ═══ أنواع البيانات (من واجهات API الفعلية) ═══════════════════

interface StatsData {
  users: {
    total: number
    teachers: { male: number; female: number; unknown: number }
    managers: number
    superAdmins: number
    active: number
    suspended: number
    demo: number
    newLast30Days: number
    schools: number
  }
  content: { achievements: number; attachments: number }
  ai: {
    totalRequests: number
    today: number
    failures: number
    successRate: number | null
    byAction: { action: string; count: number }[]
    daily: { day: string; total: number; ok: number }[]
  }
  recentUsers: AdminUser[]
}

interface AdminUser {
  id: string
  name: string
  email: string
  role: 'TEACHER' | 'MANAGER' | 'SUPER_ADMIN'
  gender: 'MALE' | 'FEMALE' | null
  status: 'ACTIVE' | 'SUSPENDED'
  isDemo: boolean
  school: string | null
  createdAt: string
  lastLoginAt: string | null
  _count?: { achievements: number; attachments: number }
}

interface UsersResponse {
  users: AdminUser[]
  total: number
  page: number
  pageSize: number
  schools: string[]
}

interface DeletionImpact {
  achievements: number
  goals: number
  years: number
  attachments: number
  evidenceLinks: number
  reflections: number
  devPlans: number
  storedFiles: number
  aiLogs: number
}

const ROLE_LABELS: Record<string, string> = {
  TEACHER: 'معلم/ـة',
  MANAGER: 'مدير',
  SUPER_ADMIN: 'مسؤول منصة',
}

const ACTION_LABELS: Record<string, string> = {
  suggestObjectives: 'اقتراح الأهداف',
  suggestGeneralObjective: 'الهدف العام',
  suggestExecution: 'تفاصيل التنفيذ',
  improveText: 'تحسين الصياغة',
  proofread: 'تدقيق لغوي',
  suggestRecommendations: 'التوصيات',
  suggestInitiative: 'اقتراح مبادرة',
  suggestRemedialPlan: 'خطة علاجية',
  suggestImpact: 'صياغة الأثر',
  summarize: 'تلخيص',
}

// ═══ بطاقة إحصائية ═══════════════════════════════════════════

function StatCard({
  label,
  value,
  icon,
  hint,
  tone = 'default',
}: {
  label: string
  value: string | number
  icon: string
  hint?: string
  tone?: 'default' | 'primary' | 'warning' | 'danger'
}) {
  const toneClasses = {
    default: 'bg-secondary text-primary',
    primary: 'bg-primary/12 text-primary',
    warning: 'bg-amber-500/12 text-amber-600',
    danger: 'bg-destructive/10 text-destructive',
  }
  return (
    <div className="rounded-3xl border border-border bg-card p-4 anim-fade-up sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{value}</p>
          {hint && <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{hint}</p>}
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${toneClasses[tone]}`}>
          <Icon name={icon} className="size-5" strokeWidth={1.8} />
        </span>
      </div>
    </div>
  )
}

// ═══ لوحة مسؤول المنصة ═══════════════════════════════════════

export function SuperAdminDashboard({ adminName }: { adminName: string }) {
  const [tab, setTab] = useState<'overview' | 'users' | 'ai'>('overview')

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      {/* الترويسة */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
              <Icon name="ShieldCheck" className="size-5" strokeWidth={1.9} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground sm:text-base">لوحة مسؤول المنصة</h1>
              <p className="text-[11px] text-muted-foreground">{adminName}</p>
            </div>
          </div>
          <nav className="flex items-center gap-1 rounded-full border border-border bg-secondary/60 p-1" role="tablist" aria-label="أقسام اللوحة">
            {([
              { key: 'overview', label: 'نظرة عامة', icon: 'LayoutDashboard' },
              { key: 'users', label: 'المستخدمون', icon: 'Users' },
              { key: 'ai', label: 'الذكاء الاصطناعي', icon: 'Sparkles' },
            ] as const).map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all sm:px-4 sm:text-sm ${
                  tab === t.key ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name={t.icon} className="size-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </nav>
          <a
            href="/"
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon name="ArrowRight" className="size-4" />
            التطبيق
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'ai' && <AiTab />}
      </main>
    </div>
  )
}

// ═══ تبويب النظرة العامة ═════════════════════════════════════

function OverviewTab() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/super-admin/stats')
      if (!res.ok) throw new Error()
      setStats(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-3xl border border-border bg-secondary/40" />
        ))}
      </div>
    )
  }
  if (error || !stats) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <p className="text-sm font-medium text-foreground">تعذر تحميل الإحصائيات</p>
        <Button onClick={load} size="sm" className="mt-4">إعادة المحاولة</Button>
      </div>
    )
  }

  const u = stats.users
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="إجمالي المستخدمين" value={u.total} icon="Users" hint={`${u.newLast30Days} مستخدمًا جديدًا آخر 30 يومًا`} tone="primary" />
        <StatCard label="المعلمون" value={u.teachers.male + u.teachers.female + u.teachers.unknown} icon="GraduationCap" hint={`${u.teachers.male} ذكر • ${u.teachers.female} أنثى • ${u.teachers.unknown} غير محدد`} />
        <StatCard label="المديرون" value={u.managers} icon="ClipboardList" />
        <StatCard label="حسابات نشطة" value={u.active} icon="CircleCheck" />
        <StatCard label="حسابات موقوفة" value={u.suspended} icon="CircleSlash" tone={u.suspended > 0 ? 'danger' : 'default'} />
        <StatCard label="المدارس" value={u.schools} icon="School" hint="مدارس مميزة في البيانات الفعلية" />
        <StatCard label="الإنجازات الموثقة" value={stats.content.achievements} icon="Trophy" />
        <StatCard label="الشواهد والمرفقات" value={stats.content.attachments} icon="Paperclip" />
      </div>

      {/* أحدث المستخدمين */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
          <Icon name="UserPlus" className="size-4 text-primary" />
          مستخدمون جدد مؤخرًا
        </h3>
        <div className="space-y-2">
          {stats.recentUsers.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">لا مستخدمين بعد</p>
          )}
          {stats.recentUsers.map((user) => (
            <div key={user.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-background px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {user.name?.slice(0, 1) || '؟'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {user.name}
                    {user.isDemo && <span className="ms-2 text-[10px] text-muted-foreground">(تجريبي)</span>}
                  </p>
                  <p dir="ltr" className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Badge variant="secondary" className="text-[10px]">{ROLE_LABELS[user.role]}</Badge>
                {user.status === 'SUSPENDED' && <Badge variant="destructive" className="text-[10px]">موقوف</Badge>}
                <span>{new Date(user.createdAt).toLocaleDateString('ar-SA')}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ═══ تبويب المستخدمين ════════════════════════════════════════

function UsersTab() {
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [gender, setGender] = useState('')
  const [status, setStatus] = useState('')
  const [school, setSchool] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyUser, setBusyUser] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ user: AdminUser; impact: DeletionImpact } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (role) params.set('role', role)
      if (gender) params.set('gender', gender)
      if (status) params.set('status', status)
      if (school) params.set('school', school)
      params.set('page', String(page))
      params.set('pageSize', '20')
      const res = await fetch(`/api/super-admin/users?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      toast.error('تعذر تحميل المستخدمين')
    } finally {
      setLoading(false)
    }
  }, [q, role, gender, status, school, page])

  useEffect(() => {
    const t = setTimeout(load, q ? 350 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  const act = async (userId: string, action: string, extra: Record<string, unknown> = {}) => {
    if (busyUser) return
    setBusyUser(userId)
    try {
      const res = await fetch(`/api/super-admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? 'تعذر تنفيذ الإجراء')
        return
      }
      toast.success(body.message ?? 'تم')
      load()
    } catch {
      toast.error('تعذر الاتصال بالخادم')
    } finally {
      setBusyUser(null)
    }
  }

  const previewDelete = async (user: AdminUser) => {
    try {
      const res = await fetch(`/api/super-admin/users/${user.id}`)
      const body = await res.json()
      if (!res.ok) {
        toast.error(body.error ?? 'تعذر جلب أثر الحذف')
        return
      }
      setDeleteTarget({ user, impact: body.deletionImpact })
    } catch {
      toast.error('تعذر الاتصال بالخادم')
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const { user, impact } = deleteTarget
    setBusyUser(user.id)
    try {
      const res = await fetch(`/api/super-admin/users/${user.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: 'CONFIRM',
          confirmCount: impact.achievements + impact.attachments + impact.goals,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? 'تعذر الحذف')
        return
      }
      toast.success(body.message ?? 'تم الحذف النهائي')
      setDeleteTarget(null)
      load()
    } catch {
      toast.error('تعذر الاتصال بالخادم')
    } finally {
      setBusyUser(null)
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const roleOf = (r: string) => ROLE_LABELS[r] ?? r

  return (
    <div className="space-y-4">
      {/* أدوات البحث والفلترة */}
      <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-border bg-card p-3 sm:p-4">
        <div className="relative min-w-52 flex-1">
          <Icon name="Search" className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            placeholder="بحث بالاسم أو البريد…"
            className="bg-background pr-10"
            aria-label="بحث بالمستخدمين"
          />
        </div>
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1) }} aria-label="فلترة الدور" className="h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground">
          <option value="">كل الأدوار</option>
          <option value="TEACHER">معلم/ـة</option>
          <option value="MANAGER">مدير</option>
          <option value="SUPER_ADMIN">مسؤول منصة</option>
        </select>
        <select value={gender} onChange={(e) => { setGender(e.target.value); setPage(1) }} aria-label="فلترة الجنس" className="h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground">
          <option value="">كلا الجنسين</option>
          <option value="MALE">ذكر</option>
          <option value="FEMALE">أنثى</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} aria-label="فلترة الحالة" className="h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground">
          <option value="">كل الحالات</option>
          <option value="ACTIVE">نشط</option>
          <option value="SUSPENDED">موقوف</option>
        </select>
        {data && data.schools.length > 0 && (
          <select value={school} onChange={(e) => { setSchool(e.target.value); setPage(1) }} aria-label="فلترة المدرسة" className="h-9 max-w-44 rounded-xl border border-border bg-background px-3 text-xs text-foreground">
            <option value="">كل المدارس</option>
            {data.schools.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {/* الجدول */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-200 text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-right text-[11px] text-muted-foreground">
                <th className="px-4 py-3 font-medium">المستخدم</th>
                <th className="px-4 py-3 font-medium">الدور</th>
                <th className="px-4 py-3 font-medium">الجنس</th>
                <th className="px-4 py-3 font-medium">المدرسة</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">التسجيل</th>
                <th className="px-4 py-3 font-medium">آخر دخول</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    <Icon name="Loader2" className="mx-auto mb-2 size-5 animate-spin" />
                    جارٍ التحميل…
                  </td>
                </tr>
              )}
              {!loading && data?.users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    لا نتائج مطابقة
                  </td>
                </tr>
              )}
              {!loading && data?.users.map((user) => (
                <tr key={user.id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-secondary/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {user.name?.slice(0, 1) || '؟'}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {user.name}
                          {user.isDemo && <span className="ms-1.5 text-[10px] text-muted-foreground">تجريبي</span>}
                        </p>
                        <p dir="ltr" className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      disabled={busyUser === user.id}
                      onChange={(e) => act(user.id, 'setRole', { role: e.target.value, confirm: e.target.value === 'SUPER_ADMIN' ? 'PROMOTE_SUPER_ADMIN' : undefined })}
                      aria-label={`تغيير دور ${user.name}`}
                      className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                    >
                      <option value="TEACHER">معلم/ـة</option>
                      <option value="MANAGER">مدير</option>
                      <option value="SUPER_ADMIN">مسؤول منصة</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {user.gender === 'MALE' ? 'ذكر' : user.gender === 'FEMALE' ? 'أنثى' : '—'}
                  </td>
                  <td className="max-w-36 truncate px-4 py-3 text-xs text-muted-foreground">
                    {user.school ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {user.status === 'SUSPENDED' ? (
                      <Badge variant="destructive" className="text-[10px]">موقوف</Badge>
                    ) : (
                      <Badge className="bg-emerald-600/15 text-[10px] text-emerald-700 hover:bg-emerald-600/15">نشط</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString('ar-SA')}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('ar-SA') : 'لم يدخل بعد'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {user.status === 'ACTIVE' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyUser === user.id}
                          onClick={() => act(user.id, 'suspend')}
                          className="h-8 border-destructive/40 px-3 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          إيقاف
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyUser === user.id}
                          onClick={() => act(user.id, 'activate')}
                          className="h-8 border-emerald-600/40 px-3 text-[11px] text-emerald-700 hover:bg-emerald-600/10"
                        >
                          تفعيل
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyUser === user.id}
                        onClick={() => act(user.id, 'requirePasswordReset')}
                        className="h-8 px-3 text-[11px]"
                        title="إرسال رابط استعادة كلمة المرور للمستخدم"
                      >
                        استعادة
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyUser === user.id}
                        onClick={() => previewDelete(user)}
                        className="h-8 px-3 text-[11px] text-destructive hover:bg-destructive/10"
                        title="حذف نهائي — بمعاينة الأثر أولًا"
                      >
                        حذف
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* ترقيم الصفحات */}
        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>{data.total} مستخدمًا — صفحة {data.page} من {totalPages}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8">السابق</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="h-8">التالي</Button>
            </div>
          </div>
        )}
      </div>

      {/* نافذة معاينة أثر الحذف النهائي */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="معاينة أثر الحذف">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-lift anim-fade-up">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <Icon name="TriangleAlert" className="size-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-foreground">حذف نهائي — معاينة الأثر</h3>
                <p className="text-[11px] text-muted-foreground">{deleteTarget.user.name} · {deleteTarget.user.email}</p>
              </div>
            </div>
            <p className="mb-3 text-xs leading-6 text-muted-foreground">
              سيُحذف نهائيًا كل ما يلي — لا يمكن التراجع:
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ['الإنجازات', deleteTarget.impact.achievements],
                ['الأهداف', deleteTarget.impact.goals],
                ['السنوات الدراسية', deleteTarget.impact.years],
                ['الشواهد والمرفقات', deleteTarget.impact.attachments],
                ['روابط الشواهد', deleteTarget.impact.evidenceLinks],
                ['الملفات المخزنة', deleteTarget.impact.storedFiles],
                ['التأملات', deleteTarget.impact.reflections],
                ['الخطط التطويرية', deleteTarget.impact.devPlans],
                ['سجلات AI', deleteTarget.impact.aiLogs],
              ].map(([label, count]) => (
                <div key={String(label)} className="rounded-xl border border-border bg-background px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className={`text-sm font-bold tabular-nums ${Number(count) > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{Number(count)}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-full">إلغاء</Button>
              <Button
                variant="destructive"
                disabled={busyUser === deleteTarget.user.id}
                onClick={confirmDelete}
                className="rounded-full"
              >
                {busyUser === deleteTarget.user.id ? <Icon name="Loader2" className="size-4 animate-spin" /> : null}
                تأكيد الحذف النهائي
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══ تبويب استخدام الذكاء الاصطناعي ══════════════════════════

function AiTab() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/stats')
      if (!res.ok) throw new Error()
      setStats(await res.json())
    } catch {
      toast.error('تعذر تحميل بيانات الاستخدام')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const maxDaily = useMemo(
    () => (stats ? Math.max(1, ...stats.ai.daily.map((d) => d.total)) : 1),
    [stats],
  )

  if (loading) {
    return <div className="h-64 animate-pulse rounded-3xl border border-border bg-secondary/40" />
  }
  if (!stats) return null

  const ai = stats.ai
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="إجمالي طلبات AI" value={ai.totalRequests} icon="Sparkles" tone="primary" />
        <StatCard label="طلبات آخر 24 ساعة" value={ai.today} icon="Clock" />
        <StatCard label="نسبة النجاح" value={ai.successRate !== null ? `${ai.successRate}%` : '—'} icon="CircleCheck" />
        <StatCard label="طلبات فاشلة" value={ai.failures} icon="CircleX" tone={ai.failures > 0 ? 'warning' : 'default'} />
      </div>

      {/* الاستخدام اليومي */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <h3 className="mb-5 flex items-center gap-2 text-sm font-bold text-foreground">
          <Icon name="BarChart3" className="size-4 text-primary" />
          الاستخدام اليومي — آخر 14 يومًا
        </h3>
        {ai.daily.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">لا استخدام بعد</p>
        ) : (
          <div className="flex h-40 items-end justify-between gap-1.5 sm:gap-2" dir="ltr">
            {ai.daily.map((d) => (
              <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${new Date(d.day).toLocaleDateString('ar-SA')} — ${d.total} طلبًا (${d.ok} ناجح)`}>
                <div className="relative w-full max-w-8 overflow-hidden rounded-lg bg-secondary" style={{ height: '100%' }}>
                  <div
                    className="absolute bottom-0 left-0 w-full rounded-lg bg-primary/25"
                    style={{ height: `${(d.total / maxDaily) * 100}%` }}
                  />
                  <div
                    className="absolute bottom-0 left-0 w-full rounded-lg bg-primary"
                    style={{ height: `${(d.ok / maxDaily) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] tabular-nums text-muted-foreground">{new Date(d.day).getDate()}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-primary" /> ناجحة</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-primary/25" /> الإجمالي</span>
        </div>
      </section>

      {/* أنواع العمليات */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
          <Icon name="ListChecks" className="size-4 text-primary" />
          أنواع العمليات
        </h3>
        {ai.byAction.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">لا عمليات بعد</p>
        ) : (
          <div className="space-y-2">
            {ai.byAction.map((a) => (
              <div key={a.action} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs text-foreground">{ACTION_LABELS[a.action] ?? a.action}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-lg bg-secondary">
                  <div className="h-full rounded-lg bg-primary/70" style={{ width: `${(a.count / Math.max(...ai.byAction.map((x) => x.count))) * 100}%` }} />
                </div>
                <span className="w-10 text-left text-xs tabular-nums text-muted-foreground">{a.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
