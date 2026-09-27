// ═══ SandboxProvider — مزوّد بيئة التطوير فقط ═════════════════
// يُستخدم حصرًا عندما: GROQ_API_KEY غير مضبوط + NODE_ENV !== production
// حتى تبقى تجربة المساعد قابلة للاختبار في بيئة المعاينة قبل ربط مفتاح Groq.
// في الإنتاج: غير متاح إطلاقًا — Groq هو المزوّد الوحيد المعتمد.

import type { AiProvider, CompletionRequest, CompletionResult } from '../types'
import { AiError } from '../types'

export class SandboxProvider implements AiProvider {
  readonly kind = 'sandbox' as const
  readonly model = 'zai-sandbox-dev'
  get ready(): boolean {
    return true
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    try {
      const { default: ZAI } = await import('z-ai-web-dev-sdk')
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: req.temperature ?? 0.4,
        max_tokens: req.maxTokens ?? 700,
      })
      const text = completion.choices?.[0]?.message?.content?.trim()
      if (!text) throw new AiError('invalid_output', 'استجابة فارغة من المزوّد.')
      return { text, model: this.model }
    } catch (e) {
      if (e instanceof AiError) throw e
      throw new AiError('provider_error', 'تعذر تشغيل المساعد الآن.')
    }
  }
}
