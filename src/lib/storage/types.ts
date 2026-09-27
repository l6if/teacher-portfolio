// ─── عقد مزوّد التخزين — تجريد موحّد للقرص المحلي و Supabase Storage ──
// التطبيق يخاطب هذا العقد فقط؛ التنفيذ (محلي/Supabase) يُختار من متغيرات
// البيئة عند التشغيل — دون أي تغيير في مسارات API أو الواجهة.

export interface StorageStream {
  stream: ReadableStream<Uint8Array>
  size: number
}

export interface SignedUploadTicket {
  /** المسار داخل الحاوية (يُعاد للعميل مع التوكن) */
  path: string
  /** توكن الرفع الموقّع قصير العمر */
  token: string
  /** الرابط الموقّع الكامل (احتياطي — العميل يبني رابطه من path+token) */
  signedUrl: string
}

export interface StorageProvider {
  /** نوع المزوّد للفحوصات والتشخيص */
  readonly kind: 'local' | 'supabase'
  /** اسم الحاوية (Supabase) أو null */
  readonly bucket: string | null

  /** رفع كامل من الخادم (وضع الوكيل) — يرفض الكتابة فوق موجود */
  upload(path: string, data: Buffer, contentType: string): Promise<void>
  /** تنزيل كامل في الذاكرة — يستخدمه تحسين الصور والتحقق من البصمة */
  download(path: string): Promise<Buffer | null>
  /** تدفق مباشر مع الحجم — يستخدمه تقديم الملفات /api/files */
  openStream(path: string): Promise<StorageStream | null>
  /** معلومات الكائن دون تنزيل */
  stat(path: string): Promise<{ size: number } | null>
  /** نطاق بايتات — للتحقق من بصمة ملف ضخم دون تحميله كاملًا */
  downloadRange(path: string, start: number, end: number): Promise<Buffer | null>
  /** حذف كائن — يعيد true إذا كان موجودًا وحُذف فعلًا */
  remove(path: string): Promise<boolean>
  /** وجود الكائن */
  exists(path: string): Promise<boolean>
  /** رابط موقّع قصير العمر — للاستخدام النادر؛ الافتراضي تقديم عبر proxy الخادم */
  createSignedUrl(path: string, expiresIn: number): Promise<string | null>
  /** رابط رفع موقّع للعميل (Direct Upload) — غير مدعوم محليًا */
  createSignedUploadUrl(path: string): Promise<SignedUploadTicket | null>
}
