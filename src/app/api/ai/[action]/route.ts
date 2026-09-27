import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, safeJson } from '@/lib/session'
import { buildReportAIContext } from '@/lib/ai/context'
import { isAiAction, ACTIONS } from '@/lib/ai/prompts'
import { runAiAction } from '@/lib/ai'
import { checkAiQuota } from '@/lib/ai/rate-limit'
import { AiError } from '@/lib/ai/types'

/**
 * بوابة عمليات المساعد الذكي — كلها خادمية وخلف جلسة موثقة.
 * POST /api/ai/{action} بجسم { context: {...} }
 *
 * حد حجم الحمولة + تنقية السياق (Data Minimization) + حد استخدام يومي لكل مستخدم
 * (للحساب التجريبي حد أدنى) + تحقق صارم من المخرجات + سجل استخدام خفيف بلا محتوى.
 */

const MAX_BODY_BYTES = 20 * 1024 // 20KB — سياق نموذج الإنجاز الكامل (مقصود طرفيًا 600 حرفًا/حقل) — الخادم ينقّي إلى 700/حقل و3000 إجمالًا

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  const { action } = await params
  if (!isAiAction(action)) {
    return NextResponse.json({ error: 'عملية غير معروفة' }, { status: 404 })
  }

  // حد الحجم قبل أي قراءة
  const contentLength = Number(req.headers.get('content-length') ?? '0')
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'السياق المرسل كبير جدًا.' }, { status: 413 })
  }

  const body = await safeJson<{ context?: Record<string, unknown> }>(req)
  if (!body?.context || typeof body.context !== 'object') {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  // التنقية والتقليل — تمنع مغادرة أي بيانات حساسة أو نصوص ضخمة للمزوّد
  const context = buildReportAIContext(body.context as Parameters<typeof buildReportAIContext>[0])
  const spec = ACTIONS[action]

  // عمليات النص تتطلب نصًا موجودًا — اقتراحات الحقول الموحدة تعمل من السياق بلا نص
  const textActions = ['improveText', 'proofread', 'summarize', 'toBullets', 'shorten', 'expand']
  if (textActions.includes(action) && !context.text) {
    return NextResponse.json({ error: 'اكتب نصًا أولًا حتى أستطيع مساعدتك.' }, { status: 400 })
  }

  // حد الاستخدام اليومي لكل مستخدم
  const quota = await checkAiQuota(me.id, Boolean(me.isDemo))
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `بلغت حدك اليومي من المساعد الذكي (${quota.limit} عملية). عد غدًا.`,
        quota: { used: quota.used, limit: quota.limit },
      },
      { status: 429 },
    )
  }

  try {
    const { result, model } = await runAiAction({
      action,
      context, // السياق المنقّى — التعليمات تبني منه ما تحتاجه
      userId: me.id,
      isDemo: Boolean(me.isDemo),
    })
    return NextResponse.json({
      result,
      model,
      quota: { remaining: Math.max(0, quota.remaining - 1), limit: quota.limit },
    })
  } catch (e) {
    if (e instanceof AiError) {
      const friendly =
        e.kind === 'not_configured'
          ? 'المساعد الذكي غير مفعل بعد على هذا الخادم.'
          : e.kind === 'rate_limit'
            ? e.message
            : e.kind === 'timeout'
              ? 'استغرق الاقتراح وقتًا أطول من المتاح — أعد المحاولة.'
              : 'تعذر إنشاء الاقتراح الآن. حاول مرة أخرى.'
      const status = e.kind === 'rate_limit' ? 429 : e.kind === 'not_configured' ? 503 : 502
      return NextResponse.json({ error: friendly }, { status })
    }
    console.error('ai route error', e)
    return NextResponse.json({ error: 'تعذر إنشاء الاقتراح الآن. حاول مرة أخرى.' }, { status: 502 })
  }
}
