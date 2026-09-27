import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { getCurrentUser, resolveYear, sanitizeInternal } from '@/lib/session'
import { fileKind } from '@/lib/constants'
import {
  getStorage,
  isSupabaseStorage,
  checkExtension,
  checkMagicBytes,
  sizeLimitBytes,
  buildStoragePath,
  PROXY_UPLOAD_LIMIT_BYTES,
} from '@/lib/storage'

/**
 * رفع الشواهد — وضع الوكيل (الملف يمر عبر دالة الخادم):
 *   POST /api/upload  (FormData: file, yearId)
 *
 * الحمايات (كما هي دون أي تخفيف):
 *   • جلسة صالحة + السنة تخص المستخدم نفسه
 *   • قائمة بيضاء للامتدادات + فحص البصمة magic bytes
 *   • رفض التنفيذيات وأي محتوى HTML/سكربت
 *   • حدود الحجم حسب النوع (مستند/فيديو)
 *   • الاسم الأصلي يُحفظ Metadata فقط — المسار school/user/year/attachment-id/file
 *
 * الملفات الأكبر من حد الوكيل (بيئة Supabase) تُرفض هنا بكود 422 مع توجيه
 * العميل لمسار الرفع المباشر الموقّع /api/upload/direct — لا تمر عبر الدالة.
 */

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'طلب رفع غير صالح' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'لم يُرفق أي ملف' }, { status: 400 })
  }

  const year = await resolveYear(me.id, form.get('yearId')?.toString() || null)
  if (!year) return NextResponse.json({ error: 'لا توجد سنة دراسية' }, { status: 400 })

  // في بيئة Supabase: الملفات الضخمة تمر حصرًا عبر الرفع المباشر الموقّع
  if (isSupabaseStorage() && file.size > PROXY_UPLOAD_LIMIT_BYTES) {
    return NextResponse.json(
      {
        error: 'حجم الملف يتجاوز حد الرفع عبر الخادم — استخدم مسار الرفع المباشر',
        mode: 'direct',
      },
      { status: 422 },
    )
  }

  // 1) الامتداد مقابل القائمة البيضاء
  const allowed = checkExtension(file.name)
  if (!allowed) {
    return NextResponse.json({ error: 'نوع الملف غير مسموح' }, { status: 400 })
  }

  // 2) حد الحجم حسب النوع
  const limit = sizeLimitBytes(allowed.kind === 'VIDEO')
  if (file.size <= 0 || file.size > limit) {
    return NextResponse.json(
      { error: `حجم الملف يتجاوز الحد المسموح (${allowed.kind === 'VIDEO' ? '100' : '25'}MB)` },
      { status: 413 },
    )
  }

  // 3) فحص البصمة — يرفض التنفيذيات وHTML والانتحال
  const buf = Buffer.from(await file.arrayBuffer())
  if (!checkMagicBytes(buf, allowed)) {
    return NextResponse.json(
      { error: 'محتوى الملف لا يطابق نوعه المعلن أو نوع غير مسموح' },
      { status: 400 },
    )
  }

  const storage = getStorage()
  const id = randomUUID()
  const mimeType = allowed.mime // النوع الموثوق من القائمة البيضاء — لا من العميل
  const path = buildStoragePath({
    school: me.school,
    userId: me.id,
    yearLabel: year.label,
    attachmentId: id,
    fileName: file.name,
    ext: allowed.ext,
  })

  try {
    await storage.upload(path, buf, mimeType)
  } catch (e) {
    console.error('upload failed', e)
    return NextResponse.json({ error: 'تعذر حفظ الملف — حاول مرة أخرى' }, { status: 500 })
  }

  const title = file.name.replace(/\.[^.]*$/, '') || 'شاهد جديد'
  try {
    const attachment = await db.attachment.create({
      data: {
        id,
        title,
        kind: fileKind(mimeType, file.name),
        fileName: file.name,
        fileSize: buf.length,
        mimeType,
        storagePath: path,
        userId: me.id,
        yearId: year.id,
      },
    })
    return NextResponse.json(sanitizeInternal({ attachment }), { status: 201 })
  } catch (e) {
    // فشل إنشاء السجل — نزيل الملف المرفوع حتى لا يبقى يتيمًا
    await storage.remove(path).catch(() => {})
    console.error('attachment create failed', e)
    return NextResponse.json({ error: 'تعذر تسجيل الشاهد — حاول مرة أخرى' }, { status: 500 })
  }
}
