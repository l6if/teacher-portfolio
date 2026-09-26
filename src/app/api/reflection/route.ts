import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveTargetUser, resolveYear } from '@/lib/session'

// التأمل المهني — أسئلة قصيرة تُحفظ كمسودة تلقائيًا
export async function GET(req: NextRequest) {
  const { me, target } = await resolveTargetUser(req)
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  if (!target) return NextResponse.json({ error: 'لا تملك صلاحية الوصول' }, { status: 403 })

  const year = await resolveYear(target.id, req.nextUrl.searchParams.get('yearId'))
  const term = req.nextUrl.searchParams.get('term') ?? 'TERM1'
  if (!year) return NextResponse.json({ reflection: null })

  const reflection = await db.reflection.findFirst({
    where: { userId: target.id, yearId: year.id, term },
  })
  return NextResponse.json({ reflection, readonly: target.id !== me.id })
}

export async function PUT(req: NextRequest) {
  const { me, target } = await resolveTargetUser(req)
  if (!me || !target || target.id !== me.id) {
    return NextResponse.json({ error: 'لا يمكنك التعديل على ملف غيرك' }, { status: 403 })
  }
  const body = await req.json()
  const year = await resolveYear(me.id, body.yearId)
  if (!year) return NextResponse.json({ error: 'لا توجد سنة دراسية' }, { status: 400 })

  const term = body.term ?? 'TERM1'
  const reflection = await db.reflection.upsert({
    where: { userId_yearId_term: { userId: me.id, yearId: year.id, term } },
    create: {
      userId: me.id, yearId: year.id, term,
      success: body.success || null, practice: body.practice || null,
      develop: body.develop || null, nextTerm: body.nextTerm || null,
    },
    update: {
      success: body.success || null, practice: body.practice || null,
      develop: body.develop || null, nextTerm: body.nextTerm || null,
    },
  })
  return NextResponse.json({ reflection })
}
