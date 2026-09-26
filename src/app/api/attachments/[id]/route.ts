import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, safeJson, sanitizeInternal } from '@/lib/session'
import { getStorage } from '@/lib/storage'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  const { id } = await params

  const existing = await db.attachment.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'الشاهد غير موجود' }, { status: 404 })
  if (existing.userId !== me.id) return NextResponse.json({ error: 'لا يمكنك تعديل هذا الشاهد' }, { status: 403 })

  const body = await safeJson(req)
  if (!body) return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  const data: Record<string, unknown> = {}
  for (const f of ['title', 'keywords', 'url']) {
    if (f in body) data[f] = body[f] === '' ? null : body[f]
  }
  // روابط الشواهد تُفتح في نافذة جديدة — نمنع أي مخطط غير http/https
  if (data.url && !/^https?:\/\//.test(String(data.url))) {
    return NextResponse.json({ error: 'الرابط يجب أن يبدأ بـ http أو https' }, { status: 400 })
  }
  const attachment = await db.attachment.update({ where: { id }, data })
  return NextResponse.json(sanitizeInternal({ attachment }))
}

/**
 * حذف شاهد — مع حماية اليتامى (Orphan Protection):
 *
 * 1) يُتحقق من EvidenceLinks أولًا: شاهد مستخدم في أكثر من إنجاز/هدف = ملف
 *    مستخدم بكثافة — لا يُحذف ملف التخزين تلقائيًا أبدًا في هذه الحالة
 *    (يُنظَّف لاحقًا عبر scripts/storage-doctor.ts بقرار صريح).
 * 2) الملف يُحذف من التخزين فقط عندما لا يبقى له أي مرجع:
 *    لا روابط شواهد أخرى، ولا سجل مرفق آخر يشترك في نفس المسار.
 * 3) حذف إنجاز يزيل روابطه فقط — لا يمس ملفات الشواهد إطلاقًا
 *    (الشواهد عناصر مكتبة مستقلة قابلة لإعادة الاستخدام).
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  const { id } = await params

  const existing = await db.attachment.findUnique({
    where: { id },
    include: { _count: { select: { links: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'الشاهد غير موجود' }, { status: 404 })
  if (existing.userId !== me.id) return NextResponse.json({ error: 'لا يمكنك حذف هذا الشاهد' }, { status: 403 })

  const linkCount = existing._count.links

  // هل يشترك مرفق آخر في نفس مسار الملف؟ (مرجع إضافي يمنع الحذف)
  let sharedRefs = 0
  if (existing.storagePath) {
    sharedRefs = await db.attachment.count({
      where: { storagePath: existing.storagePath, id: { not: id } },
    })
  }

  await db.$transaction([
    db.evidenceLink.deleteMany({ where: { attachmentId: id } }),
    db.attachment.delete({ where: { id } }),
  ])

  // قرار ملف التخزين — بعد حذف السجلات، هل بقي أي مرجع للملف؟
  let fileRemoved = false
  let fileKeptReason: string | null = null
  if (existing.storagePath) {
    if (linkCount > 1) {
      fileKeptReason = 'multi-use' // شاهد مستخدم في أكثر من إنجاز — يحتفظ بملفه
    } else if (sharedRefs > 0) {
      fileKeptReason = 'shared-path' // مرفق آخر يشير لنفس الملف
    } else {
      try {
        fileRemoved = await getStorage().remove(existing.storagePath)
      } catch {
        fileKeptReason = 'storage-error'
      }
    }
  }

  return NextResponse.json({ ok: true, fileRemoved, fileKeptReason })
}
