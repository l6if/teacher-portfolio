import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, safeJson } from '@/lib/session'

// ربط / فك ربط شاهد بإنجاز أو هدف — إعادة استخدام بدون تكرار الملف
export async function POST(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  const body = await safeJson<{ attachmentId?: string; achievementId?: string; goalId?: string; action?: string }>(req)
  if (!body?.attachmentId) return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  const { attachmentId, achievementId, goalId, action } = body

  const attachment = await db.attachment.findUnique({ where: { id: attachmentId } })
  if (!attachment || attachment.userId !== me.id) {
    return NextResponse.json({ error: 'الشاهد غير موجود' }, { status: 404 })
  }

  if (achievementId) {
    const ach = await db.achievement.findUnique({ where: { id: achievementId } })
    if (!ach || ach.userId !== me.id) {
      return NextResponse.json({ error: 'الإنجاز غير موجود' }, { status: 404 })
    }
  }
  if (goalId) {
    const goal = await db.goal.findUnique({ where: { id: goalId } })
    if (!goal || goal.userId !== me.id) {
      return NextResponse.json({ error: 'الهدف غير موجود' }, { status: 404 })
    }
  }

  if (action === 'remove') {
    await db.evidenceLink.deleteMany({
      where: { attachmentId, achievementId: achievementId ?? undefined, goalId: goalId ?? undefined },
    })
  } else {
    try {
      await db.evidenceLink.create({
        data: { attachmentId, achievementId: achievementId ?? null, goalId: goalId ?? null },
      })
    } catch (e: unknown) {
      // رابط مكرر (قيد الفريدية) — لا يعد خطأ: العملية idempotent
      if ((e as { code?: string })?.code !== 'P2002') throw e
    }
  }

  const links = await db.evidenceLink.findMany({
    where: { attachmentId },
    include: {
      achievement: { select: { id: true, title: true, type: true } },
      goal: { select: { id: true, title: true } },
    },
  })
  return NextResponse.json({ links })
}
