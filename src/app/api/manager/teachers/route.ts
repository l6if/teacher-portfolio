import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, resolveYear } from '@/lib/session'
import { computeCompletion } from '@/lib/progress'

// عرض المدير — ملفات إنجاز المعلمين
export async function GET(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  if (me.role !== 'MANAGER') {
    return NextResponse.json({ error: 'هذه الصفحة متاحة للمدير فقط' }, { status: 403 })
  }

  // نطاق المدير: إن كانت له مدرسة فلا يرى إلا معلميها (المشرف بلا مدرسة يرى الكل)
  const teachers = await db.user.findMany({
    where: { role: 'TEACHER', ...(me.school ? { school: me.school } : {}) },
    orderBy: { name: 'asc' },
  })

  const rows = await Promise.all(
    teachers.map(async (t) => {
      const year = await resolveYear(t.id)
      if (!year) {
        return {
          id: t.id, name: t.name, subject: t.subject, school: t.school,
          completion: 0, achievements: 0, lastUpdate: null, yearLabel: '—',
        }
      }
      const completion = await computeCompletion(t.id, year.id)
      const last = await db.achievement.findFirst({
        where: { userId: t.id, yearId: year.id },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      })
      return {
        id: t.id,
        name: t.name,
        subject: t.subject,
        school: t.school,
        completion: completion.overall,
        achievements: completion.counts.achievements,
        evidence: completion.counts.evidence,
        lastUpdate: last?.updatedAt ?? null,
        yearLabel: year.label,
      }
    }),
  )

  const q = req.nextUrl.searchParams.get('q')?.trim()
  const filtered = q
    ? rows.filter((r) => r.name.includes(q) || (r.subject ?? '').includes(q))
    : rows

  return NextResponse.json({ teachers: filtered })
}
