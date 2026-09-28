// ═══ محرك الاكتمال المهني — الحساب الموحد من جهة الخادم ═════════════════
// المبدأ (مواصفة القسم 7-10):
//   Completion = المعايير الفرعية المستوفاة ÷ إجمالي المعايير الفرعية × 100
//
// «مستوفى» (القسم 8): إنجاز واحد على الأقل بحالة مكتمل/معتمد + شاهد مرتبط.
// «التكرار لا يضاعف» (القسم 9): خمسة إنجازات تحت نفس المعيار الفرعي = 1 مستوفى.
// المستويات (القسم 10): فرعي (ثنائي) ← معيار ← مجال ← إجمالي.
// الفصل الصارم (القسم 26): الاكتمال الرسمي من العناصر الرسمية فقط؛
//   والمخصص يُحسب وحده ولا يلمس النسبة الرسمية إطلاقًا.
//
// النطاق: ملف المعلم كاملًا (كل السنوات، بما فيها المؤرشفة) — المعيار
// المهني يتحقق عبر المسيرة لا عبر سنة واحدة؛ التوضيح يظهر في الواجهة.
//
// ⚠️ هذه النسبة مؤشر داخلي لملف الإنجاز داخل التطبيق — وليست درجة
//   رسمية من هيئة تقويم التعليم والتدريب (القسم 45).

import { db } from './db'

export const COMPLETED_STATUSES = ['COMPLETED', 'APPROVED'] as const

/** شرط الاستيفاء لحالة الإنجاز */
export function isFulfilledStatus(status: string): boolean {
  return (COMPLETED_STATUSES as readonly string[]).includes(status)
}

// ─── عقد النتائج (JSON-serializable) ─────────────────────────────────

export interface TSubCriterionNode {
  id: string
  name: string
  description: string | null
  isOfficial: boolean
  officialCode: string | null
  sortOrder: number
  archived: boolean
  /** ثنائي: مستوفى (إنجاز مكتمل + شاهد) أو لا */
  completed: boolean
  /** إنجاز مكتمل بلا شاهد — يظهر «ينقصه شاهد» */
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
  /** عدد المعايير التابعة (غير المؤرشفة) */
  criteriaCount: number
  completedSubs: number
  totalSubs: number
  percent: number
  criteria: TCriterionNode[]
}

export interface ProfessionalCompletion {
  /** شجرة كاملة: رسمي + مخصص (المخصص داخل رسمي أيضًا) — مرتبة */
  domains: TDomainNode[]
  /** الاكتمال الرسمي فقط — لا يتأثر بالمخصص إطلاقًا */
  official: { completed: number; total: number; percent: number }
  /** الاكتمال المخصص فقط — null إن لم توجد عناصر مخصصة */
  custom: { completed: number; total: number; percent: number } | null
  /** إنجازات بانتظار التصنيف (بلا معيار فرعي) — شارة «يحتاج تصنيفًا» */
  unmappedCount: number
}

const pct = (n: number, d: number) => (d <= 0 ? 0 : Math.round((n / d) * 100))

/**
 * الحساب الموحد للاكتمال المهني — يستدعى من /api/framework و
 * /api/dashboard فقط (لا يتكرر في أي Component — القسم 62).
 * @param userId ملف المعلم المستهدف
 * @param schoolId مدرسة المعلم — لجلب العناصر المخصصة المرئية لمدرسته
 */
