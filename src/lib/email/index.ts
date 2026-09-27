/**
 * EmailProvider — تجريد مركزي لإرسال البريد.
 * لا يُكتب إرسال البريد داخل أي API route — الكل يمر من هنا.
 *
 * المزودات:
 *   • console  — الافتراضي في التطوير: يسجل الرسالة كاملة في سجل الخادم (رابط الاستعادة يظهر هناك).
 *   • smtp     — جاهز للربط لاحقًا عند توفير مزود بريد فعلي (env: EMAIL_PROVIDER=smtp + إعداداته).
 *
 * الصدق أولًا: استعادة كلمة المرور "تعمل من طرف البريد" فقط بعد ربط مزود فعلي
 * واختبار إرسال حقيقي — قبل ذلك تُعلَّم الحالة PENDING EMAIL PROVIDER.
 */

export interface EmailMessage {
  to: string
  subject: string
  text: string
  /** HTML اختياري — المزود قد يتجاهله */
  html?: string
}

export interface EmailProvider {
  readonly name: string
  send(message: EmailMessage): Promise<void>
}

// ─── مزود التطوير: سجل الخادم ────────────────────────────────

class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console'

  async send(message: EmailMessage): Promise<void> {
    const line = '─'.repeat(60)
    console.info(
      `\n[email:${this.name}] ${line}\n` +
        `إلى: ${message.to}\nالموضوع: ${message.subject}\n${line}\n` +
        `${message.text}\n${line}\n`,
    )
  }
}

// ─── مزود SMTP جاهز للتفعيل (يتطلب nodemailer أو مكافئًا عند الربط) ──

class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp'

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly user: string,
    private readonly pass: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    // جاهز للربط الفعلي بمزود SMTP (عند توفير بيانات الاعتماد).
    // حتى ذلك الحين: نرسم بوضوح أن الإرسال الفعلي لم يتم بعد.
    console.warn(
      `[email:smtp] EMAIL_PROVIDER=smtp لكن مزود SMTP الفعلي غير مربوط بعد — ` +
        `الرسالة إلى ${message.to} لم تُرسل فعليًا (PENDING EMAIL PROVIDER)`,
    )
    throw new Error('SMTP provider not wired yet')
  }
}

// ─── المزود الحالي وفق البيئة ────────────────────────────────

let cached: EmailProvider | null = null

export function getEmailProvider(): EmailProvider {
  if (cached) return cached
  const kind = (process.env.EMAIL_PROVIDER ?? 'console').toLowerCase()
  if (kind === 'smtp') {
    const host = process.env.EMAIL_SMTP_HOST ?? ''
    const port = Number(process.env.EMAIL_SMTP_PORT ?? 587)
    const user = process.env.EMAIL_SMTP_USER ?? ''
    const pass = process.env.EMAIL_SMTP_PASS ?? ''
    const from = process.env.EMAIL_FROM ?? ''
    if (host && user && pass) {
      cached = new SmtpEmailProvider(host, port, user, pass, from)
    } else {
      console.warn('[email] EMAIL_PROVIDER=smtp لكن إعداداته ناقصة — العودة لمزود السجل')
      cached = new ConsoleEmailProvider()
    }
  } else {
    cached = new ConsoleEmailProvider()
  }
  return cached
}

// ─── قوالب الرسائل الجاهزة (to يُحدد عند الإرسال) ───────────────

export function passwordResetEmail(resetUrl: string, minutes: number): Omit<EmailMessage, 'to'> {
  return {
    subject: 'استعادة كلمة المرور — ملف إنجاز المعلم',
    text:
      `وصلنا طلب استعادة كلمة المرور لحسابك في منصة «ملف إنجاز المعلم».\n\n` +
      `افتح الرابط التالي خلال ${minutes} دقيقة لاختيار كلمة مرور جديدة:\n` +
      `${resetUrl}\n\n` +
      `إن لم تطلب ذلك فتجاهل هذه الرسالة — كلمة مرورك الحالية تبقى كما هي.\n` +
      `لأمانك: الرابط يعمل مرة واحدة فقط.`,
  }
}

export function suspensionNoticeEmail(): Omit<EmailMessage, 'to'> {
  return {
    subject: 'إيقاف حسابك — ملف إنجاز المعلم',
    text:
      `تم إيقاف حسابك في منصة «ملف إنجاز المعلم» من قبل مسؤول المنصة.\n` +
      `تواصل مع إدارة المدرسة لإعادة التفعيل.`,
  }
}
