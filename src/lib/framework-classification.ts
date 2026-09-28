// ═══ تصنيف الإنجاز داخل الإطار المهني — مساعدات مشتركة من جهة الخادم ═══
// يتحقق من سلامة ثلاثة التصنيف (مجال ← معيار ← معيار فرعي) ويشتق الأنساب
// من المعيار الفرعي المختار مباشرة — فلا يمكن إرسال ثلاثة متناقضة.
// التحقق من نطاق المدرسة: عنصر SCHOOL من مدرسة أخرى لا يُقبل.
import { db } from './db'

export interface ClassificationInput {
  domainId?: string | null
  criterionId?: string | null
  subCriterionId?: string | null
}

export interface ResolvedClassification {
  domainId: string | null
  criterionId: string | null
  subCriterionId: string | null
}

/**
 * يحل التصنيف المدخل إلى ثلاثة متسقة أو يرفضه.
 * القاعدة: إذا وُجد معيار فرعي → هو مصدر الحقيقة للأنساب كلها.
 * إن لم يوجد → يقبل معيارًا وحده أو مجالًا وحده (تصنيف جزئي مقبول،
 * لكن الاكتمال لا يُحسب إلا على مستوى المعيار الفرعي).
 * @returns null عند تصنيف غير موجود أو خارج نطاق مدرسة المستخدم
 */
export async function resolveClassification(
  input: ClassificationInput,
  schoolId: string | null,
): Promise<ResolvedClassification | null> {
  const subId = input.subCriterionId?.trim() || null
  const critId = input.criterionId?.trim() || null
  const domId = input.domainId?.trim() || null

  if (subId) {
    const sub = await db.subCriterion.findUnique({
      where: { id: subId },
      include: { criterion: { include: { domain: true } } },
    })
    if (!sub) return null
    // النطاق: الرسمي عالمي؛ المخصص (حتى داخل رسمي) لمدرسته حصرًا (القسم 32)
    const ownerSchool = sub.schoolId ?? sub.criterion.schoolId ?? sub.criterion.domain.schoolId
    if (!sub.isOfficial && ownerSchool !== schoolId) return null
    return { domainId: sub.criterion.domainId, criterionId: sub.criterionId, subCriterionId: sub.id }
  }
  if (critId) {
    const crit = await db.criterion.findUnique({ where: { id: critId }, include: { domain: true } })
    if (!crit) return null
    const ownerSchool = crit.schoolId ?? crit.domain.schoolId
    if (!crit.isOfficial && ownerSchool !== schoolId) return null
    return { domainId: crit.domainId, criterionId: crit.id, subCriterionId: null }
  }
  if (domId) {
    const dom = await db.domain.findUnique({ where: { id: domId } })
    if (!dom) return null
    if (dom.scope === 'SCHOOL' && dom.schoolId !== schoolId) return null
    return { domainId: dom.id, criterionId: null, subCriterionId: null }
  }
  return { domainId: null, criterionId: null, subCriterionId: null }
}
