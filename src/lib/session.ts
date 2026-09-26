import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { db } from './db'
import { verifySessionToken } from './auth'

export const SESSION_COOKIE = 'pf_session'

export async function getCurrentUser() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  // التوكن موقّع HMAC — لا يمكن انتحال userId آخر بتغيير الكوكي
  const uid = verifySessionToken(token)
  if (!uid) return null
  return db.user.findUnique({ where: { id: uid } })
}

/**
 * تحديد المستخدم الهدف: المعلم يرى ملفه فقط، والمدير يستطيع الاطلاع
 * على ملفات المعلمين المسموح له برؤيتهم (معلمو مدرسته فقط إن حُددت مدرسته).
 * التحقق يتم هنا من جهة الخادم وليس الواجهة.
 */
export async function resolveTargetUser(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return { me: null, target: null }

  const targetId = req.nextUrl.searchParams.get('userId')
  if (targetId && targetId !== me.id) {
    if (me.role !== 'MANAGER') return { me, target: null }
    // المدير يفتح ملفات المعلمين فقط — لا ملفات مديرين آخرين
    const target = await db.user.findUnique({ where: { id: targetId } })
    if (!target || target.role !== 'TEACHER') return { me, target: null }
    // نطاق المدير: إن كانت له مدرسة فلا يرى إلا معلميها (مشرف المنطقة بدون مدرسة يرى الكل)
    if (me.school && target.school && target.school !== me.school) {
      return { me, target: null }
    }
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

/** قراءة جسم JSON بشكل آمن — جسم تالف يعيد null (يُعالج كـ 400) */
export async function safeJson<T = any>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}
