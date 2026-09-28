// ═══ اختبارات محرك الإطار المهني والاكتمال (المواصفة 63-67 + الصلاحيات) ═══
// التشغيل: DATABASE_URL مضبوطة على قاعدة التطوير المحلية والخادم على 3000:
//   env -u DATABASE_URL -u DIRECT_URL bun scripts/test-framework.mts
//
// يغطي:
//   63 — مثال الاكتمال الرسمي: 2/3 = 67% (إنجازان مكتملان بشاهد + واحد فارغ)
//   64 — التكرار لا يضاعف: 5 إنجازات تحت نفس الفرعي = مستوفى واحد
//   65 — بلا شاهد لا يُعد مستوفى (يظهر «يحتاج توثيقًا»)
//   66 — المخصص لا يلمس الرسمي: 20/39 تبقى 20/39 مهما أُضيف مخصص
//   67 — معيار مخصص داخل مجال رسمي: شارة مخص + تقدم المجال من رسميه فقط
//   + حماية النص الرسمي (403) + صلاحيات المعلم/المدير/المسؤول + نطاق المدرسة
//   + الحذف المحمي (409 مع إنجازات) + تعيين التصنيف من API الإنجازات
//
// كل بيانات الاختبار تُنشأ وتُنظف ذاتيًا — لا يمس بيانات التطوير القياسية.
import { PrismaClient } from '@prisma/client'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'
const DB_URL = process.env.DATABASE_URL || ''
if (!DB_URL.includes('127.0.0.1') && !DB_URL.includes('localhost')) {
  console.error('⛔ DATABASE_URL ليست قاعدة محلية — اختبارات الإطار لبيئة التطوير فقط')
  process.exit(1)
}
const db = new PrismaClient()

const TEST_SCHOOL = 'مدرسة اختبار الإطار المؤقتة'
let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const cookie = res.headers.get('set-cookie')?.split(';')[0] ?? ''
  return { ok: res.ok, cookie }
}

async function api(cookie: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, ...(init.headers ?? {}) },
  })
  let body: any = null
  try { body = await res.json() } catch { /* فارغ */ }
  return { status: res.status, body }
}

const counts = async () => ({
  users: await db.user.count(),
  achievements: await db.achievement.count(),
  attachments: await db.attachment.count(),
  evidenceLinks: await db.evidenceLink.count(),
})

