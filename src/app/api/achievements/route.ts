import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveTargetUser, resolveYear, safeJson, sanitizeInternal } from '@/lib/session'
import { TYPE_SECTION } from '@/lib/constants'

// قائمة الإنجازات مع الفلاتر
export async function GET(req: NextRequest) {
  const { me, target } = await resolveTargetUser(req)
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  if (!target) return NextResponse.json({ error: 'لا تملك صلاحية الوصول' }, { status: 403 })

  const p = req.nextUrl.searchParams
  const year = await resolveYear(target.id, p.get('yearId'))
  if (!year) return NextResponse.json({ achievements: [], goals: [] })

  const type = p.get('type')
  const status = p.get('status')
  const q = p.get('q')?.trim()
  const section = p.get('section')
  const goalId = p.get('goalId')

  const types = section
    ? Object.entries(TYPE_SECTION).filter(([, s]) => s === section).map(([t]) => t)
    : type ? [type] : undefined

  const achievements = await db.achievement.findMany({
    where: {
      userId: target.id,
      yearId: year.id,
      ...(types ? { type: { in: types } } : {}),
      ...(status ? { status } : {}),
      ...(goalId ? { goalId } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
              { keywords: { contains: q } },
              { impact: { contains: q } },
              { results: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ date: 'desc' }, { updatedAt: 'desc' }],
    include: {
      links: { include: { attachment: true } },
      goal: { select: { id: true, title: true } },
    },
  })

  const goals = await db.goal.findMany({
    where: { userId: target.id, yearId: year.id },
    select: { id: true, title: true },
  })

  return NextResponse.json(sanitizeInternal({ achievements, goals, year, readonly: target.id !== me.id }))
}

// إنشاء إنجاز جديد
export async function POST(req: NextRequest) {
  const { me, target } = await resolveTargetUser(req)
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  if (!target || target.id !== me.id) {
    return NextResponse.json({ error: 'لا يمكنك التعديل على ملف غيرك' }, { status: 403 })
  }

  const body = await safeJson(req)
  if (!body) return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  const year = await resolveYear(me.id, body.yearId)
  if (!year) return NextResponse.json({ error: 'لا توجد سنة دراسية' }, { status: 400 })

  const { attachmentIds, ...rest } = body
  const num = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v))

  const achievement = await db.achievement.create({
    data: {
      type: rest.type ?? 'OTHER',
      title: (rest.title ?? '').trim() || 'إنجاز بدون عنوان',
      field: rest.field ?? null,
      date: rest.date ? new Date(rest.date) : null,
      description: rest.description || null,
      goalText: rest.goalText || null,
      execution: rest.execution || null,
      beneficiaries: rest.beneficiaries || null,
      results: rest.results || null,
      impact: rest.impact || null,
      notes: rest.notes || null,
      problem: rest.problem || null,
      actions: rest.actions || null,
      durationText: rest.durationText || null,
      provider: rest.provider || null,
      hours: num(rest.hours),
      studentsCount: num(rest.studentsCount),
      beneficiariesCount: num(rest.beneficiariesCount),
      preScore: num(rest.preScore),
      postScore: num(rest.postScore),
      keywords: rest.keywords || null,
      status: rest.status ?? 'DRAFT',
      goalId: rest.goalId || null,
      userId: me.id,
      yearId: year.id,
    },
  })

  // لا يمكن ربط إلا شواهدك أنت — تحقق ملكية قبل أي ربط
  if (Array.isArray(attachmentIds) && attachmentIds.length) {
    const valid = await db.attachment.findMany({
      where: { id: { in: attachmentIds }, userId: me.id },
      select: { id: true },
    })
    if (valid.length) {
      await db.evidenceLink.createMany({
        data: valid.map((a) => ({ attachmentId: a.id, achievementId: achievement.id })),
      })
    }
  }

  const created = await db.achievement.findUnique({
    where: { id: achievement.id },
    include: { links: { include: { attachment: true } }, goal: true },
  })
  return NextResponse.json(sanitizeInternal({ achievement: created }), { status: 201 })
}
