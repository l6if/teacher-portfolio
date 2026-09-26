// ═══ الانحدار الأمني بعد PostgreSQL — 10 اختبارات عملية ═════════════════
// الاستخدام:
//   DATABASE_URL="postgresql://..." bun scripts/test-security-regression.ts
//
//  1) دخول صحيح                    → 200 + كوكي
//  2) كلمة مرور خاطئة              → 401
//  3) كوكي مزوّر                    → 401
//  4) معلم يطلب بيانات معلم آخر     → 403
//  5) معلم يطلب ملف معلم آخر        → 403
//  6) مدير خارج نطاق المدرسة        → 403 (مع شاهد موجب: داخل النطاق → 200)
//  7) ملف بلا مصادقة               → 401
//  8) معرف مرفق أجنبي               → 404 (رفض آمن، لا 500)
//  9) رابط شاهد مكرر                → لا تكرار (idempotent)
// 10) استجابات المستخدم             → لا passwordHash إطلاقًا
//
// ينشئ صفوفًا مؤقتة (معلم بمدرسة أخرى + مرفقان) ثم يمسحها — ويتأكد
// في النهاية أن الأعداد القياسية عاد كما كانت (5/5/4/40/11/12/1/3).

import { PrismaClient } from '../.pg-client'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'
const DB_URL = process.env.DATABASE_URL || ''
if (!/^postgres(ql)?:\/\//.test(DB_URL)) {
  console.error('⛔ اضبط DATABASE_URL إلى PostgreSQL لتشغيل هذا الاختبار')
  process.exit(1)
}

let passed = 0, failed = 0
function ok(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`) }
  else { failed++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`) }
}

