import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { db } from './db'
import { verifySessionToken } from './auth'

export const SESSION_COOKIE = 'pf_session'

// ═══ أمان بيانات المستخدم ═══════════════════════════════════
// passwordHash (وأي بيانات أمان داخلية) لا يغادر الخادم أبدًا عبر أي API.
// الطبقة الأولى: explicit select في كل استعلام مستخدم (getCurrentUser/resolveTargetUser).
// الطبقة الثانية: toSafeUser DTO يُطبَّق عند كل تسلسل JSON (دفاع في العمق —
// يحمي حتى لو استعاد مسارٌ ما المستخدم باستعلام خام خاص به).

/** حقول آمنة للتسلسل — كل حقول User عدا passwordHash */
export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  school: true,
  subject: true,
  qualification: true,
  experienceYears: true,
  stage: true,
  classes: true,
  licenseNumber: true,
  duties: true,
  photoUrl: true,
  educationAdmin: true,
  educationOffice: true,
  principalName: true,
  weeklyLoad: true,
  schedule: true,
  committees: true,
  extraDuties: true,
  createdAt: true,
  updatedAt: true,
} as const

/** DTO آمن: يحرّر passwordHash من أي كائن مستخدم قبل مغادرة الخادم (إن وُجد) */
export function toSafeUser<T extends object>(user: T): Omit<T, 'passwordHash'> {
  if (!user) return user
  const { passwordHash: _removed, ...safe } = user as T & { passwordHash?: string | null }
  return safe as Omit<T, 'passwordHash'>
}

// ═══ تنقية عميقة للحمولات المعقدة ═══════════════════════════
// الحقول الداخلية التي لا تغادر الخادم أبدًا مهما تعمّق التسلسل:
//   • passwordHash — بيانات اعتماد المستخدم
//   • storagePath — مسار التخزين الداخلي للملف (بنية school/user/year/...)
const INTERNAL_KEYS = new Set(['passwordHash', 'storagePath'])

/**
 * ينقي أي شجرة كائنات من الحقول الداخلية — عميقًا (مصفوفات + كائنات متداخلة).
 * يعالج الحمولات المركبة مثل الإنجازات بروابط شواهدها والمرفقات المتداخلة.
 * كائنات Date تمر كما هي (تُسلسل ISO عبر NextResponse.json كالمعتاد).
 */
export function sanitizeInternal<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sanitizeInternal) as unknown as T
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (INTERNAL_KEYS.has(k)) continue
      out[k] = sanitizeInternal(v)
    }
    return out as T
  }
  return value
}

export async function getCurrentUser() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  // التوكن موقّع HMAC — لا يمكن انتحال userId آخر بتغيير الكوكي
  const uid = verifySessionToken(token)
  if (!uid) return null
  return db.user.findUnique({ where: { id: uid }, select: SAFE_USER_SELECT })
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
    // (select آمن — بلا passwordHash أصلًا)
    const target = await db.user.findUnique({
      where: { id: targetId },
      select: SAFE_USER_SELECT,
    })
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
