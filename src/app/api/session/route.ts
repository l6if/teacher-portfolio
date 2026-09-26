import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SESSION_COOKIE } from '@/lib/session'

// اختيار حساب تجريبي للجلسة (المعلم أو المدير)
export async function GET() {
  const users = await db.user.findMany({
    select: { id: true, name: true, role: true, subject: true, school: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const { userId } = await req.json()
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
  const res = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } })
  res.cookies.set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(SESSION_COOKIE)
  return res
}