async function main() {
  const before = await counts()
  console.log(`═══ اختبارات الإطار المهني — ${BASE} ═══\n`)

  // ─── تجهيز: مستخدم اختبار معزول + بناء رسمي ─────────────────────
  // تنظيف مسبق لأي بقايا من تشغيل سابق (اجعل الاختبار قابلًا للتكرار دائمًا)
  await db.user.deleteMany({ where: { email: 'framework-test@madrasati.sa' } })
  await db.domain.deleteMany({ where: { schoolId: TEST_SCHOOL } })
  await db.criterion.deleteMany({ where: { name: { contains: 'اختبار' }, isOfficial: false } })
  // معايير فرعية مخصصة أُنشئت داخل معايير رسمية لا يمسحها أي حذف متسلسل
  await db.subCriterion.deleteMany({ where: { name: { contains: 'فرعي مخصص داخل' }, isOfficial: false } })
  await db.subCriterion.deleteMany({ where: { name: { contains: 'فرعي مخصص' }, isOfficial: false } })
  const teacher = await db.user.create({
    data: {
      email: 'framework-test@madrasati.sa',
      passwordHash: 'x', // دخول مباشر غير مطلوب — اختبارات المحرك على مستوى القاعدة
      name: 'معلم اختبار الإطار',
      role: 'TEACHER',
      school: TEST_SCHOOL,
    },
  })
  const year = await db.academicYear.create({ data: { label: '1449هـ', userId: teacher.id } })
  const attachment = await db.attachment.create({
    data: { title: 'شاهد اختبار', kind: 'IMAGE', userId: teacher.id, yearId: year.id },
  })

  const officialSubs = await db.subCriterion.findMany({
    where: { isOfficial: true },
    select: { id: true, officialCode: true, criterionId: true, criterion: { select: { domainId: true, isOfficial: true } } },
  })
  const subByCode = new Map(officialSubs.map((s) => [s.officialCode, s]))
  const mkAchievement = (subCode: string, status: string, withEvidence: boolean, title: string) =>
    db.achievement.create({
      data: {
        type: 'COOP', title, status, userId: teacher.id, yearId: year.id,
        domainId: subByCode.get(subCode)!.criterion.domainId,
        criterionId: subByCode.get(subCode)!.criterionId,
        subCriterionId: subByCode.get(subCode)!.id,
      },
    })

  // ═══ 63 — مثال الاكتمال: معيار من 3 فرعية، اثنان مستوفيان = 67% ═══
  console.log('── 63: مثال الاكتمال الرسمي (2/3 = 67%) ──')
  const a1 = await mkAchievement('S3.1', 'COMPLETED', true, 'إنجاز ١')
  const a2 = await mkAchievement('S3.2', 'COMPLETED', true, 'إنجاز ٢')
  await db.evidenceLink.create({ data: { attachmentId: attachment.id, achievementId: a1.id } })
  await db.evidenceLink.create({ data: { attachmentId: attachment.id, achievementId: a2.id } })

  const { calculateProfessionalCompletion } = await import('../src/lib/framework-completion')
  const c1 = await calculateProfessionalCompletion(teacher.id, TEST_SCHOOL)
  const crit3 = c1.domains.flatMap((d) => d.criteria).find((c) => c.officialCode === 'C3')!
  check('المعيار الثالث: 2 من 3 فرعية', crit3.completedSubs === 2 && crit3.totalSubs === 3, `got ${crit3.completedSubs}/${crit3.totalSubs}`)
  check('النسبة 67%', crit3.percent === 67, `got ${crit3.percent}%`)
  check('المستوفي لا يُحتسب إلا بشاهد (S3.1 و S3.2 فقط)', crit3.subs.filter((s) => s.completed).map((s) => s.officialCode).join(',') === 'S3.1,S3.2')
  check('الإجمالي الرسمي 2 من 39', c1.official.completed === 2 && c1.official.total === 39, `got ${c1.official.completed}/${c1.official.total}`)

  // ═══ 64 — التكرار لا يضاعف ═══
  console.log('── 64: التكرار لا يضاعف ──')
  for (let i = 0; i < 4; i++) {
    const dup = await mkAchievement('S3.1', 'COMPLETED', true, `إنجاز مكرر ${i + 1}`)
    await db.evidenceLink.create({ data: { attachmentId: attachment.id, achievementId: dup.id } })
  }
  const c2 = await calculateProfessionalCompletion(teacher.id, TEST_SCHOOL)
  const crit3b = c2.domains.flatMap((d) => d.criteria).find((c) => c.officialCode === 'C3')!
  check('خمسة إنجازات تحت S3.1 تبقيه مستوفيًا واحدًا', crit3b.subs.find((s) => s.officialCode === 'S3.1')!.achievementsCount === 5 && crit3b.subs.find((s) => s.officialCode === 'S3.1')!.completed === true)
  check('المعيار ما زال 2/3 (لا 6/3)', crit3b.completedSubs === 2 && crit3b.totalSubs === 3, `got ${crit3b.completedSubs}/${crit3b.totalSubs}`)
  check('الرسمي ما زال 2/39', c2.official.completed === 2)

  // ═══ 65 — مكتمل بلا شاهد = غير مستوفٍ ═══
  console.log('── 65: بلا شاهد لا يُعد مستوفى ──')
  await mkAchievement('S3.3', 'COMPLETED', false, 'إنجاز بلا شاهد')
  const c3 = await calculateProfessionalCompletion(teacher.id, TEST_SCHOOL)
  const s33 = c3.domains.flatMap((d) => d.criteria).flatMap((c) => c.subs).find((s) => s.officialCode === 'S3.3')!
  check('S3.3 غير مستوفٍ رغم الحالة مكتمل', s33.completed === false)
  check('يظهر «يحتاج توثيقًا» (completedNoEvidence)', s33.completedNoEvidence === true)
  check('المعيار ما زال 2/3', c3.domains.flatMap((d) => d.criteria).find((c) => c.officialCode === 'C3')!.completedSubs === 2)

  // ═══ 66 — المخصص منفصل عن الرسمي ═══
  console.log('── 66: المخصص لا يلمس الرسمي ──')
  const customDomain = await db.domain.create({
    data: { name: 'مجال مخصص اختبار', isOfficial: false, scope: 'SCHOOL', schoolId: TEST_SCHOOL, sortOrder: 50 },
  })
  const customCrit = await db.criterion.create({
    data: { name: 'معيار مخصص اختبار', domainId: customDomain.id, isOfficial: false, sortOrder: 1, schoolId: TEST_SCHOOL },
  })
  const customSubs = []
  for (let i = 1; i <= 5; i++) {
    customSubs.push(await db.subCriterion.create({
      data: { name: `فرعي مخصص ${i}`, criterionId: customCrit.id, isOfficial: false, sortOrder: i, schoolId: TEST_SCHOOL },
    }))
  }
  // استوفِ اثنين فقط من الخمسة
  for (const s of customSubs.slice(0, 2)) {
    const ca = await db.achievement.create({
      data: { type: 'INITIATIVE', title: `إنجاز مخصص ${s.sortOrder}`, status: 'COMPLETED', userId: teacher.id, yearId: year.id, domainId: customDomain.id, criterionId: customCrit.id, subCriterionId: s.id },
    })
    await db.evidenceLink.create({ data: { attachmentId: attachment.id, achievementId: ca.id } })
  }
  const c4 = await calculateProfessionalCompletion(teacher.id, TEST_SCHOOL)
  check('المخصص: 2 من 5', c4.custom?.completed === 2 && c4.custom?.total === 5, `got ${c4.custom?.completed}/${c4.custom?.total}`)
  check('الرسمي بقيت 2/39 (لم تصبح 2/44)', c4.official.completed === 2 && c4.official.total === 39, `got ${c4.official.completed}/${c4.official.total}`)

  // ═══ 67 — معيار مخصص داخل مجال رسمي ═══
  console.log('── 67: معيار مخصص داخل مجال رسمي ──')
  const d3 = await db.domain.findFirst({ where: { officialCode: 'D3' } })!
  const customInOfficial = await db.criterion.create({
    data: { name: 'التوظيف المتقدم للتقنيات التعليمية (اختبار)', domainId: d3.id, isOfficial: false, sortOrder: 90, schoolId: TEST_SCHOOL },
  })
  const cSub1 = await db.subCriterion.create({ data: { name: 'فرعي مخصص داخل رسمي ١', criterionId: customInOfficial.id, isOfficial: false, sortOrder: 1, schoolId: TEST_SCHOOL } })
  await db.subCriterion.create({ data: { name: 'فرعي مخصص داخل رسمي ٢', criterionId: customInOfficial.id, isOfficial: false, sortOrder: 2, schoolId: TEST_SCHOOL } })
  const cia = await db.achievement.create({
    data: { type: 'PRACTICE', title: 'إنجاز داخل معيار مخصص بالرسمي', status: 'COMPLETED', userId: teacher.id, yearId: year.id, domainId: d3.id, criterionId: customInOfficial.id, subCriterionId: cSub1.id },
  })
  await db.evidenceLink.create({ data: { attachmentId: attachment.id, achievementId: cia.id } })

  const c5 = await calculateProfessionalCompletion(teacher.id, TEST_SCHOOL)
  const d3node = c5.domains.find((d) => d.officialCode === 'D3')!
  check('المعيار المخصص داخل D3 يحمل isOfficial=false', d3node.criteria.find((c) => c.id === customInOfficial.id)?.isOfficial === false)
  check('تقدم D3 الرسمي من معاييره الرسمية فقط (15 فرعيًا)', d3node.totalSubs === 15 && d3node.completedSubs === 0, `got ${d3node.completedSubs}/${d3node.totalSubs}`)
  check('الرسمي ما زالت 2/39', c5.official.completed === 2 && c5.official.total === 39)
  check('المخصص احتسبها (3 من 7)', c5.custom?.completed === 3 && c5.custom?.total === 7, `got ${c5.custom?.completed}/${c5.custom?.total}`)
  check('عدد إنجازات بانتظار التصنيف = 0', c5.unmappedCount === 0, `got ${c5.unmappedCount}`)

  // ─── معيار فرعي مخصص داخل معيار رسمي (القسم 25) — لا يدخل الرسمي أبدًا ───
  // اكتُشف كخلل حقيقي أثناء QA: كان يُعدّ في مجاله الرسمي قبل الإصلاح
  const c8 = await db.criterion.findFirst({ where: { officialCode: 'C8' } })!
  const customSubInOfficialCrit = await db.subCriterion.create({
    data: { name: 'فرعي مخصص داخل معيار رسمي', criterionId: c8.id, isOfficial: false, sortOrder: 90, schoolId: TEST_SCHOOL },
  })
  const csa = await db.achievement.create({
    data: { type: 'PRACTICE', title: 'إنجاز فرعي مخصص داخل معيار رسمي', status: 'COMPLETED', userId: teacher.id, yearId: year.id, domainId: d3.id, criterionId: c8.id, subCriterionId: customSubInOfficialCrit.id },
  })
  await db.evidenceLink.create({ data: { attachmentId: attachment.id, achievementId: csa.id } })
  const c5b = await calculateProfessionalCompletion(teacher.id, TEST_SCHOOL)
  const d3b = c5b.domains.find((d) => d.officialCode === 'D3')!
  const c8node = d3b.criteria.find((c) => c.officialCode === 'C8')!
  check('فرعي مخصص داخل معيار رسمي: لا يرفع مجاله الرسمي (يبقى 0/15)', d3b.completedSubs === 0 && d3b.totalSubs === 15, `got ${d3b.completedSubs}/${d3b.totalSubs}`)
  check('المعيار الرسمي لا يعدّه في تقدمه (C8 يبقى 0/5 — معلم الاختبار لم يستوفِ فرعياته)', c8node.completedSubs === 0 && c8node.totalSubs === 5, `got ${c8node.completedSubs}/${c8node.totalSubs}`)
  check('يُحسب مخصصًا (4 من 8)', c5b.custom?.completed === 4 && c5b.custom?.total === 8, `got ${c5b.custom?.completed}/${c5b.custom?.total}`)
  check('الرسمي ما زالت 2/39 رغم استيفائه', c5b.official.completed === 2 && c5b.official.total === 39)

  // ─── عزل المدرسة (القسم 32): مخصص لمدرسة أخرى داخل شجرة رسمية لا يظهر ───
  // عنصر نورة (مدرسة متوسطة الملك عبدالعزيز) داخل معيار رسمي — معلم مدرسة
  // اختبار مختلف لا يراه في شجرته أبدًا
  {
    const nouraSubInOfficial = await db.subCriterion.findFirst({
      where: { name: 'قيادة التحول الرقمي الصفي' },
      select: { id: true, schoolId: true },
    })
    if (nouraSubInOfficial) {
      const allVisibleIds = new Set<string>()
      for (const d of c5b.domains) {
        for (const c of d.criteria) for (const s of c.subs) allVisibleIds.add(s.id)
      }
      check('عنصر مخصص لمدرسة أخرى داخل شجرة رسمية لا يظهر لمعلم مدرسة مختلفة', !allVisibleIds.has(nouraSubInOfficial.id))
    } else {
      console.log('  ℹ تخطي اختبار عزل نورة — عنصر QA غير موجود (أُعيد تهيئة القاعدة)')
    }
  }

  // ═══ حماية الرسمي + الصلاحيات عبر API ═══
  console.log('── API: الصلاحيات وحماية النص الرسمي ──')
  const tLogin = await login('sultan@madrasati.sa', 'teacher123')
  check('دخول المعلم', tLogin.ok)
  const mLogin = await login('noura@madrasati.sa', 'teacher123')
  check('دخول المديرة', mLogin.ok)
  const aLogin = await login('admin@madrasati.sa', 'Masool2026!')
  check('دخول مسؤول المنصة', aLogin.ok)

  const fw = await api(tLogin.cookie, '/api/framework')
  check('GET /api/framework للمعلم 200', fw.status === 200)
  check('الشجرة فيها 3 مجالات رسمية + المخصص', (fw.body?.domains ?? []).filter((d: any) => d.isOfficial).length === 3)
  check('canManage=false للمعلم', fw.body?.canManage === false)
  check('المصدر الرسمي معروض', fw.body?.source?.authority === 'هيئة تقويم التعليم والتدريب')

  const teachManage = await api(tLogin.cookie, '/api/framework/manage', {
    method: 'POST', body: JSON.stringify({ level: 'domain', action: 'create', name: 'محاولة معلم' }),
  })
  check('المعلم لا يُنشئ هيكلًا (403)', teachManage.status === 403)

  // مديرة: مجال مخصص لمدرستها + حماية الرسمي
  const mgrCreate = await api(mLogin.cookie, '/api/framework/manage', {
    method: 'POST', body: JSON.stringify({ level: 'domain', action: 'create', name: 'الابتكار والتحول الرقمي', description: 'مجال مخصص للتجربة' }),
  })
  check('المديرة تنشئ مجالًا مخصصًا (201)', mgrCreate.status === 201 && mgrCreate.body?.domain?.isOfficial === false, JSON.stringify(mgrCreate.body).slice(0, 120))
  const mgrDomainId = mgrCreate.body?.domain?.id as string | undefined

  const d1 = await db.domain.findFirst({ where: { officialCode: 'D1' } })!
  const protectOfficial = await api(mLogin.cookie, '/api/framework/manage', {
    method: 'POST', body: JSON.stringify({ level: 'domain', action: 'update', id: d1.id, name: 'محاولة تعديل رسمي' }),
  })
  check('تعديل نص رسمي مرفوض (403) بالرسالة المعتمدة', protectOfficial.status === 403 && protectOfficial.body?.error === 'هذا عنصر رسمي ولا يمكن تعديل نصه.')

  const protectDeleteOfficial = await api(mLogin.cookie, '/api/framework/manage', {
    method: 'POST', body: JSON.stringify({ level: 'subCriterion', action: 'delete', id: subByCode.get('S1.1')!.id }),
  })
  check('حذف رسمي مرفوض (403)', protectDeleteOfficial.status === 403)

  // معيار مخصص داخل مجال رسمي (القسم 21) — من المديرة
  const critInOfficial = await api(mLogin.cookie, '/api/framework/manage', {
    method: 'POST', body: JSON.stringify({ level: 'criterion', action: 'create', domainId: d1.id, name: 'معيار مخصص داخل رسمي (اختبار مديرة)' }),
  })
  check('المديرة تضيف معيارًا مخصصًا داخل مجال رسمي (201)', critInOfficial.status === 201 && critInOfficial.body?.criterion?.isOfficial === false)

  // نطاق المدرسة: مجال مدرسة اختبار لا تديره المديرة
  const foreignManage = await api(mLogin.cookie, '/api/framework/manage', {
    method: 'POST', body: JSON.stringify({ level: 'domain', action: 'update', id: customDomain.id, name: 'تعديل دخيل' }),
  })
  check('مجال مدرسة أخرى محمي من المديرة (403)', foreignManage.status === 403)

  // مسؤول المنصة يدير مخصص أي مدرسة
  const adminUpdate = await api(aLogin.cookie, '/api/framework/manage', {
    method: 'POST', body: JSON.stringify({ level: 'domain', action: 'update', id: customDomain.id, description: 'تحديث من مسؤول المنصة' }),
  })
  check('مسؤول المنصة يدير مخصص أي مدرسة (200)', adminUpdate.status === 200)

  // الحذف المحمي: معيار الاختبار المخصص للمعلم مرتبط بإنجازات → 409
  const protectedDelete = await api(aLogin.cookie, '/api/framework/manage', {
    method: 'POST', body: JSON.stringify({ level: 'criterion', action: 'delete', id: customCrit.id }),
  })
  check('حذف معيار بإنجازات مرتبطة مرفوض (409) مع إرشاد للأرشفة', protectedDelete.status === 409 && String(protectedDelete.body?.error).includes('الأرشفة'))

  // الأرشفة مسموحة حتى مع إنجازات، وتُخرج العنصر من الحساب
  const archiveOk = await api(aLogin.cookie, '/api/framework/manage', {
    method: 'POST', body: JSON.stringify({ level: 'subCriterion', action: 'archive', id: cSub1.id }),
  })
  check('أرشفة معيار فرعي مرتبط مسموحة (200)', archiveOk.status === 200)
  const c6 = await calculateProfessionalCompletion(teacher.id, TEST_SCHOOL)
  check('المؤرشف خرج من الحساب تمامًا: المخصص 3 من 7 (المستوفي المؤرشف لا يُحتسب)', c6.custom?.completed === 3 && c6.custom?.total === 7, `got ${c6.custom?.completed}/${c6.custom?.total}`)

  // تعيين التصنيف من API الإنجازات (القسم 13)
  const newAch = await api(tLogin.cookie, '/api/achievements', {
    method: 'POST',
    body: JSON.stringify({ type: 'COOP', title: 'إنجاز بتصنيف مباشر', status: 'COMPLETED', subCriterionId: subByCode.get('S3.3')!.id }),
  })
  check('POST /api/achievements مع subCriterionId ينشئ مصنفًا', newAch.status === 201 && newAch.body?.achievement?.subCriterionId === subByCode.get('S3.3')!.id)
  // ربط شاهد له عبر PATCH attachmentIds ليجعله مستوفيًا — استخدم شاهد سلطان الحقيقي
  const sultanAtt = await db.attachment.findFirst({ where: { user: { email: 'sultan@madrasati.sa' } } })
  if (sultanAtt && newAch.body?.achievement?.id) {
    const patched = await api(tLogin.cookie, `/api/achievements/${newAch.body.achievement.id}`, {
      method: 'PATCH', body: JSON.stringify({ attachmentIds: [sultanAtt.id] }),
    })
    check('PATCH يعزز التصنيف والشواهد معًا', patched.status === 200 && patched.body?.achievement?.subCriterion?.officialCode === 'S3.3' && (patched.body?.achievement?.links ?? []).length === 1, JSON.stringify({ st: patched.status, sub: patched.body?.achievement?.subCriterion?.officialCode, links: (patched.body?.achievement?.links ?? []).length }))
    await db.achievement.delete({ where: { id: newAch.body.achievement.id } })
  }

  // تصنيف من مدرسة أخرى مرفوض
  const foreignSub = await api(tLogin.cookie, '/api/achievements', {
    method: 'POST',
    body: JSON.stringify({ type: 'COOP', title: 'تصنيف دخيل', subCriterionId: customSubs[4].id }),
  })
  check('تصنيف من مدرسة أخرى مرفوض (400) ولم يُنشأ', foreignSub.status === 400)

  // ═══ التنظيف الذاتي (كامل — هيكلًا وبيانات) ═══
  await db.user.delete({ where: { id: teacher.id } }) // cascade: achievements/links/attachments/year
  await db.domain.deleteMany({ where: { schoolId: TEST_SCHOOL } }) // cascade: معايير المجال المخصص وفرعيّاته
  await db.criterion.deleteMany({ where: { id: customInOfficial.id } }) // معيار مخصص داخل رسمي
  if (mgrDomainId) await db.domain.delete({ where: { id: mgrDomainId } }).catch(() => {})
  if (critInOfficial.body?.criterion?.id) {
    await db.criterion.delete({ where: { id: critInOfficial.body.criterion.id } }).catch(() => {})
  }
  // معيار فرعي مخصص داخل معيار رسمي — لا يمسحه حذف متسلسل، يُحذف صراحة
  await db.subCriterion.deleteMany({ where: { name: { contains: 'فرعي مخصص' }, isOfficial: false } })
  // تحقق التنظيف: لا بقايا مخصصة من الاختبار (أسماء الاختبار أو مدرسته —
  // عناصر نورة الحقيقية من QA الواجهة تبقى: هي بيانات تطوير مشروعة)
  const leftoverCustom = await db.subCriterion.count({
    where: { isOfficial: false, OR: [{ name: { contains: 'فرعي مخصص' } }, { schoolId: TEST_SCHOOL }] },
  })
  check('تنظيف ذاتي كامل — لا بقايا هيكل مخصص', leftoverCustom === 0, `leftover=${leftoverCustom}`)

  const after = await counts()
  check('لا فقد بيانات: الأعداد الإجمالية كما كانت أو أعلى فقط (بيانات سلطان المؤقتة نُظفت)', after.achievements >= before.achievements && after.attachments >= before.attachments && after.evidenceLinks >= before.evidenceLinks, JSON.stringify({ before, after }))

  console.log(`\n═══ النتيجة: ${passed} ✓ / ${failed} ✗ ═══`)
  if (failed > 0) process.exit(1)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
