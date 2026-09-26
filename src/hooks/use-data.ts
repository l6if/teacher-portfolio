'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApp } from '@/store/app-store'
import type { DashboardData, TAchievement, TGoal, TAttachment, TReflection, TDevPlan, TYear, TUser } from '@/lib/types'

async function j<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? 'تعذر تحميل البيانات')
  }
  return res.json()
}

/** تحويل روابط الشواهد إلى مصفوفة مرفقات على كل إنجاز */
function withAttachments<T extends { links?: { attachment?: unknown }[] }>(raw: T): T & { attachments: unknown[] } {
  return { ...raw, attachments: (raw.links ?? []).map((l) => l.attachment).filter((a): a is NonNullable<typeof a> => Boolean(a)) }
}

function mapAchievements(list: unknown[]): TAchievement[] {
   
  return list.map((a) => withAttachments(a as any) as TAchievement)
}

export interface SessionData {
  user: TUser
  years: TYear[]
  year: TYear | null
}

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async (): Promise<SessionData | null> => {
      const res = await fetch('/api/me')
      if (res.status === 401) return null
      if (!res.ok) throw new Error('تعذر التحقق من الجلسة')
      return res.json()
    },
    staleTime: 60_000,
  })
}

/** نطاق الاستعلام: السنة + المستخدم الهدف (للمدير) */
export function useScope() {
  const yearId = useApp((s) => s.yearId)
  const viewUserId = useApp((s) => s.viewUserId)
  const qs = (extra: Record<string, string | undefined | null> = {}) => {
    const p = new URLSearchParams()
    if (yearId) p.set('yearId', yearId)
    if (viewUserId) p.set('userId', viewUserId)
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== null && v !== '') p.set(k, v)
    }
    return p.toString()
  }
  return { yearId, viewUserId, readonly: Boolean(viewUserId), qs }
}

export function useDashboard() {
  const { qs } = useScope()
  return useQuery<DashboardData & { readonly?: boolean }>({
    queryKey: ['dashboard', qs()],
    queryFn: async () => {
      const d = await j<DashboardData & { readonly?: boolean; recent: unknown[]; drafts: unknown[] }>(`/api/dashboard?${qs()}`)
      return { ...d, recent: mapAchievements(d.recent), drafts: mapAchievements(d.drafts) }
    },
  })
}

export function useAchievements(filters: { type?: string; status?: string; section?: string; q?: string; goalId?: string } = {}) {
  const { qs } = useScope()
  const key = qs(filters)
  return useQuery<{ achievements: TAchievement[]; goals: { id: string; title: string }[]; year: TYear; readonly?: boolean }>({
    queryKey: ['achievements', key],
    queryFn: async () => {
      const d = await j<{ achievements: unknown[]; goals: { id: string; title: string }[]; year: TYear; readonly?: boolean }>(`/api/achievements?${key}`)
      return { ...d, achievements: mapAchievements(d.achievements) }
    },
  })
}

export function useGoals() {
  const { qs } = useScope()
  return useQuery<{ goals: TGoal[]; year: TYear; readonly?: boolean }>({
    queryKey: ['goals', qs()],
    queryFn: () => j(`/api/goals?${qs()}`),
  })
}

export function useAttachments(filters: { kind?: string; q?: string; linked?: string } = {}) {
  const { qs } = useScope()
  const key = qs(filters)
  return useQuery<{ attachments: TAttachment[]; year: TYear; readonly?: boolean }>({
    queryKey: ['attachments', key],
    queryFn: () => j(`/api/attachments?${key}`),
  })
}

export function useReflection(term = 'TERM1') {
  const { qs } = useScope()
  return useQuery<{ reflection: TReflection | null; readonly?: boolean }>({
    queryKey: ['reflection', qs({ term })],
    queryFn: () => j(`/api/reflection?${qs({ term })}`),
  })
}

export function useDevPlans() {
  const { qs } = useScope()
  return useQuery<{ plans: TDevPlan[]; year: TYear; readonly?: boolean }>({
    queryKey: ['devplan', qs()],
    queryFn: () => j(`/api/devplan?${qs()}`),
  })
}

export function useReport() {
  const { qs } = useScope()
  return useQuery<ReportData>({
    queryKey: ['report', qs()],
    queryFn: async () => {
      const d = await j<ReportData & { achievements: unknown[] }>(`/api/report?${qs()}`)
      return { ...d, achievements: mapAchievements(d.achievements) }
    },
    staleTime: 30_000,
  })
}

export interface ReportData {
  user: TUser
  year: TYear
  goals: TGoal[]
  achievements: TAchievement[]
  attachments: TAttachment[]
  reflection: TReflection | null
  devPlans: TDevPlan[]
  completion: { overall: number; sections: Record<string, number>; counts: ReportCounts }
  readonly?: boolean
}

export interface ReportCounts {
  achievements: number
  evidence: number
  completedSections: number
  needsWorkSections: number
  initiatives: number
  pdHours: number
  remedial: number
  avgImprovement: number | null
  beneficiaries: number
}

export function useManagerTeachers() {
  return useQuery<{
    teachers: {
      id: string; name: string; subject?: string | null; school?: string | null
      completion: number; achievements: number; evidence?: number
      lastUpdate: string | null; yearLabel: string
    }[]
  }>({
    queryKey: ['manager-teachers'],
    queryFn: () => j('/api/manager/teachers'),
  })
}

export function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries()
}
