import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin, SAFE_USER_SELECT } from '@/lib/session'
import { getStorage } from '@/lib/storage'
import { createResetToken, RESET_TOKEN_TTL_MS } from '@/lib/auth'
import { getEmailProvider, passwordResetEmail } from '@/lib/email'

type Ctx = { params: Promise<{ id: string }> }

/** عدد مسؤولي المنصة النشطين — لحماية «آخر مسؤول» من العزل الذاتي */
async function activeSuperAdminCount(excludeId?: string): Promise<number> {
  return db.user.count({
    where: { role: 'SUPER_ADMIN', status: 'ACTIVE', id: { not: excludeId ?? undefined } },
  })
}

/** تفاصيل مستخدم + أثر الحذف المتوقع (قبل أي حذف نهائي) */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const guard = await requireSuperAdmin()
  if (guard.res) return guard.res
  const { id } = await ctx.params

  const user = await db.user.findUnique({
    where: { id },
    select: {
      ...SAFE_USER_SELECT,
      _count: {
        select: { achievements: true, goals: true, years: true, attachments: true, reflections: true, devPlans: true, aiLogs: true },
      },
    },
  })
  if (!user) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })

  // أثر الحذف على مستوى العلاقات المتشعبة
  const [links, files] = await Promise.all([
    db.evidenceLink.count({
      where: { attachment: { userId: id } },
    }),
    db.attachment.count({ where: { userId: id, storagePath: { not: null } } }),
  ])

  return NextResponse.json({
    user,
    deletionImpact: {
      achievements: user._count.achievements,
      goals: user._count.goals,
      years: user._count.years,
      attachments: user._count.attachments,
      evidenceLinks: links,
      reflections: user._count.reflections,
      devPlans: user._count.devPlans,
      storedFiles: files,
      aiLogs: user._count.aiLogs,
    },
  })
}

