import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { safeJson } from '@/lib/session'
import { createResetToken, RESET_TOKEN_TTL_MS } from '@/lib/auth'
import { normalizeEmail, validateEmail } from '@/lib/validation'
import { getEmailProvider, passwordResetEmail } from '@/lib/email'

/**
 * طلب استعادة كلمة المرور.
 *
 * منع اكتشاف الحسابات: الاستجابة واحدة دائمًا مهما كان البريد مسجلًا أو لا —
 * «إذا كان البريد مسجلًا لدينا فستصلك رسالة استعادة كلمة المرور.»
 *
 * التوكن: عشوائي 256-بت، يُخزّن هاشه فقط، صلاحية 45 دقيقة، استخدام واحد.
 * (توكنات قديمة لنفس المستخدم تُبطل بإنشاء الجديد.)
 */
export async function POST(req: NextRequest) {
  const body = await safeJson<{ email?: string }>(req)
  const email = normalizeEmail(body?.email)
  const emailError = validateEmail(email)
  if (emailError) return NextResponse.json({ error: emailError }, { status: 400 })

  const genericMessage = 'إذا كان البريد مسجلًا لدينا فستصلك رسالة استعادة كلمة المرور.'

  try {
    const user = await db.user.findUnique({ where: { email }, select: { id: true, status: true } })
    if (!user) {
      // نفس الاستجابة تمامًا — لا نكشف وجود الحساب (لا فرق زمني ولا نصي)
      return NextResponse.json({ ok: true, message: genericMessage })
    }

    // حساب موقوف: لا استعادة ذاتية — لكن الرسالة العامة نفسها (لا نكشف حالة الحساب)
    if (user.status === 'SUSPENDED') {
      return NextResponse.json({ ok: true, message: genericMessage })
    }

    // توكن جديد يبطل أي توكن سابق غير مستخدم لنفس المستخدم
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    const { raw, tokenHash, expiresAt } = createResetToken()
    await db.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } })

    // إرسال البريد عبر المزود المركزي — فشل الإرسال لا يغيّر الاستجابة العامة (لا تسريب معلومات)
    const base = process.env.APP_URL ?? ''
    const resetUrl = base
      ? `${base}/reset-password?token=${encodeURIComponent(raw)}`
      : `/reset-password?token=${encodeURIComponent(raw)}`
    try {
      await getEmailProvider().send({ ...passwordResetEmail(resetUrl, Math.round(RESET_TOKEN_TTL_MS / 60000)), to: email })
    } catch (mailError) {
      console.error('reset email send failed', mailError)
    }

    return NextResponse.json({ ok: true, message: genericMessage })
  } catch (e) {
    console.error('forgot-password error', e)
    // حتى الأخطاء الداخلية تُعيد الرسالة العامة — لا تفصح عن شيء
    return NextResponse.json({ ok: true, message: genericMessage })
  }
}
