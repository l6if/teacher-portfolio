import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { db } from './db'
import { parseSessionToken, SESSION_MAX_AGE } from './auth'

export const SESSION_COOKIE = 'pf_session'

// ═══ كوكي الجلسة عبر بوابات HTTPS (معاينة space-z.ai مثلًا) ═══
// المتصفح يمنع كوكيز SameSite=Lax/Strict في السياق عبر الموقع (iframe المعاينة)،
// فينجح POST /api/session لكن الكوكي لا يُخزَّن → /api/me يعيد 401 فورًا.
// الحل: عند خدمة الطلب عبر HTTPS (مباشرة أو خلف بروكسي) نُصدر الكوكي
// SameSite=None + Secure — وهي الصيغة الوحيدة المقبولة في ذلك السياق.
// محليًا عبر HTTP يبقى Lax كما كان (لا تغيير على تجربة التطوير).

/** هل يُخدم الطلب عبر HTTPS؟ (مباشرة، أو خلف بروكسي/بوابة يحترم الترويسات القياسية) */
export function isSecureRequest(req: NextRequest): boolean {
  if (req.nextUrl.protocol === 'https:') return true
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  if (proto === 'https') return true
  if (req.headers.get('x-forwarded-ssl')?.toLowerCase() === 'on') return true
  // نطاق حقيقي (ليس localhost ولا IP) = لا يُوَصَّل إلا عبر بوابة HTTPS حتمًا
  const host = (req.headers.get('host') ?? '').split(':')[0].trim().toLowerCase()
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  return !isLocal && host.includes('.')
}

/** خيارات كوكي الجلسة — مشتقة من سياق الطلب نفسه */
export function sessionCookieOptions(req: NextRequest) {
  const secure = isSecureRequest(req)
  return {
    httpOnly: true as const,
    sameSite: (secure ? 'none' : 'lax') as 'none' | 'lax',
    secure,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  }
}

/** حذف كوكي الجلسة بنفس خصائص الإصدار حتى يُطابق فعليًا في كل السياقات */
export function clearSessionCookie(res: NextResponse, req: NextRequest) {
  res.cookies.set(SESSION_COOKIE, '', {
    ...sessionCookieOptions(req),
    maxAge: 0,
    expires: new Date(0),
  })
}

// ═══ أمان بيانات المستخدم ═══════════════════════════════════
// passwordHash (وأي بيانات أمان داخلية) لا يغادر الخادم أبدًا عبر أي API.
// الطبقة الأولى: explicit select في كل استعلام مستخدم (getCurrentUser/resolveTargetUser).
// الطبقة الثانية: toSafeUser DTO يُطبَّق عند كل تسلسل JSON (دفاع في العمق —
// يحمي حتى لو استعاد مسارٌ ما المستخدم باستعلام خام خاص به).

/** حقول آمنة للتسلسل — كل حقول User عدا passwordHash وsessionEpoch */
export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  gender: true,
  lastLoginAt: true,
  isDemo: true,
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
const INTERNAL_KEYS = new Set(['passwordHash', 'storagePath', 'sessionEpoch'])

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
  const parsed = parseSessionToken(token)
  if (!parsed) return null
  // نجلب الحقول الآمنة + epoch للتحقق من إبطال الجلسات (تغيير كلمة المرور)
  const user = await db.user.findUnique({
    where: { id: parsed.userId },
    select: { ...SAFE_USER_SELECT, sessionEpoch: true },
  })
  if (!user) return null
  // حساب موقوف = جلسة مرفوضة فورًا (الإيقاف يطرد المستخدم الحالي أيضًا)
  if (user.status === 'SUSPENDED') return null
  // epoch لا يتطابق = الجلسة أُبطلت بعد تغيير كلمة المرور
  if (parsed.epoch !== user.sessionEpoch) return null
  const { sessionEpoch: _internal, ...safe } = user
  return safe
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

/**
 * حارس مسؤول المنصة — Server-side حصراً (لا اعتماد على إخفاء عناصر UI).
 * غير مسجل 401 — مسجل بغير دور SUPER_ADMIN 403.
 */
export async function requireSuperAdmin(): Promise<
  { me: null; res: NextResponse } | { me: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; res: null }
> {
  const me = await getCurrentUser()
  if (!me) {
    return { me: null, res: NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 }) }
  }
  if (me.role !== 'SUPER_ADMIN') {
    return { me: null, res: NextResponse.json({ error: 'هذه الواجهة لمسؤول المنصة فقط' }, { status: 403 }) }
  }
  return { me, res: null }
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
