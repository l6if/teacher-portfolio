import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, safeJson } from '@/lib/session'

// تفاصيل إنجاز واحد
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  const { id } = await params

  const achievement = await db.achievement.findUnique({
    where: { id },
    include: {
      links: { include: { attachment: true } },
      goal: { select: { id: true, title: true } },
    },
  })
  if (!achievement) return NextResponse.json({ error: 'الإنجاز غير موجود' }, { status: 404 })
  if (achievement.userId !== me.id && me.role !== 'MANAGER') {
    return NextResponse.json({ error: 'لا تملك صلاحية الوصول' }, { status: 403 })
  }

  return NextResponse.json({ achievement })
}

// تحديث إنجاز (يشمل الحفظ التلقائي للمسودات)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  const { id } = await params

  const existing = await db.achievement.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'الإنجاز غير موجود' }, { status: 404 })
  if (existing.userId !== me.id) {
    return NextResponse.json({ error: 'لا يمكنك تعديل إنجاز غيرك' }, { status: 403 })
  }

  const body = await safeJson(req)
  if (!body) return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  const { attachmentIds, ...rest } = body
  const num = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v))

  const data: Record<string, unknown> = {}
  const stringFields = ['title', 'field', 'description', 'goalText', 'execution', 'beneficiaries',
    'results', 'impact', 'notes', 'problem', 'actions', 'durationText', 'provider', 'keywords', 'status', 'type']
  for (const f of stringFields) {
    if (f in rest) data[f] = rest[f] === '' ? null : rest[f]
  }
  const numFields = ['hours', 'studentsCount', 'beneficiariesCount', 'preScore', 'postScore']
  for (const f of numFields) {
    if (f in rest) data[f] = num(rest[f])
  }
  if ('date' in rest) data.date = rest.date ? new Date(rest.date) : null
  if ('goalId' in rest) data.goalId = rest.goalId || null

  if (Object.keys(data).length) {
    await db.achievement.update({ where: { id }, data })
  }

  // مزامنة روابط الشواهد
  if (Array.isArray(attachmentIds)) {
    await db.evidenceLink.deleteMany({ where: { achievementId: id } })
    if (attachmentIds.length) {
      const valid = await db.attachment.findMany({
        where: { id: { in: attachmentIds }, userId: me.id },
        select: { id: true },
      })
      if (valid.length) {
        await db.evidenceLink.createMany({
          data: valid.map((a) => ({ attachmentId: a.id, achievementId: id })),
        })
      }
    }
  }

  const updated = await db.achievement.findUnique({
    where: { id },
    include: { links: { include: { attachment: true } }, goal: { select: { id: true, title: true } } },
  })
  return NextResponse.json({ achievement: updated })
}

// حذف إنجاز (لا تُحذف الشواهد المرتبطة — تبقى في المكتبة)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  const { id } = await params

  const existing = await db.achievement.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'الإنجاز غير موجود' }, { status: 404 })
  if (existing.userId !== me.id) {
    return NextResponse.json({ error: 'لا يمكنك حذف إنجاز غيرك' }, { status: 403 })
  }

  await db.evidenceLink.deleteMany({ where: { achievementId: id } })
  await db.achievement.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
