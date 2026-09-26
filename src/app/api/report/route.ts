import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveTargetUser, resolveYear, toSafeUser, sanitizeInternal } from '@/lib/session'
import { computeCompletion } from '@/lib/progress'

// بيانات التقارير — كل ما تحتاجه واجهة التصدير في استدعاء واحد
export async function GET(req: NextRequest) {
  const { me, target } = await resolveTargetUser(req)
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  if (!target) return NextResponse.json({ error: 'لا تملك صلاحية الوصول' }, { status: 403 })

  const year = await resolveYear(target.id, req.nextUrl.searchParams.get('yearId'))
  if (!year) return NextResponse.json({ error: 'لا توجد سنة دراسية' }, { status: 404 })

  const [goals, achievements, attachments, reflection, devPlans, completion] = await Promise.all([
    db.goal.findMany({
      where: { userId: target.id, yearId: year.id },
      orderBy: { createdAt: 'asc' },
      include: {
        achievements: { orderBy: { date: 'asc' }, select: { id: true, title: true, type: true, date: true } },
      },
    }),
    db.achievement.findMany({
      where: { userId: target.id, yearId: year.id },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      include: {
        links: { include: { attachment: true } },
        goal: { select: { id: true, title: true } },
      },
    }),
    db.attachment.findMany({
      where: { userId: target.id, yearId: year.id },
      orderBy: { createdAt: 'desc' },
      include: {
        links: {
          include: {
            achievement: { select: { id: true, title: true, type: true } },
            goal: { select: { id: true, title: true } },
          },
        },
      },
    }),
    db.reflection.findFirst({ where: { userId: target.id, yearId: year.id, term: 'TERM1' } }),
    db.devPlan.findMany({ where: { userId: target.id, yearId: year.id }, orderBy: { createdAt: 'asc' } }),
    computeCompletion(target.id, year.id),
  ])

  return NextResponse.json(
    sanitizeInternal({
      user: toSafeUser(target),
      year,
      goals,
      achievements,
      attachments,
      reflection,
      devPlans,
      completion,
      readonly: target.id !== me.id,
    }),
  )
}
