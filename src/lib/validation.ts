/**
 * تحقق مركزي من مدخلات المصادقة — رسائل عربية بشرية.
 * لا Prisma errors ولا stack traces تصل للمستخدم أبدًا.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** تطبيع البريد: trim + lowercase — يمنع التكرار بحروف مختلفة */
export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase()
}

export function validateEmail(email: string): string | null {
  if (!email) return 'أدخل البريد الإلكتروني'
  if (email.length > 254) return 'البريد الإلكتروني طويل جدًا'
  if (!EMAIL_RE.test(email)) return 'أدخل بريدًا إلكترونيًا صحيحًا'
  return null
}

// كلمات مرور ضعيفة جدًا — شائعة ومعروفة
const WEAK_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1',
  'qwerty123', '11111111', '88888888', '00000000', 'abcd1234',
  'letmein1', 'iloveyou1', 'welcome123', 'school123', 'admin123',
])

export function validatePassword(
  password: string,
  confirm?: string,
): string | null {
  if (!password) return 'أدخل كلمة المرور'
  if (password.length < 8) return 'كلمة المرور قصيرة جدًا — 8 أحرف على الأقل'
  if (password.length > 128) return 'كلمة المرور طويلة جدًا'
  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return 'كلمة المرور ضعيفة جدًا — اختر كلمة مرور أصعب للتخمين'
  }
  // تنوع أدنى: أحرف وأرقام
  if (!/[A-Za-zء-ي]/.test(password) || !/[0-9]/.test(password)) {
    return 'اجعل كلمة المرور تجمع بين الحروف والأرقام'
  }
  if (confirm !== undefined && password !== confirm) {
    return 'كلمتا المرور غير متطابقتين'
  }
  return null
}

/** قيم الجنس المسموحة */
export const GENDER_VALUES = ['MALE', 'FEMALE'] as const
export type Gender = (typeof GENDER_VALUES)[number]

export function validateGender(gender: string | null | undefined): Gender | null {
  if (gender === 'MALE' || gender === 'FEMALE') return gender
  return null
}
