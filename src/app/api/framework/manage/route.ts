import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, safeJson } from '@/lib/session'
import { OFFICIAL_PROTECTED_MESSAGE } from '@/lib/official-framework-constants'

// ═══ إدارة هيكل الإطار المخصص (مجالات/معايير/معايير فرعية) ═════════════
// POST /api/framework/manage   body:
//   { level: 'domain'|'criterion'|'subCriterion', action: 'create'|'update'|'archive'|'restore'|'delete', ... }
//
// الصلاحيات (القسم 33 — فوق نظام الأدوار القائم دون تغييره):
//   SUPER_ADMIN → يدير كل العناصر المخصصة (أي مدرسة).
//   MANAGER     → يضيف/يعدّل المخصص لمدرسته فقط.
//   TEACHER     → لا يغيّر الهيكل إطلاقًا (403) — يضيف إنجازات ويربطها فقط.
//
// حماية الرسمي (القسم 23/56): أي محاولة تعديل نص عنصر رسمي تُرفض 403
// برسالة واضحة — من جهة الخادم حصرًا لا إخفاءً في الواجهة.
// الحذف (القسم 24/57): ممنوع إن وُجدت إنجازات مرتبطة → يُقترح الأرشفة.

interface ManageBody {
  level?: 'domain' | 'criterion' | 'subCriterion'
  action?: 'create' | 'update' | 'archive' | 'restore' | 'delete'
  // إنشاء
  name?: string
  description?: string
  sortOrder?: number
  domainId?: string // للأ level criterion
  criterionId?: string // للـ subCriterion
  schoolId?: string // لمسؤول المنصة عند إنشاء مجال (نطاق مدرسة محددة)
  // تحديث/أرشفة/حذف
  id?: string
}

const LEVELS = new Set(['domain', 'criterion', 'subCriterion'])
const ACTIONS = new Set(['create', 'update', 'archive', 'restore', 'delete'])

const cleanName = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const cleanDesc = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

