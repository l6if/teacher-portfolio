import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  const { id } = await params

  const existing = await db.goal.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'الهدف غير موجود' }, { status: 404 })
  if (existing.userId !== me.id) return NextResponse.json({ error: 'لا يمكنك تعديل هدف غيرك' }, { status: 403 })

  const body = await req.json()
  const num = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v))
  const data: Record<string, unknown> = {}
  for (const f of ['title', 'description', 'indicator', 'scope']) {
    if (f in body) data[f] = body[f] === '' ? null : body[f]
  }
  for (const f of ['targetValue', 'currentValue']) {
    if (f in body) data[f] = num(body[f])
  }
  for (const f of ['startDate', 'endDate']) {
    if (f in body) data[f] = body[f] ? new Date(body[f]) : null
  }

  const goal = await db.goal.update({ where: { id }, data })
  return NextResponse.json({ goal })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  const { id } = await params

  const existing = await db.goal.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'الهدف غير موجود' }, { status: 404 })
  if (existing.userId !== me.id) return NextResponse.json({ error: 'لا يمكنك حذف هدف غيرك' }, { status: 403 })

  await db.evidenceLink.deleteMany({ where: { goalId: id } })
  await db.achievement.updateMany({ where: { goalId: id }, data: { goalId: null } })
  await db.goal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