/**
 * إجراءات إدارية على مستخدم:
 *  suspend | activate | setRole(TEACHER↔MANAGER) | setSchool | setGender | requirePasswordReset
 *
 * حماية صارمة:
 *  - لا يمكن للمسؤول إيقاف/تخفيض/حذف نفسه (عزل ذاتي ممنوع)
 *  - لا يمكن المساس بآخر مسؤول منصة نشط
 *  - الترقية إلى SUPER_ADMIN مسموحة لمسؤول منصة فقط (الحارس يضمنها) وتتطلب تأكيدًا صريحًا
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await requireSuperAdmin()
  if (guard.res) return guard.res
  const me = guard.me
  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  if (!body?.action) return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  const action = String(body.action)

  const user = await db.user.findUnique({ where: { id }, select: { id: true, email: true, role: true, status: true, school: true, gender: true, isDemo: true } })
  if (!user) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })

  // حماية العزل الذاتي — المسؤول لا يوقف نفسه ولا يخفض دوره
  if (user.id === me.id && ['suspend', 'setRole'].includes(action)) {
    return NextResponse.json({ error: 'لا يمكنك تنفيذ هذا الإجراء على حسابك الخاص.' }, { status: 400 })
  }

  // حماية آخر مسؤول منصة نشط
  if (user.role === 'SUPER_ADMIN' && user.status === 'ACTIVE') {
    const others = await activeSuperAdminCount(user.id)
    if (others === 0 && ['suspend', 'setRole'].includes(action)) {
      return NextResponse.json(
        { error: 'لا يمكن تنفيذ هذا الإجراء على آخر مسؤول منصة نشط — فعّل مسؤولًا آخر أولًا.' },
        { status: 400 },
      )
    }
  }

  try {
    switch (action) {
      case 'suspend': {
        await db.user.update({ where: { id }, data: { status: 'SUSPENDED' } })
        // رسالة إشعار إن أمكن (غير حاجزة)
        getEmailProvider()
          .send({ ...suspensionNotice(), to: user.email })
          .catch(() => {})
        return NextResponse.json({ ok: true, message: 'تم إيقاف الحساب — طُردت جلسته القائمة فورًا.' })
      }
      case 'activate': {
        await db.user.update({ where: { id }, data: { status: 'ACTIVE' } })
        return NextResponse.json({ ok: true, message: 'تمت إعادة تفعيل الحساب.' })
      }
      case 'setRole': {
        const role = body.role
        if (!['TEACHER', 'MANAGER', 'SUPER_ADMIN'].includes(role)) {
          return NextResponse.json({ error: 'دور غير صالح' }, { status: 400 })
        }
        if (role === 'SUPER_ADMIN' && body.confirm !== 'PROMOTE_SUPER_ADMIN') {
          return NextResponse.json(
            { error: 'ترقية إلى مسؤول منصة تتطلب تأكيدًا صريحًا (confirm: PROMOTE_SUPER_ADMIN).' },
            { status: 400 },
          )
        }
        await db.user.update({ where: { id }, data: { role } })
        return NextResponse.json({ ok: true, message: `تم تحديث الدور إلى ${role === 'TEACHER' ? 'معلم' : role === 'MANAGER' ? 'مدير' : 'مسؤول منصة'}.` })
      }
      case 'setSchool': {
        const school = typeof body.school === 'string' ? body.school.trim() : ''
        await db.user.update({ where: { id }, data: { school: school || null } })
        return NextResponse.json({ ok: true, message: 'تم تحديث المدرسة.' })
      }
      case 'setGender': {
        const gender = body.gender
        if (!['MALE', 'FEMALE', ''].includes(gender)) {
          return NextResponse.json({ error: 'قيمة جنس غير صالحة' }, { status: 400 })
        }
        await db.user.update({ where: { id }, data: { gender: gender || null } })
        return NextResponse.json({ ok: true, message: 'تم تحديث الجنس.' })
      }
      case 'requirePasswordReset': {
        // بدء إجراء استعادة كلمة المرور بالنيابة عن المستخدم
        await db.passwordResetToken.updateMany({
          where: { userId: id, usedAt: null },
          data: { usedAt: new Date() },
        })
        const { raw, tokenHash, expiresAt } = createResetToken()
        await db.passwordResetToken.create({ data: { userId: id, tokenHash, expiresAt } })
        const base = process.env.APP_URL ?? ''
        const resetUrl = `${base}/reset-password?token=${encodeURIComponent(raw)}`
        try {
          await getEmailProvider().send({
            ...passwordResetEmail(resetUrl, Math.round(RESET_TOKEN_TTL_MS / 60000)),
            to: user.email,
          })
        } catch {
          // فشل الإرسال لا يفشل الإجراء — التوكن موجود صالحًا
        }
        return NextResponse.json({ ok: true, message: 'أُرسل رابط استعادة كلمة المرور إلى بريد المستخدم.' })
      }
      default:
        return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
    }
  } catch (e) {
    console.error('super-admin user PATCH error', e)
    return NextResponse.json({ error: 'تعذر تنفيذ الإجراء — حاول مرة أخرى.' }, { status: 500 })
  }
}

function suspensionNotice() {
  return {
    subject: 'إيقاف حسابك — ملف إنجاز المعلم',
    text:
      'تم إيقاف حسابك في منصة «ملف إنجاز المعلم» من قبل مسؤول المنصة.\nتواصل مع إدارة المدرسة لإعادة التفعيل.',
  }
}

/**
 * حذف نهائي — إجراء متقدم جدًا:
 *  - يتطلب GET أولًا لعرض أثر الحذف (الواجهة تفرضه)
 *  - يتطلب تأكيدًا صريحًا confirm: "CONFIRM" + معرفة عدد العناصر confirmCount
 *  - يزيل ملفات التخزين المرفوعة أولًا ثم يحذف السجل (Cascade يأخذ الباقي)
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const guard = await requireSuperAdmin()
  if (guard.res) return guard.res
  const me = guard.me
  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  if (!body || body.confirm !== 'CONFIRM' || typeof body.confirmCount !== 'number') {
    return NextResponse.json(
      { error: 'الحذف النهائي يتطلب تأكيدًا صريحًا بعد معاينة أثر الحذف.' },
      { status: 400 },
    )
  }

  if (id === me.id) {
    return NextResponse.json({ error: 'لا يمكنك حذف حسابك الخاص من هنا.' }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true, status: true, email: true },
  })
  if (!user) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })

  // آخر مسؤول منصة نشط محمي من الحذف
  if (user.role === 'SUPER_ADMIN' && user.status === 'ACTIVE') {
    const others = await activeSuperAdminCount(user.id)
    if (others === 0) {
      return NextResponse.json(
        { error: 'لا يمكن حذف آخر مسؤول منصة نشط.' },
        { status: 400 },
      )
    }
  }

  try {
    // 1) حذف ملفات التخزين المرفوعة الخاصة بالمستخدم (الأصل قبل السجلات)
    const attachments = await db.attachment.findMany({
      where: { userId: id, storagePath: { not: null } },
      select: { storagePath: true },
    })
    const storage = getStorage()
    for (const a of attachments) {
      if (a.storagePath) {
        try {
          await storage.remove(a.storagePath)
        } catch (fileError) {
          console.error('user delete: file remove failed', a.storagePath, fileError)
        }
      }
    }

    // 2) حذف المستخدم — Cascade يحذف السنوات/الأهداف/الإنجازات/الشواهد/الروابط/التأمل/الخطط
    await db.user.delete({ where: { id } })

    return NextResponse.json({
      ok: true,
      message: `تم الحذف النهائي مع ${attachments.length} ملفًا مخزنًا.`,
      deletedFiles: attachments.length,
    })
  } catch (e) {
    console.error('super-admin user DELETE error', e)
    return NextResponse.json({ error: 'تعذر الحذف — حاول مرة أخرى.' }, { status: 500 })
  }
}