/** إذن إدارة عنصر مخصص: مسؤول المنصة (الكل) أو مدير مدرسته فقط */
async function canManageCustomItem(me: { id: string; role: string; school: string | null }, schoolId: string | null): Promise<boolean> {
  if (me.role === 'SUPER_ADMIN') return true
  if (me.role === 'MANAGER') return !!schoolId && me.school === schoolId
  return false
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  const body = await safeJson<ManageBody>(req)
  if (!body) return bad('طلب غير صالح')
  const { level, action } = body
  if (!level || !LEVELS.has(level)) return bad('مستوى غير صالح')
  if (!action || !ACTIONS.has(action)) return bad('إجراء غير صالح')

  // المعلم لا يدير الهيكل مطلقًا — مهما كان الطلب
  if (me.role === 'TEACHER') {
    return bad('الهيكل المهني يُدار من مدير المدرسة أو مسؤول المنصة — يمكنك ربط إنجازاتك بالمعايير', 403)
  }

  // ─── إنشاء ───────────────────────────────────────────────────────
  if (action === 'create') {
    const name = cleanName(body.name)
    if (!name) return bad('الاسم مطلوب')
    if (name.length > 200) return bad('الاسم طويل جدًا (الحد 200 حرف)')
    const sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0

    if (level === 'domain') {
      // نطاق المجال المخصص: مدرسة المدير حصرًا؛ لمسؤول المنصة: schoolId إلزامي
      const schoolId = me.role === 'MANAGER' ? me.school ?? null : cleanName(body.schoolId) || null
      if (!schoolId) {
        return bad(me.role === 'MANAGER'
          ? 'لا يمكن إنشاء مجال مخصص قبل تحديد مدرستك في ملفك المهني'
          : 'حدّد schoolId للمدرسة المستهدفة عند إنشاء مجال مخصص (مسؤول المنصة)')
      }
      const domain = await db.domain.create({
        data: {
          name,
          description: cleanDesc(body.description),
          isOfficial: false,
          sortOrder: sortOrder || 999,
          scope: 'SCHOOL',
          schoolId,
        },
      })
      return NextResponse.json({ domain }, { status: 201 })
    }

    if (level === 'criterion') {
      const domainId = cleanName(body.domainId)
      if (!domainId) return bad('domainId مطلوب')
      const domain = await db.domain.findUnique({ where: { id: domainId } })
      if (!domain) return bad('المجال غير موجود', 404)
      // نطاق المدرسة للمعيار المخصص (القسم 32): مدرسة المدير حصرًا —
      // حتى داخل مجال رسمي لا يظهر إلا لمدرسته
      const schoolId = me.role === 'MANAGER' ? me.school ?? null : cleanName(body.schoolId) || domain.schoolId
      if (!schoolId) {
        return bad(me.role === 'MANAGER'
          ? 'لا يمكن إنشاء معيار مخصص قبل تحديد مدرستك في ملفك المهني'
          : 'حدّد schoolId للمدرسة المستهدفة (مسؤول المنصة)')
      }
      // مجال مخصص → يجب أن يكون من نطاق صلاحية المدير (المجال الرسمي عالمي فيقبل)
      if (!domain.isOfficial && !(await canManageCustomItem(me, domain.schoolId))) {
        return bad('لا تملك صلاحية إضافة معيار في مجال مدرسة أخرى', 403)
      }
      const criterion = await db.criterion.create({
        data: {
          name,
          description: cleanDesc(body.description),
          domainId: domain.id,
          isOfficial: false,
          sortOrder: sortOrder || 999,
          schoolId,
        },
      })
      return NextResponse.json({ criterion }, { status: 201 })
    }

    // subCriterion
    const criterionId = cleanName(body.criterionId)
    if (!criterionId) return bad('criterionId مطلوب')
    const criterion = await db.criterion.findUnique({
      where: { id: criterionId },
      include: { domain: true },
    })
    if (!criterion) return bad('المعيار غير موجود', 404)
    // نطاق المدرسة للفرعي المخصص: يرث نطاق معياره المخصص، أو مدرسة المنشئ داخل رسمي
    const subSchoolId = criterion.isOfficial
      ? (me.role === 'MANAGER' ? me.school ?? null : cleanName(body.schoolId) || null)
      : criterion.schoolId
    if (!subSchoolId) {
      return bad(me.role === 'MANAGER'
        ? 'لا يمكن إضافة معيار فرعي مخصص قبل تحديد مدرستك في ملفك المهني'
        : 'حدّد schoolId للمدرسة المستهدفة (مسؤول المنصة)')
    }
    // معيار مخصص → تحقق نطاق صلاحية المدير (الرسمي عالمي فيقبل)
    if (!criterion.isOfficial && !(await canManageCustomItem(me, criterion.schoolId))) {
      return bad('لا تملك صلاحية إضافة معيار فرعي هنا', 403)
    }
    const sub = await db.subCriterion.create({
      data: {
        name,
        description: cleanDesc(body.description),
        criterionId: criterion.id,
        isOfficial: false,
        sortOrder: sortOrder || 999,
        schoolId: subSchoolId,
      },
    })
    return NextResponse.json({ subCriterion: sub }, { status: 201 })
  }

  // ─── بقية الإجراءات تحتاج عنصرًا موجودًا ─────────────────────────
  const id = cleanName(body.id)
  if (!id) return bad('id مطلوب')

  if (level === 'domain') {
    const domain = await db.domain.findUnique({ where: { id } })
    if (!domain) return bad('المجال غير موجود', 404)
    if (domain.isOfficial) return bad(OFFICIAL_PROTECTED_MESSAGE, 403)
    if (!(await canManageCustomItem(me, domain.schoolId))) {
      return bad('لا تملك صلاحية إدارة مجال مدرسة أخرى', 403)
    }

    if (action === 'update') {
      const name = cleanName(body.name)
      if (name && name.length > 200) return bad('الاسم طويل جدًا (الحد 200 حرف)')
      const domain2 = await db.domain.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...('description' in body ? { description: cleanDesc(body.description) } : {}),
          ...(Number.isFinite(body.sortOrder) ? { sortOrder: Number(body.sortOrder) } : {}),
        },
      })
      return NextResponse.json({ domain: domain2 })
    }
    if (action === 'archive') {
      const domain2 = await db.domain.update({ where: { id }, data: { archivedAt: new Date() } })
      return NextResponse.json({ domain: domain2 })
    }
    if (action === 'restore') {
      const domain2 = await db.domain.update({ where: { id }, data: { archivedAt: null } })
      return NextResponse.json({ domain: domain2 })
    }
    // delete — ممنوع بإنجازات مرتبطة (بالمجال أو ما تحته)
    const linked = await countDomainAchievements(id)
    if (linked > 0) {
      return bad(`لا يمكن الحذف: يوجد ${linked} إنجازًا مرتبطًا بهذا المجال أو معاييره — استخدم الأرشفة بدلًا من الحذف`, 409)
    }
    await db.domain.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  }

  if (level === 'criterion') {
    const criterion = await db.criterion.findUnique({ where: { id }, include: { domain: true } })
    if (!criterion) return bad('المعيار غير موجود', 404)
    if (criterion.isOfficial) return bad(OFFICIAL_PROTECTED_MESSAGE, 403)
    // نطاق المعيار المخصص: علمه الخاص (حتى داخل مجال رسمي) أو مجاله المخصص
    if (!(await canManageCustomItem(me, criterion.schoolId ?? criterion.domain.schoolId))) {
      return bad('لا تملك صلاحية إدارة معيار مدرسة أخرى', 403)
    }

    if (action === 'update') {
      const name = cleanName(body.name)
      if (name && name.length > 200) return bad('الاسم طويل جدًا (الحد 200 حرف)')
      const criterion2 = await db.criterion.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...('description' in body ? { description: cleanDesc(body.description) } : {}),
          ...(Number.isFinite(body.sortOrder) ? { sortOrder: Number(body.sortOrder) } : {}),
        },
      })
      return NextResponse.json({ criterion: criterion2 })
    }
    if (action === 'archive') {
      const criterion2 = await db.criterion.update({ where: { id }, data: { archivedAt: new Date() } })
      return NextResponse.json({ criterion: criterion2 })
    }
    if (action === 'restore') {
      const criterion2 = await db.criterion.update({ where: { id }, data: { archivedAt: null } })
      return NextResponse.json({ criterion: criterion2 })
    }
    const linked = await countCriterionAchievements(id)
    if (linked > 0) {
      return bad(`لا يمكن الحذف: يوجد ${linked} إنجازًا مرتبطًا بهذا المعيار أو معاييره الفرعية — استخدم الأرشفة بدلًا من الحذف`, 409)
    }
    await db.criterion.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  }

  // subCriterion
  const sub = await db.subCriterion.findUnique({
    where: { id },
    include: { criterion: { include: { domain: true } } },
  })
  if (!sub) return bad('المعيار الفرعي غير موجود', 404)
  if (sub.isOfficial) return bad(OFFICIAL_PROTECTED_MESSAGE, 403)
  // نطاق الفرعي المخصص: علمه الخاص، أو معياره المخصص، أو مجال أجداده المخصص
  if (!(await canManageCustomItem(me, sub.schoolId ?? sub.criterion.schoolId ?? sub.criterion.domain.schoolId))) {
    return bad('لا تملك صلاحية إدارة معيار فرعي لمدرسة أخرى', 403)
  }

  if (action === 'update') {
    const name = cleanName(body.name)
    if (name && name.length > 200) return bad('الاسم طويل جدًا (الحد 200 حرف)')
    const sub2 = await db.subCriterion.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...('description' in body ? { description: cleanDesc(body.description) } : {}),
        ...(Number.isFinite(body.sortOrder) ? { sortOrder: Number(body.sortOrder) } : {}),
      },
    })
    return NextResponse.json({ subCriterion: sub2 })
  }
  if (action === 'archive') {
    const sub2 = await db.subCriterion.update({ where: { id }, data: { archivedAt: new Date() } })
    return NextResponse.json({ subCriterion: sub2 })
  }
  if (action === 'restore') {
    const sub2 = await db.subCriterion.update({ where: { id }, data: { archivedAt: null } })
    return NextResponse.json({ subCriterion: sub2 })
  }
  const linked = await db.achievement.count({ where: { subCriterionId: id } })
  if (linked > 0) {
    return bad(`لا يمكن الحذف: يوجد ${linked} إنجازًا مرتبطًا بهذا المعيار الفرعي — استخدم الأرشفة بدلًا من الحذف`, 409)
  }
  await db.subCriterion.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

// ─── عدّاد الإنجازات المرتبطة (لحماية الحذف) ────────────────────────
async function countDomainAchievements(domainId: string): Promise<number> {
  return db.achievement.count({
    where: {
      OR: [
        { domainId },
        { criterion: { domainId } },
        { subCriterion: { criterion: { domainId } } },
      ],
    },
  })
}

async function countCriterionAchievements(criterionId: string): Promise<number> {
  return db.achievement.count({
    where: {
      OR: [{ criterionId }, { subCriterion: { criterionId } }],
    },
  })
}
