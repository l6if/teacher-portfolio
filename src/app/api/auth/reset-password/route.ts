import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { safeJson, sessionCookieOptions, SESSION_COOKIE } from '@/lib/session'
import { hashPassword, hashResetToken, createSessionToken } from '@/lib/auth'
import { validatePassword } from '@/lib/validation'

/**
 * تعيين كلمة مرور جديدة بتوكن الاستعادة.
 *
 * الشروط: التوكن موجود بالهاش، غير منتهي، غير مستخدم سابقًا.
 * بعد النجاح: يُبطل التوكن (استخدام واحد) + تُرفع epoch فتُبطل كل الجلسات القديمة
 * ثم تُنشأ جلسة جديدة مباشرة (تسجيل دخول تلقائي بعد الاستعادة).
 */
export async function POST(req: NextRequest) {
  const body = await safeJson<{ token?: string; password?: string; confirmPassword?: string }>(req)
  if (!body?.token) return NextResponse.json({ error: 'رابط الاستعادة غير صالح.' }, { status: 400 })

  const token = body.token.trim()
  const password = body.password ?? ''
  const confirmPassword = body.confirmPassword ?? ''

  const passwordError = validatePassword(password, confirmPassword)
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 })

  try {
    const tokenHash = hashResetToken(token)
    const record = await db.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, status: true } } },
    })

    const invalid = NextResponse.json(
      { error: 'رابط الاستعادة غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا.' },
      { status: 400 },
    )

    if (!record) return invalid
    if (record.usedAt) return invalid // استخدام واحد فقط
    if (record.expiresAt < new Date()) return invalid
    if (record.user.status === 'SUSPENDED') return invalid

    // تحديث كلمة المرور + رفع epoch (إبطال كل الجلسات القديمة) + استهلاك التوكن — ذريًا
    const user = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: hashPassword(password),
          sessionEpoch: { increment: 1 },
        },
        select: { id: true, name: true, email: true, role: true, sessionEpoch: true },
      })
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      })
      return updated
    })

    const res = NextResponse.json({ ok: true, message: 'تم تحديث كلمة المرور بنجاح.' })
    // جلسة جديدة بالـ epoch المرفوع — دخول تلقائي بعد الاستعادة
    // (خيارات مشتقة من الطلب — تعمل خلف بوابات HTTPS/المعاينة أيضًا)
    res.cookies.set(SESSION_COOKIE, createSessionToken(user.id, user.sessionEpoch), sessionCookieOptions(req))
    return res
  } catch (e) {
    console.error('reset-password error', e)
    return NextResponse.json(
      { error: 'تعذر تحديث كلمة المرور الآن. حاول مرة أخرى.' },
      { status: 500 },
    )
  }
}
