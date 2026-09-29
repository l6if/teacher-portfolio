// ═══════════════════════════════════════════════════════════════════
// بيانات QA الإنتاجية — عبر API التطبيق نفسه حصرًا (لا SQL مباشر)
// ينشئ حساب معلم QA + إنجازات سيناريوهات التقارير + شواهد مرفوعة فعليًا
// ثم يُنظَّف كل شيء لاحقًا عبر scripts/qa-prod-cleanup.mjs
// الاستخدام: node scripts/qa-prod-data.mjs <BASE> <email> <password>
// ═══════════════════════════════════════════════════════════════════
const BASE = process.argv[2] ?? 'http://localhost:3000'
const QA_EMAIL = process.argv[3] ?? 'qa.report@madrasati.sa'
const QA_PASSWORD = process.argv[4] ?? 'QaReport2026!X'

let cookie = ''

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...(opts.headers ?? {}), ...(cookie ? { cookie } : {}), ...(opts.body && !opts.isForm ? { 'Content-Type': 'application/json' } : {}) },
  })
  const setCookie = res.headers.getSetCookie?.() ?? []
  for (const c of setCookie) {
    const pair = c.split(';')[0]
    if (pair.includes('pf_session')) cookie = pair
  }
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

async function main() {
  // ─── 1) signup (أو دخول إن وُجد) ───
  let r = await api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'خالد بن سعد العتيبي', email: QA_EMAIL, password: QA_PASSWORD, confirmPassword: QA_PASSWORD, gender: 'MALE' }),
  })
  if (r.status >= 400) {
    console.log('signup:', r.status, JSON.stringify(r.body).slice(0, 120), '— نحاول الدخول')
    r = await api('/api/session', {
      method: 'POST',
      body: JSON.stringify({ email: QA_EMAIL, password: QA_PASSWORD }),
    })
    if (r.status !== 200) throw new Error('تعذر إنشاء/الدخول بحساب QA: ' + r.status)
  }
  console.log('✓ حساب QA جاهز:', QA_EMAIL)

  // ─── 2) الملف المهني ───
  await api('/api/profile', {
    method: 'PUT',
    body: JSON.stringify({
      name: 'خالد بن سعد العتيبي',
      school: 'ثانوية رواد العلوم',
      subject: 'العلوم',
      qualification: 'بكالوريوس علوم — أحياء',
      experienceYears: 9,
      stage: 'المرحلة الثانوية',
      classes: 'أول ثانوي — ثاني ثانوي',
      licenseNumber: 'MOE-2020-11876',
      duties: 'معلم علوم + مشرف النادي العلمي',
      weeklyLoad: 22,
      educationAdmin: 'الإدارة العامة للتعليم بمحافظة الواحة',
      educationOffice: 'مكتب التعليم بشمال الواحة',
      principalName: 'ماجد بن ناصر الدوسري',
    }),
  })
  console.log('✓ الملف المهني مكتمل')

  // ─── 3) السنة الدراسية (أنشئها إن لم توجد — مستخدم جديد) ───
  // GET /api/years غير موجود (405) — السنوات تأتي ضمن /api/dashboard
  const dash = await api('/api/dashboard')
  let yearId = dash.body.years?.find((y) => !y.archived)?.id ?? dash.body.years?.[0]?.id
  if (!yearId) {
    await api('/api/years', { method: 'POST', body: JSON.stringify({ label: '1448هـ' }) })
    const dash2 = await api('/api/dashboard')
    yearId = dash2.body.years?.find((y) => !y.archived)?.id ?? dash2.body.years?.[0]?.id
  }
  if (!yearId) throw new Error('لا سنة دراسية')
  console.log('✓ العام الدراسي:', '1448هـ')

  // ─── 4) الإطار المهني (لتصنيف الإنجازات) ───
  const fw = await api('/api/framework')
  const domains = fw.body.domains?.filter((d) => d.isOfficial) ?? []
  const subOf = (di, ci, si) => domains[di]?.criteria?.[ci]?.subs?.[si]?.id ?? null
  console.log('✓ الإطار:', fw.body.official?.completed, '/', fw.body.official?.total, 'مستوفى رسميًا')

  // ─── 5) شواهد صورية — ملفات PNG صغيرة مولدة ───
  // صور PNG حقيقية (SVG ممنوع أمنيًا في مسار الرفع) — تُولَّد عبر sharp
  const sharp = (await import('sharp')).default ?? require('sharp')
  const mkPng = async (label, w, h, accent) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="100%" height="100%" fill="#F4F8F6"/>
