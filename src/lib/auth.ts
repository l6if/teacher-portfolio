import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

/**
 * المصادقة الحقيقية:
 * - كلمات المرور: scrypt مع ملح عشوائي لكل مستخدم (بدون مكتبات خارجية).
 * - الجلسة: توكن موقّع HMAC-SHA256 يحمل (userId + تاريخ الانتهاء) —
 *   لا يمكن تزويره ولا انتحال مستخدم آخر بتغيير الكوكي يدويًا.
 */

const SECRET = process.env.SESSION_SECRET

function getSecret(): string {
  if (!SECRET || SECRET.length < 16) {
    // في الإنتاج يجب ضبط SESSION_SECRET دائمًا — نمنع التشغيل الصامت بمفتاح ضعيف
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET مطلوب في بيئة الإنتاج (32 حرفًا على الأقل)')
    }
    // بيئة التطوير فقط: مفتاح ثقيل محلي حتى لا تنقطع الجلسة بين إعادة التشغيل
    return 'dev-only-insecure-secret-DO-NOT-USE-IN-PRODUCTION'
  }
  return SECRET
}

// ─── كلمات المرور ────────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, hash] = parts
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

// ─── توكن الجلسة: userId.expiry.signature ─────────────────────

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 يومًا — مطابق لعمر الكوكي

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

export function createSessionToken(userId: string): string {
  const exp = Date.now() + SESSION_TTL_MS
  const payload = `${userId}.${exp}`
  return `${payload}.${sign(payload)}`
}

/** يتحقق من التوقيع وانتهاء الصلاحية ويعيد userId أو null */
export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [userId, exp, sig] = parts
  const payload = `${userId}.${exp}`
  const expected = sign(payload)
  // مقارنة ثابتة الزمن
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return null
  return userId
}

export const SESSION_MAX_AGE = SESSION_TTL_MS / 1000
