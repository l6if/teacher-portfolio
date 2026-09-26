import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { fileStream, fileSize } from '@/lib/storage'

/**
 * تقديم ملفات الشواهد المرفوعة — خاصة وليست عامة:
 * تتطلب جلسة صالحة، والمعلم لا يصل إلا لملفاته، والمدير لملفات معلمي نطاقه.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  const { id } = await params
  const attachment = await db.attachment.findUnique({
    where: { id },
    include: { user: { select: { role: true, school: true } } },
  })
  if (!attachment || !attachment.storagePath) {
    return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 })
  }

  // الملكية: صاحب الملف، أو مدير ضمن نطاقه (معلمو مدرسته، والمشرف بلا مدرسة يرى الكل)
  const isOwner = attachment.userId === me.id
  const managerScopeOk =
    me.role === 'MANAGER' &&
    attachment.user.role === 'TEACHER' &&
    (me.school == null || attachment.user.school === me.school)
  if (!isOwner && !managerScopeOk) {
    return NextResponse.json({ error: 'لا تملك صلاحية الوصول لهذا الملف' }, { status: 403 })
  }

  const size = await fileSize(attachment.storagePath)
  if (size == null) {
    return NextResponse.json({ error: 'الملف غير موجود على الخادم' }, { status: 404 })
  }

  const stream = fileStream(attachment.storagePath)
  if (!stream) {
    return NextResponse.json({ error: 'تعذر قراءة الملف' }, { status: 500 })
  }

  const headers = new Headers({
    'Content-Type': attachment.mimeType || 'application/octet-stream',
    'Content-Length': String(size),
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName ?? 'file')}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=3600',
  })

  return new NextResponse(stream as unknown as BodyInit, { status: 200, headers })
}
