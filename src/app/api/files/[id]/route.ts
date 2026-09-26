import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { fileStream, fileSize, uploadDir } from '@/lib/storage'
import { readFile, mkdir, stat, writeFile } from 'fs/promises'
import path from 'path'

/**
 * تقديم ملفات الشواهد المرفوعة — خاصة وليست عامة:
 * تتطلب جلسة صالحة، والمعلم لا يصل إلا لملفاته، والمدير لملفات معلمي نطاقه.
 *
 * تحسين الصور للتقارير (دون مس الملف الأصلي):
 *   /api/files/<id>?w=1600&q=82
 * ينشئ نسخة مضغوطة مناسبة للطباعة/المعاينة وتخزينها مؤقتًا على القرص —
 * الصور الصغيرة أصلًا تُقدَّم كما هي، والأصول المتجهة (SVG/GIF) لا تُعالج.
 */

const RASTER_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'])
const MAX_OPTIMIZED_W = 2400
const MIN_OPTIMIZED_W = 200

function optimizedDir(userId: string): string {
  return path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), 'storage', 'uploads'), '..', 'optimized', userId)
}

/** نسخة محسّنة جاهزة؟ تُقدَّم مباشرة (أحدث من الأصل) */
async function cachedVariant(userId: string, id: string, w: number, q: number, origAbs: string): Promise<Buffer | null> {
  const file = path.join(optimizedDir(userId), `${id}_${w}_q${q}.jpg`)
  try {
    const [cached, orig] = await Promise.all([stat(file), stat(origAbs)])
    if (cached.isFile() && orig.isFile() && cached.mtimeMs >= orig.mtimeMs) {
      return await readFile(file)
    }
  } catch {
    return null
  }
  return null
}

async function makeVariant(userId: string, id: string, w: number, q: number, origAbs: string, mime: string): Promise<Buffer | null> {
  try {
    const input = await readFile(origAbs)
    const sharp = (await import('sharp')).default
    // الشفافية تُسطح على أبيض — أأمن للطباعة من خلفية سوداء في JPEG
    const out = await sharp(input, { failOn: 'none', animated: false })
      .rotate() // احترام علامة EXIF للدوران
      .resize({ width: w, withoutEnlargement: true, fit: 'inside' })
      .flatten({ background: '#FFFFFF' })
      .jpeg({ quality: q, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer()
    if (!out?.length) return null
    const dir = optimizedDir(userId)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, `${id}_${w}_q${q}.jpg`), out)
    return out
  } catch {
    return null
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const mime = attachment.mimeType || 'application/octet-stream'

  /* ─── المسار المحسّن: صور نقطية كبيرة فقط، والأصل لا يُمس أبدًا ─── */
  const sp = req.nextUrl.searchParams
  const wParam = Number(sp.get('w'))
  const qParam = Number(sp.get('q'))
  if (
    Number.isFinite(wParam) && wParam >= MIN_OPTIMIZED_W && wParam <= MAX_OPTIMIZED_W &&
    RASTER_MIMES.has(mime)
  ) {
    const q = Number.isFinite(qParam) ? Math.min(95, Math.max(40, qParam)) : 82
    const origAbs = path.join(uploadDir(), attachment.storagePath)
    try {
      const cached = await cachedVariant(attachment.userId, id, wParam, q, origAbs)
      if (cached) {
        return new NextResponse(new Uint8Array(cached), {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
            'Content-Length': String(cached.length),
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'private, max-age=86400, immutable',
          },
        })
      }
      // هل تستحق المعالجة؟ اقرأ الأبعاد أولًا — الصور الصغيرة تمر كما هي
      const sharp = (await import('sharp')).default
      const input = await readFile(origAbs)
      const meta = await sharp(input, { failOn: 'none' }).metadata()
      if (meta.width && meta.width > wParam * 1.05) {
        const out = await makeVariant(attachment.userId, id, wParam, q, origAbs, mime)
        if (out) {
          return new NextResponse(new Uint8Array(out), {
            status: 200,
            headers: {
              'Content-Type': 'image/jpeg',
              'Content-Length': String(out.length),
              'X-Content-Type-Options': 'nosniff',
              'Cache-Control': 'private, max-age=86400, immutable',
            },
          })
        }
      }
    } catch {
      // أي فشل في التحسين → تقديم الأصل كما هو (مسار آمن دائمًا)
    }
  }

  const stream = fileStream(attachment.storagePath)
  if (!stream) {
    return NextResponse.json({ error: 'تعذر قراءة الملف' }, { status: 500 })
  }

  const headers = new Headers({
    'Content-Type': mime,
    'Content-Length': String(size),
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName ?? 'file')}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=3600',
  })

  return new NextResponse(stream as unknown as BodyInit, { status: 200, headers })
}
