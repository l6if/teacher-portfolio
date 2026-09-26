import { db } from './db'
import type { SectionKey } from './constants'

export interface CompletionResult {
  overall: number
  sections: Record<string, number>
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
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

/** قيمة تقدم لمجال مبني على عدد العناصر وثراء المحتوى */
function countProgress(count: number, rich: number): number {
  if (count <= 0) return 0
  const base = count >= 4 ? 90 : count === 3 ? 80 : count === 2 ? 70 : 50
  const bonus = count > 0 ? (rich / count) * 10 : 0
  return clamp(base + bonus)
}

export async function computeCompletion(userId: string, yearId: string): Promise<CompletionResult> {
  const [user, achievements, goals, reflection, devPlans, attachments] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.achievement.findMany({
      where: { userId, yearId },
      include: { links: { include: { attachment: true } } },
    }),
    db.goal.findMany({ where: { userId, yearId } }),
    db.reflection.findFirst({ where: { userId, yearId } }),
    db.devPlan.findMany({ where: { userId, yearId } }),
    db.attachment.count({ where: { userId, yearId } }),
  ])

  const u = user
  const rich = (a: (typeof achievements)[number]) => Boolean(a.results || a.impact)

  const byType = (types: string[]) => achievements.filter((a) => types.includes(a.type))
  const isCompleted = (a: (typeof achievements)[number]) => a.status === 'COMPLETED' || a.status === 'APPROVED'

  // 1. البيانات المهنية — 8 حقول جوهرية
  const profileFields = [u?.school, u?.subject, u?.qualification, u?.experienceYears, u?.stage, u?.classes, u?.licenseNumber, u?.duties]
  const profile = clamp((profileFields.filter(Boolean).length / profileFields.length) * 100)

  // 2. التكليف والنصاب — 4 كتل
  const assignFields = [u?.weeklyLoad, u?.schedule, u?.committees, u?.extraDuties]
  const assignment = clamp((assignFields.filter(Boolean).length / assignFields.length) * 100)

  // 3. الأهداف
  let goalsP = 0
  if (goals.length >= 2) goalsP = 100
  else if (goals.length === 1) goalsP = goals[0].indicator ? 70 : 60

  // المجالات المبنية على الإنجازات
  const planItems = byType(['PLAN'])
  const planning = countProgress(planItems.length, planItems.filter(rich).length)

  const practiceItems = byType(['PRACTICE'])
  const practices = countProgress(practiceItems.length, practiceItems.filter(rich).length)

  const assessItems = byType(['ASSESSMENT'])
  const assessment = countProgress(assessItems.length, assessItems.filter(rich).length)

  // نواتج التعلم — إنجازات بها قياس قبلي/بعدي مكتمل
  const scored = achievements.filter((a) => a.preScore !== null && a.postScore !== null && a.postScore !== undefined && a.preScore !== undefined)
  const outcomes = scored.length >= 3 ? 100 : scored.length === 2 ? 85 : scored.length === 1 ? 60 : 0

  const remedialItems = byType(['REMEDIAL'])
  const remedial = countProgress(remedialItems.length, remedialItems.filter(rich).length)

  const enrichItems = byType(['ENRICHMENT'])
  const enrichment = countProgress(enrichItems.length, enrichItems.filter(rich).length)

  // التطوير المهني — يعتمد على الساعات
  const pdItems = byType(['PD'])
  const pdHours = pdItems.reduce((s, a) => s + (a.hours ?? 0), 0)
  const development = pdHours >= 20 ? 100 : pdHours >= 12 ? 85 : pdHours >= 6 ? 65 : pdHours > 0 ? 40 : 0

  const initItems = byType(['INITIATIVE'])
  const initiatives = countProgress(initItems.length, initItems.filter(rich).length)

  const partItems = byType(['PARTICIPATION', 'ACTIVITY'])
  const participation = countProgress(partItems.length, partItems.filter(rich).length)

  const coopItems = byType(['COOP'])
  const cooperation = countProgress(coopItems.length, coopItems.filter(rich).length)

  const awardItems = byType(['AWARD', 'CERTIFICATE'])
  const awards = countProgress(awardItems.filter(isCompleted).length, awardItems.filter(rich).length)

  // التأمل المهني — 4 أسئلة
  const refQs = reflection ? [reflection.success, reflection.practice, reflection.develop, reflection.nextTerm].filter(Boolean).length : 0
  const reflectionP = clamp((refQs / 4) * 100)

  // الخطة التطويرية
  const devplan = devPlans.length >= 3 ? 100 : devPlans.length === 2 ? 85 : devPlans.length === 1 ? 55 : 0

  const sections: Record<string, number> = {
    profile, assignment, goals: goalsP, planning, practices, assessment, outcomes,
    remedial, enrichment, development, initiatives, participation,
    cooperation, awards, reflection: reflectionP, devplan,
  }

  const overall = clamp(Object.values(sections).reduce((s, v) => s + v, 0) / Object.keys(sections).length)

  const improvements = scored.map((a) => (a.postScore as number) - (a.preScore as number))
  const avgImprovement = improvements.length
    ? Math.round((improvements.reduce((s, v) => s + v, 0) / improvements.length) * 10) / 10
    : null

  return {
    overall,
    sections,
    counts: {
      achievements: achievements.length,
      evidence: attachments,
      completedSections: Object.values(sections).filter((v) => v >= 100).length,
      needsWorkSections: Object.values(sections).filter((v) => v < 100).length,
      initiatives: initItems.length,
      pdHours: Math.round(pdHours),
      remedial: remedialItems.length,
      avgImprovement,
      beneficiaries: achievements.reduce((s, a) => s + (a.beneficiariesCount ?? a.studentsCount ?? 0), 0),
    },
  }
}

/** أول توصية "أكمل ملفك" — مجال واحد فقط في كل مرة */
export function pickRecommendation(sections: Record<string, number>) {
  const order: SectionKey[] = [
    'development', 'initiatives', 'practices', 'planning', 'assessment',
    'remedial', 'enrichment', 'participation', 'cooperation', 'awards',
    'outcomes', 'goals', 'reflection', 'devplan', 'profile', 'assignment',
  ]
  // المجال غير المكتمل ذو النسبة الأدنى ضمن ترتيب الأولويات
  const candidates = order.filter((k) => (sections[k] ?? 0) < 100)
  if (!candidates.length) return null
  let best = candidates[0]
  for (const k of candidates) {
    if ((sections[k] ?? 0) < (sections[best] ?? 0)) best = k
  }
  return { section: best, value: sections[best] ?? 0 }
}
