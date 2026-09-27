// ═══ عقد طبقة الذكاء الاصطناعي ═══════════════════════════════
// UI → AI Service (API routes) → AIProvider → GroqProvider → Groq API
// لا استدعاء مباشر للمزوّد من مكونات React أبدًا — كل شيء خادمي.

export type AiAction =
  | 'suggestObjectives'        // 4 أهداف مرتبطة بعنوان/سياق
  | 'suggestGeneralObjective'  // هدف عام واحد
  | 'suggestExecution'         // تفاصيل/خطوات التنفيذ
  | 'improveText'              // تحسين الصياغة
  | 'proofread'                // تدقيق لغوي
  | 'summarize'                // تلخيص
  | 'toBullets'                // تحويل إلى نقاط
  | 'shorten'                  // اختصار
  | 'expand'                   // توسيع
  | 'suggestImpact'            // صياغة الأثر (من المدخلات فقط)
  | 'suggestRecommendations'   // توصيات مرتبطة بالمحتوى
  | 'suggestInitiative'        // مسودة مبادرة كاملة (JSON)
  | 'suggestRemedialPlan'      // مسودة خطة علاجية كاملة (JSON)
  | 'improveTitle'             // تحسين عنوان

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

export interface CompletionRequest {
  messages: ChatMessage[]
  /** درجة الحرارة — الافتراضي 0.4 */
  temperature?: number
  /** حد الرموز للإخراج */
  maxTokens?: number
  /** إخراج JSON صارم (حيث يدعمه المزوّد) */
  jsonMode?: boolean
}

export interface CompletionResult {
  text: string
  model: string
  promptTokens?: number
  completionTokens?: number
}

export interface AiProvider {
  /** اسم المزوّد للسجل والتشخيص */
  readonly kind: 'groq' | 'sandbox'
  /** اسم النموذج المستخدم */
  readonly model: string
  /** هل المزوّد جاهز فعلًا (مفتاح مضبوط)؟ */
  readonly ready: boolean
  complete(req: CompletionRequest): Promise<CompletionResult>
}

// ─── أخطاء موحدة ═════════════════════════════════════════════

export type AiErrorKind = 'timeout' | 'rate_limit' | 'provider_error' | 'invalid_output' | 'not_configured'

export class AiError extends Error {
  constructor(
    public readonly kind: AiErrorKind,
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message)
    this.name = 'AiError'
  }
}
