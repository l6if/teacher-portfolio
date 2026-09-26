// ═══ Demo Account Provisioning — حساب المعاينة التجريبي ═══════════════
// Idempotent بالكامل: موجود → لا يُكرر شيئًا؛ ناقص → يُكمل الناقص فقط.
// ⛔ لا deleteMany على أي بيانات — لا يمس المستخدمين الحقيقيين إطلاقًا.
// ⛔ لا يعمل بمجرد import — التنفيذ بالتشغيل المباشر فقط.
//
// العزل: مدرسة تجريبية مستقلة «مدرسة المعاينة النموذجية» + علم isDemo
//   → المعلم التجريبي يرى بياناته فقط (المعلمون دائمًا يرون ملفاتهم)
//   → المديرون الحقيقيون لا يرونه (نطاق مدارسهم مختلف)
//
// الاستخدام: bun scripts/ensure-demo-account.ts
//   DEMO_EMAIL (افتراضي demo@madrasati.sa) — DEMO_PASSWORD (قوية افتراضية تُطبع عند الإنشاء)
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'crypto'
import { hashPassword } from '../src/lib/auth'

const db = new PrismaClient()

const DEMO_EMAIL = (process.env.DEMO_EMAIL ?? 'demo@madrasati.sa').trim().toLowerCase()
const DEMO_SCHOOL = 'مدرسة المعاينة النموذجية'

function defaultDemoPassword(): string {
  // قوية ويمكن طباعتها في التقرير — 16 حرفًا بأبجدية واضحة
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@'
  const bytes = randomBytes(16)
  return `Shahid@${Array.from(bytes.slice(6), (b) => alphabet[b % alphabet.length]).join('')}`
}

const now = new Date()
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)

// أصول عامة قائمة (رسوم توضيحية — لا أشخاص حقيقيين)
const UP = '/uploads'

async function main() {
  const existing = await db.user.findUnique({ where: { email: DEMO_EMAIL } })

  if (existing) {
    const counts = await db.achievement.count({ where: { userId: existing.id } })
    if (counts > 0) {
      console.log(`الحساب التجريبي موجود وكامل: ${existing.name} <${existing.email}> — ${counts} إنجازًا. لا حاجة لأي إجراء.`)
      return
    }
    // موجود بلا بيانات (نادر) → نكمل بياناته أدناه دون إعادة إنشاء
    console.log('الحساب التجريبي موجود لكن بلا بيانات — سيُكمل الناقص فقط.')
    await populateDemoData(existing.id)
    return
  }

  const password = process.env.DEMO_PASSWORD?.trim() || defaultDemoPassword()
  const user = await db.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash: hashPassword(password),
      name: 'المعلم التجريبي',
      role: 'TEACHER',
      status: 'ACTIVE',
      gender: 'MALE',
      isDemo: true,
      school: DEMO_SCHOOL,
      educationAdmin: 'إدارة تعليم المعاينة',
      educationOffice: 'مكتب تعليم المعاينة',
      principalName: 'مدير/ة مدرسة المعاينة',
      subject: 'اللغة العربية',
      qualification: 'بكالوريوس اللغة العربية — كلية التربية',
      experienceYears: 8,
      stage: 'المرحلة المتوسطة',
      classes: 'أول متوسط (1، 2) — ثاني متوسط (3)',
      licenseNumber: 'رخصة معلم مهني — 1441هـ',
      duties: 'معلم أول — منسق برنامج القراءة المدرسي',
      weeklyLoad: 22,
      schedule: JSON.stringify([
        { day: 'الأحد', grade: 'أول متوسط', periods: 'الحصص 1 — 4' },
        { day: 'الاثنين', grade: 'ثاني متوسط', periods: 'الحصص 2 — 5' },
        { day: 'الثلاثاء', grade: 'أول متوسط', periods: 'الحصص 1 — 3' },
        { day: 'الأربعاء', grade: 'ثاني متوسط', periods: 'الحصص 1 — 4' },
        { day: 'الخميس', grade: 'نشاط القراءة', periods: 'الحصص 1 — 2' },
      ]),
      committees: JSON.stringify([
        { name: 'لجنة النشاط الطلابي', role: 'رئيس اللجنة' },
        { name: 'مجلس المعلمين', role: 'عضو' },
      ]),
      extraDuties: JSON.stringify(['الإشراف على ركن القراءة الصفي', 'تنسيق برنامج القراءة المدرسي']),
    },
  })

  await populateDemoData(user.id)
  console.log(`تم إنشاء الحساب التجريبي المعزول: <${user.email}> — مدرسة ${DEMO_SCHOOL}`)
  if (!process.env.DEMO_PASSWORD?.trim()) {
    console.log(`كلمة المرور التجريبية (تُطبع مرة واحدة): ${password}`)
  }
}

