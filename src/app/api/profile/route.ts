import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, safeJson, toSafeUser } from '@/lib/session'

// البيانات المهنية + التكليف والنصاب
export async function GET(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  const userId = req.nextUrl.searchParams.get('userId')
  let target = me
  if (userId && userId !== me.id) {
    if (me.role !== 'MANAGER') return target403()
    // المدير يطّلع على ملفات المعلمين فقط — لا مديرين آخرين
    const candidate = await db.user.findUnique({ where: { id: userId } })
    if (!candidate || candidate.role !== 'TEACHER') return target403()
    // نطاق المدرسة
    if (me.school && candidate.school && candidate.school !== me.school) return target403()
    target = candidate
  }

  return NextResponse.json({ user: toSafeUser(target) })
}

function target403() {
  return NextResponse.json({ error: 'لا تملك صلاحية الوصول' }, { status: 403 })
}

export async function PUT(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  const body = await safeJson(req)
  if (!body) return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })

  // تحديث جزئي آمن: يُحدَّث فقط ما ورد في الطلب — لا يُمسّ ما لم يُرسل
  const data: Record<string, unknown> = {}
  if ('name' in body) data.name = body.name?.trim() || me.name
  for (const f of ['school', 'subject', 'qualification', 'stage', 'classes', 'licenseNumber', 'duties', 'photoUrl', 'educationAdmin', 'educationOffice', 'principalName']) {
    if (f in body) data[f] = body[f] === '' ? null : body[f]
  }
  for (const f of ['experienceYears', 'weeklyLoad']) {
    if (f in body) data[f] = body[f] === '' || body[f] === null ? null : Number(body[f])
  }
  for (const f of ['schedule', 'committees', 'extraDuties']) {
    if (f in body) data[f] = body[f] ? JSON.stringify(body[f]) : null
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ user: toSafeUser(me) })
  }

  const updated = await db.user.update({ where: { id: me.id }, data })
  return NextResponse.json({ user: toSafeUser(updated) })
}
