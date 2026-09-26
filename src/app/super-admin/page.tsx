import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { SuperAdminDashboard } from './dashboard'

export const metadata = { title: 'مسؤول المنصة — ملف إنجاز المعلم' }

/**
 * مسار مسؤول المنصة — مستقل تمامًا عن تجربة المعلم/المدير.
 * الحماية Server-side حصرًا: غير مسجل → الصفحة الرئيسية (الدخول)؛
 * مسجل بدون دور SUPER_ADMIN → يرى رسالة 403 صريحة (لا إخفاء UI فقط).
 */
export default async function SuperAdminPage() {
  const me = await getCurrentUser()

  if (!me) {
    // غير مسجل: يعاد إلى جذر التطبيق حيث شاشة الدخول (401 فعليًا عبر البوابات)
    redirect('/?super-admin-auth=1')
  }

  if (me.role !== 'SUPER_ADMIN') {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-7 text-destructive">
              <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-foreground">غير مصرح بالوصول</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            هذه الصفحة مخصصة لمسؤول المنصة فقط. إن كنت مسؤولًا فسجّل الدخول بحساب المسؤول.
          </p>
          <a
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:bg-primary/90"
          >
            العودة للتطبيق
          </a>
        </div>
      </div>
    )
  }

  return <SuperAdminDashboard adminName={me.name} />
}
