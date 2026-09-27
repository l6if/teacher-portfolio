// بيانات تجريبية غنية — للتطوير فقط، لا تُشغّل في الإنتاج أبدًا (انظر README قسم 8)
//
// ⛔ حمايات إلزامية (شرط أمان أساسي — لا تُزلها):
//   1) الاستيراد من أي ملف آخر لا ينفّذ seed أبدًا — التنفيذ فقط بتشغيل مباشر: bun prisma/seed.ts --reset
//   2) يُرفض قاطعًا إذا NODE_ENV=production أو إذا كانت قاعدة البيانات غير ملف SQLite محلي (postgres/mysql/...)
//   3) حتى في التطوير يتطلب علم --reset صريحًا — حماية من التشغيل العرضي الذي يمسح البيانات
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'

const db = new PrismaClient()

// كلمة مرور موحدة لجميع حسابات التطوير التجريبية — من البيئة فقط (بلا افتراضي ثابت في الكود)
const DEV_PASSWORD = process.env.SEED_PASSWORD ?? ''
if (!DEV_PASSWORD) {
  throw new Error('اضبط SEED_PASSWORD في البيئة قبل تشغيل البذرة (سياسة: لا كلمات مرور ثابتة في الكود).')
}

const now = new Date()
const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)
// تواريخ العام الدراسي الماضي (1447هـ: سبتمبر 2025 - مايو 2026)
const lastYear = (month, day) => new Date(2026, month - 1, day, 10, 0)

const UP = '/uploads'

// ─── حمايات التشغيل (تُنفَّذ قبل أي عملية تخريبية) ───────────
function refuse(msg: string, hint: string): never {
  console.error('⛔ ' + msg)
  console.error('   ' + hint)
  process.exit(1)
}

/** seed التخريبي مسموح فقط على ملف SQLite محلي (file:...) — أي محرك خادم = بيئة حقيقية ممنوعة */
function isLocalDevSqlite(url: string | undefined): boolean {
  return !!url && url.trim().toLowerCase().startsWith('file:')
}

