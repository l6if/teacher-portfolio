import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveTargetUser, sanitizeInternal } from '@/lib/session'
import { calculateProfessionalCompletion } from '@/lib/framework-completion'
import { ensureOfficialFramework, OFFICIAL_SOURCE } from '@/lib/official-framework'

// ═══ الإطار المهني: الشجرة + الاكتمال (رسمي/مخصص منفصلين) ═════════════
// GET /api/framework            → إطاري أنا
// GET /api/framework?userId=..  → ملف معلم (للمدير — نفس نمط بقية المسارات)
//
// استعلامان فقط للشجرة والإنجازات — لا N+1 (القسم 61).
// تثبيت ذاتي كسول: أول طلب يضمن وجود البناء الرسمي (idempotent upsert —
// يسهّل الإنتاج دون خطوات يدوية، ولا يمس أي بيانات قائمة).

export async function GET(req: NextRequest) {
  const { me, target } = await resolveTargetUser(req)
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })
  if (!target) return NextResponse.json({ error: 'لا تملك صلاحية الوصول لهذا الملف' }, { status: 403 })

  // تثبيت ذاتي: إن غاب البناء الرسمي (أول تشغيل بعد النشر) نضمنه الآن
  const officialCount = await db.domain.count({ where: { isOfficial: true } })
  if (officialCount < 3) {
    await ensureOfficialFramework(db)
  }

  const completion = await calculateProfessionalCompletion(target.id, target.school ?? null)

  // صلاحية إدارة الهيكل المخصص: المدير (مدرسته) أو مسؤول المنصة — المعلم لا يغيّر الهيكل
  const canManage = me.role === 'MANAGER' || me.role === 'SUPER_ADMIN'

  return NextResponse.json(
    sanitizeInternal({
      source: OFFICIAL_SOURCE,
      schoolName: target.school ?? null,
      canManage,
      // مجال الإنشاء للمدير = مدرسته دائمًا؛ لمسؤول المنصة = مدرسة الملف المعروض
      manageSchoolId: me.role === 'MANAGER' ? me.school ?? null : target.school ?? null,
      ...completion,
    }),
  )
}
