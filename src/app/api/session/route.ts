import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, SESSION_COOKIE, safeJson } from '@/lib/session'
import { createSessionToken, verifyPassword, SESSION_MAX_AGE } from '@/lib/auth'

/**
 * المصادقة الحقيقية: دخول بالبريد وكلمة المرور فقط.
 * لا قائمة مستخدمين عامة — لا يمكن معرفة من المسجلين في النظام دون تسجيل دخول.
 */
export async function GET() {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ user: null })
  return NextResponse.json({
    user: { id: me.id, name: me.name, email: me.email, role: me.role },
  })
}

export async function POST(req: NextRequest) {
  const body = await safeJson<{ email?: string; password?: string }>(req)
  const email = body?.email?.trim().toLowerCase()
  const password = body?.password ?? ''

  if (!email || !password) {
    return NextResponse.json({ error: 'أدخل البريد الإلكتروني وكلمة المرور' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { email } })
  // رسالة موحدة دوماً — لا نكشف هل البريد موجود من عدمه
  const invalid = NextResponse.json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401 })
  if (!user) return invalid
  if (!verifyPassword(password, user.passwordHash)) return invalid

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, role: user.role },
  })
  res.cookies.set(SESSION_COOKIE, createSessionToken(user.id), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(SESSION_COOKIE)
  return res
}
