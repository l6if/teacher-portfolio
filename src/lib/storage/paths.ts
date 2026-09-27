// ─── بناء مسارات التخزين الآمنة ────────────────────────────────
// البنية الإلزامية: school/user/year/attachment-id/file
// - معرّف المرفق هو الأساس (المجلد الخاص به) — اسم الملف الأصلي لا يُستخدم
//   كمعرف أبدًا، ويُحتفظ به في Metadata قاعدة البيانات (fileName) فقط.
// - كل مقطع يُنظَّف من أي محاولة اجتياز مسار (../ أو / أو \ أو محارف تحكم).

/** تنظيف مقطع مسار: حروف يونيكود (العربية محفوظة) وأرقام و - و _ فقط */
export function sanitizeSegment(raw: string | null | undefined, fallback: string, maxLen = 60): string {
  if (!raw) return fallback
  let s = String(raw)
    .trim()
    .replace(/\s+/g, '-') // المسافات → شرطة
    .replace(/[./\\:*>|"'\[\]{}();!?~`\x00-\x1f\u200e\u200f\u202a-\u202e]/g, '') // محارف خطرة/تحكم/اتجاه
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/^-+|-+$/g, '')
  if (!s) s = fallback
  return s
}

/** تحقق دفاعي: المسار المخزَّن يجب أن يكون نسبيًا بلا اجتياز مجلدات */
export function isSafeRelativePath(p: string | null | undefined): p is string {
  if (!p) return false
  if (p.includes('..') || p.startsWith('/') || p.includes('\\') || p.includes('\x00')) return false
  if (p.length > 512) return false
  return true
}

export interface StoragePathInput {
  /** مدرسة المعلم (من بروفايله) — مقطع المستوى الأول */
  school?: string | null
  /** معرّف المستخدم — يضمن عزل ملفات كل معلم */
  userId: string
  /** عنوان السنة الدراسية مثل «1448هـ» */
  yearLabel?: string | null
  /** معرّف المرفق — المجلد الأساسي المعرِّف للملف */
  attachmentId: string
  /** الاسم الأصلي للملف — للعرض فقط، يُنظَّف قبل استخدامه في المسار */
  fileName?: string | null
  /** الامتداد المعتمد من القائمة البيضاء */
  ext: string
}

/**
 * بناء مسار التخزين: school/user/year/attachment-id/file
 * اسم الملف النهائي مشتق من الاسم الأصلي منظّفًا (للقراءة داخل الحاوية فقط) —
 * المعرف الفعلي هو attachmentId فلا يحدث أي تعارض مهما تشابهت الأسماء.
 */
export function buildStoragePath(input: StoragePathInput): string {
  const schoolSeg = sanitizeSegment(input.school, 'unspecified-school', 40)
  const userSeg = sanitizeSegment(input.userId, 'user', 40)
  const yearSeg = sanitizeSegment(input.yearLabel, 'year', 20)
  const idSeg = sanitizeSegment(input.attachmentId, 'attachment', 40)
  const base = sanitizeSegment(
    (input.fileName ?? '').replace(/\.[^.]*$/, ''), // بلا امتداد — نضيفه نحن
    'file',
    60,
  )
  const ext = input.ext.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${schoolSeg}/${userSeg}/${yearSeg}/${idSeg}/${base}.${ext}`
}
