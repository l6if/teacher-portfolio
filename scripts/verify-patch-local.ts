// ═══ تحقق محلي سريع لإصلاحات الرقعة: اشتقاق /api/files + قسم الشواهد ═══
// يسجل دخول مستخدم QA محلي، يرفع صورة، ينشئ إنجازًا ويربط الشاهد،
// ثم يفحص /api/report: url المشتق + GET /api/files يعمل بالجلسة.
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const EMAIL = 'qa-patch-local@school.sa'
const PASSWORD = 'QaPatch!2026'

async function j(url: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${url}`, init)
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body, headers: res.headers }
}

async function main() {
  // 1) تسجيل الدخول
  const login = await j('/api/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (login.status !== 200) {
    console.error('فشل الدخول:', login.status, login.body)
    process.exit(1)
  }
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
  const H = { cookie }

  // 2) سنة دراسية — من /api/me (year + years)، وإلا تُنشأ
  let yearId: string | undefined
  const me = await j('/api/me', { headers: H })
  yearId = me.body.year?.id ?? me.body.years?.[0]?.id
  if (!yearId) {
    const created = await j('/api/years', {
      method: 'POST', headers: { ...H, 'content-type': 'application/json' },
      body: JSON.stringify({ label: '1448هـ' }),
    })
    yearId = created.body.years?.[0]?.id ?? created.body.year?.id
  }
  if (!yearId) {
    console.error('تعذر تأمين سنة دراسية:', me.status)
    process.exit(1)
  }
  console.log('✓ دخول + سنة:', yearId)

  // 3) رفع صورة (1×1 PNG حقيقية)
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  )
  const fd = new FormData()
  fd.append('file', new Blob([png], { type: 'image/png' }), 'qa-evidence.png')
  fd.append('yearId', yearId ?? '')
  const up = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: H, body: fd })
  const upBody = await up.json()
  if (up.status !== 201) {
    console.error('فشل الرفع:', up.status, upBody)
    process.exit(1)
  }
  const att = upBody.attachment
  console.log('✓ رفع صورة:', att.id, '| kind =', att.kind, '| url =', att.url)

  // 4) رابط شاهد خارجي
  const link = await j('/api/attachments', {
    method: 'POST', headers: { ...H, 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'LINK', title: 'نتائج البرنامج على منصة مدرستي', url: 'https://schools.madrasati.sa/qa', yearId }),
  })
  if (link.status !== 201) {
    console.error('فشل إنشاء الرابط:', link.status, link.body)
    process.exit(1)
  }
  console.log('✓ رابط خارجي:', link.body.attachment.id)

  // 5) إنجاز + ربط الشاهدين
  const ach = await j('/api/achievements', {
    method: 'POST', headers: { ...H, 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'INITIATIVE', title: 'مبادرة اختبار الرقعة', status: 'COMPLETED', yearId,
      problem: 'مشكلة اختبار', execution: 'تنفيذ اختبار', results: 'نتائج اختبار', impact: 'أثر اختبار',
      attachmentIds: [att.id, link.body.attachment.id],
    }),
  })
  if (ach.status !== 201) {
    console.error('فشل الإنجاز:', ach.status, ach.body)
    process.exit(1)
  }
  console.log('✓ إنجاز:', ach.body.achievement.id)

  // 6) الفحص الحاسم: /api/report — url المشتق للشاهد المخزّن
  const report = await j(`/api/report?yearId=${yearId}`, { headers: H })
  const a = (report.body.achievements ?? []).find((x: any) => x.title === 'مبادرة اختبار الرقعة')
  const linked = a?.links ?? []
  const imageLink = linked.find((l: any) => l.attachment?.kind === 'IMAGE')?.attachment
  const linkLink = linked.find((l: any) => l.attachment?.kind === 'LINK')?.attachment
  console.log('  IMAGE link url =', imageLink?.url, '| storagePath مسرب؟', 'storagePath' in (imageLink ?? {}))
  console.log('  LINK  link url =', linkLink?.url)

  const okDerived = imageLink?.url === `/api/files/${att.id}`
  const okNoLeak = !('storagePath' in (imageLink ?? {}))
  const okLink = linkLink?.url === 'https://schools.madrasati.sa/qa'

  // 7) الوكيل المصادَق يعمل بالجلسة — والصورة تصل فعلًا
  const fileRes = await fetch(`${BASE}${imageLink?.url ?? '/api/files/x'}`, { headers: H })
  console.log('  GET /api/files/<id> =', fileRes.status, '| content-type =', fileRes.headers.get('content-type'))

  // 8) تنظيف: حذف الإنجاز ثم الشواهد (تتالي عبر حذف المستخدم لاحقًا)
  console.log(okDerived && okNoLeak && okLink && fileRes.status === 200 ? '\n✓✓ كل فحوصات url اشتقت بنجاح' : '\n✗ فشل فحص')
  process.exit(okDerived && okNoLeak && okLink && fileRes.status === 200 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
