// ─── تحققات رفع الملفات — منقولة حرفيًا كما كانت (حمايات مجمّدة) ──
// القائمة البيضاء + فحص البصمة magic bytes + حدود الحجم.
// لم تتغير أي قاعدة — النقل فقط إلى وحدة مستقلة ضمن طبقة التخزين.

export interface AllowedType {
  ext: string
  kind: 'IMAGE' | 'PDF' | 'DOC' | 'SHEET' | 'VIDEO'
  mime: string
}

const ALLOWED: AllowedType[] = [
  { ext: 'png', kind: 'IMAGE', mime: 'image/png' },
  { ext: 'jpg', kind: 'IMAGE', mime: 'image/jpeg' },
  { ext: 'jpeg', kind: 'IMAGE', mime: 'image/jpeg' },
  { ext: 'webp', kind: 'IMAGE', mime: 'image/webp' },
  { ext: 'gif', kind: 'IMAGE', mime: 'image/gif' },
  { ext: 'bmp', kind: 'IMAGE', mime: 'image/bmp' },
  { ext: 'pdf', kind: 'PDF', mime: 'application/pdf' },
  { ext: 'doc', kind: 'DOC', mime: 'application/msword' },
  { ext: 'docx', kind: 'DOC', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { ext: 'xls', kind: 'SHEET', mime: 'application/vnd.ms-excel' },
  { ext: 'xlsx', kind: 'SHEET', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { ext: 'csv', kind: 'SHEET', mime: 'text/csv' },
  { ext: 'ppt', kind: 'DOC', mime: 'application/vnd.ms-powerpoint' },
  { ext: 'pptx', kind: 'DOC', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  { ext: 'mp4', kind: 'VIDEO', mime: 'video/mp4' },
  { ext: 'webm', kind: 'VIDEO', mime: 'video/webm' },
  { ext: 'mov', kind: 'VIDEO', mime: 'video/quicktime' },
  { ext: 'm4v', kind: 'VIDEO', mime: 'video/x-m4v' },
]

export const MAX_DOC_MB = Number(process.env.UPLOAD_MAX_MB || 25)
export const MAX_VIDEO_MB = Number(process.env.UPLOAD_VIDEO_MAX_MB || 100)

/**
 * حد الرفع عبر الوكيل (proxy) داخل دالة الخادم — فوقه يلزم الرفع المباشر الموقّع.
 * حدود Vercel Functions لجسم الطلب ≈ 4.5MB؛ نترك هامش أمان (الافتراضي 4MB).
 * في وضع التخزين المحلي (تطوير/اختبار) يُستخدم دائمًا مسار الوكيل.
 */
export const PROXY_UPLOAD_LIMIT_MB = Number(process.env.PROXY_UPLOAD_LIMIT_MB || 4)
export const PROXY_UPLOAD_LIMIT_BYTES = PROXY_UPLOAD_LIMIT_MB * 1024 * 1024

/** التحقق من الامتداد مقابل القائمة البيضاء */
export function checkExtension(fileName: string): AllowedType | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  return ALLOWED.find((a) => a.ext === ext) ?? null
}

/**
 * فحص البصمة (magic bytes) — يتأكد أن محتوى الملف يطابق نوعه المعلن
 * ويرفض الملفات التنفيذية وأي محتوى HTML/سكربت.
 */
export function checkMagicBytes(buf: Buffer, allowed: AllowedType): boolean {
  // رفض قاطع للتنفيذيات و anything يبدأ كـ HTML/سكربت
  if (buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a) return false // MZ (exe)
  if (buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return false // ELF
  const head = buf.subarray(0, 64).toString('latin1').toLowerCase()
  if (head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('<?php') || head.startsWith('<script')) return false

  switch (allowed.ext) {
    case 'png': return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    case 'jpg': case 'jpeg': return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    case 'gif': return buf.length > 6 && buf.subarray(0, 6).toString('latin1') === 'GIF89a' || buf.subarray(0, 6).toString('latin1') === 'GIF87a'
    case 'webp': return buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP'
    case 'bmp': return buf.length > 2 && buf[0] === 0x42 && buf[1] === 0x4d
    case 'pdf': return buf.subarray(0, 5).toString('latin1') === '%PDF-'
    case 'doc': case 'xls': case 'ppt': return buf.length > 8 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0
    case 'docx': case 'xlsx': case 'pptx': return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b // PK (zip)
    case 'csv': return !/[<>]/.test(head) // نص فقط — لا وسوم HTML
    case 'mp4': case 'mov': case 'm4v': return buf.length > 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp'
    case 'webm': return buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3
    default: return false
  }
}

/** حد الحجم حسب النوع (فيديو أم مستند) */
export function sizeLimitBytes(kindVideo: boolean): number {
  return (kindVideo ? MAX_VIDEO_MB : MAX_DOC_MB) * 1024 * 1024
}
