import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { getCurrentUser, resolveYear, safeJson } from '@/lib/session'
import {
  getStorage,
  checkExtension,
  sizeLimitBytes,
  buildStoragePath,
} from '@/lib/storage'

/**
 * تذكرة رفع مباشر موقّع (للملفات الأكبر من حد دالة الخادم في بيئة Supabase):
 *   POST /api/upload/direct  (JSON: fileName, mimeType, size, yearId)
 *
 * الأمان:
 *   • نفس تحققات الوكيل على البيانات المعلنة (امتداد/حجم/جلسة/سنة)
 *   • المسار يُبنى في الخادم حصرًا من سياق المستخدم — العميل لا يختار المسار
 *   • لا يُنشأ أي سجل قاعدة بيانات هنا — ينشأ في /complete بعد تحقق
 *     البصمة والحجم الفعليين من الملف المرفوع فعلًا
 *   • لا دعم محليًا → {mode:'proxy'} فيعود العميل لمسار الوكيل
 */

export const runtime = 'nodejs'

interface DirectBody {
  fileName?: string
  mimeType?: string
  size?: number
  yearId?: string
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  const body = await safeJson<DirectBody>(req)
  if (!body?.fileName) {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const year = await resolveYear(me.id, body.yearId ?? null)
  if (!year) return NextResponse.json({ error: 'لا توجد سنة دراسية' }, { status: 400 })

  const storage = getStorage()

  // المزوّد المحلي لا يدعم الرفع الموقّع — العميل يعود لمسار الوكيل
  if (storage.kind !== 'supabase') {
    return NextResponse.json({ mode: 'proxy' })
  }

  // 1) الامتداد المعلن
  const allowed = checkExtension(body.fileName)
  if (!allowed) {
    return NextResponse.json({ error: 'نوع الملف غير مسموح' }, { status: 400 })
  }

  // 2) الحجم المعلن
  const declaredSize = Number(body.size ?? 0)
  const limit = sizeLimitBytes(allowed.kind === 'VIDEO')
  if (!Number.isFinite(declaredSize) || declaredSize <= 0 || declaredSize > limit) {
    return NextResponse.json(
      { error: `حجم الملف يتجاوز الحد المسموح (${allowed.kind === 'VIDEO' ? '100' : '25'}MB)` },
      { status: 413 },
    )
  }

  const id = randomUUID()
  const path = buildStoragePath({
    school: me.school,
    userId: me.id,
    yearLabel: year.label,
    attachmentId: id,
    fileName: body.fileName,
    ext: allowed.ext,
  })

  const signed = await storage.createSignedUploadUrl(path)
  if (!signed) {
    return NextResponse.json({ error: 'تعذر إنشاء رابط الرفع — حاول مسار الوكيل' }, { status: 500 })
  }

  return NextResponse.json({
    mode: 'direct',
    attachmentId: id,
    path,
    token: signed.token,
    signedUrl: signed.signedUrl,
    expiresIn: 7200, // رابط الرفع الموقّع صالح ساعتين
  })
}
