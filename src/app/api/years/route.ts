import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, safeJson } from '@/lib/session'

// إنشاء سنة دراسية جديدة
export async function POST(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  const body = await safeJson<{ label?: string }>(req)
  const label = body?.label?.trim()
  if (!label) return NextResponse.json({ error: 'أدخل اسم العام الدراسي' }, { status: 400 })

  const exists = await db.academicYear.findFirst({ where: { userId: me.id, label } })
  if (exists) return NextResponse.json({ error: 'هذا العام الدراسي موجود بالفعل' }, { status: 400 })

  const year = await db.academicYear.create({
    data: { label, userId: me.id },
  })
  return NextResponse.json({ year }, { status: 201 })
}

// أرشفة / استعادة سنة دراسية
export async function PATCH(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  const body = await safeJson<{ yearId?: string; archived?: boolean }>(req)
  if (!body?.yearId) return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  const year = await db.academicYear.findFirst({ where: { id: body.yearId, userId: me.id } })
  if (!year) return NextResponse.json({ error: 'العام الدراسي غير موجود' }, { status: 404 })

  const updated = await db.academicYear.update({
    where: { id: body.yearId },
    data: { archived: Boolean(body.archived) },
  })
  return NextResponse.json({ year: updated })
}
