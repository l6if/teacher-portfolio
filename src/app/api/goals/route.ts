import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveTargetUser, resolveYear, sanitizeInternal } from '@/lib/session'

// الأهداف المهنية
export async function GET(req: NextRequest) {
  const { me, target } = await resolveTargetUser(req)
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  if (!target) return NextResponse.json({ error: 'لا تملك صلاحية الوصول' }, { status: 403 })

  const year = await resolveYear(target.id, req.nextUrl.searchParams.get('yearId'))
  if (!year) return NextResponse.json({ goals: [] })

  const goals = await db.goal.findMany({
    where: { userId: target.id, yearId: year.id },
    orderBy: { createdAt: 'asc' },
    include: {
      achievements: {
        orderBy: { date: 'desc' },
        select: { id: true, title: true, type: true, date: true, status: true, preScore: true, postScore: true },
      },
      links: { include: { attachment: true } },
    },
  })
  return NextResponse.json(sanitizeInternal({ goals, year, readonly: target.id !== me.id }))
}

export async function POST(req: NextRequest) {
  const { me, target } = await resolveTargetUser(req)
  if (!me || !target || target.id !== me.id) {
    return NextResponse.json({ error: 'لا يمكنك التعديل على ملف غيرك' }, { status: 403 })
  }
  const body = await req.json()
  const year = await resolveYear(me.id, body.yearId)
  if (!year) return NextResponse.json({ error: 'لا توجد سنة دراسية' }, { status: 400 })

  const num = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v))

  const goal = await db.goal.create({
    data: {
      title: (body.title ?? '').trim() || 'هدف جديد',
      description: body.description || null,
      indicator: body.indicator || null,
      targetValue: num(body.targetValue),
      currentValue: num(body.currentValue),
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      scope: body.scope ?? 'YEAR',
      userId: me.id,
      yearId: year.id,
    },
  })
  return NextResponse.json({ goal }, { status: 201 })
}
