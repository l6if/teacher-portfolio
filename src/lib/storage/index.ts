// ─── نظام التخزين الآمن للشواهد — واجهة موحّدة (محلي ⇄ Supabase) ──
// اختيار المزوّد:
//   • Supabase (الإنتاج): عند ضبط SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//   • محلي (تطوير/اختبار): خلاف ذلك — تحت storage/uploads
// القواعد الثابتة في الحالتين:
//   • الملفات خارج public — لا وصول مباشر برابط عام أبدًا
//   • التقديم حصريًا عبر /api/files/<id> بعد التحقق من الجلسة والملكية
//   • بنية المسارات: school/user/year/attachment-id/file

import type { StorageProvider } from './types'
import { LocalDiskStorage } from './local'
import { SupabaseStorage } from './supabase'

export * from './validation'
export * from './paths'
export type { StorageProvider, StorageStream, SignedUploadTicket } from './types'

export const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'teacher-evidence'

/** إعداد Supabase من متغيرات البيئة (جانب الخادم فقط) */
export function supabaseStorageEnv(): { url: string; serviceKey: string; bucket: string } | null {
  const url = process.env.SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceKey || !/^https?:\/\//.test(url)) return null
  return { url, serviceKey, bucket: SUPABASE_STORAGE_BUCKET }
}

/** هل التخزين الفعّال هو Supabase Storage؟ */
export function isSupabaseStorage(): boolean {
  return process.env.STORAGE_DRIVER !== 'local' && supabaseStorageEnv() != null
}

let cached: StorageProvider | null = null

/**
 * المزوّد الفعّال. في الإنتاج يُرفض التخزين المحلي قاطعًا (فشل صريح مبكر)
 * إلا بعلم صريح للاختبار المحلي فقط — الإنتاج لا يعتمد على قرص قابل للمحو أبدًا.
 */
export function getStorage(): StorageProvider {
  if (cached) return cached
  if (isSupabaseStorage()) {
    const env = supabaseStorageEnv()!
    cached = new SupabaseStorage(env.url, env.serviceKey, env.bucket)
  } else {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.STORAGE_ALLOW_LOCAL_IN_PROD !== '1'
    ) {
      throw new Error(
        'التخزين المحلي ممنوع في بيئة الإنتاج — اضبط SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY (حاوية خاصة). ' +
          '(لاختبار إنتاجي محلي فقط: STORAGE_ALLOW_LOCAL_IN_PROD=1)',
      )
    }
    cached = new LocalDiskStorage()
  }
  return cached
}

/** للاختبارات — إبطال المزوّد المخزَّن مؤقتًا بعد تغيير المتغيرات */
export function resetStorageCache(): void {
  cached = null
}
