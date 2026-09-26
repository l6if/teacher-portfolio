import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, safeJson } from '@/lib/session'

// مساعدات ذكية محدودة: تحسين الصياغة — اقتراح أثر — تلخيص الإنجاز
// لا تُ invented بيانات: تعمل فقط على نص أدخله المستخدم
export async function POST(req: NextRequest) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'غير مسجل الدخول' }, { status: 401 })

  const body = await safeJson<{ mode?: string; text?: string }>(req)
  const input = (body?.text ?? '').toString().trim()
  if (!input || input.length < 3) {
    return NextResponse.json({ error: 'اكتب نصًا أولًا حتى أستطيع مساعدتك.' }, { status: 400 })
  }

  const prompts: Record<string, string> = {
    improve: 'أنت مساعد تحرير عربي لمعلم. أعد صياغة النص التالي بأسلوب مهني واضح وموجز مناسب لملف إنجاز مهني، دون إضافة أي معلومات غير موجودة فيه ودون تغيير أي رقم. أعِد النص المحسّن فقط دون أي مقدمات أو عناوين.',
    impact: 'أنت مساعد مهني لمعلم. بناءً على الوصف التالي فقط، صِغ فقرة "أثر مهني" واقعية من جملة إلى جملتين دون اختلاق أرقام أو نتائج غير مذكورة. أعِد الأثر فقط دون مقدمات.',
    summarize: 'أنت مساعد تحرير عربي. لخص النص التالي في سطر أو سطرين بأسلوب مهني موجز دون إضافة معلومات جديدة. أعِد الملخص فقط دون مقدمات.',
  }
  const system = prompts[body?.mode ?? 'improve'] ?? prompts.improve

  try {
    const { default: ZAI } = await import('z-ai-web-dev-sdk')
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: input },
      ],
      temperature: 0.4,
      max_tokens: 400,
    })
    const output = completion.choices?.[0]?.message?.content?.trim()
    if (!output) throw new Error('empty')
    return NextResponse.json({ output })
  } catch (e) {
    console.error('ai error', e)
    return NextResponse.json(
      { error: 'تعذر تشغيل المساعد الذكي الآن. يمكنك المحاولة لاحقًا أو الكتابة يدويًا.' },
      { status: 502 },
    )
  }
}
