import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/session'

/**
 * إحصائيات لوحة مسؤول المنصة — بيانات حقيقية فقط من قاعدة البيانات.
 * لا Metrics مخترعة: كل رقم هنا مرتبط بجدول فعلي.
 */
export async function GET() {
  const guard = await requireSuperAdmin()
  if (guard.res) return guard.res

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    teachersMale,
    teachersFemale,
    managers,
    superAdmins,
    activeUsers,
    suspendedUsers,
    schools,
    achievements,
    attachments,
    aiRequests,
    aiToday,
    newUsers30d,
    recentUsers,
    aiByAction,
    aiByDay,
    aiFailures,
    demoUsers,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: 'TEACHER', gender: 'MALE' } }),
    db.user.count({ where: { role: 'TEACHER', gender: 'FEMALE' } }),
    db.user.count({ where: { role: 'MANAGER' } }),
    db.user.count({ where: { role: 'SUPER_ADMIN' } }),
    db.user.count({ where: { status: 'ACTIVE' } }),
    db.user.count({ where: { status: 'SUSPENDED' } }),
    db.user.findMany({ select: { school: true }, distinct: ['school'] }),
    db.achievement.count(),
    db.attachment.count(),
    db.aiUsageLog.count(),
    db.aiUsageLog.count({ where: { createdAt: { gte: since24h } } }),
    db.user.count({ where: { createdAt: { gte: since30d } } }),
    // أحدث 8 مستخدمين مسجلين (حقول آمنة فقط)
    db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true, name: true, email: true, role: true, gender: true,
        status: true, school: true, isDemo: true, createdAt: true, lastLoginAt: true,
      },
    }),
    // توزيع عمليات الذكاء الاصطناعي حسب النوع
    db.aiUsageLog.groupBy({
      by: ['action'],
      _count: { _all: true },
      orderBy: { _count: { action: 'desc' } },
      take: 12,
    }),
    // الاستخدام اليومي — آخر 14 يومًا
    db.$queryRaw<{ day: Date; total: number; ok: number }[]>`
      SELECT date_trunc('day', "createdAt") AS day,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE success)::int AS ok
      FROM "AiUsageLog"
      WHERE "createdAt" >= NOW() - INTERVAL '14 days'
      GROUP BY 1 ORDER BY 1`,
    db.aiUsageLog.count({ where: { success: false } }),
    db.user.count({ where: { isDemo: true } }),
  ])

  return NextResponse.json({
    users: {
      total: totalUsers,
      teachers: { male: teachersMale, female: teachersFemale, unknown: totalUsers - managers - superAdmins - teachersMale - teachersFemale },
      managers,
      superAdmins,
      active: activeUsers,
      suspended: suspendedUsers,
      demo: demoUsers,
      newLast30Days: newUsers30d,
      schools: schools.filter((s) => s.school?.trim()).length,
    },
    content: {
      achievements,
      attachments,
    },
    ai: {
      totalRequests: aiRequests,
      today: aiToday,
      failures: aiFailures,
      successRate: aiRequests > 0 ? Math.round(((aiRequests - aiFailures) / aiRequests) * 100) : null,
      byAction: aiByAction.map((a) => ({ action: a.action, count: a._count._all })),
      daily: aiByDay.map((d) => ({
        day: d.day,
        total: d.total,
        ok: d.ok,
      })),
    },
    recentUsers,
  })
}
