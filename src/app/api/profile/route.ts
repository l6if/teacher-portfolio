import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// البيانات المهنية + التكليف والنصاب
export async function GET(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  const userId = req.nextUrl.searchParams.get('userId')
  const target = userId && userId !== me.id
    ? (me.role === 'MANAGER' ? await db.user.findUnique({ where: { id: userId } }) : null)
    : me
  if (!target) return NextResponse.json({ error: 'لا تملك صلاحية الوصول' }, { status: 403 })

  return NextResponse.json({ user: target })
}

export async function PUT(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  const body = await req.json()

  // تحديث جزئي آمن: يُحدَّث فقط ما ورد في الطلب — لا يُمسّ ما لم يُرسل
  const data: Record<string, unknown> = {}
  if ('name' in body) data.name = body.name?.trim() || me.name
  for (const f of ['school', 'subject', 'qualification', 'stage', 'classes', 'licenseNumber', 'duties', 'photoUrl']) {
    if (f in body) data[f] = body[f] === '' ? null : body[f]
  }
  for (const f of ['experienceYears', 'weeklyLoad']) {
    if (f in body) data[f] = body[f] === '' || body[f] === null ? null : Number(body[f])
  }
  for (const f of ['schedule', 'committees', 'extraDuties']) {
    if (f in body) data[f] = body[f] ? JSON.stringify(body[f]) : null
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ user: me })
  }

  const updated = await db.user.update({ where: { id: me.id }, data })
  return NextResponse.json({ user: updated })
}