async function main() {
  // الحماية 1: بيئة الإنتاج تُرفض قاطعًا — حتى مع --reset
  if (process.env.NODE_ENV === 'production') {
    refuse(
      'NODE_ENV=production — seed التخريبي ممنوع في الإنتاج نهائيًا.',
      'لإنشاء أول حساب إداري في الإنتاج: bun scripts/create-user.ts (انظر README قسم 8)',
    )
  }
  // الحماية 2: أي قاعدة بيانات غير SQLite محلية (postgres/mysql/...) = بيئة حقيقية — ممنوعة
  if (!isLocalDevSqlite(process.env.DATABASE_URL)) {
    refuse(
      'DATABASE_URL يشير إلى قاعدة بيانات خادم (postgres/mysql/...) — seed التخريبي ممنوع خارج بيئة تطوير SQLite المحلية.',
      'للإنتاج: bun scripts/create-user.ts — seed يعمل فقط على ملف SQLite محلي للتطوير.',
    )
  }
  // الحماية 3: علم --reset صريح حتى في التطوير (منع التشغيل العرضي/الأخطاء المطبعية)
  if (!process.argv.includes('--reset')) {
    refuse(
      'seed يمسح كل بيانات قاعدة البيانات ويعيد تعبئتها ببيانات تجريبية.',
      'للتأكيد المتعمد: bun prisma/seed.ts --reset  |  الاستيراد من ملف آخر لا ينفّذ seed أبدًا (حماية مقصودة).',
    )
  }

  console.warn('⚠️ تشغيل seed تخريبي: سيتم مسح كل البيانات وإعادة تعبئتها ببيانات تجريبية...')
  await db.$transaction([
    db.evidenceLink.deleteMany(),
    db.attachment.deleteMany(),
    db.achievement.deleteMany(),
    db.reflection.deleteMany(),
    db.devPlan.deleteMany(),
    db.goal.deleteMany(),
    db.academicYear.deleteMany(),
    db.user.deleteMany(),
  ])

  // ═══ المستخدمون ═════════════════════════════════════════════
  const sultan = await db.user.create({
    data: {
      email: 'sultan@madrasati.sa',
      passwordHash: hashPassword(DEV_PASSWORD),
      name: 'سلطان بن حمد الحربي',
      role: 'TEACHER',
      school: 'متوسطة الملك عبدالعزيز',
      educationAdmin: 'إدارة تعليم الرياض',
      educationOffice: 'مكتب تعليم شمال الرياض',
      principalName: 'أ. نورة العتيبي',
      subject: 'اللغة العربية',
      qualification: 'بكالوريوس اللغة العربية — كلية التربية',
      experienceYears: 9,
      stage: 'المرحلة المتوسطة',
      classes: 'أول متوسط (1، 3) — ثاني متوسط (2) — ثالث متوسط (1، 2)',
      licenseNumber: 'رخصة معلم مهني — 1440هـ',
      duties: 'معلم أول — مشرف ركن القراءة الصفي',
      weeklyLoad: 24,
      schedule: JSON.stringify([
        { day: 'الأحد', grade: 'ثالث متوسط', periods: 'الحصص 1 — 3' },
        { day: 'الاثنين', grade: 'أول متوسط', periods: 'الحصص 1 — 4' },
        { day: 'الثلاثاء', grade: 'ثاني متوسط', periods: 'الحصص 2 — 5' },
        { day: 'الأربعاء', grade: 'ثالث متوسط', periods: 'الحصص 1 — 4' },
        { day: 'الخميس', grade: 'أول متوسط + نشاط', periods: 'الحصص 1 — 3' },
      ]),
      committees: JSON.stringify([
        { name: 'لجنة النشاط الطلابي', role: 'رئيس اللجنة' },
        { name: 'لجنة الإعلام التعليمي', role: 'عضو' },
        { name: 'مجلس المعلمين', role: 'عضو' },
      ]),
      extraDuties: JSON.stringify([
        'الإشراف على ركن القراءة الصفي',
        'ريادة الفصول الافتراضية على منصة مدرستي',
        'تنسيق برنامج القراءة المدرسي',
      ]),
    },
  })

  const noura = await db.user.create({
    data: {
      email: 'noura@madrasati.sa',
      passwordHash: hashPassword(DEV_PASSWORD),
      name: 'نورة القحطاني',
      role: 'MANAGER',
      school: 'متوسطة الملك عبدالعزيز',
      educationAdmin: 'إدارة تعليم الرياض',
      educationOffice: 'مكتب تعليم شمال الرياض',
      principalName: 'أ. نورة العتيبي',
      subject: 'الإدارة المدرسية',
    },
  })

  const ahmed = await db.user.create({
    data: {
      email: 'ahmed@madrasati.sa',
      passwordHash: hashPassword(DEV_PASSWORD),
      name: 'أحمد الشمري',
      role: 'TEACHER',
      school: 'متوسطة الملك عبدالعزيز',
      educationAdmin: 'إدارة تعليم الرياض',
      educationOffice: 'مكتب تعليم شمال الرياض',
      principalName: 'أ. نورة العتيبي',
      subject: 'الرياضيات',
      qualification: 'بكالوريوس الرياضيات',
      experienceYears: 4,
      stage: 'المرحلة المتوسطة',
      classes: 'أول متوسط (4، 5) — ثاني متوسط (1، 4)',
      weeklyLoad: 22,
    },
  })

  const fatimah = await db.user.create({
    data: {
      email: 'fatimah@madrasati.sa',
      passwordHash: hashPassword(DEV_PASSWORD),
      name: 'فاطمة الزهراني',
      role: 'TEACHER',
      school: 'متوسطة الملك عبدالعزيز',
      educationAdmin: 'إدارة تعليم الرياض',
      educationOffice: 'مكتب تعليم شمال الرياض',
      principalName: 'أ. نورة العتيبي',
      subject: 'العلوم',
      qualification: 'بكالوريوس العلوم العامة — كلية التربية',
      experienceYears: 12,
      stage: 'المرحلة المتوسطة',
      classes: 'أول متوسط (2، 5) — ثالث متوسط (3)',
      licenseNumber: 'رخصة معلمة مهني — 1439هـ',
      weeklyLoad: 20,
      schedule: JSON.stringify([
        { day: 'الأحد', grade: 'أول متوسط', periods: 'الحصص 1 — 3' },
        { day: 'الاثنين', grade: 'ثالث متوسط', periods: 'الحصص 1 — 4' },
      ]),
      committees: JSON.stringify([{ name: 'لجنة المختبرات', role: 'رئيس اللجنة' }]),
    },
  })

  const khaled = await db.user.create({
    data: {
      email: 'khaled@madrasati.sa',
      passwordHash: hashPassword(DEV_PASSWORD),
      name: 'خالد العتيبي',
      role: 'TEACHER',
      school: 'متوسطة الملك عبدالعزيز',
      educationAdmin: 'إدارة تعليم الرياض',
      educationOffice: 'مكتب تعليم شمال الرياض',
      principalName: 'أ. نورة العتيبي',
      subject: 'الدراسات الاجتماعية',
      qualification: 'بكالوريوس الدراسات الاجتماعية',
      experienceYears: 2,
      stage: 'المرحلة المتوسطة',
    },
  })

  // ═══ السنوات الدراسية ═══════════════════════════════════════
  const y1448 = await db.academicYear.create({
    data: { label: '1448هـ', userId: sultan.id },
  })
  const y1447 = await db.academicYear.create({
    data: { label: '1447هـ', userId: sultan.id, archived: true },
  })
  const ay1448 = await db.academicYear.create({ data: { label: '1448هـ', userId: ahmed.id } })
  const fy1448 = await db.academicYear.create({ data: { label: '1448هـ', userId: fatimah.id } })
  const ky1448 = await db.academicYear.create({ data: { label: '1448هـ', userId: khaled.id } })

  // ═══ الأهداف المهنية — 1448هـ ═══════════════════════════════
  const goal1 = await db.goal.create({
    data: {
      title: 'رفع مستوى إتقان مهارة القراءة لدى طلاب الصف السابع',
      description: 'تحسين الطلاقة والاستيعاب القرائي من خلال خطة علاجية ومبادرة قرائية مدرسية.',
      indicator: 'نسبة إتقان مهارة القراءة في الاختبار البعدي',
      targetValue: 85,
      currentValue: 83,
      startDate: daysAgo(35),
      endDate: daysAgo(-140),
      scope: 'YEAR',
      userId: sultan.id,
      yearId: y1448.id,
    },
  })
  const goal2 = await db.goal.create({
    data: {
      title: 'توظيف استراتيجيات التعلم النشط في 80% من الدروس',
      description: 'الانتقال التدريجي من المحاضرة إلى الأنشطة البنائية داخل الفصل.',
      indicator: 'عدد الدروس الموظفة فيها استراتيجيات التعلم النشط',
      targetValue: 80,
      currentValue: 75,
      startDate: daysAgo(35),
      endDate: daysAgo(-120),
      scope: 'YEAR',
      userId: sultan.id,
      yearId: y1448.id,
    },
  })
  const goal3 = await db.goal.create({
    data: {
      title: 'إنجاز 40 ساعة تطوير مهني معتمدة',
      description: 'المشاركة في الدورات وورش العمل واللقاءات المهنية المسجلة.',
      indicator: 'مجموع الساعات التدريبية المعتمدة',
      targetValue: 40,
      currentValue: 38,
      startDate: daysAgo(35),
      endDate: daysAgo(-150),
      scope: 'YEAR',
      userId: sultan.id,
      yearId: y1448.id,
    },
  })

  // ═══ الشواهد (المرفقات) — 1448هـ ════════════════════════════
  const att = async (data) => (await db.attachment.create({ data })).id

  const certActive = await att({
    title: 'شهادة ورشة استراتيجيات التعلم النشط',
    kind: 'IMAGE', url: `${UP}/cert-active-learning.svg`, fileName: 'شهادة-التعلم-النشط.svg',
    fileSize: 9800, mimeType: 'image/svg+xml', keywords: 'شهادة، تدريب، تعلم نشط',
    userId: sultan.id, yearId: y1448.id,
  })
  const certThanks = await att({
    title: 'شهادة شكر من إدارة المدرسة',
    kind: 'IMAGE', url: `${UP}/cert-thanks.svg`, fileName: 'شهادة-شكر.svg',
    fileSize: 9200, mimeType: 'image/svg+xml', keywords: 'شهادة، تكريم، شكر',
    userId: sultan.id, yearId: y1448.id,
  })
  const certAssess = await att({
    title: 'شهادة دورة التقويم التكويني الرقمي',
    kind: 'IMAGE', url: `${UP}/cert-assessment.svg`, fileName: 'شهادة-التقويم-التكويني.svg',
    fileSize: 9500, mimeType: 'image/svg+xml', keywords: 'شهادة، تقويم، دورة',
    userId: sultan.id, yearId: y1448.id,
  })
  const chartReading = await att({
    title: 'رسم بياني — أثر الخطة العلاجية في القراءة',
    kind: 'IMAGE', url: `${UP}/chart-reading.svg`, fileName: 'تحسن-القراءة.svg',
    fileSize: 7400, mimeType: 'image/svg+xml', keywords: 'رسم، قراءة، تحسن',
    userId: sultan.id, yearId: y1448.id,
  })
  const docRemedial = await att({
    title: 'مستند الخطة العلاجية لمهارة القراءة',
    kind: 'PDF', url: `${UP}/doc-remedial-plan.svg`, fileName: 'الخطة-العلاجية-القراءة.pdf',
    fileSize: 486000, mimeType: 'application/pdf', keywords: 'خطة، علاجي، قراءة',
    userId: sultan.id, yearId: y1448.id,
  })
  const docDist = await att({
    title: 'توزيع منهج اللغة العربية — الفصل الأول',
    kind: 'PDF', url: `${UP}/doc-curriculum-distribution.svg`, fileName: 'توزيع-المنهج.pdf',
    fileSize: 312000, mimeType: 'application/pdf', keywords: 'توزيع، منهج، تخطيط',
    userId: sultan.id, yearId: y1448.id,
  })
  const photoInit = await att({
    title: 'صور مبادرة القراءة الواعية',
    kind: 'IMAGE', url: `${UP}/photo-initiative.svg`, fileName: 'مبادرة-القراءة.svg',
    fileSize: 15200, mimeType: 'image/svg+xml', keywords: 'صور، مبادرة، قراءة',
    userId: sultan.id, yearId: y1448.id,
  })
  const photoCoop = await att({
    title: 'صور توثيق التعلم التعاوني',
    kind: 'IMAGE', url: `${UP}/photo-coop.svg`, fileName: 'التعلم-التعاوني.svg',
    fileSize: 13800, mimeType: 'image/svg+xml', keywords: 'صور، تعاوني، ممارسة',
    userId: sultan.id, yearId: y1448.id,
  })
  const photoExhib = await att({
    title: 'صور معرض المواهب والقدرات',
    kind: 'IMAGE', url: `${UP}/photo-exhibition.svg`, fileName: 'معرض-المواهب.svg',
    fileSize: 14400, mimeType: 'image/svg+xml', keywords: 'صور، معرض، مشاركة',
    userId: sultan.id, yearId: y1448.id,
  })
  const linkPlatform = await att({
    title: 'رابط فصول اللغة العربية على منصة مدرستي',
    kind: 'LINK', url: 'https://schools.madrasati.sa', fileName: null,
    fileSize: null, mimeType: null, keywords: 'رابط، منصة، تقنية',
    userId: sultan.id, yearId: y1448.id,
  })

  // ═══ الإنجازات — 1448هـ ═════════════════════════════════════
  const A = (data) => db.achievement.create({ data })
  const link = (attachmentId, achievementId) => db.evidenceLink.create({ data: { attachmentId, achievementId } })

  const remedialReading = await A({
    type: 'REMEDIAL', title: 'خطة علاجية لتنمية مهارة القراءة',
    field: 'الخطط العلاجية', date: daysAgo(2),
    description: 'خطة مكثفة لمعالجة ضعف الطلاقة والاستيعاب القرائي لدى طلاب الصف السابع.',
    goalText: 'رفع نسبة إتقان مهارة القراءة لدى الطلاب المستهدفين إلى 85%.',
    problem: 'تدني واضح في معدلات الطلاحة القرائية ظهر في الاختبار التشخيصي (58%).',
    execution: 'جلسات قراءة موجّهة ثلاث مرات أسبوعيًا، أنشطة قرائية متدرجة، بطاقات رصد فردية، تكليفات منزلية قصيرة مع متابعة أولياء الأمور.',
    actions: 'تشخيص — تجميع المجموعات — تنفيذ الجلسات — رصد أسبوعي — قياس بعلي',
    beneficiaries: 'طلاب الصف السابع — الفئة الضعيفة في القراءة',
    studentsCount: 18, preScore: 58, postScore: 83,
    durationText: '4 أسابيع',
    results: 'ارتفاع نسبة الإتقان من 58% إلى 83% وتحسن الطلاقة لدى 16 طالبًا من أصل 18.',
    impact: 'ارتفاع واضح في ثقة الطلاب بالمشاركة الصفية وإقبالهم على ركن القراءة.',
    keywords: 'قراءة، خطة علاجية، طلاقة، استيعاب',
    status: 'COMPLETED', goalId: goal1.id, userId: sultan.id, yearId: y1448.id,
  })
  await link(chartReading, remedialReading.id)
  await link(docRemedial, remedialReading.id)

  const remedialSpelling = await A({
    type: 'REMEDIAL', title: 'خطة علاجية لمهارة الإملاء (الهمزات)',
    field: 'الخطط العلاجية', date: daysAgo(22),
    description: 'معالجة الأخطاء الإملائية الشائعة في كتابة الهمزات بأنواعها.',
    goalText: 'إتقان كتابة الهمزات في مواقعها الصحيحة.',
    problem: 'تكرار أخطاء الهمزات في الكتابة التعبيرية.',
    execution: 'تدريبات قصيرة يومية، بطاقات إملائية، تصحيح تبادلي بين الطلاب.',
    beneficiaries: 'طلاب الصف الثالث المتوسط', studentsCount: 12,
    preScore: 64, postScore: 81, durationText: '3 أسابيع',
    results: 'انخفاض نسبة الأخطاء الإملائية إلى 19%.',
    impact: 'تحسن دقة الكتابة في أوراق التعبير.',
    keywords: 'إملاء، همزات، خطة علاجية',
    status: 'COMPLETED', userId: sultan.id, yearId: y1448.id,
  })

  const enrichment = await A({
    type: 'ENRICHMENT', title: 'برنامج إثرائي: الكتابة الإبداعية للموهوبين',
    field: 'برامج الإثراء', date: daysAgo(10),
    description: 'برنامج متقدم لتوسيع مهارات الكتابة الإبداعية لدى الطلاب الموهوبين.',
    goalText: 'إنتاج نصوص إبداعية مكتملة العناصر ونشرها في صحيفة المدرسة.',
    execution: 'ورش كتابة أسبوعية، قراءة نصوص نموذجية، مراجعة فردية للأعمال.',
    beneficiaries: 'الطلاب الموهوبون في اللغة', studentsCount: 8,
    durationText: '6 أسابيع',
    results: 'إنتاج 14 نصًا إبداعيًا نُشر منها 9 في صحيفة المدرسة.',
    impact: 'ظهور مواهب كتابية جديدة وارتفاع دافعية الفئة الموهوبة.',
    keywords: 'إثراء، كتابة إبداعية، موهوبون',
    status: 'COMPLETED', userId: sultan.id, yearId: y1448.id,
  })

  const pdActive = await A({
    type: 'PD', title: 'ورشة عمل: استراتيجيات التعلم النشط',
    field: 'التطوير المهني', date: daysAgo(5),
    description: 'ورشة تدريبية عملية حول توظيف استراتيجيات التعلم النشط داخل الفصل.',
    goalText: 'اكتساب أدوات عملية لتصميم أنشطة تعلم نشط فعالة.',
    execution: 'حضور الورشة وتنفيذ تطبيق عملي مصغر خلال الورشة.',
    provider: 'مكتب التعليم — شرق الرياض', hours: 6,
    notes: 'أبرز ما تعلمته: تنويع الأدوار داخل المجموعات — طبقتها في درس الظواهر اللغوية.',
    results: 'شهادة إتمام معتمدة + خطة تطبيق داخل الفصل.',
    impact: 'ارتفاع معدل مشاركة الطلاب الصفية بشكل ملحوظ.',
    keywords: 'ورشة، تعلم نشط، تدريب',
    status: 'COMPLETED', goalId: goal2.id, userId: sultan.id, yearId: y1448.id,
  })
  await link(certActive, pdActive.id)

  const pdAssess = await A({
    type: 'PD', title: 'دورة: التقويم التكويني الرقمي',
    field: 'التطوير المهني', date: daysAgo(21),
    description: 'دورة مسائية عن بناء أدوات تقويم تكويني رقمية وتحليل نتائجها.',
    goalText: 'إتقان تصميم اختبارات قصيرة رقمية بمخرجات تحليلية فورية.',
    execution: 'حضور 4 جلسات مسائية وتنفيذ المشروع الختامي.',
    provider: 'الأكاديمية المهنية للمعلمين', hours: 12,
    notes: 'طبقت ما تعلمته في بناء اختبار تشخيصي رقمي لمهارة القراءة.',
    results: 'شهادة إتمام + تطبيق عملي داخل الفصل.',
    impact: 'اختصار وقت تصحيح الاختبارات القصيرة إلى النصف.',
    keywords: 'دورة، تقويم، رقمي',
    status: 'COMPLETED', goalId: goal3.id, userId: sultan.id, yearId: y1448.id,
  })
  await link(certAssess, pdAssess.id)

  await A({
    type: 'PD', title: 'اللقاء المهني الشهري لمعلمي اللغة العربية',
    field: 'التطوير المهني', date: daysAgo(27),
    description: 'لقاء مهني لتبادل الخبرات حول تعليم مهارات الكتابة.',
    goalText: 'الاطلاع على ممارسات الزملاء ومواءمتها مع الواقع الصفي.',
    execution: 'حضور اللقاء وعرض تجربة ركن القراءة الصفي أمام الزملاء.',
    provider: 'مكتب التعليم — شرق الرياض', hours: 2,
    results: 'تبني فكرة الركن في مدرستين أخريين.',
    impact: 'توسع أثر التجربة خارج المدرسة.',
    keywords: 'لقاء مهني، كتابة',
    status: 'COMPLETED', goalId: goal3.id, userId: sultan.id, yearId: y1448.id,
  })

  const initiative = await A({
    type: 'INITIATIVE', title: 'مبادرة القراءة الواعية',
    field: 'المبادرات', date: daysAgo(7),
    description: 'مبادرة مدرسية لترسيخ عادة القراءة اليومية وتحسين الفهم القرائي.',
    goalText: 'وصول 200 طالب لقراءة 5 كتب خلال الفصل الدراسي.',
    problem: 'ضعف الاهتمام بالقراءة الحرة خارج الكتاب المدرسي.',
    execution: 'أسبوع قراءة كامل، ركن تبادلي للكتب، بطاقة قارئ ماهر، مسابقة ختامية.',
    actions: 'التجهيز — الإطلاق — المتابعة الأسبوعية — المسابقة الختامية',
    beneficiariesCount: 240, durationText: '6 أسابيع',
    results: 'قراءة أكثر من 1100 كتاب تراكميًا وفوز 12 طالبًا في المسابقة.',
    impact: 'ارتفاع معدل الاستعارة من مكتبة المدرسة ثلاثة أضعاف.',
    keywords: 'مبادرة، قراءة، نشاط',
    status: 'COMPLETED', goalId: goal1.id, userId: sultan.id, yearId: y1448.id,
  })
  await link(photoInit, initiative.id)

  const initiativeCorner = await A({
    type: 'INITIATIVE', title: 'ركن القراءة الصفي',
    field: 'المبادرات', date: daysAgo(26),
    description: 'تجهيز ركن قراءة دائم داخل الفصل بمدونة استعارة ذاتية.',
    goalText: 'إتاحة الكتب أمام الطلاب في كل حصة دون وسيط.',
    problem: 'بعد مكتبة المدرسة عن بعض الفصول.',
    execution: 'تصميم الركن، جمع التبرعات من أولياء الأمور، نظام استعارة ذاتي.',
    beneficiariesCount: 120, durationText: 'دائم طوال العام',
    results: 'استعارة يومية بمعدل 9 كتب.',
    impact: 'تحول القراءة إلى عادة صفية يومية.',
    keywords: 'ركن قراءة، مبادرة',
    status: 'COMPLETED', userId: sultan.id, yearId: y1448.id,
  })

  const practiceCoop = await A({
    type: 'PRACTICE', title: 'التعلم التعاوني في درس الظواهر اللغوية',
    field: 'الممارسات التعليمية', date: daysAgo(6),
    description: 'توظيف استراتيجية الفرق التعاونية في تحليل الظواهر اللغوية.',
    goalText: 'جعل الطالب مشاركًا فاعلًا في استنتاج القاعدة اللغوية.',
    execution: 'تقسيم الفصل إلى 6 مجموعات بأدوار محددة، أوراق عمل متدرجة، عرض ختامي.',
    beneficiaries: 'طلاب الصف الثالث المتوسط', studentsCount: 28,
    results: 'إتقان 85% من الطلاب للقاعدة المستهدفة في التقويم الختامي.',
    impact: 'انخفاض ملحوظ في السلبية الصفية ومشاركة الجميع.',
    keywords: 'تعلم تعاوني، ممارسة، ظواهر لغوية',
    status: 'COMPLETED', goalId: goal2.id, userId: sultan.id, yearId: y1448.id,
  })
  await link(photoCoop, practiceCoop.id)

  await A({
    type: 'PRACTICE', title: 'التعلم القائم على المشكلات في درس النصوص الوصفية',
    field: 'الممارسات التعليمية', date: daysAgo(13),
    description: 'طرح مشكلة واقعية تحفز الطلاب على تحليل نص وصفي طويل.',
    goalText: 'تنمية مهارة التحليل النقدي للنص الوصفي.',
    execution: 'مشكلة افتتاحية، عمل ثنائي، لوحة استنتاج مشتركة.',
    beneficiaries: 'طلاب الصف الثاني المتوسط', studentsCount: 24,
    results: 'إنتاج لوحات تحليل جماعية لكل ثنائي.',
    impact: 'ارتفاع جودة التحليل في الواجبات اللاحقة.',
    keywords: 'تعلم بالمشكلات، نصوص',
    status: 'COMPLETED', goalId: goal2.id, userId: sultan.id, yearId: y1448.id,
  })

  await A({
    type: 'PRACTICE', title: 'دمج التقنية التعليمية عبر منصة مدرستي',
    field: 'الممارسات التعليمية', date: daysAgo(20),
    description: 'إدارة الواجبات والاختبارات القصيرة عبر الفصول الافتراضية.',
    goalText: 'رقمنة جزء من التقويم التكويني والمتابعة.',
    execution: 'إنشاء فصول افتراضية لجميع الشُعب ورفع الواجبات أسبوعيًا.',
    beneficiaries: 'جميع الشُعب', studentsCount: 86,
    results: 'تفعيل 8 واجبات رقمية.',
    impact: 'سهولة متابعة المتأخرين عن التسليم.',
    keywords: 'تقنية، منصة، رقمي',
    status: 'NEEDS_WORK', userId: sultan.id, yearId: y1448.id,
  })
  await link(linkPlatform, (await db.achievement.findFirstOrThrow({ where: { title: 'دمج التقنية التعليمية عبر منصة مدرستي' } })).id)

  const assessDiag = await A({
    type: 'ASSESSMENT', title: 'الاختبار التشخيصي لمهارة القراءة وتحليل النتائج',
    field: 'القياس والتقويم', date: daysAgo(29),
    description: 'بناء اختبار تشخيصي رقمي وتحليل نتائجه لتحديد الفئات.',
    goalText: 'تحديد مستوى كل طالب قبل بدء الخطة العلاجية.',
    execution: 'اختبار رقمي 20 فقرة + تحليل إكسل للنتائج + قائمة أسماء الفئات.',
    beneficiaries: 'طلاب الصف السابع', studentsCount: 86,
    preScore: 58,
    results: 'تحديد 18 طالبًا للخطة العلاجية.',
    impact: 'بناء تدخل مبني على بيانات دقيقة.',
    keywords: 'تشخيص، تحليل نتائج، قراءة',
    status: 'COMPLETED', goalId: goal1.id, userId: sultan.id, yearId: y1448.id,
  })
  await link(chartReading, assessDiag.id)

  await A({
    type: 'ASSESSMENT', title: 'بناء قوائم رصد لمهارات الكتابة',
    field: 'القياس والتقويم', date: daysAgo(16),
    description: 'قوائم تحقق لرصد تقدم مهارات الكتابة على مستوى الفقرة.',
    goalText: 'متابعة تقدم كتابي دقيق بدل التقدير الكلي.',
    execution: 'بناء 3 قوائم رصد (بدء — منتصف — نهاية) وتطبيقها الدوري.',
    beneficiaries: 'طلاب المرحلة المتوسطة',
    results: 'رصد دوري لمهارات 86 طالبًا.',
    impact: 'تغذية راجعة فردية أدق للطلاب.',
    keywords: 'قوائم رصد، كتابة، تقويم تكويني',
    status: 'COMPLETED', userId: sultan.id, yearId: y1448.id,
  })

  await A({
    type: 'COOP', title: 'تبادل زيارات صفية مع معلم اللغة الإنجليزية',
    field: 'التعاون المهني', date: daysAgo(14),
    description: 'زيارة متبادلة للاطلاع على توظيف استراتيجية القراءة المتزامنة في المادتين.',
    goalText: 'تكامل تدريس مهارات القراءة بين مادتي اللغة.',
    execution: 'زيارة صفية متبادلة + جلسة نقاش بعد الزيارة.',
    beneficiaries: 'معلمو اللغات',
    results: 'توحيد مصطلحات استراتيجيات القراءة بين المادتين.',
    impact: 'تقليل تشتت الطلاب بين منهجيتي القراءة.',
    keywords: 'زيارات صفية، تعاون',
    status: 'COMPLETED', userId: sultan.id, yearId: y1448.id,
  })

  await A({
    type: 'COOP', title: 'المجتمع المهني لمعلمي اللغة العربية',
    field: 'التعاون المهني', date: daysAgo(24),
    description: 'مجتمع مهني دائم يجتمع أسبوعيًا لتبادل الخبرات داخل المدرسة.',
    goalText: 'إيجاد مساحة نمو مهني دائمة داخل المدرسة.',
    execution: 'اجتماع أسبوعي 45 دقيقة، روتazione عرض التجارب، أرشفة المحتوى.',
    beneficiaries: 'معلمو اللغة العربية (4 معلمين)',
    durationText: 'أسبوعي — طوال العام',
    results: '8 اجتماعات منجز منها حتى الآن.',
    impact: 'توحيد الممارسات الجيدة بين معلمي اللغة.',
    keywords: 'مجتمع مهني، تعاون، لقاء أسبوعي',
    status: 'COMPLETED', userId: sultan.id, yearId: y1448.id,
  })

  const participationArabicDay = await A({
    type: 'PARTICIPATION', title: 'اليوم العالمي للغة العربية',
    field: 'المشاركات المدرسية', date: daysAgo(18),
    description: 'إعداد وتنفيذ فعالية اليوم العالمي للغة العربية على مستوى المدرسة.',
    goalText: 'تعزيز الانتماء للغة العربية واحتفاء بجمالها.',
    execution: 'إذاعة صباحية، مسابقة خط، معرض مصاحب.',
    beneficiariesCount: 340, durationText: '3 أيام',
    results: 'مشاركة 60 طالبًا في المسابقات والفعاليات.',
    impact: 'تفاعل مدرسي واسع مع أنشطة اللغة.',
    keywords: 'يوم عالمي، لغة عربية، فعالية',
    status: 'COMPLETED', userId: sultan.id, yearId: y1448.id,
  })

  const participationExhib = await A({
    type: 'PARTICIPATION', title: 'معرض المواهب والقدرات',
    field: 'المشاركات المدرسية', date: daysAgo(25),
    description: 'المشاركة بركن أعمال الطلاب في المعرض المدرسي السنوي.',
    goalText: 'إبراز منتجات الطلاب الكتابية أمام المجتمع المدرسي.',
    execution: 'تجهيز الركن بمعرض أعمال الطلاب الإبداعية.',
    beneficiariesCount: 500,
    results: 'زيارة أكثر من 300 طالب للركن.',
    impact: 'دافعية مرتفعة لدى الطلاب أصحاب الأعمال.',
    keywords: 'معرض، مواهب، مشاركة',
    status: 'COMPLETED', userId: sultan.id, yearId: y1448.id,
  })
  await link(photoExhib, participationExhib.id)

  const awardThanks = await A({
    type: 'AWARD', title: 'شهادة شكر من إدارة المدرسة',
    field: 'الإنجازات والتكريم', date: daysAgo(4),
    description: 'شهادة شكر تقديرًا للجهود في أنشطة القراءة والفعاليات اللغوية.',
    goalText: null, execution: null,
    provider: 'إدارة متوسطة الملك عبدالعزيز',
    results: 'شهادة معتمدة ضمن السجل المهني.',
    impact: 'تعزيز ثقافة التقدير داخل المدرسة.',
    keywords: 'تكريم، شهادة شكر',
    status: 'COMPLETED', userId: sultan.id, yearId: y1448.id,
  })
  await link(certThanks, awardThanks.id)

  await A({
    type: 'CERTIFICATE', title: 'اعتماد قائد مجتمع مهني',
    field: 'الإنجازات والتكريم', date: daysAgo(12),
    description: 'ترشيح واعتماد قيادة المجتمع المهني لمعلمي اللغة العربية.',
    keywords: 'اعتماد، قيادة، مجتمع مهني',
    status: 'DRAFT', userId: sultan.id, yearId: y1448.id,
  })

  const planDist = await A({
    type: 'PLAN', title: 'توزيع منهج اللغة العربية — الفصل الأول',
    field: 'التخطيط للتدريس', date: daysAgo(30),
    description: 'توزيع زمني واقعي للمنهج مع مراعاة الأنشطة والتقويم.',
    goalText: 'إنجاز المنهج في وقته المحدد مع تضمين الأنشطة.',
    execution: 'جلسة تخطيط مع تحفير زمني لكل وحدة.',
    durationText: 'الفصل الدراسي الأول',
    results: 'التزام بالتوزيع حتى الأسبوع الخامس.',
    impact: 'استقرار إيقاع الدروس لدى الطلاب.',
    keywords: 'توزيع منهج، تخطيط',
    status: 'COMPLETED', userId: sultan.id, yearId: y1448.id,
  })
  await link(docDist, planDist.id)

  // ═══ الإنجازات — 1447هـ (مؤرشف) ═════════════════════════════
  const oldCert = await att({
    title: 'شهادة تكريم اليوم العالمي للمعلم — 1447هـ',
    kind: 'IMAGE', url: `${UP}/cert-teacher-day.svg`, fileName: 'تكريم-يوم-المعلم.svg',
    fileSize: 9100, mimeType: 'image/svg+xml', keywords: 'شهادة، تكريم، يوم المعلم',
    userId: sultan.id, yearId: y1447.id,
  })

  await A({
    type: 'REMEDIAL', title: 'خطة علاجية لمهارة القراءة — 1447هـ',
    field: 'الخطط العلاجية', date: lastYear(10, 12),
    description: 'خطة علاجية لطلاب الصف السابع في مهارات القراءة الأساسية.',
    studentsCount: 15, preScore: 52, postScore: 74, durationText: '5 أسابيع',
    results: 'تحسن 22 نقطة مئوية.', impact: 'أساس لتطوير نسخة الخطة الحالية.',
    keywords: 'قراءة، علاجي، 1447',
    status: 'COMPLETED', userId: sultan.id, yearId: y1447.id,
  })
  await A({
    type: 'PD', title: 'دورة: مهارات التفكير العليا — 1447هـ',
    field: 'التطوير المهني', date: lastYear(11, 20), provider: 'الأكاديمية المهنية للمعلمين',
    hours: 15, description: 'دورة عن توظيف مهارات التفكير العليا في تدريس اللغة.',
    results: 'شهادة معتمدة.', keywords: 'دورة، تفكير',
    status: 'COMPLETED', userId: sultan.id, yearId: y1447.id,
  })
  await A({
    type: 'PD', title: 'مؤتمر معلمي اللغة العربية — 1447هـ',
    field: 'التطوير المهني', date: lastYear(2, 9), provider: 'إدارة التعليم — الرياض',
    hours: 16, description: 'مؤتمر سنوي بورقة عمل حول القراءة المدرسية.',
    results: 'تقديم ورقة عمل أمام 120 معلمًا.', keywords: 'مؤتمر، ورقة عمل',
    status: 'COMPLETED', userId: sultan.id, yearId: y1447.id,
  })
  await A({
    type: 'INITIATIVE', title: 'مسابقة أوائل القراء — 1447هـ',
    field: 'المبادرات', date: lastYear(3, 15),
    description: 'مسابقة فصلية لأكثر الطلاب قراءةً وتلخيصًا.',
    beneficiariesCount: 180, durationText: 'فصل دراسي',
    results: 'فوز 10 طلاب وتكريمهم في الإذاعة الصباحية.',
    impact: 'تنافسية إيجابية في القراءة.',
    keywords: 'مسابقة، قراءة، 1447',
    status: 'COMPLETED', userId: sultan.id, yearId: y1447.id,
  })
  await A({
    type: 'PRACTICE', title: 'توظيف التعلم باللعب — قواعد النحو — 1447هـ',
    field: 'الممارسات التعليمية', date: lastYear(1, 25),
    description: 'تحويل تدريبات النظر إلى ألعاب قواعد جماعية.',
    studentsCount: 26,
    results: 'ارتفاع درجات الاختبار القصير 12 نقطة.',
    keywords: 'تعلم باللعب، نحو',
    status: 'COMPLETED', userId: sultan.id, yearId: y1447.id,
  })
  await A({
    type: 'ASSESSMENT', title: 'تحليل نتائج نهاية العام — 1447هـ',
    field: 'القياس والتقويم', date: lastYear(5, 4),
    description: 'تحليل شامل لنتائج الاختبارات النهائية وتقفية أثرها.',
    results: 'تقرير تحليلي رُفع للإدارة.', keywords: 'تحليل، نهاية عام',
    status: 'COMPLETED', userId: sultan.id, yearId: y1447.id,
  })
  const oldAward = await A({
    type: 'AWARD', title: 'تكريم اليوم العالمي للمعلم — 1447هـ',
    field: 'الإنجازات والتكريم', date: lastYear(10, 5),
    description: 'تكريم على مستوى إدارة التعليم بمناسبة اليوم العالمي للمعلم.',
    provider: 'إدارة التعليم — منطقة الرياض',
    keywords: 'تكريم، يوم المعلم',
    status: 'COMPLETED', userId: sultan.id, yearId: y1447.id,
  })
  await link(oldCert, oldAward.id)
  await A({
    type: 'COOP', title: 'اجتماعات مجلس المعلمين — 1447هـ',
    field: 'التعاون المهني', date: lastYear(9, 8),
    description: 'حضور ومشاركة فاعلة في اجتماعات مجلس المعلمين الدورية.',
    keywords: 'مجلس المعلمين، اجتماعات',
    status: 'COMPLETED', userId: sultan.id, yearId: y1447.id,
  })

  // ═══ التأمل المهني + الخطة التطويرية — 1448هـ ═══════════════
  await db.reflection.create({
    data: {
      term: 'TERM1',
      success: 'نجاح الخطة العلاجية للقراءة وتحول 18 طالبًا من الفئة الضعيفة إلى فئة الإتقان تقريبًا.',
      practice: 'التعلم التعاوني بأدوار محددة — أعطى كل طالب موقعًا فاعلًا داخل المجموعة.',
      develop: 'التوسع في التقويم الرقمي وتحليل البيانات بدل الاكتفاء بالرصد الورقي.',
      nextTerm: 'سأبني بطاقات متابعة رقمية فردية لكل طالب بدل التقارير الجماعية فقط.',
      userId: sultan.id, yearId: y1448.id,
    },
  })

  await db.devPlan.createMany({
    data: [
      {
        goal: 'إتقان تحليل بيانات التقويم الرقمي',
        action: 'دورة متقدمة في تحليل البيانات التربوية + تطبيق على نتائج الفصل الأول.',
        period: 'الفصل الثاني 1448هـ',
        indicator: 'تقرير تحليلي رقمي كامل لنتائج الشعبة.',
        userId: sultan.id, yearId: y1448.id,
      },
      {
        goal: 'توسيع مبادرة القراءة لتشمل المرحلة الثانوية',
        action: 'التنسيق مع مدرسة ثانوية مجاورة لتطبيق نموذج المبادرة.',
        period: 'الفصل الثاني 1448هـ',
        indicator: 'تفعيل المبادرة في مدرسة إضافية.',
        userId: sultan.id, yearId: y1448.id,
      },
      {
        goal: 'توثيق ممارساتي أولاً بأول',
        action: 'تخصيص 15 دقيقة نهاية كل أسبوع لتوثيق الإنجازات في الملف.',
        period: 'مستمر',
        indicator: 'لا يمر أسبوع دون توثيق على الأقل إنجازًا واحدًا.',
        result: 'التزمت حتى الآن — الأسبوع الخامس.',
        userId: sultan.id, yearId: y1448.id,
      },
    ],
  })

  // ═══ بيانات المعلمين الآخرين (لعرض المدير) ═════════════════
  const fatimahGoal = await db.goal.create({
    data: {
      title: 'تفعيل التجارب العملية في 70% من وحدات العلوم',
      indicator: 'عدد التجارب المنفذة فعليًا', targetValue: 70, currentValue: 55,
      scope: 'YEAR', userId: fatimah.id, yearId: fy1448.id,
    },
  })
  const f1 = await A({
    type: 'PRACTICE', title: 'المختبر المتنقل داخل الفصل', field: 'الممارسات التعليمية',
    date: daysAgo(9), description: 'نقل التجارب العلمية إلى الفصول بمعدات مصغرة.',
    studentsCount: 90, results: 'تنفيذ 12 تجربة عملية.', keywords: 'تجارب، علوم',
    status: 'COMPLETED', userId: fatimah.id, yearId: fy1448.id,
  })
  await A({
    type: 'PD', title: 'دورة السلامة المختبرية', field: 'التطوير المهني', date: daysAgo(17),
    provider: 'إدارة التعليم', hours: 8, keywords: 'سلامة، مختبر',
    status: 'COMPLETED', userId: fatimah.id, yearId: fy1448.id,
  })
  await A({
    type: 'INITIATIVE', title: 'معرض العلوم البيئي', field: 'المبادرات', date: daysAgo(11),
    beneficiariesCount: 260, keywords: 'معرض، بيئة',
    status: 'COMPLETED', userId: fatimah.id, yearId: fy1448.id,
  })
  await A({
    type: 'REMEDIAL', title: 'خطة علاجية — وحدة الخلايا', field: 'الخطط العلاجية',
    date: daysAgo(23), studentsCount: 14, preScore: 61, postScore: 79, keywords: 'خلايا، علاجي',
    status: 'COMPLETED', goalId: fatimahGoal.id, userId: fatimah.id, yearId: fy1448.id,
  })
  await A({
    type: 'COOP', title: 'لقاء تنسيقي مع معلمات المرحلة الابتدائية', field: 'التعاون المهني',
    date: daysAgo(6), keywords: 'تنسيق',
    status: 'COMPLETED', userId: fatimah.id, yearId: fy1448.id,
  })

  await A({
    type: 'PLAN', title: 'توزيع منهج الرياضيات — الفصل الأول', field: 'التخطيط للتدريس',
    date: daysAgo(28), keywords: 'توزيع، منهج',
    status: 'COMPLETED', userId: ahmed.id, yearId: ay1448.id,
  })
  await A({
    type: 'PD', title: 'ورشة: التدريس بالاستقصاء الرياضي', field: 'التطوير المهني',
    date: daysAgo(15), provider: 'مكتب التعليم', hours: 5, keywords: 'استقصاء',
    status: 'COMPLETED', userId: ahmed.id, yearId: ay1448.id,
  })
  await A({
    type: 'REMEDIAL', title: 'خطة علاجية — العمليات على الكسور', field: 'الخطط العلاجية',
    date: daysAgo(8), studentsCount: 16, preScore: 48, postScore: 66, keywords: 'كسور، علاجي',
    status: 'COMPLETED', userId: ahmed.id, yearId: ay1448.id,
  })
  await A({
    type: 'PARTICIPATION', title: 'أولمبياد الرياضيات المدرسي', field: 'المشاركات المدرسية',
    date: daysAgo(19), beneficiariesCount: 95, keywords: 'أولمبياد',
    status: 'COMPLETED', userId: ahmed.id, yearId: ay1448.id,
  })
  await A({
    type: 'PRACTICE', title: 'ألعاب رياضيات رقمية (كاهوت)', field: 'الممارسات التعليمية',
    date: daysAgo(3), studentsCount: 48, keywords: 'كاهوت، ألعاب',
    status: 'DRAFT', userId: ahmed.id, yearId: ay1448.id,
  })

  await A({
    type: 'PARTICIPATION', title: 'رحلة المتحف الوطني', field: 'المشاركات المدرسية',
    date: daysAgo(13), beneficiariesCount: 44, keywords: 'رحلة، متحف',
    status: 'COMPLETED', userId: khaled.id, yearId: ky1448.id,
  })
  await A({
    type: 'PD', title: 'ورشة المهارات الجيومكانية', field: 'التطوير المهني',
    date: daysAgo(20), provider: 'مكتب التعليم', hours: 4, keywords: 'جيومكانية',
    status: 'COMPLETED', userId: khaled.id, yearId: ky1448.id,
  })

  console.log('✓ تم إنشاء البيانات التجريبية بنجاح')
  const counts = {
    users: await db.user.count(),
    years: await db.academicYear.count(),
    goals: await db.goal.count(),
    achievements: await db.achievement.count(),
    attachments: await db.attachment.count(),
    links: await db.evidenceLink.count(),
    reflections: await db.reflection.count(),
    devPlans: await db.devPlan.count(),
  }
  console.log(counts)
}

// التنفيذ فقط عند التشغيل المباشر (bun prisma/seed.ts) — استيراد هذا الملف لا ينفّذ شيئًا أبدًا.
// import.meta.main خاصية Bun: true فقط إذا كان الملف نقطة دخول العملية.
const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => db.$disconnect())
}
