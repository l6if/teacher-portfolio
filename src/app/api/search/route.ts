import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveTargetUser, resolveYear } from '@/lib/session'

// البحث الشامل — إنجازات + أهداف + شواهد (ضمن صلاحيات المستخدم)
export async function GET(req: NextRequest) {
  const { me, target } = await resolveTargetUser(req)
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  if (!target) return NextResponse.json({ error: 'لا تملك صلاحية الوصول' }, { status: 403 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1) return NextResponse.json({ achievements: [], goals: [], attachments: [] })

  const year = await resolveYear(target.id, req.nextUrl.searchParams.get('yearId'))
  if (!year) return NextResponse.json({ achievements: [], goals: [], attachments: [] })

  const contains = { contains: q }

  const [achievements, goals, attachments] = await Promise.all([
    db.achievement.findMany({
      where: {
        userId: target.id,
        yearId: year.id,
        OR: [
          { title: contains }, { description: contains }, { keywords: contains },
          { impact: contains }, { results: contains }, { problem: contains },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 12,
      select: { id: true, title: true, type: true, date: true, status: true, description: true },
    }),
    db.goal.findMany({
      where: {
        userId: target.id,
        yearId: year.id,
        OR: [{ title: contains }, { description: contains }, { indicator: contains }],
      },
      take: 6,
      select: { id: true, title: true, currentValue: true, targetValue: true },
    }),
    db.attachment.findMany({
      where: {
        userId: target.id,
        yearId: year.id,
        OR: [{ title: contains }, { keywords: contains }, { fileName: contains }],
      },
      take: 8,
      select: { id: true, title: true, kind: true, url: true },
    }),
  ])

  return NextResponse.json({ achievements, goals, attachments, yearLabel: year.label })
}
