import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveTargetUser, resolveYear } from '@/lib/session'

// الخطة التطويرية
export async function GET(req: NextRequest) {
  const { me, target } = await resolveTargetUser(req)
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  if (!target) return NextResponse.json({ error: 'لا تملك صلاحية الوصول' }, { status: 403 })

  const year = await resolveYear(target.id, req.nextUrl.searchParams.get('yearId'))
  if (!year) return NextResponse.json({ plans: [] })

  const plans = await db.devPlan.findMany({
    where: { userId: target.id, yearId: year.id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ plans, year, readonly: target.id !== me.id })
}

export async function POST(req: NextRequest) {
  const { me, target } = await resolveTargetUser(req)
  if (!me || !target || target.id !== me.id) {
    return NextResponse.json({ error: 'لا يمكنك التعديل على ملف غيرك' }, { status: 403 })
  }
  const body = await req.json()
  const year = await resolveYear(me.id, body.yearId)
  if (!year) return NextResponse.json({ error: 'لا توجد سنة دراسية' }, { status: 400 })

  const plan = await db.devPlan.create({
    data: {
      goal: (body.goal ?? '').trim() || 'هدف تطويري',
      action: body.action || null,
      period: body.period || null,
      indicator: body.indicator || null,
      result: body.result || null,
      userId: me.id,
      yearId: year.id,
    },
  })
  return NextResponse.json({ plan }, { status: 201 })
}
