import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  const { id } = await params

  const existing = await db.attachment.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'الشاهد غير موجود' }, { status: 404 })
  if (existing.userId !== me.id) return NextResponse.json({ error: 'لا يمكنك تعديل هذا الشاهد' }, { status: 403 })

  const body = await req.json()
  const data: Record<string, unknown> = {}
  for (const f of ['title', 'keywords', 'url']) {
    if (f in body) data[f] = body[f] === '' ? null : body[f]
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
  return NextResponse.json({ ok: true })
}
