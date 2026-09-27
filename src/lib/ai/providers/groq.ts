// ═══ GroqProvider — مزوّد الإنتاج المعتمد (Groq Cloud) ═════════
// متوافق مع OpenAI API: {GROQ_BASE_URL}/chat/completions
// GROQ_API_KEY خادمي حصرًا — ممنوع NEXT_PUBLIC_ — لا يظهر في المتصفح أو الحزم أبدًا.

import type { AiProvider, CompletionRequest, CompletionResult } from '../types'
import { AiError } from '../types'

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1'
const TIMEOUT_MS = 25_000

export class GroqProvider implements AiProvider {
  readonly kind = 'groq' as const

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    readonly model: string,
  ) {}

  get ready(): boolean {
    return Boolean(this.apiKey && this.model)
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.4,
      max_tokens: req.maxTokens ?? 700,
    }
    if (req.jsonMode) {
      body.response_format = { type: 'json_object' }
    }

    let attempt = 0
    // 429: احترام retry-after بمحاولة واحدة إضافية — لا Retry loop عدوانية
    while (true) {
      attempt++
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      try {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        clearTimeout(timer)

        if (res.status === 429) {
          if (attempt >= 2) {
            throw new AiError('rate_limit', 'تجاوزت حد الطلبات مؤقتًا — انتظر قليلًا ثم أعد المحاولة.')
          }
          const retryAfter = Number(res.headers.get('retry-after') ?? '5')
          await new Promise((r) => setTimeout(r, Math.min(10, Math.max(1, retryAfter)) * 1000))
          continue
        }

        if (!res.ok) {
          const detail = await res.text().catch(() => '')
          console.error(`[ai:groq] HTTP ${res.status}`, detail.slice(0, 300))
          throw new AiError('provider_error', 'تعذر الاتصال بخدمة الذكاء الاصطناعي.')
        }

        const data = await res.json()
        const text = data?.choices?.[0]?.message?.content?.trim()
        if (!text) throw new AiError('invalid_output', 'استجابة فارغة من المزوّد.')

        return {
          text,
          model: data?.model ?? this.model,
          promptTokens: data?.usage?.prompt_tokens,
          completionTokens: data?.usage?.completion_tokens,
        }
      } catch (e) {
        clearTimeout(timer)
        if (e instanceof AiError) throw e
        if (e instanceof Error && e.name === 'AbortError') {
          throw new AiError('timeout', 'انتهت مهلة الطلب.')
        }
        throw new AiError('provider_error', 'تعذر الاتصال بخدمة الذكاء الاصطناعي.')
      }
    }
  }
}
