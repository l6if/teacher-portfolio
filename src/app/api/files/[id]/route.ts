import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { getStorage } from '@/lib/storage'
import { mkdir, readFile, writeFile, readdir, stat, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

/**
 * تقديم ملفات الشواهد المرفوعة — خاصة وليست عامة:
 * تتطلب جلسة صالحة، والمعلم لا يصل إلا لملفاته، والمدير لملفات معلمي نطاقه.
 *
 * المصدر: مزوّد التخزين الفعّال (Supabase Storage في الإنتاج / قرص محلي في التطوير)
 * — لا روابط عامة دائمة؛ التقديم عبر proxy الخادم المصادَق حصرًا.
 *
 * تحسين الصور للتقارير (دون مس الملف الأصلي):
 *   /api/files/<id>?w=1600&q=82
 * نسخة مضغوطة مناسبة للطباعة/المعاينة تُخزَّن في ذاكرة قرص مؤقتة (tmp) فقط —
 * cache مؤقت قابل للاختفاء بلا أي فقدان بيانات: الأصل يُجلب من التخزين عند الحاجة.
 * الصور الصغيرة أصلًا تُقدَّم كما هي، والأصول المتجهة (SVG/GIF) لا تُعالج.
 */

export const runtime = 'nodejs'

const RASTER_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'])
const MAX_OPTIMIZED_W = 2400
const MIN_OPTIMIZED_W = 200

/** ذاكرة تحسين مؤقتة في tmp — ليست بيانات دائمة أبدًا */
function optimizedDir(userId: string): string {
  return path.join(tmpdir(), 'teacherfolio-optimized', userId)
}

/** الأصول الأصلية لا تُعدَّل بعد الرفع أبدًا — مفتاح id كافٍ لصلاحية النسخة */
async function cachedVariant(userId: string, id: string, w: number, q: number): Promise<Buffer | null> {
  const file = path.join(optimizedDir(userId), `${id}_${w}_q${q}.jpg`)
  try {
    const s = await stat(file)
    if (s.isFile() && s.size > 0) return await readFile(file)
  } catch {
    return null
  }
  return null
}

async function writeVariant(userId: string, id: string, w: number, q: number, out: Buffer): Promise<void> {
  try {
    const dir = optimizedDir(userId)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, `${id}_${w}_q${q}.jpg`), out)
    // تنظيف أفضل جهد: أزل أقدم الملفات إذا تجاوز العدد حدًا معقولًا
    await pruneCache(dir).catch(() => {})
  } catch {
    // فشل الكتابة في الذاكرة المؤقتة غير قاتل — النسخة تُقدَّم مباشرة
  }
}

/** صيانة خفيفة للذاكرة المؤقتة — احتفظ بحد أقصى 600 نسخة لكل مستخدم */
async function pruneCache(dir: string): Promise<void> {
  const files = await readdir(dir)
  if (files.length <= 600) return
  const entries = await Promise.all(
    files.map(async (f) => {
      try {
        const s = await stat(path.join(dir, f))
        return { f, mtime: s.mtimeMs }
      } catch {
        return null
      }
    }),
  )
  const valid = entries.filter((e): e is { f: string; mtime: number } => e != null)
  valid.sort((a, b) => a.mtime - b.mtime)
  const excess = valid.slice(0, valid.length - 600)
  await Promise.all(excess.map((e) => unlink(path.join(dir, e.f)).catch(() => {})))
}

async function makeVariant(input: Buffer, w: number, q: number): Promise<Buffer | null> {
  try {
    const sharp = (await import('sharp')).default
    // الشفافية تُسطح على أبيض — أأمن للطباعة من خلفية سوداء في JPEG
    const out = await sharp(input, { failOn: 'none', animated: false })
      .rotate() // احترام علامة EXIF للدوران
      .resize({ width: w, withoutEnlargement: true, fit: 'inside' })
      .flatten({ background: '#FFFFFF' })
      .jpeg({ quality: q, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer()
    return out?.length ? out : null
  } catch {
    return null
  }
}

function jpegResponse(buf: Buffer): NextResponse {
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(buf.length),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=86400, immutable',
    },
  })
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

  const storage = getStorage()
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
    try {
      // 1) نسخة محسّنة جاهزة في الذاكرة المؤقتة؟
      const cached = await cachedVariant(attachment.userId, id, wParam, q)
      if (cached) return jpegResponse(cached)

      // 2) جلب الأصل من التخزين (المصدر الدائم الوحيد) — تنزيل واحد للاستخدامين
      const input = await storage.download(attachment.storagePath)
      if (input) {
        const sharp = (await import('sharp')).default
        const meta = await sharp(input, { failOn: 'none' }).metadata()
        // هل تستحق المعالجة؟ الصور الصغيرة تمر كما هي
        if (meta.width && meta.width > wParam * 1.05) {
          const out = await makeVariant(input, wParam, q)
          if (out) {
            await writeVariant(attachment.userId, id, wParam, q, out)
            return jpegResponse(out)
          }
        }
      }
    } catch {
      // أي فشل في التحسين → تقديم الأصل كما هو (مسار آمن دائمًا)
    }
  }

  /* ─── التقديم المباشر من التخزين (تدفق + حجم) ─── */
  const opened = await storage.openStream(attachment.storagePath)
  if (!opened) {
    return NextResponse.json({ error: 'الملف غير موجود على وحدة التخزين' }, { status: 404 })
  }

  const headers = new Headers({
    'Content-Type': mime,
    'Content-Length': String(opened.size || attachment.fileSize || 0),
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName ?? 'file')}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=3600',
  })

  return new NextResponse(opened.stream as unknown as BodyInit, { status: 200, headers })
}
