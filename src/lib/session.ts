import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { db } from './db'

export const SESSION_COOKIE = 'pf_session'

export async function getCurrentUser() {
  const store = await cookies()
  const uid = store.get(SESSION_COOKIE)?.value
  if (!uid) return null
  return db.user.findUnique({ where: { id: uid } })
}

/**
 * تحديد المستخدم الهدف: المعلم يرى ملفه فقط، والمدير يستطيع الاطلاع على أي معلم.
 * التحقق يتم هنا من جهة الخادم وليس الواجهة.
 */
export async function resolveTargetUser(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return { me: null, target: null }

  const targetId = req.nextUrl.searchParams.get('userId')
  if (targetId && targetId !== me.id) {
    if (me.role !== 'MANAGER') return { me, target: null }
    const target = await db.user.findUnique({ where: { id: targetId } })
    return { me, target }
  }
  return { me, target: me }
}

/** سنة العرض: المحددة في الطلب، وإلا الأحدث غير المؤرشفة، وإلا الأحدث */
export async function resolveYear(userId: string, yearId?: string | null) {
  if (yearId) {
    const y = await db.academicYear.findFirst({ where: { id: yearId, userId } })
    if (y) return y
  }
  const active = await db.academicYear.findFirst({
    where: { userId, archived: false },
    orderBy: { createdAt: 'desc' },
  })
  if (active) return active
  return db.academicYear.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } })
}
