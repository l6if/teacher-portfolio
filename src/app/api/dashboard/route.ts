import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveTargetUser, resolveYear, toSafeUser, sanitizeInternal } from '@/lib/session'
import { computeCompletion, pickRecommendation } from '@/lib/progress'

// بيانات الصفحة الرئيسية
export async function GET(req: NextRequest) {
  const { me, target } = await resolveTargetUser(req)
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  if (!target) return NextResponse.json({ error: 'لا تملك صلاحية الوصول لهذا الملف' }, { status: 403 })

  const years = await db.academicYear.findMany({
    where: { userId: target.id },
    orderBy: { createdAt: 'desc' },
  })
  const year = await resolveYear(target.id, req.nextUrl.searchParams.get('yearId'))
  if (!year) {
    return NextResponse.json({ error: 'لا توجد سنة دراسية بعد' }, { status: 404 })
  }

  const completion = await computeCompletion(target.id, year.id)
  const recommendation = pickRecommendation(completion.sections)

  const recent = await db.achievement.findMany({
    where: { userId: target.id, yearId: year.id },
    orderBy: { updatedAt: 'desc' },
    take: 6,
    include: { links: { include: { attachment: true } } },
  })

  const drafts = await db.achievement.findMany({
    where: { userId: target.id, yearId: year.id, status: 'DRAFT' },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  })

  return NextResponse.json(
    sanitizeInternal({
      user: toSafeUser(target),
      year,
      years,
      completion,
      counts: completion.counts,
      recommendation,
      recent,
      drafts,
      readonly: target.id !== me.id,
    }),
  )
}
