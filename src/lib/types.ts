// أنواع مشتركة (نسخ JSON متسلسلة من قاعدة البيانات)

export interface TUser {
  id: string
  name: string
  email: string
  role: 'TEACHER' | 'MANAGER' | 'SUPER_ADMIN'
  status?: 'ACTIVE' | 'SUSPENDED'
  gender?: 'MALE' | 'FEMALE' | null
  isDemo?: boolean
  lastLoginAt?: string | null
  school?: string | null
  subject?: string | null
  qualification?: string | null
  experienceYears?: number | null
  stage?: string | null
  classes?: string | null
  licenseNumber?: string | null
  duties?: string | null
  photoUrl?: string | null
  weeklyLoad?: number | null
  schedule?: string | null
  committees?: string | null
  extraDuties?: string | null
  // بيانات جهة العمل — ترويسة التقرير الرسمي
  educationAdmin?: string | null
  educationOffice?: string | null
  principalName?: string | null
}

export interface TYear {
  id: string
  label: string
  archived: boolean
  createdAt: string
}

export interface TAttachment {
  id: string
  title: string
  kind: string
  fileName?: string | null
  fileSize?: number | null
  mimeType?: string | null
  url?: string | null
  keywords?: string | null
  /** حجم عرض الصورة في التقرير — COMPACT (مصغّر، افتراضي) / ORIGINAL (أصلي) — عرض فقط */
  reportDisplaySize?: string | null
  createdAt: string
  links?: { id: string; achievementId?: string | null; goalId?: string | null; goal?: { id: string; title: string } | null }[]
  achievementTitles?: { id: string; title: string; type: string }[]
}

export interface TGoal {
  id: string
  title: string
  description?: string | null
  indicator?: string | null
  targetValue?: number | null
  currentValue?: number | null
  startDate?: string | null
  endDate?: string | null
  scope: string
  achievements?: TAchievement[]
  links?: { attachment?: TAttachment }[]
}

export interface TAchievement {
  id: string
  type: string
  title: string
  field?: string | null
  date?: string | null
  description?: string | null
  goalText?: string | null
  execution?: string | null
  beneficiaries?: string | null
  results?: string | null
  impact?: string | null
  notes?: string | null
  problem?: string | null
  actions?: string | null
  durationText?: string | null
  provider?: string | null
  hours?: number | null
  studentsCount?: number | null
  beneficiariesCount?: number | null
  preScore?: number | null
  postScore?: number | null
  keywords?: string | null
  status: string
  goalId?: string | null
  yearId: string
  createdAt: string
  updatedAt: string
  attachments?: TAttachment[]
  goal?: { id: string; title: string } | null
  // التصنيف داخل الإطار المهني (مجال ← معيار ← معيار فرعي)
  domainId?: string | null
  criterionId?: string | null
  subCriterionId?: string | null
  domain?: { id: string; name: string; isOfficial: boolean } | null
  criterion?: { id: string; name: string; isOfficial: boolean } | null
  subCriterion?: { id: string; name: string; isOfficial: boolean; officialCode?: string | null } | null
}

export interface TReflection {
  term: string
  success?: string | null
  practice?: string | null
  develop?: string | null
  nextTerm?: string | null
  updatedAt: string
}

export interface TDevPlan {
  id: string
  goal: string
  action?: string | null
  period?: string | null
  indicator?: string | null
  result?: string | null
}

// ─── الإطار المهني الرسمي (عقد الواجهة — نسخ JSON من محرك الاكتمال) ───

export interface TSubCriterionNode {
  id: string
  name: string
  description: string | null
  isOfficial: boolean
  officialCode: string | null
  sortOrder: number
  archived: boolean
  completed: boolean
  completedNoEvidence: boolean
  achievementsCount: number
  evidenceCount: number
  lastUpdatedAt: string | null
}

export interface TCriterionNode {
  id: string
  name: string
  description: string | null
  isOfficial: boolean
  officialCode: string | null
  sortOrder: number
  archived: boolean
  completedSubs: number
  totalSubs: number
  percent: number
  subs: TSubCriterionNode[]
}

export interface TDomainNode {
  id: string
  name: string
  description: string | null
  isOfficial: boolean
  officialCode: string | null
  sortOrder: number
  scope: string
  schoolId: string | null
  archived: boolean
  criteriaCount: number
  completedSubs: number
  totalSubs: number
  percent: number
  criteria: TCriterionNode[]
}

export interface FrameworkData {
  source: { authority: string; document: string; edition: string; isbn: string; approval: string }
  schoolName: string | null
  canManage: boolean
  manageSchoolId: string | null
  domains: TDomainNode[]
  official: { completed: number; total: number; percent: number }
  custom: { completed: number; total: number; percent: number } | null
  unmappedCount: number
}

export interface DashboardData {
  user: TUser
  year: TYear
  years: TYear[]
  completion: { overall: number; sections: Record<string, number> }
  counts: {
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
  recommendation: { section: import('./constants').SectionKey; value: number } | null
  recent: TAchievement[]
  drafts: TAchievement[]
  professional?: {
    official: { completed: number; total: number; percent: number }
    custom: { completed: number; total: number; percent: number } | null
    domains: { id: string; name: string; completedSubs: number; totalSubs: number; percent: number }[]
    unmappedCount: number
  }
}
