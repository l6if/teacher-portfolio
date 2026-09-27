import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, resolveYear, safeJson, sanitizeInternal } from '@/lib/session'
import { fileKind } from '@/lib/constants'
import {
  getStorage,
  checkExtension,
  checkMagicBytes,
  sizeLimitBytes,
  buildStoragePath,
} from '@/lib/storage'

/**
 * إتمام الرفع المباشر الموقّع — إنشاء سجل الشاهد بعد تحقق فعلي:
 *   POST /api/upload/complete  (JSON: attachmentId, fileName, yearId)
 *
 * الأمان:
 *   • المسار يُعاد اشتقاقه في الخادم من سياق المستخدم الحالي — لا يُوثق
 *     بأي مسار يرسله العميل، فلا يمكن إتمام رفع على مسار غيرك
 *   • يُتحقق من وجود الكائن وحجمه الفعلي بعد الرفع (لا الحجم المعلن)
 *   • فحص بصمة أول 64KB من الملف المرفوع فعلًا — أي انتحال يُرفض ويُحذف
 *   • لا يُنشأ سجل مكرر لنفس المعرف (409)
 */

export const runtime = 'nodejs'

interface CompleteBody {
  attachmentId?: string
  fileName?: string
  yearId?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  const body = await safeJson<CompleteBody>(req)
  if (!body?.attachmentId || !UUID_RE.test(body.attachmentId) || !body.fileName) {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const year = await resolveYear(me.id, body.yearId ?? null)
  if (!year) return NextResponse.json({ error: 'لا توجد سنة دراسية' }, { status: 400 })

  // معرف مرفوع مسبقًا؟ (إعادة إرسال / سباق)
  const existing = await db.attachment.findUnique({ where: { id: body.attachmentId } })
  if (existing) {
    return NextResponse.json({ error: 'هذا الشاهد مسجل بالفعل' }, { status: 409 })
  }

  const allowed = checkExtension(body.fileName)
  if (!allowed) {
    return NextResponse.json({ error: 'نوع الملف غير مسموح' }, { status: 400 })
  }

  // المسار يُشتق من سياق المستخدم الحالي حصرًا — لا يُوثق بالعميل
  const path = buildStoragePath({
    school: me.school,
    userId: me.id,
    yearLabel: year.label,
    attachmentId: body.attachmentId,
    fileName: body.fileName,
    ext: allowed.ext,
  })

  const storage = getStorage()
  const statInfo = await storage.stat(path)
  if (!statInfo) {
    return NextResponse.json(
      { error: 'لم يُرفع الملف بعد — أتمم الرفع المباشر أولًا' },
      { status: 400 },
    )
  }

  // الحجم الفعلي بعد الرفع — لا الحجم المعلن
  const limit = sizeLimitBytes(allowed.kind === 'VIDEO')
  if (statInfo.size <= 0 || statInfo.size > limit) {
    await storage.remove(path).catch(() => {})
    return NextResponse.json(
      { error: `حجم الملف الفعلي يتجاوز الحد المسموح (${allowed.kind === 'VIDEO' ? '100' : '25'}MB)` },
      { status: 413 },
    )
  }

  // بصمة أول 64KB من الملف الفعلي
  const head = await storage.downloadRange(path, 0, 65535)
  if (!head || !checkMagicBytes(head, allowed)) {
    await storage.remove(path).catch(() => {})
    return NextResponse.json(
      { error: 'محتوى الملف لا يطابق نوعه المعلن أو نوع غير مسموح' },
      { status: 400 },
    )
  }

  const title = body.fileName.replace(/\.[^.]*$/, '') || 'شاهد جديد'
  try {
    const attachment = await db.attachment.create({
      data: {
        id: body.attachmentId,
        title,
        kind: fileKind(allowed.mime, body.fileName),
        fileName: body.fileName,
        fileSize: statInfo.size,
        mimeType: allowed.mime,
        storagePath: path,
        userId: me.id,
        yearId: year.id,
      },
    })
    return NextResponse.json(sanitizeInternal({ attachment }), { status: 201 })
  } catch (e) {
    console.error('attachment create failed', e)
    return NextResponse.json({ error: 'تعذر تسجيل الشاهد — حاول مرة أخرى' }, { status: 500 })
  }
}
