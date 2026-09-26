// أنواع مشتركة (نسخ JSON متسلسلة من قاعدة البيانات)

export interface TUser {
  id: string
  name: string
  email: string
  role: 'TEACHER' | 'MANAGER'
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
  createdAt: string
  links?: { id: string; achievementId?: string | null; goalId?: string | null }[]
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
  recommendation: { section: string; value: number } | null
  recent: TAchievement[]
  drafts: TAchievement[]
}
