import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, SESSION_COOKIE, safeJson, sessionCookieOptions, clearSessionCookie } from '@/lib/session'
import { createSessionToken, verifyPassword } from '@/lib/auth'
import { normalizeEmail } from '@/lib/validation'

/**
 * المصادقة الحقيقية: دخول بالبريد وكلمة المرور فقط.
 * لا قائمة مستخدمين عامة — لا يمكن معرفة من المسجلين في النظام دون تسجيل دخول.
 *
 * الحساب الموقوف: يُرفض دخوله برسالة واضحة (وقد طُردت جلسته القائمة أصلًا
 * من getCurrentUser لأن حالة SUSPENDED تُبطل أي جلسة قائمة).
 */
export async function GET() {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ user: null })
  return NextResponse.json({
    user: {
      id: me.id,
      name: me.name,
      email: me.email,
      role: me.role,
      gender: me.gender,
      status: me.status,
      isDemo: me.isDemo,
    },
  })
}

export async function POST(req: NextRequest) {
  const body = await safeJson<{ email?: string; password?: string }>(req)
  const email = normalizeEmail(body?.email)
  const password = body?.password ?? ''

  if (!email || !password) {
    return NextResponse.json({ error: 'أدخل البريد الإلكتروني وكلمة المرور' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { email } })
  // رسالة موحدة دوماً — لا نكشف هل البريد موجود من عدمه
  const invalid = NextResponse.json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401 })
  if (!user) return invalid
  if (!verifyPassword(password, user.passwordHash)) return invalid

  // الحساب الموقوف لا يدخل — إجراء إداري يظل قائمًا حتى إعادة التفعيل
  if (user.status === 'SUSPENDED') {
    return NextResponse.json(
      { error: 'هذا الحساب موقوف. تواصل مع مسؤول المنصة لإعادة التفعيل.' },
      { status: 403 },
    )
  }

  // تسجيل آخر دخول (بلا انتظار — لا يفشل الدخول إن تعذر)
  db.user
    .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    .catch(() => {})

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, gender: user.gender },
  })
  // خيارات الكوكي مشتقة من سياق الطلب: عبر بوابة HTTPS (معاينة) يُصدر
  // SameSite=None + Secure وإلا رفضه المتصفح في السياق عبر الموقع وفشل الدخول
  res.cookies.set(SESSION_COOKIE, createSessionToken(user.id, user.sessionEpoch), sessionCookieOptions(req))
  return res
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  clearSessionCookie(res, req)
  return res
}
