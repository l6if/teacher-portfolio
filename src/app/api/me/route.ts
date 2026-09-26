import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, resolveYear, toSafeUser } from '@/lib/session'

// المستخدم الحالي + سنواته الدراسية
export async function GET(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  const years = await db.academicYear.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: 'desc' },
  })
  const year = await resolveYear(me.id, req.nextUrl.searchParams.get('yearId'))

  return NextResponse.json({ user: toSafeUser(me), years, year })
}
