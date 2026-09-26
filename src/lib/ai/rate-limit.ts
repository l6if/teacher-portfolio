// ═══ حدود استخدام الذكاء الاصطناعي لكل مستخدم ═════════════════
// رقم واحد قابل للضبط عبر البيئة — لا Hardcode مبعثر في ملفات متعددة.
// الحساب التجريبي: حد أدنى منفصل (DEMO_AI_DAILY_LIMIT).

import { db } from '@/lib/db'

export const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT ?? 60)
export const DEMO_AI_DAILY_LIMIT = Number(process.env.DEMO_AI_DAILY_LIMIT ?? 15)

export interface QuotaCheck {
  allowed: boolean
  used: number
  limit: number
  remaining: number
}

/** بداية اليوم بتوقيت الخادم (UTC) — نافذة يومية كاملة */
function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}

export async function checkAiQuota(userId: string, isDemo: boolean): Promise<QuotaCheck> {
  const limit = isDemo ? DEMO_AI_DAILY_LIMIT : AI_DAILY_LIMIT
  const used = await db.aiUsageLog.count({
    where: { userId, createdAt: { gte: startOfToday() } },
  })
  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  }
}
