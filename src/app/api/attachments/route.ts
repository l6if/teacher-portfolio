import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveTargetUser, resolveYear, safeJson, sanitizeInternal } from '@/lib/session'
import { fileKind } from '@/lib/constants'

// مكتبة الشواهد — بحث وفلاتر
export async function GET(req: NextRequest) {
  const { me, target } = await resolveTargetUser(req)
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  if (!target) return NextResponse.json({ error: 'لا تملك صلاحية الوصول' }, { status: 403 })

  const p = req.nextUrl.searchParams
  const year = await resolveYear(target.id, p.get('yearId'))
  if (!year) return NextResponse.json({ attachments: [] })

  const kind = p.get('kind')
  const q = p.get('q')?.trim()
  const linked = p.get('linked') // 'linked' | 'unlinked' | null

  const attachments = await db.attachment.findMany({
    where: {
      userId: target.id,
      yearId: year.id,
      ...(kind ? { kind } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { keywords: { contains: q } },
              { fileName: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      links: {
        include: {
          achievement: { select: { id: true, title: true, type: true } },
          goal: { select: { id: true, title: true } },
        },
      },
    },
  })

  const filtered =
    linked === 'linked' ? attachments.filter((a) => a.links.length > 0)
    : linked === 'unlinked' ? attachments.filter((a) => a.links.length === 0)
    : attachments

  return NextResponse.json(sanitizeInternal({ attachments: filtered, year, readonly: target.id !== me.id }))
}

// إضافة شاهد يدوي (رابط أو ملف مرفوع مسبقًا)
export async function POST(req: NextRequest) {
  const { me, target } = await resolveTargetUser(req)
  if (!me || !target || target.id !== me.id) {
    return NextResponse.json({ error: 'لا يمكنك التعديل على ملف غيرك' }, { status: 403 })
  }
  const body = await safeJson(req)
  if (!body) return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  const year = await resolveYear(me.id, body.yearId)
  if (!year) return NextResponse.json({ error: 'لا توجد سنة دراسية' }, { status: 400 })

  if (body.kind === 'LINK' && !/^https?:\/\//.test(String(body.url ?? ''))) {
    return NextResponse.json({ error: 'الرجاء إدخال رابط صحيح يبدأ بـ http' }, { status: 400 })
  }

  const attachment = await db.attachment.create({
    data: {
      title: (body.title ?? '').trim() || body.fileName || 'شاهد جديد',
      kind: body.kind ?? fileKind(body.mimeType, body.fileName),
      fileName: body.fileName || null,
      fileSize: body.fileSize ?? null,
      mimeType: body.mimeType || null,
      url: body.url || null,
      keywords: body.keywords || null,
      userId: me.id,
      yearId: year.id,
    },
  })
  return NextResponse.json(sanitizeInternal({ attachment }), { status: 201 })
}
