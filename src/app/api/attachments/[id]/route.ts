import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, safeJson } from '@/lib/session'
import { deleteFile } from '@/lib/storage'

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
  return NextResponse.json({ attachment })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  const { id } = await params

  const existing = await db.attachment.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'الشاهد غير موجود' }, { status: 404 })
  if (existing.userId !== me.id) return NextResponse.json({ error: 'لا يمكنك حذف هذا الشاهد' }, { status: 403 })

  await db.evidenceLink.deleteMany({ where: { attachmentId: id } })
  await db.attachment.delete({ where: { id } })
  // حذف الملف المرفوع من القرص أيضًا (إن كان ملفًا مخزنًا لا رابطًا)
  await deleteFile(existing.storagePath)
  return NextResponse.json({ ok: true })
}
