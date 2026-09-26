import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// إنشاء سنة دراسية جديدة (مع استنساخ البيانات الأساسية عند الرغبة)
export async function POST(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  const { label, cloneBasic } = await req.json()
  if (!label?.trim()) return NextResponse.json({ error: 'أدخل اسم العام الدراسي' }, { status: 400 })

  const exists = await db.academicYear.findFirst({ where: { userId: me.id, label: label.trim() } })
  if (exists) return NextResponse.json({ error: 'هذا العام الدراسي موجود بالفعل' }, { status: 400 })

  const year = await db.academicYear.create({
    data: { label: label.trim(), userId: me.id },
  })
  return NextResponse.json({ year }, { status: 201 })
}

// أرشفة / استعادة سنة دراسية
export async function PATCH(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  const { yearId, archived } = await req.json()
  const year = await db.academicYear.findFirst({ where: { id: yearId, userId: me.id } })
  if (!year) return NextResponse.json({ error: 'العام الدراسي غير موجود' }, { status: 404 })

  const updated = await db.academicYear.update({
    where: { id: yearId },
    data: { archived: Boolean(archived) },
  })
  return NextResponse.json({ year: updated })
}