export async function calculateProfessionalCompletion(
  userId: string,
  schoolId: string | null,
): Promise<ProfessionalCompletion> {
  // استعلامان فقط — لا N+1: (1) الشجرة كاملة، (2) إنجازات المعلم بعدّاداتها.
  // نطاق العناصر (القسم 32): الرسمي عالمي؛ والمخصص (مجالًا كان أو معيارًا/فرعيًا
  // داخل رسمي) لمدرسته حصرًا — مدرسة أخرى لا تراه إطلاقًا.
  const visibleCriterion = { OR: [{ isOfficial: true }, { schoolId }] }
  const visibleSub = { OR: [{ isOfficial: true }, { schoolId }] }
  const [domains, achievements] = await Promise.all([
    db.domain.findMany({
      where: {
        OR: [{ scope: 'GLOBAL' }, { scope: 'SCHOOL', schoolId }],
      },
      orderBy: [{ isOfficial: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        criteria: {
          where: visibleCriterion,
          orderBy: [{ isOfficial: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            subCriteria: {
              where: visibleSub,
              orderBy: [{ isOfficial: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    }),
    db.achievement.findMany({
      where: { userId },
      select: {
        subCriterionId: true,
        criterionId: true,
        domainId: true,
        status: true,
        updatedAt: true,
        _count: { select: { links: true } },
      },
    }),
  ])

  // فهرس الإنجازات حسب المعيار الفرعي (مرة واحدة — O(n))
  const bySub = new Map<
    string,
    { total: number; evidenceTotal: number; fulfilled: boolean; completedNoEvidence: boolean; lastUpdatedAt: Date | null }
  >()
  let unmappedCount = 0

  for (const a of achievements) {
    if (!a.subCriterionId) {
      unmappedCount += 1
      continue
    }
    const entry = bySub.get(a.subCriterionId) ?? {
      total: 0,
      evidenceTotal: 0,
      fulfilled: false,
      completedNoEvidence: false,
      lastUpdatedAt: null as Date | null,
    }
    entry.total += 1
    entry.evidenceTotal += a._count.links
    if (!entry.lastUpdatedAt || a.updatedAt > entry.lastUpdatedAt) entry.lastUpdatedAt = a.updatedAt
    if (isFulfilledStatus(a.status)) {
      if (a._count.links > 0) entry.fulfilled = true
      else entry.completedNoEvidence = true
    }
    bySub.set(a.subCriterionId, entry)
  }

  // بناء الشجرة مع التقدم المنفصل (رسمي/مخصص)
  let officialCompleted = 0
  let officialTotal = 0
  let customCompleted = 0
  let customTotal = 0

  const domainNodes: TDomainNode[] = domains.map((d) => {
    let dCompleted = 0
    let dTotal = 0
    let criteriaCount = 0

    const criteriaNodes: TCriterionNode[] = d.criteria.map((c) => {
      let cCompleted = 0
      let cTotal = 0

      const subNodes: TSubCriterionNode[] = c.subCriteria.map((s) => {
        const agg = bySub.get(s.id)
        const active = s.archivedAt === null
        const completed = !!agg?.fulfilled && active
        // العدّ ضمن التقدم: العناصر النشطة فقط (المؤرشف معتزل لا يُحسب).
        // الرسمية/المخصصة تُحسب بعلم المعيار الفرعي نفسه (وليس معياره الأب):
        // معيار فرعي مخصص داخل معيار رسمي (القسم 25) يُحسب مخصصًا حصرًا —
        // لا يدخل النسبة الرسمية أبدًا (القسم 26).
        // تقدم المعيار نفسه: الرسمي يعدّ فرعياته الرسمية فقط؛ والمخصص كلها.
        const countsInCriterion = c.isOfficial ? s.isOfficial : true
        if (active) {
          if (countsInCriterion) {
            cTotal += 1
            if (completed) cCompleted += 1
          }
          if (s.isOfficial) {
            officialTotal += 1
            if (completed) officialCompleted += 1
          } else {
            customTotal += 1
            if (completed) customCompleted += 1
          }
        }
        return {
          id: s.id,
          name: s.name,
          description: s.description,
          isOfficial: s.isOfficial,
          officialCode: s.officialCode,
          sortOrder: s.sortOrder,
          archived: s.archivedAt !== null,
          completed,
          completedNoEvidence: !!agg?.completedNoEvidence,
          achievementsCount: agg?.total ?? 0,
          evidenceCount: agg?.evidenceTotal ?? 0,
          lastUpdatedAt: agg?.lastUpdatedAt ? agg.lastUpdatedAt.toISOString() : null,
        }
      })

      if (c.archivedAt === null) criteriaCount += 1
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        isOfficial: c.isOfficial,
        officialCode: c.officialCode,
        sortOrder: c.sortOrder,
        archived: c.archivedAt !== null,
        completedSubs: cCompleted,
        totalSubs: cTotal,
        percent: pct(cCompleted, cTotal),
        subs: subNodes,
      }
    })

    // تقدم المجال الرسمي = معاييره الفرعية الرسمية فقط (القسم 67):
    // يتخطى المعايير المخصصة داخله والمعايير الفرعية المخصصة داخل معاييره الرسمية
    if (d.isOfficial) {
      for (const c of criteriaNodes) {
        if (!c.isOfficial) continue
        for (const s of c.subs) {
          if (s.archived || !s.isOfficial) continue
          dTotal += 1
          if (s.completed) dCompleted += 1
        }
      }
    } else {
      // المجال المخصص: كل معاييره الفرعية مخصصة
      for (const c of criteriaNodes) {
        for (const s of c.subs) {
          if (s.archived) continue
          dTotal += 1
          if (s.completed) dCompleted += 1
        }
      }
    }

    return {
      id: d.id,
      name: d.name,
      description: d.description,
      isOfficial: d.isOfficial,
      officialCode: d.officialCode,
      sortOrder: d.sortOrder,
      scope: d.scope,
      schoolId: d.schoolId,
      archived: d.archivedAt !== null,
      criteriaCount,
      completedSubs: dCompleted,
      totalSubs: dTotal,
      percent: pct(dCompleted, dTotal),
      criteria: criteriaNodes,
    }
  })

  return {
    domains: domainNodes,
    official: {
      completed: officialCompleted,
      total: officialTotal,
      percent: pct(officialCompleted, officialTotal),
    },
    custom: customTotal > 0 ? { completed: customCompleted, total: customTotal, percent: pct(customCompleted, customTotal) } : null,
    unmappedCount,
  }
}
