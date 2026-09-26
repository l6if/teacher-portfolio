import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin, SAFE_USER_SELECT } from '@/lib/session'

/**
 * قائمة المستخدمين لمسؤول المنصة: بحث + فلترة + صفحات.
 * البحث بالاسم أو البريد — لا يُعاد أي حقل داخلي (SAFE_USER_SELECT).
 */
export async function GET(req: NextRequest) {
  const guard = await requireSuperAdmin()
  if (guard.res) return guard.res

  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').trim()
  const role = sp.get('role') ?? ''
  const gender = sp.get('gender') ?? ''
  const status = sp.get('status') ?? ''
  const school = (sp.get('school') ?? '').trim()
  const page = Math.max(1, Number(sp.get('page') ?? '1') || 1)
  const pageSize = Math.min(100, Math.max(10, Number(sp.get('pageSize') ?? '20') || 20))

  const where: Record<string, unknown> = {}
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (role === 'TEACHER' || role === 'MANAGER' || role === 'SUPER_ADMIN') where.role = role
  if (gender === 'MALE' || gender === 'FEMALE') where.gender = gender
  if (status === 'ACTIVE' || status === 'SUSPENDED') where.status = status
  if (school) where.school = { contains: school, mode: 'insensitive' }

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        ...SAFE_USER_SELECT,
        _count: { select: { achievements: true, attachments: true } },
      },
    }),
  ])

  // قائمة المدارس المتاحة للفلترة (من البيانات الفعلية)
  const schools = await db.user.findMany({
    where: { school: { not: null } },
    select: { school: true },
    distinct: ['school'],
    orderBy: { school: 'asc' },
  })

  return NextResponse.json({
    users,
    total,
    page,
    pageSize,
    schools: schools.map((s) => s.school).filter((s): s is string => Boolean(s?.trim())),
  })
}
