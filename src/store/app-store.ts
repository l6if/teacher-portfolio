'use client'

import { create } from 'zustand'
import type { SectionKey, AchievementType } from '@/lib/constants'

export type View =
  | 'dashboard' | 'portfolio' | 'section' | 'evidence'
  | 'reports' | 'journey' | 'manager' | 'profile'

export interface PrintConfig {
  mode: 'full' | 'summary' | 'impact' | 'pd' | 'initiatives' | 'custom' | 'official'
  sections: string[]
  title: string
  /** للتقرير الرسمي — معرّف الإنجاز المستهدف */
  achievementId?: string
}

interface AppState {
  view: View
  sectionKey: SectionKey | null
  yearId: string | null
  /** المدير يتصفح ملف معلم آخر */
  viewUserId: string | null
  viewUserName: string | null

  formOpen: boolean
  formType: AchievementType | null
  formAchievementId: string | null

  searchOpen: boolean
  printConfig: PrintConfig | null
  /** معاينة التقرير — مرحلة مستقلة قبل التنزيل */
  previewConfig: PrintConfig | null

  navigate: (view: View, opts?: { sectionKey?: SectionKey }) => void
  openForm: (opts?: { type?: AchievementType | null; achievementId?: string | null }) => void
  closeForm: () => void
  setYear: (yearId: string | null) => void
  setViewUser: (userId: string | null, name?: string | null) => void
  setSearchOpen: (open: boolean) => void
  setPrintConfig: (config: PrintConfig | null) => void
  setPreviewConfig: (config: PrintConfig | null) => void
}

export const useApp = create<AppState>((set) => ({
  view: 'dashboard',
  sectionKey: null,
  yearId: null,
  viewUserId: null,
  viewUserName: null,

  formOpen: false,
  formType: null,
  formAchievementId: null,

  searchOpen: false,
  printConfig: null,
  previewConfig: null,

  navigate: (view, opts) =>
    set((s) => ({
      view,
      sectionKey: opts?.sectionKey ?? (view === 'section' ? s.sectionKey : null),
      searchOpen: false,
    })),
  openForm: (opts) =>
    set({ formOpen: true, formType: opts?.type ?? null, formAchievementId: opts?.achievementId ?? null }),
  closeForm: () => set({ formOpen: false, formType: null, formAchievementId: null }),
  setYear: (yearId) => set({ yearId }),
  setViewUser: (viewUserId, viewUserName) => set({ viewUserId, viewUserName }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setPrintConfig: (printConfig) => set({ printConfig }),
  setPreviewConfig: (previewConfig) => set({ previewConfig }),
}))
