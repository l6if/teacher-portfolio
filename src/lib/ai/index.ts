// ═══ منسّق طبقة الذكاء الاصطناعي ═══════════════════════════════
// يختار المزوّد وفق البيئة، ينفذ العملية، يتحقق من المخرجات، ويسجل الاستخدام.
// Groq هو مزوّد الإنتاج الوحيد — مزوّد Sandbox للتطوير فقط بلا مفتاح Groq.

import type { AiAction, AiProvider } from './types'
import { AiError } from './types'
import { GroqProvider } from './providers/groq'
import { SandboxProvider } from './providers/sandbox'
import { ACTIONS } from './prompts'
import { db } from '@/lib/db'

// ─── اختيار المزوّد ───────────────────────────────────────────

let cachedProvider: AiProvider | null = null

export function getAIProvider(): AiProvider {
  if (cachedProvider) return cachedProvider

  const apiKey = process.env.GROQ_API_KEY?.trim()
  const baseUrl = (process.env.GROQ_BASE_URL?.trim() || 'https://api.groq.com/openai/v1').replace(/\/$/, '')
  const model = process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile'

  if (apiKey) {
    cachedProvider = new GroqProvider(apiKey, baseUrl, model)
    return cachedProvider
  }

  // لا مفتاح Groq: في الإنتاج = غير مهيأ (خطأ صريح) — في التطوير = مزوّد المعاينة
  if (process.env.NODE_ENV === 'production') {
    // مزوّد غير جاهز — يرمي not_configured عند أول استخدام
    cachedProvider = new GroqProvider('', baseUrl, model)
  } else {
    console.warn('[ai] GROQ_API_KEY غير مضبوط — استخدام مزوّد المعاينة (للتطوير فقط). الإنتاج يتطلب Groq.')
    cachedProvider = new SandboxProvider()
  }
  return cachedProvider
}

export function aiProviderStatus(): { kind: string; model: string; ready: boolean; configured: boolean } {
  const p = getAIProvider()
  return { kind: p.kind, model: p.model, ready: p.ready, configured: Boolean(process.env.GROQ_API_KEY?.trim()) }
}

// ─── تنفيذ عملية مع السجل ─────────────────────────────────────

export interface RunAiOptions {
  action: AiAction
  context: Record<string, string>
  userId: string
  isDemo?: boolean
}

export interface RunAiResult {
  result: unknown
  model: string
  latencyMs: number
}

export async function runAiAction({ action, context, userId, isDemo }: RunAiOptions): Promise<RunAiResult> {
  const spec = ACTIONS[action]
  const provider = getAIProvider()
  const started = Date.now()

  if (!provider.ready) {
    throw new AiError('not_configured', 'خدمة الذكاء الاصطناعي غير مهيأة بعد (GROQ_API_KEY مطلوب).')
  }

  try {
    const completion = await provider.complete({
      messages: [
        { role: 'system', content: spec.system(context) },
        { role: 'user', content: spec.user(context) },
      ],
      temperature: spec.temperature,
      maxTokens: spec.maxTokens,
      jsonMode: spec.jsonMode,
    })

    // تحقق Server-side صارم من المخرجات قبل تسليمها للعميل
    const validated = spec.validate(completion.text)
    const latencyMs = Date.now() - started

    // سجل خفيف: بلا prompt ولا response — خصوصية أولًا
    await db.aiUsageLog
      .create({
        data: {
          userId,
          action,
          model: completion.model,
          success: true,
          latencyMs,
          promptTokens: completion.promptTokens ?? null,
          completionTokens: completion.completionTokens ?? null,
        },
      })
      .catch(() => {})

    return { result: validated, model: completion.model, latencyMs }
  } catch (e) {
    const latencyMs = Date.now() - started
    const kind = e instanceof AiError ? e.kind : 'provider_error'
    await db.aiUsageLog
      .create({
        data: {
          userId,
          action,
          model: provider.model,
          success: false,
          latencyMs,
          errorKind: kind,
        },
      })
      .catch(() => {})
    throw e
  }
}