async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/api/session`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const cookie = res.headers.get('set-cookie')?.split(';')[0] ?? ''
  return { res, cookie }
}

function deepScan(value: unknown, hits: string[]): void {
  if (Array.isArray(value)) { value.forEach((v) => deepScan(v, hits)); return }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k.toLowerCase() === 'passwordhash') hits.push(k)
      deepScan(v, hits)
    }
  }
}

async function main() {
  const db = new PrismaClient()
  console.log(`═══ الانحدار الأمني ضد ${BASE} (قاعدة PostgreSQL) ═══\n`)

  // ─── تجهيز الصفوف المؤقتة ───
  const sultan = await db.user.findUnique({ where: { email: 'sultan@madrasati.sa' } })
  const ahmed = await db.user.findUnique({ where: { email: 'ahmed@madrasati.sa' } })
  const noura = await db.user.findUnique({ where: { email: 'noura@madrasati.sa' } })
  if (!sultan || !ahmed || !noura) { console.error('⛔ مستخدمو التطوير غير موجودين'); process.exit(1) }

  const ahmedYear = await db.academicYear.findFirst({ where: { userId: ahmed.id } })
  const sultanYear = await db.academicYear.findFirst({ where: { userId: sultan.id, archived: false } })
  if (!ahmedYear || !sultanYear) { console.error('⛔ سنوات التطوير غير موجودة'); process.exit(1) }

  const tempTeacher = await db.user.create({
    data: {
      id: 'tmpsec-scope-teacher', email: 'scope-test@madrasati.sa',
      name: 'اختبار النطاق', role: 'TEACHER', school: 'ثانوية خارج النطاق',
    },
  })
  const tempAttAhmed = await db.attachment.create({
    data: {
      id: 'tmpsec-att-ahmed', title: 'ملف أحمد الاختباري', kind: 'IMAGE',
      fileName: 't.jpg', mimeType: 'image/jpeg', storagePath: 'temp/ahmed-test.jpg',
      userId: ahmed.id, yearId: ahmedYear.id,
    },
  })
  const tempAttSultan = await db.attachment.create({
    data: {
      id: 'tmpsec-att-sultan', title: 'ملف سلطان الاختباري', kind: 'IMAGE',
      fileName: 't.jpg', mimeType: 'image/jpeg', storagePath: 'temp/sultan-test.jpg',
      userId: sultan.id, yearId: sultanYear.id,
    },
  })
  const someAch = await db.achievement.findFirst({ where: { userId: sultan.id, yearId: sultanYear.id } })

  try {
    // ── 1) دخول صحيح ──
    const s = await login('sultan@madrasati.sa', '***REMOVED-DEV-SECRET***')
    ok('1) دخول صحيح → 200 + جلسة', s.res.status === 200 && !!s.cookie)
    const meBody = await s.res.clone?.().json().catch(() => null) ?? null

    // ── 2) كلمة مرور خاطئة ──
    const bad = await login('sultan@madrasati.sa', 'wrong-password')
    ok('2) كلمة مرور خاطئة → 401', bad.res.status === 401)

    // ── 3) كوكي مزوّر ──
    const tampered = await fetch(`${BASE}/api/me`, { headers: { cookie: 'pf_session=forged.9999999999.AAAA' } })
    ok('3) كوكي مزوّر → 401', tampered.status === 401)

    // ── 4) معلم يطلب بيانات معلم آخر ──
    const cross = await fetch(`${BASE}/api/dashboard?userId=${ahmed.id}`, { headers: { cookie: s.cookie } })
    ok('4) معلم يطلب لوحة معلم آخر → 403', cross.status === 403)
    const cross2 = await fetch(`${BASE}/api/report?userId=${ahmed.id}`, { headers: { cookie: s.cookie } })
    ok('4-ب) معلم يطلب تقرير معلم آخر → 403', cross2.status === 403)

    // ── 5) معلم يطلب ملف معلم آخر ──
    const fileCross = await fetch(`${BASE}/api/files/${tempAttAhmed.id}`, { headers: { cookie: s.cookie } })
    ok('5) معلم يطلب ملف معلم آخر → 403', fileCross.status === 403)

    // ── 6) مدير خارج نطاق المدرسة ──
    const n = await login('noura@madrasati.sa', '***REMOVED-DEV-SECRET***')
    const outScope = await fetch(`${BASE}/api/dashboard?userId=${tempTeacher.id}`, { headers: { cookie: n.cookie } })
    ok('6) مدير يطلب معلمًا خارج مدرسته → 403', outScope.status === 403)
    const outScopeFile = await fetch(`${BASE}/api/files/${'tmpsec-att-outscope'}`, { headers: { cookie: n.cookie } })
    // مرفق أجنبي (غير موجود) — يجب أن يكون رفضًا آمنًا وليس تسريبًا
    ok('6-ب) معرف غير موجود → رفض آمن (404)', outScopeFile.status === 404)
    const inScope = await fetch(`${BASE}/api/dashboard?userId=${ahmed.id}`, { headers: { cookie: n.cookie } })
    ok('6-ج) شاهد موجب: مدير ومعلم داخل نطاقه → 200', inScope.status === 200)

    // ── 7) ملف بلا مصادقة ──
    const anon = await fetch(`${BASE}/api/files/${tempAttSultan.id}`)
    ok('7) ملف بلا جلسة → 401', anon.status === 401)

    // ── 8) معرف مرفق أجنبي ──
    const foreign = await fetch(`${BASE}/api/files/foreign-unknown-id-123`, { headers: { cookie: s.cookie } })
    ok('8) معرف مرفق أجنبي → 404 (رفض آمن)', foreign.status === 404)
    const foreignBody = await foreign.json().catch(() => ({}))
    ok('8-ب) لا تسريب في رسالة الرفض', !JSON.stringify(foreignBody).match(/scrypt\$|postgres:\/\//))

    // ── 9) رابط شاهد مكرر → لا تكرار ──
    if (someAch) {
      const linkOnce = async () =>
        (await fetch(`${BASE}/api/attachments/link`, {
          method: 'POST', headers: { cookie: s.cookie, 'content-type': 'application/json' },
          body: JSON.stringify({ attachmentId: tempAttSultan.id, achievementId: someAch.id }),
        }).then((r) => r.json()))
      const r1 = await linkOnce()
      const r2 = await linkOnce()
      const linksInDb = await db.evidenceLink.count({ where: { attachmentId: tempAttSultan.id } })
      ok('9) رابط مكرر → لا تكرار (idempotent)', linksInDb === 1 && (r2?.links?.length ?? 0) === 1,
        `روابط=${linksInDb}`)
    } else {
      ok('9) رابط مكرر → لا تكرار (idempotent)', false, 'لا يوجد إنجاز للاختبار')
    }

    // ── 10) لا passwordHash في أي استجابة مستخدم ──
    const endpoints = ['/api/me', '/api/session', '/api/dashboard', '/api/profile']
    let leakFound = false, leakAt = ''
    for (const ep of endpoints) {
      const r = await fetch(`${BASE}${ep}`, { headers: { cookie: s.cookie } })
      const j = await r.json().catch(() => null)
      const hits: string[] = []
      deepScan(j, hits)
      if (hits.length) { leakFound = true; leakAt = ep }
    }
    ok('10) لا passwordHash في /api/me و /api/session و /api/dashboard و /api/profile', !leakFound, leakAt)

  } finally {
    // ─── تنظيف الصفوف المؤقتة ───
    await db.evidenceLink.deleteMany({ where: { attachmentId: tempAttSultan.id } })
    await db.attachment.deleteMany({ where: { id: { in: [tempAttAhmed.id, tempAttSultan.id] } } })
    await db.user.delete({ where: { id: tempTeacher.id } })

    // ─── التحقق النهائي: الأعداد القياسية ───
    const counts = {
      user: await db.user.count(),
      academicYear: await db.academicYear.count(),
      goal: await db.goal.count(),
      achievement: await db.achievement.count(),
      attachment: await db.attachment.count(),
      evidenceLink: await db.evidenceLink.count(),
      reflection: await db.reflection.count(),
      devPlan: await db.devPlan.count(),
    }
    const expected: Record<string, number> = {
      user: 5, academicYear: 5, goal: 4, achievement: 40,
      attachment: 11, evidenceLink: 12, reflection: 1, devPlan: 3,
    }
    const restored = Object.keys(expected).every((k) => (counts as any)[k] === expected[k])
    ok('تنظيف: الأعداد القياسية عادت (5/5/4/40/11/12/1/3)', restored,
      Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(' '))
    await db.$disconnect()
  }

  console.log(`\n═══ النتيجة: ${passed} ناجح / ${failed} فاشل ═══`)
  if (failed > 0) process.exit(1)
}

const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
