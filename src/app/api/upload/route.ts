import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, resolveYear } from '@/lib/session'
import { checkExtension, checkMagicBytes, storeFile, MAX_DOC_MB, MAX_VIDEO_MB } from '@/lib/storage'

/**
 * رفع شاهد ملفي (سحب وإفلات أو اختيار).
 * الأمان: جلسة مطلوبة + قائمة بيضاء للامتدادات + فحص بصمة الملفات
 * + حد للحجم + تخزين خارج public باسم عشوائي.
 */
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
    return NextResponse.json({ error: 'لم يتم إرسال أي ملف' }, { status: 400 })
  }

  const year = await resolveYear(me.id, (form.get('yearId') as string | null) || undefined)
  if (!year) return NextResponse.json({ error: 'لا توجد سنة دراسية' }, { status: 400 })

  // 1) الامتداد ضمن القائمة البيضاء
  const originalName = file.name || 'ملف'
  const allowed = checkExtension(originalName)
  if (!allowed) {
    return NextResponse.json(
      { error: 'نوع الملف غير مدعوم. الأنواع المسموحة: صور (png/jpg/webp/gif)، PDF، مستندات Office، جداول، وفيديو (mp4/webm/mov).' },
      { status: 400 },
    )
  }

  // 2) حد الحجم
  const maxMb = allowed.kind === 'VIDEO' ? MAX_VIDEO_MB : MAX_DOC_MB
  if (file.size > maxMb * 1024 * 1024) {
    return NextResponse.json(
      { error: `حجم الملف يتجاوز الحد المسموح (${maxMb} ميجابايت لهذا النوع).` },
      { status: 400 },
    )
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'الملف فارغ أو تالف' }, { status: 400 })
  }

  // 3) فحص بصمة المحتوى — منع التنفيذيات والسكربتات والملفات المتنكرة
  const buf = Buffer.from(await file.arrayBuffer())
  if (!checkMagicBytes(buf, allowed)) {
    return NextResponse.json(
      { error: 'محتوى الملف لا يطابق امتداده أو نوع غير مسموح — مرفوض لأسباب أمنية.' },
      { status: 400 },
    )
  }

  // 4) إنشاء سجل الشاهد أولًا ثم التخزين باسم عشوائي مرتبط بمعرفه
  const attachment = await db.attachment.create({
    data: {
      title: originalName.replace(/\.[^.]+$/, '') || 'شاهد مرفوع',
      kind: allowed.kind,
      fileName: originalName.slice(0, 180),
      fileSize: file.size,
      mimeType: allowed.mime,
      keywords: null,
      userId: me.id,
      yearId: year.id,
    },
  })

  const rel = await storeFile(me.id, attachment.id, allowed.ext, buf)
  const withPath = await db.attachment.update({
    where: { id: attachment.id },
    data: { storagePath: rel, url: `/api/files/${attachment.id}` },
  })

  return NextResponse.json({ attachment: withPath }, { status: 201 })
}
