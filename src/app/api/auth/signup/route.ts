import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, safeJson } from '@/lib/session'
import { hashPassword, createSessionToken, SESSION_MAX_AGE } from '@/lib/auth'
import { SESSION_COOKIE } from '@/lib/session'
import { normalizeEmail, validateEmail, validatePassword } from '@/lib/validation'
import { hijriToday } from '@/lib/hijri'

/**
 * تسجيل حساب جديد — أولي فقط: بريد + كلمة مرور + تأكيدها.
 * البيانات المهنية الإضافية تُجمع لاحقًا في «إكمال الملف المهني».
 *
 * أمان الأدوار: أي حقل role في الطلب يُتجاهل تمامًا — الدور دائمًا TEACHER.
 * الترقية لMANAGER/SUPER_ADMIN فقط عبر مسؤول المنصة.
 */
export async function POST(req: NextRequest) {
  const body = await safeJson<{ email?: string; password?: string; confirmPassword?: string; role?: string }>(req)
  if (!body) return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })

  const email = normalizeEmail(body.email)
  const password = body.password ?? ''
  const confirmPassword = body.confirmPassword ?? ''

  const emailError = validateEmail(email)
  if (emailError) return NextResponse.json({ error: emailError }, { status: 400 })

  const passwordError = validatePassword(password, confirmPassword)
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 })

  try {
    // قيد الفريد على البريد + التطبيع (trim/lowercase) يمنع التكرار بحروف مختلفة
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) {
      return NextResponse.json({ error: 'هذا البريد مسجل بالفعل.' }, { status: 409 })
    }

    const user = await db.user.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        name: 'مستخدم جديد', // يُستبدل في «إكمال الملف المهني»
        role: 'TEACHER', // ثابت — لا يُقبل أي دور من الطلب أبدًا
        status: 'ACTIVE',
        lastLoginAt: new Date(),
      },
      select: { id: true, name: true, email: true, role: true, status: true, gender: true },
    })

    // سنة دراسية افتراضية بالهجري الحالي حتى يعمل التطبيق مباشرة
    const hijri = hijriToday()
    await db.academicYear.create({
      data: { label: `${hijri.year}هـ`, userId: user.id },
    })

    const res = NextResponse.json({ ok: true, user })
    res.cookies.set(SESSION_COOKIE, createSessionToken(user.id, 0), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    })
    return res
  } catch (e) {
    // خطأ قاعدة بيانات محتمل (تسابق على البريد الفريد مثلًا) — رسالة بشرية بلا تفاصيل داخلية
    console.error('signup error', e)
    return NextResponse.json(
      { error: 'تعذر إنشاء الحساب الآن. حاول مرة أخرى.' },
      { status: 500 },
    )
  }
}

/** من يسجل دخوله بالفعل لا يحتاج هذه الواجهة — مجرد 204 صامت */
export async function GET() {
  const me = await getCurrentUser()
  return NextResponse.json({ authenticated: Boolean(me) })
}
