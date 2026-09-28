// تنظيف Production: حذف حساب QA المؤقت بتتالي (شواهد + ملفات التخزين + الإنجازات)
export {}
/** bun runtime global — غير معرّف في tsc بدون @types/bun (سكربت تشغيل فقط) */
declare const Bun: { file(path: string): { text(): Promise<string> } }
const BASE = 'https://teacher-portfolio-sultans-projects-bce2ab1d.vercel.app'
const secrets = (await Bun.file('.env.production-secrets').text()).split('\n')
const get = (k: string) => secrets.find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1).trim() ?? ''
const login = await fetch(`${BASE}/api/session`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: get('SUPER_ADMIN_EMAIL'), password: get('SUPER_ADMIN_PASSWORD') }),
})
const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
const me = await login.json()
if (login.status !== 200 || me.user?.role !== 'SUPER_ADMIN') {
  console.error('فشل دخول المسؤول:', login.status, me)
  process.exit(1)
}
// ابحث عن حسابات QA المؤقتة لهذه الرقعة
const list = await fetch(`${BASE}/api/super-admin/users?q=qa-patch`, { headers: { cookie } }).then((r) => r.json())
const targets = (list.users ?? []).filter((u: any) => String(u.email).startsWith('qa-patch-'))
console.log('حسابات QA المراد حذفها:', targets.map((u: any) => u.email).join(', '))
for (const u of targets) {
  const res = await fetch(`${BASE}/api/super-admin/users/${u.id}`, { method: 'DELETE', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ confirm: 'CONFIRM', confirmCount: 1 }) })
  const body = await res.json().catch(() => ({}))
  console.log(`حذف ${u.email}: ${res.status}`, res.status === 200 ? `(شواهد: ${body.deletedFiles})` : body.error ?? '')
}
// تحقق نهائي: لم يبق شيء
const after = await fetch(`${BASE}/api/super-admin/users?q=qa-patch`, { headers: { cookie } }).then((r) => r.json())
console.log('المتبقي:', (after.users ?? []).length === 0 ? 'لا شيء ✓' : JSON.stringify(after.users?.map((u: any) => u.email)))