/** بيانات غنية كاملة للحساب التجريبي — لا تمس أي بيانات أخرى */
async function populateDemoData(userId: string) {
  // ═══ السنوات ═══
  const y1448 = await db.academicYear.create({ data: { label: '1448هـ', userId } })
  const y1447 = await db.academicYear.create({ data: { label: '1447هـ', userId, archived: true } })

  // ═══ الأهداف ═══
  const goal1 = await db.goal.create({
    data: {
      title: 'رفع مستوى إتقان مهارة القراءة لدى طلاب المرحلة المتوسطة',
      description: 'تحسين الطلاقة والاستيعاب القرائي من خلال خطة علاجية ومبادرة قرائية مدرسية.',
      indicator: 'نسبة إتقان مهارة القراءة في الاختبار البعدي',
      targetValue: 85,
      currentValue: 83,
      startDate: daysAgo(40),
      endDate: daysAgo(-130),
      scope: 'YEAR',
      userId,
      yearId: y1448.id,
    },
  })
  await db.goal.create({
    data: {
      title: 'توظيف استراتيجيات التعلم النشط في أغلب الدروس',
      description: 'الانتقال التدريجي من الشرح المباشر إلى الأنشطة البنائية داخل الفصل.',
      indicator: 'عدد الدروس الموظفة فيها استراتيجيات التعلم النشط',
      targetValue: 80,
      currentValue: 72,
      startDate: daysAgo(40),
      endDate: daysAgo(-110),
      scope: 'TERM2',
      userId,
      yearId: y1448.id,
    },
  })

  // ═══ الإنجازات — 1448هـ ═══
  const initiative = await db.achievement.create({
    data: {
      type: 'INITIATIVE',
      title: 'مبادرة ركن القراءة الصفي',
      field: 'المجال التعليمي',
      date: daysAgo(60),
      problem: 'تراجع الاهتمام بالقراءة الحرة لدى الطلاب وقلة المتاح من الكتب المناسبة داخل الفصول.',
      goalText: 'إحياء ثقافة القراءة الحرة عبر ركن قراءة جذاب داخل الفصل يتيح تبادل الكتب والتوصيات القرائية بين الطلاب.',
      execution: 'تجهيز الركن بمقترح الطلاب أنفسهم، وتنظيم نظام إعارة بسيط، وتخصيص عشر دقائق أسبوعيًا لعرض توصية كتاب، مع لوحة متابعة للأقرأ أكثر.',
      actions: '1) تشكيل فريق الطلاب المسؤول عن الركن\n2) تجهيز الرفوف والكتب بالتعاون مع المكتبة المدرسية\n3) إطلاق نظام الإعارة الأسبوعي\n4) جلسة توصيات قرائية كل خميس\n5) لوحة تحفيزية ومتابعة شهرية',
      beneficiaries: 'طلاب أول وثاني متوسط',
      beneficiariesCount: 96,
      results: 'ارتفاع عدد المستعيرين أسبوعيًا بشكل ملحوظ بعد الشهر الأول، وتفاعل الطلاب مع جلسات التوصيات.',
      impact: 'تحولت القراءة الحرة إلى عادة صفية جماعية، وأصبح الطلاب يتشاركون الكتب ويتنافسون في لوحة الأقرأ أكثر.',
      durationText: 'عام دراسي متواصل',
      status: 'COMPLETED',
      goalId: goal1.id,
      userId,
      yearId: y1448.id,
    },
  })

  const remedial = await db.achievement.create({
    data: {
      type: 'REMEDIAL',
      title: 'خطة علاجية لتنمية الفهم القرائي',
      field: 'المجال التعليمي',
      date: daysAgo(45),
      problem: 'ضعف الفهم القرائي لدى فئة من طلاب أول متوسط ظهر في التشخيص الأولي.',
      goalText: 'معالجة الفاقد في مهارات الفهم القرائي (الفكرة الرئيسة، الاستنتاج، التخيل) لفئة الطلاب الأقل إتقانًا.',
      execution: 'حصص علاجية أسبوعية بمجموعات صغيرة مع نصوص متدرجة وأوراق عمل قصيرة، وقياس بعدي بعد ستة أسابيع.',
      actions: '1) تشخيص قبلي بأداة قياس مصممة\n2) تقسيم الطلاب إلى مجموعات صغيرة\n3) ست جلسات علاجية أسبوعية\n4) واجبات قرائية قصيرة منزلية\n5) قياس بعدي ومقارنة النتائج',
      beneficiaries: 'طلاب أول متوسط — الفئة الأقل إتقانًا',
      studentsCount: 14,
      durationText: '6 أسابيع',
      preScore: 58,
      postScore: 81,
      results: 'تحسن الفهم القرائي للفئة المستهدفة بنسبة 23 نقطة مئوية بين القياسين القبلي والبعدي.',
      impact: 'تحسنت ثقة الطلاب بأنفسهم القرائية وانتقل أثر الخطة إلى أدائهم في باقي المواد.',
      status: 'COMPLETED',
      goalId: goal1.id,
      userId,
      yearId: y1448.id,
    },
  })

  const pd1 = await db.achievement.create({
    data: {
      type: 'PD',
      title: 'ورشة عمل: التعلم النشط داخل الفصل',
      field: 'التطوير المهني',
      date: daysAgo(80),
      provider: 'مكتب تعليم المعاينة',
      hours: 12,
      description: 'ورشة تدريبية عملية حول تصميم أنشطة التعلم النشط وربطها بأهداف الدرس.',
      goalText: 'اكتساب مهارات تصميم الأنشطة البنائية وتطبيقها في دروس اللغة العربية.',
      execution: 'حضور الورشة الكامل مع تطبيق عملي مصغر وتغذية راجعة من المدرب.',
      results: 'شهادة معتمدة 12 ساعة + خطط دروس مطبقة بالاستراتيجيات المكتسبة.',
      impact: 'تحول ملحوظ في أسلوب التخطيط من الشرح المباشر إلى الأنشطة الموجهة.',
      status: 'COMPLETED',
      userId,
      yearId: y1448.id,
    },
  })

  const practice = await db.achievement.create({
    data: {
      type: 'PRACTICE',
      title: 'استراتيجية التعلم التعاوني في دروس النصوص',
      field: 'المجال التعليمي',
      date: daysAgo(30),
      goalText: 'تنمية مهارات الحوار وتحليل النصوص عبر مجموعات تعاونية ذات أدوار محددة.',
      execution: 'تقسيم الفصل إلى مجموعات بأدوار (قائد، مقرر، ميقاتي، مراسل) وتحويل تحليل النص إلى مهمة تعاونية.',
      beneficiaries: 'طلاب ثاني متوسط',
      studentsCount: 28,
      preScore: 62,
      postScore: 79,
      results: 'ارتفاع متوسط درجات تحليل النصوص 17 نقطة مئوية بعد تطبيق الاستراتيجية ستة أسابيع.',
      impact: 'أصبح الطلاب يقودون النقاش بأنفسهم وتحسنت مهارات الإصغاء المتبادل.',
      status: 'COMPLETED',
      goalId: goal1.id,
      userId,
      yearId: y1448.id,
    },
  })

  await db.achievement.create({
    data: {
      type: 'ASSESSMENT',
      title: 'أداة قياس تشخيصية لمهارات القراءة',
      field: 'القياس والتقويم',
      date: daysAgo(50),
      goalText: 'بناء أداة تشخيص عملية تحدد مستوى كل طالب في مهارات القراءة الفرعية.',
      execution: 'تصميم الأداة (15 فقرة متدرجة) وتطبيقها فرديًا وتحليل النتائج في جدول واحد.',
      beneficiaries: 'طلاب أول متوسط',
      studentsCount: 52,
      results: 'خريطة تشخيصية واضحة حددت الفئات الثلاث ومستوياتها في كل مهارة فرعية.',
      impact: 'أصبحت الخطة العلاجية مبنية على بيانات فعلية بدل التقدير العام.',
      status: 'COMPLETED',
      userId,
      yearId: y1448.id,
    },
  })

  await db.achievement.create({
    data: {
      type: 'AWARD',
      title: 'شهادة شكر وتقدير — برنامج القراءة المدرسي',
      field: 'الإنجازات والتكريم',
      date: daysAgo(15),
      provider: 'إدارة تعليم المعاينة',
      description: 'تقدير الجهود في تنسيق برنامج القراءة المدرسي ونتائجه الظاهرة.',
      results: 'شهادة شكر رسمية على مستوى المكتب.',
      impact: 'تحفيز معنوي وتوثيق رسمي لأثر البرنامج.',
      status: 'COMPLETED',
      userId,
      yearId: y1448.id,
    },
  })

  // ═══ إنجازات مؤرشفة — 1447هـ (للرحلة المهنية) ═══
  await db.achievement.create({
    data: {
      type: 'PARTICIPATION',
      title: 'المشاركة في معرض المواهب المدرسي',
      field: 'المشاركات المدرسية',
      date: new Date(2026, 1, 12, 10, 0),
      goalText: 'إبراز مواهب الطلاب الأدبية أمام المجتمع المدرسي.',
      execution: 'الإشراف على ركن اللغة العربية وتجهيز عروض الطلاب.',
      beneficiaries: 'طلاب المرحلة المتوسطة',
      beneficiariesCount: 120,
      results: 'مشاركة فاعلة وحضور مميز لأولياء الأمور.',
      impact: 'تعزيز الثقة لدى الطلاب المشاركين.',
      status: 'COMPLETED',
      userId,
      yearId: y1447.id,
    },
  })
  await db.achievement.create({
    data: {
      type: 'PD',
      title: 'دورة: التقويم التكويني الرقمي',
      field: 'التطوير المهني',
      date: new Date(2025, 10, 3, 10, 0),
      provider: 'منصة التدريب الوطنية',
      hours: 8,
      description: 'دورة حول أدوات التقويم التكويني الرقمية وتوظيفها أثناء الحصة.',
      goalText: 'إتقان استخدام أدوات التقويم الرقمية الفورية.',
      execution: 'دورة إلكترونية مع تطبيقات عملية.',
      results: 'شهادة معتمدة 8 ساعات.',
      impact: 'دقة أعلى في رصد تعلم الطلاب أثناء الدرس.',
      status: 'COMPLETED',
      userId,
      yearId: y1447.id,
    },
  })

  // ═══ الشواهد — أصول عامة قائمة (رسوم توضيحية) ═══
  const a1 = await db.attachment.create({
    data: {
      title: 'صورة من فعاليات مبادرة ركن القراءة',
      kind: 'IMAGE',
      url: `${UP}/photo-initiative.svg`,
      keywords: 'قراءة، مبادرة، ركن القراءة',
      userId,
      yearId: y1448.id,
    },
  })
  const a2 = await db.attachment.create({
    data: {
      title: 'رسم تحسن نتائج الفهم القرائي',
      kind: 'IMAGE',
      url: `${UP}/chart-reading.svg`,
      keywords: 'قياس، تحسن، فهم قرائي',
      userId,
      yearId: y1448.id,
    },
  })
  const a3 = await db.attachment.create({
    data: {
      title: 'وثيقة الخطة العلاجية',
      kind: 'DOC',
      url: `${UP}/doc-remedial-plan.svg`,
      keywords: 'خطة علاجية، وثيقة',
      userId,
      yearId: y1448.id,
    },
  })
  const a4 = await db.attachment.create({
    data: {
      title: 'شهادة ورشة التعلم النشط',
      kind: 'IMAGE',
      url: `${UP}/cert-active-learning.svg`,
      keywords: 'شهادة، تطوير مهني، تعلم نشط',
      userId,
      yearId: y1448.id,
    },
  })
  const a5 = await db.attachment.create({
    data: {
      title: 'شهادة شكر برنامج القراءة',
      kind: 'IMAGE',
      url: `${UP}/cert-thanks.svg`,
      keywords: 'شهادة، شكر، تكريم',
      userId,
      yearId: y1448.id,
    },
  })

  // ═══ روابط الشواهد (إعادة استخدام عبر أكثر من إنجاز) ═══
  await db.evidenceLink.create({ data: { attachmentId: a1.id, achievementId: initiative.id } })
  await db.evidenceLink.create({ data: { attachmentId: a2.id, achievementId: remedial.id } })
  await db.evidenceLink.create({ data: { attachmentId: a2.id, achievementId: practice.id } })
  await db.evidenceLink.create({ data: { attachmentId: a3.id, achievementId: remedial.id } })
  await db.evidenceLink.create({ data: { attachmentId: a4.id, achievementId: pd1.id } })
  await db.evidenceLink.create({ data: { attachmentId: a5.id, goalId: goal1.id } })

  // ═══ التأمل المهني ═══
  await db.reflection.create({
    data: {
      term: 'TERM1',
      success: 'نجاح مبادرة ركن القراءة وتحولها إلى عادة صفية جماعية.',
      practice: 'المجموعات التعاونية ذات الأدوار — أثرها كان الأوضح في دروس النصوص.',
      develop: 'توظيف التقويم الرقمي الفوري بشكل أوسع.',
      nextTerm: 'تخصيص وقت أسبوعي ثابت لجلسات التوصيات القرائية بدل العرض المتقطع.',
      userId,
      yearId: y1448.id,
    },
  })

  // ═══ الخطة التطويرية ═══
  await db.devPlan.createMany({
    data: [
      {
        goal: 'إتقان أدوات التقويم التكويني الرقمي',
        action: 'تطبيق أداة واحدة أسبوعيًا ومراجعة أثرها مع زميل التخصص.',
        period: 'الفصل الثاني',
        indicator: 'سجل أسبوعي موثق للأداة ونتائجها',
        userId,
        yearId: y1448.id,
      },
      {
        goal: 'توسيع مبادرة ركن القراءة إلى بقية الفصول',
        action: 'تدريب فريق طلابي لقيادة الأركان في فصول أخرى.',
        period: 'الفصل الثاني',
        indicator: 'ثلاثة أركان جديدة تعمل بفاعلية',
        userId,
        yearId: y1448.id,
      },
    ],
  })
}

// التنفيذ فقط عند التشغيل المباشر — الاستيراد لا ينفّذ شيئًا أبدًا.
const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => db.$disconnect())
}