<rect x="6" y="6" width="${w - 12}" height="${h - 12}" fill="none" stroke="${accent}" stroke-width="4" rx="20"/>
<text x="50%" y="48%" text-anchor="middle" font-family="sans-serif" font-size="${Math.max(30, Math.round(w / 10))}" fill="${accent}" font-weight="700">${label}</text>
<text x="50%" y="60%" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#6C7A72">شاهد QA</text>
</svg>`
    return sharp(Buffer.from(svg)).png().toBuffer()
  }

  const upload = async (name, buf) => {
    const form = new FormData()
    form.append('file', new Blob([buf], { type: 'image/png' }), name.endsWith('.png') ? name : name + '.png')
    const res = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { cookie }, body: form })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error('رفع فشل: ' + res.status + ' ' + JSON.stringify(body).slice(0, 100))
    return body.attachment ?? body
  }

  const ev = {
    lab1: await upload('صورة-تجربة-المعمل', await mkPng('تجربة المعمل', 900, 620, '#0E5A45')),
    lab2: await upload('صورة-مشروع-الأحياء', await mkPng('مشروع الأحياء', 900, 620, '#0E5A45')),
    lab3: await upload('صورة-معرض-العلوم', await mkPng('معرض العلوم', 900, 620, '#A8863C')),
    chart: await upload('رسم-قياس-النتائج', await mkPng('قياس النتائج', 900, 620, '#0E5A45')),
    tall: await upload('لوحة-المتابعة-الرقمية', await mkPng('لوحة المتابعة', 760, 1600, '#093D2F')),
  }
  console.log('✓ رُفعت 5 شواهد صورية (منها لقطة طويلة 760×1600)')

  // ─── 6) الإنجازات — سيناريوهات التقارير ───
  const A = async (data) => {
    const res = await api('/api/achievements', { method: 'POST', body: JSON.stringify({ ...data, yearId }) })
    if (res.status >= 400) throw new Error('إنشاء إنجاز فشل: ' + res.status + JSON.stringify(res.body).slice(0, 150))
    return res.body.achievement ?? res.body
  }
  const link = async (attachmentId, achievementId) => {
    await api('/api/attachments/link', { method: 'POST', body: JSON.stringify({ attachmentId, achievementId }) })
  }

  // CASE A: نص قصير + صورة → صفحة واحدة
  const a1 = await A({
    type: 'PRACTICE', title: 'تجربة علمية تفاعلية في وحدة الخلية',
    date: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    description: 'درس عملي تفاعلي يجسد تركيب الخلية بنماذج محسوسة.',
    execution: 'عمل الطلاب في مجموعات لبناء نموذج خلوي ثم قارنوا نماذجهم تحت المجهر.',
    status: 'COMPLETED', domainId: domains[0]?.id, subCriterionId: subOf(0, 0, 0),
    studentsCount: 26,
  })
  await link(ev.lab1.id, a1.id)

  // CASE B: نص متوسط + 3 صور
  const a2 = await A({
    type: 'INITIATIVE', title: 'مبادرة معرض العلوم السنوي',
    date: new Date(Date.now() - 55 * 86400000).toISOString().slice(0, 10),
    description: 'معرض علمي سنوي يعرض مشروعات الطلاب البحثية لأولياء الأمور والمجتمع.',
    problem: 'ضعف التواصل بين المدرسة والمجتمع حول مخرجات التعلم.',
    goalText: 'إبراز مشروعات الطلاب وتعزيز الشراكة المجتمعية.',
    execution: 'جهز الطلاب مشروعاتهم على مدى شهر، ثم نظّم المعرض في المدرسة بدعوة أولياء الأمور والمدارس المجاورة، ووثقت الفعاليات كاملة.',
    results: 'زار المعرض 410 أشخاص وعرضت 38 مشروعًا.',
    impact: 'نمت ثقافة المشروع البحثي داخل المدرسة.',
    status: 'COMPLETED', domainId: domains[1]?.id, subCriterionId: subOf(1, 0, 0),
    beneficiariesCount: 410, durationText: 'شهر ونصف',
  })
  for (const e of [ev.lab2, ev.lab3, ev.chart]) await link(e.id, a2.id)

  // CASE C: نص طويل + قياس قبلي/بعد + لقطة طويلة
  const longExec = [
    'بدأ البرنامج بتشخيص شامل لأسباب ضعف الاستيعاب في وحدة الوراثة عبر تحليل ثلاث اختبارات شهرية ومقابلات مع عينة من الطلاب.',
    'قُسمت المعالجة إلى مراحل: سد الفجوات التأسيسية أولًا عبر بطاقات إتقان متدرجة، ثم بناء المفهوم بنماذج بصرية، فالتطبيق على مسائل سياقية حقيقية.',
    'وُظفت تقنية التعلم المقلوب عبر تسجيل مقاطع شرح قصيرة يتابعها الطلاب من المنزل، فتحرر وقت الحصة للممارسة الموجهة والمشروعات المصغرة.',
    'خُتم البرنامج بمشروع بحثي مصغر يرصد صفة وراثية في عائلات الطلاب ويعرض نتائجه بملصقات علمية أمام الصف.',
  ].join('\n')
  const a3 = await A({
    type: 'REMEDIAL', title: 'برنامج معالجة التعثر في وحدة الوراثة',
    date: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10),
    description: 'برنامج علاجي مكثف لوحدة الوراثة بأثر مقيس.',
    problem: 'ضعف شامل في مفاهيم الوراثة الأساسية لدى 31% من الطلاب.',
    goalText: 'خفض نسبة المتعثرين إلى أقل من 10%.',
    execution: longExec,
    results: 'انخفضت نسبة المتعثرين من 31% إلى 9%.',
    impact: 'تحسن واضح في الثقة العلمية والمشاركة الصفية.',
    status: 'COMPLETED', domainId: domains[2]?.id, subCriterionId: subOf(2, 1, 0),
    studentsCount: 38, preScore: 44, postScore: 79,
  })
  await link(ev.tall.id, a3.id)

  // CASE D: بلا شواهد (تعاون مهني)
  await A({
    type: 'COOP', title: 'تعاون مهني مع قسم الكيمياء في وحدة المركبات',
    date: new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10),
    description: 'حصص مشتركة بين العلوم والكيمياء لربط المفاهيم.',
    goalText: 'تكامل مفاهيم المادتين في أذهان الطلاب.',
    execution: 'حصص أسبوعية مشتركة بمشروع توأمة.',
    results: 'تحسن أداء أسئلة التكامل في الاختبار الموحد.',
    status: 'COMPLETED', domainId: domains[0]?.id, subCriterionId: subOf(0, 1, 0),
    studentsCount: 52,
  })

  console.log('✓ أُنشئت 4 إنجازات QA (قصير+صورة / متوسط+3 صور / طويل+قياس+لقطة طويلة / بلا شواهد)')

  const me = await api('/api/me')
  const final = await api('/api/framework')
  console.log('✓ الاكتمال الرسمي الآن:', final.body.official.completed, '/', final.body.official.total)
  console.log('\nQA DATA READY — المعرفات للحذف لاحقًا: user =', me.body.user?.id)
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
