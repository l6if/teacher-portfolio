// بيانات تطوير غنية لقاعدة PG المحلية فقط — للتطوير والQA حصرًا
// ⛔ حمايات: يرفض أي DATABASE_URL غير 127.0.0.1 محلي، ويرفض production.
// ينشئ: معلمًا ذكرًا غني البيانات + معلمة أنثى (اختبار الجنس) + سنة حالية ومؤرشفة
// + إنجازات تغطي سيناريوهات QA السبعة (نص قصير/متوسط/طويل × صور 0/1/2/3/6/10)
// + تصنيف إطار رسمي (3/10/39) حقيقي + أهداف + تأمل + خطة تطويرية.
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'
import { ensureOfficialFramework } from '../src/lib/official-framework'

const db = new PrismaClient()

const URL = process.env.DATABASE_URL ?? ''
if (process.env.NODE_ENV === 'production' || !URL.includes('127.0.0.1') || !URL.includes('5433')) {
  console.error('⛔ dev-dataset يعمل فقط على قاعدة التطوير المحلية 127.0.0.1:5433')
  process.exit(1)
}
if (!process.env.DEV_PASSWORD) {
  console.error('اضبط DEV_PASSWORD في البيئة (سياسة: لا كلمات مرور ثابتة في الكود).')
  process.exit(1)
}

const now = new Date()
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000)

// صور SVG ثابتة موجودة في public/uploads — تُعرض عبر /uploads/... مباشرة
const UP = '/uploads'
const IMG = {
  photoClass: `${UP}/photo-class.svg`,
  photoLab: `${UP}/photo-lab.svg`,
  photoReading: `${UP}/photo-reading.svg`,
  photoActivity: `${UP}/photo-activity.svg`,
  photoTrip: `${UP}/photo-trip.svg`,
  photoMeeting: `${UP}/photo-meeting.svg`,
  chartReading: `${UP}/chart-reading.svg`,
  chartRemedial: `${UP}/chart-remedial.svg`,
  docRemedial: `${UP}/doc-remedial-plan.svg`,
  docDistribution: `${UP}/doc-curriculum-distribution.svg`,
  certTeacherDay: `${UP}/cert-teacher-day.svg`,
  certActive: `${UP}/cert-active-learning.svg`,
  certAssessment: `${UP}/cert-assessment.svg`,
  certThanks: `${UP}/cert-thanks.svg`,
}

async function main() {
  const pw = await hashPassword(process.env.DEV_PASSWORD!)

  // الإطار الرسمي (idempotent)
  await ensureOfficialFramework(db)
  const domains = await db.domain.findMany({
    where: { isOfficial: true },
    orderBy: { sortOrder: 'asc' },
    include: { criteria: { orderBy: { sortOrder: 'asc' }, include: { subCriteria: { orderBy: { sortOrder: 'asc' } } } } },
  })
  const subOf = (di: number, ci: number, si: number) =>
    domains[di]?.criteria[ci]?.subCriteria[si]?.id ?? null
  const domainIds = domains.map((d) => d.id)

  // ─── نظف بيانات QA السابقة ───
  const qaEmails = ['sultan@madrasati.sa', 'noura@madrasati.sa']
  const old = await db.user.findMany({ where: { email: { in: qaEmails } }, select: { id: true } })
  if (old.length) {
    await db.user.deleteMany({ where: { id: { in: old.map((u) => u.id) } } })
    console.log(`أُزيل ${old.length} مستخدم QA قديم (تسلسل حذف)`)
  }

  // ─── المعلم الرئيسي — بيانات مهنية كاملة ───
  const sultan = await db.user.create({
    data: {
      email: 'sultan@madrasati.sa',
      passwordHash: pw,
      name: 'سلطان بن عبدالله الحربي',
      role: 'TEACHER',
      gender: 'MALE',
      school: 'ثانوية الفجر النموذجية',
      subject: 'الرياضيات',
      qualification: 'بكالوريوس تربية — تخصص رياضيات',
      experienceYears: 12,
      stage: 'المرحلة الثانوية',
      classes: 'أول ثانوي — ثاني ثانوي — ثالث ثانوي',
      licenseNumber: 'MOE-2019-44210',
      duties: 'معلم رياضيات + رائد نشاط + عضو لجنة التقويم',
      weeklyLoad: 24,
      educationAdmin: 'الإدارة العامة للتعليم بمحافظة الحديقة',
      educationOffice: 'مكتب التعليم بشرق الحديقة',
      principalName: 'عبدالرحمن بن سعيد الزهراني',
      years: {
        create: [
          { label: '1448هـ', archived: false },
          { label: '1447هـ', archived: true },
        ],
      },
    },
    include: { years: true },
  })
  const year = sultan.years.find((y) => !y.archived)!
  const lastYear = sultan.years.find((y) => y.archived)!

  // ─── المعلمة — لاختبار الجنس المؤنث ───
  const noura = await db.user.create({
    data: {
      email: 'noura@madrasati.sa',
      passwordHash: pw,
      name: 'نورة بنت محمد القحطاني',
      role: 'TEACHER',
      gender: 'FEMALE',
      school: 'متوسطـة الهدى',
      subject: 'اللغة العربية',
      qualification: 'بكالوريوس لغة عربية',
      experienceYears: 8,
      stage: 'المرحلة المتوسطة',
      educationAdmin: 'الإدارة العامة للتعليم بمحافظة الحديقة',
      principalName: 'فاطمة بنت علي السالم',
      years: { create: [{ label: '1448هـ', archived: false }] },
    },
  })
  const nouraYear = await db.academicYear.findFirstOrThrow({ where: { userId: noura.id } })

  // ─── الأهداف المهنية ───
  const goal1 = await db.goal.create({
    data: {
      userId: sultan.id, yearId: year.id,
      title: 'رفع نتيجة اختبار الرياضيات الدولي TIMSS للصف الثالث الثانوي',
      description: 'خطة سنوية لرفع متوسط الأداء في الاختبارات المعيارية الدولية عبر تدريبات مكثفة وتقويم مستمر.',
      indicator: 'متوسط الدرجات',
      targetValue: 85, currentValue: 78,
    },
  })
  const goal2 = await db.goal.create({
    data: {
      userId: sultan.id, yearId: year.id,
      title: 'توثيق 30% من الممارسات الصفية بشواهد رقمية',
      description: 'تحويل ملف الإنجاز إلى أرشيف رقمي حي يخدم التقويم الذاتي.',
      indicator: 'نسبة التوثيق',
      targetValue: 30, currentValue: 21,
    },
  })

  // ─── مرفقات (شواهد) ───
  const att = async (data: { title: string; kind: string; url?: string; fileName?: string; fileSize?: number; reportDisplaySize?: string }) =>
    (await db.attachment.create({ data: { ...data, userId: sultan.id, yearId: year.id } })).id

  const aPhotoClass = await att({ title: 'صورة من الحصة الافتتاحية', kind: 'IMAGE', url: IMG.photoClass })
  const aPhotoLab = await att({ title: 'توثيق تجربة المعمل', kind: 'IMAGE', url: IMG.photoLab })
  const aPhotoReading = await att({ title: 'ركن القراءة الرياضية', kind: 'IMAGE', url: IMG.photoReading })
  const aPhotoActivity = await att({ title: 'نشاط الإذاعة الصباحية', kind: 'IMAGE', url: IMG.photoActivity })
  const aPhotoTrip = await att({ title: 'الرحلة العلمية', kind: 'IMAGE', url: IMG.photoTrip })
  const aPhotoMeeting = await att({ title: 'اجتماع لجنة التقويم', kind: 'IMAGE', url: IMG.photoMeeting })
  const aChartReading = await att({ title: 'نتائج قياس القراءة الرياضية', kind: 'IMAGE', url: IMG.chartReading })
  const aChartRemedial = await att({ title: 'مقارنة قبل/بعد الخطة العلاجية', kind: 'IMAGE', url: IMG.chartRemedial })
  const aCertTeacherDay = await att({ title: 'شهادة التميز في يوم المعلم', kind: 'CERTIFICATE' as string, url: IMG.certTeacherDay })
  const aDocRemedial = await att({ title: 'وثيقة الخطة العلاجية المعتمدة', kind: 'DOC', fileName: 'plan.pdf', fileSize: 284000, url: IMG.docRemedial })
  const aLinkPlatform = await att({ title: 'منصة مدرستي — فصل الرياضيات', kind: 'LINK', url: 'https://schools.madrasati.sa' })

  // ─── الإنجازات — تغطية سيناريوهات QA السبعة ───
  const A = (data: object) => db.achievement.create({ data: { ...data, userId: sultan.id, yearId: year.id } as never })
  const link = (attachmentId: string, achievementId: string) =>
    db.evidenceLink.create({ data: { attachmentId, achievementId } }).catch(() => {})

  // CASE 1: نص قصير + صورة واحدة → صفحة واحدة
  const case1 = await A({
    type: 'PRACTICE', title: 'توظيف التعلم النشط في درس المتتابعات',
    date: daysAgo(40), status: 'COMPLETED',
    description: 'درس تطبيقي بأسلوب التعلم النشط لتفعيل المشاركة الصفية.',
    goalText: 'رفع معدل المشاركة الصفية في حصص الرياضيات.',
    execution: 'بدأت الدرس بتهيئة قصيرة، ثم وُزّع الطلاب إلى مجموعات تعاونية بأدوار محددة، وخُتم الدرس بتقويم ختامي قصير.',
    results: 'ارتفعت المشاركة الصفية بشكل ملحوظ خلال أسبوعين.',
    impact: 'أصبح الطلاب أكثر استعدادًا لطرح الحلول ونقاشها.',
    problem: 'ضعف المشاركة الصفية في بداية الفصل الدراسي.',
    domainId: domainIds[0], subCriterionId: subOf(0, 0, 0),
    studentsCount: 28, beneficiariesCount: 28,
  })
  await link(aPhotoClass, case1.id)
  await db.achievement.update({ where: { id: case1.id }, data: { goalId: goal2.id } })

  // CASE 2: نص متوسط + 3 صور → صفحة واحدة غالبًا
  const case2 = await A({
    type: 'INITIATIVE', title: 'مبادرة ركن القراءة الرياضية',
    date: daysAgo(60), status: 'COMPLETED',
    description: 'مبادرة لإنشاء ركن دائم للكتب الرياضية داخل الفصل يخدم القراءة العلمية الذاتية.',
    problem: 'ضعف الثقافة الرياضية وندرة مصادر القراءة العلمية في المدرسة.',
    goalText: 'إيجاد مساحة دائمة تشجع الطلاب على القراءة العلمية الذاتية.',
    execution: 'جرى اختيار زاوية هادئة داخل الفصل وتجهيزها برفوف وأغطية، ثم اختيرت 45 كتابًا ومرجعًا رياضيًا مبسطًا مناسبة للمرحلة الثانوية، وعُيّن طالبان مسؤولان عن النظام والإعارة كل أسبوعين، وأُطلق مسابقة شهرية لأفضل مراجعة لكتاب مقروء.',
    results: 'استعار 96 طالبًا 210 كتابًا خلال الفصل الدراسي الأول.',
    impact: 'ارتفع متوسط درجات الاستيعاب القرائي في مادة الرياضيات.',
    notes: 'اعتُمدت المبادرة ضمن خطة المدرسة للعام القادم.',
    domainId: domainIds[1], subCriterionId: subOf(1, 0, 0),
    beneficiaries: 'طلبة المدرسة', beneficiariesCount: 96,
    durationText: 'عام دراسي كامل',
  })
  for (const a of [aPhotoReading, aPhotoActivity, aChartReading]) await link(a, case2.id)
  await db.achievement.update({ where: { id: case2.id }, data: { goalId: goal1.id } })

  // CASE 3: نص متوسط + 6 صور → Grid مضغوط أو صفحتان
  const case3 = await A({
    type: 'ACTIVITY', title: 'أسبوع الرياضيات الأول',
    date: daysAgo(75), status: 'COMPLETED',
    description: 'برنامج أسبوعي متنوع الفعاليات لإحياء ثقافة الرياضيات في المدرسة.',
    problem: 'النظرة السلبية العامة تجاه مادة الرياضيات.',
    goalText: 'تغيير الصورة الذهنية عن الرياضيات وتحويلها إلى مادة ممتعة.',
    execution: 'شمل الأسبوع معرض ملصقات علمية، ومسابقة حساب ذهني بين الصفوف، ومحاضرة عن الرياضيات في الحضارة الإسلامية، وبازار الألغاز المنطقية، ورحلة علمية مصغرة، وحفل ختامي برعاية إدارة المدرسة.',
    results: 'مشاركة 320 طالبًا في فعاليات الأسبوع.',
    impact: 'ارتفع الطلب على النادي الرياضي المدرسي بعد الأسبوع.',
    domainId: domainIds[2], subCriterionId: subOf(2, 0, 0),
    beneficiaries: 'طلبة المدرسة كافة', beneficiariesCount: 320,
    durationText: 'أسبوع',
  })
  for (const a of [aPhotoClass, aPhotoLab, aPhotoReading, aPhotoActivity, aPhotoTrip, aChartReading]) await link(a, case3.id)

  // CASE 4: نص طويل جدًا + صورتان → صفحتان (لا تصغير نص مزعج)
  const longExecution = [
    'استُهل المشروع بدراسة تشخيصية شاملة لأسباب التعثر في وحدة الدوال، شملت تحليل نتائج الاختبارات الشهرية الثلاث السابقة ومقابلات قصيرة مع عينة من الطلاب المتعثرين ومراجعة دفاتر الواجبات.',
    'بناءً على التشخيص قُسّمت المنهجية إلى ثلاث مراحل متتابعة: مرحلة معالجة الفجوات الأساسية في المفاهيم التأسيسية، ثم مرحلة البناء التدريجي لمفهوم الدالة بادئين بالنماذج المحسوسة قبل التمثيل المجرد، وأخيرًا مرحلة التطبيق والتعمق عبر مسائل سياقية حياتية.',
    'في المرحلة الأولى خُصصت ست حصص علاجية مكثفة صباحية استُخدمت فيها بطاقات تعلم ذاتي متدرجة الصعوبة، مع متابعة يومية لمؤشر الإتقان لكل مفهوم تأسيسي، ولم ينتقل أي طالب إلى المفهوم التالي قبل بلوغه 80% في بطاقة الإتقان.',
    'في المرحلة الثانية جرى توظيف منصة مدرستي لتسجيل مقاطع شرح قصيرة يستعرضها الطلاب من المنزل قبل الحصة ( التعلم المقلوب)، فأصبح وقت الحصة متاحًا للممارسة التطبيقية supervised داخل الفصل مع توزيع المهام وفق مستويات الإتقان الثلاثة.',
    'في المرحلة الثالثة صُممت مشروعات مصغرة يطبق فيها الطلاب مفهوم الدالة على سياقات حقيقية: نمذجة فاتورة الكهرباء المنزلية، وتحليل منحنى نمو نبتة في مختبر الأحياء، ودراسة علاقة سرعة السيارة بمسافة الفرملة، وعرضت المشروعات في معرض مصغر نهاية الوحدة.',
    'قُيّم الأثر عبر اختبار قبلي وبعدي موحد صممه فريق المادة وراجعته منسقة التقويم، بالإضافة إلى استبانة اتجاهات قيست قبل بدء المشروع وبعده بشهرين كاملين.',
  ].join('\n')
  const case4 = await A({
    type: 'REMEDIAL', title: 'برنامج معالجة التعثر في وحدة الدوال واللوغاريتمات',
    date: daysAgo(30), status: 'COMPLETED',
    description: 'برنامج علاجي مكثف ممتد لمعالجة ضعف شامل في أساسيات وحدة الدوال.',
    problem: 'ضعف كبير في المفاهيم التأسيسية للدوال لدى 34% من طلاب الصف الثالث الثانوي، ظهر جليًا في تحليل الاختبارات الشهرية وتعطل معه تقدم الوحدة.',
    goalText: 'خفض نسبة المتعثرين إلى أقل من 10% قبل اختبار منتصف الفصل.',
    execution: longExecution,
    results: 'انخفضت نسبة المتعثرين من 34% إلى 8% في اختبار نهاية الوحدة الموحد.',
    impact: 'تحسن جوهري في ثقة الطلاب الذاتية تجاه المادة وارتفاع ملحوظ في المشاركة الطوعية بالحل على السبورة.',
    notes: 'وُثق البرنامج كاملًا ليكون نموذجًا قابلًا للتعميم على بقية الشعب.',
    domainId: domainIds[2], subCriterionId: subOf(2, 1, 0),
    studentsCount: 42, preScore: 41, postScore: 78,
    durationText: 'ستة أسابيع', provider: 'لجنة التقويم بالمدرسة',
  })
  for (const a of [aChartRemedial, aDocRemedial]) await link(a, case4.id)

  // CASE 5: Screenshot طويل → contain قابل للقراءة
  const case5 = await A({
    type: 'ASSESSMENT', title: 'نظام متابعة التقويم المستمر الرقمي',
    date: daysAgo(20), status: 'COMPLETED',
    description: 'أتمتة رصد درجات التقويم المستمر ومتابعة نمو كل طالب رقميًا.',
    goalText: 'توفر لوحة متابعة فورية لأداء كل طالب طول الفصل.',
    execution: 'بُنيت قاعدة بيانات بسيطة تربط درجات كل طالب بمؤشرات إتقان المهارات، وتولّد تقريرًا أسبوعيًا آليًا يشارك مع ولي الأمر عبر منصة مدرستي.',
    results: 'اختُصر زمن الرصد الأسبوعي من ساعتين إلى عشر دقائق.',
    impact: 'أصبح تدخل الدعم موجهًا بالبيانات لا بالانطباع.',
    domainId: domainIds[1], subCriterionId: subOf(1, 1, 0),
    studentsCount: 118,
  })
  await link(aChartReading, case5.id)

  // CASE 6: بلا شواهد → لا فراغ ضخم
  const case6 = await A({
    type: 'COOP', title: 'تعاون مهني مع قسم الفيزياء في وحدة النمذجة',
    date: daysAgo(15), status: 'COMPLETED',
    description: 'تنسيق مشترك بين قسمي الرياضيات والفيزياء لدراسة النمذجة الرياضية للظواهر الفيزيائية.',
    goalText: 'ربط المفاهيم الرياضية بتطبيقاتها الفيزيائية بشكل مباشر.',
    execution: 'حصص مشتركة أسبوعية بقيادة معلمي المادتين مع مشروع مشترك.',
    results: 'ارتفع أداء الطلاب في أسئلة النمذجة بالاختبارات الموحدة.',
    domainId: domainIds[0], subCriterionId: subOf(0, 1, 0),
    studentsCount: 55,
  })

  // CASE 7: 10 شواهد → Pagination محترمة
  const case7 = await A({
    type: 'ENRICHMENT', title: 'نادي الرياضيات الإثرائي الفصلي',
    date: daysAgo(10), status: 'COMPLETED',
    description: 'نشاط إثرائي أسبوعي للطلاب المتميزين يغطي ألغاز ومنافسات ومشروعات بحث مصغرة.',
    problem: 'غياب مسار تحدٍ للطلاب المتميزين داخل اليوم الدراسي.',
    goalText: 'إشباع حاجات الطلاب المتميزين وتأهيلهم لمنافسات الموهوبين.',
    execution: 'لقاء أسبوعي لمدة ساعتين يتنوع بين حل ألغاز منطقية، وتدريب على أسئلة أولمبياد الرياضيات، ومشروع بحث مصغر يقدمه الطالب نهاية الفصل أمام أولياء الأمور.',
    results: 'تأهل ثلاثة طلاب للمرحلة النهائية لأولمبياد المنطقة.',
    impact: 'نمو ثقافة التنافس العلمي البناء داخل المدرسة.',
    domainId: domainIds[2], subCriterionId: subOf(2, 2, 0),
    beneficiaries: 'الطلاب المتميزون', beneficiariesCount: 24, durationText: 'فصل دراسي كامل',
  })
  for (const a of [aPhotoClass, aPhotoLab, aPhotoReading, aPhotoActivity, aPhotoTrip, aPhotoMeeting, aChartReading, aChartRemedial, aDocRemedial, aLinkPlatform]) await link(a, case7.id)

  // تكريم — لقسم التكريم والشهادات
  const award = await A({
    type: 'AWARD', title: 'المركز الأول في مسابقة المعلم المتميز على مستوى المكتب',
    date: daysAgo(50), status: 'APPROVED',
    description: 'تكريم على مستوى مكتب التعليم تقديرًا للممارسات التقويمية المبتكرة.',
    provider: 'مكتب التعليم بشرق الحديقة',
    results: 'شهادة تقدير ودرع المكتب.',
    domainId: domainIds[0], subCriterionId: subOf(0, 0, 1),
  })
  await link(aCertTeacherDay, award.id)

  // تدريب مهني — لقسم التطوير المهني
  const pd1 = await A({
    type: 'PD', title: 'برنامج التقويم للأداء المبني على الأدلة',
    date: daysAgo(90), status: 'COMPLETED',
    description: 'برنامج تدريبي معتمد عن بناء أدوات التقويم وربطها بالأدلة.',
    provider: 'المركز الوطني للتعلم الإلكتروني', hours: 12,
    durationText: 'أسبوعان (12 ساعة)',
    impact: 'أعيدت هيكلة أدوات التقويم في مادة الرياضيات بالكامل وفق مخرجات البرنامج.',
    domainId: domainIds[1], subCriterionId: subOf(1, 2, 0),
  })
  const pd2 = await A({
    type: 'PD', title: 'مهارات إدارة الفصل المقلوب',
    date: daysAgo(120), status: 'COMPLETED',
    provider: 'منصة مدرستي — مسار التطوير المهني', hours: 6,
    durationText: '6 ساعات',
    impact: 'طُبق التعلم المقلوب في وحدة الدوال كاملة.',
    domainId: domainIds[1], subCriterionId: subOf(1, 2, 1),
  })
  const pd3 = await A({
    type: 'CERTIFICATE', title: 'شهادة مدرب معتمد في استراتيجيات التعلم النشط',
    date: daysAgo(200), status: 'COMPLETED',
    provider: 'كلية التربية — جامعة المدينة', hours: 20,
    durationText: '5 أيام (20 ساعة)',
    results: 'اعتماد تدريب الزملاء داخل المدرسة.',
    domainId: domainIds[1], subCriterionId: subOf(1, 2, 2),
  })

  // العام المؤرشف — إنجاز واحد لاختبار سنة مؤرشفة
  await db.achievement.create({
    data: {
      userId: sultan.id, yearId: lastYear.id,
      type: 'PRACTICE', title: 'تجربة سنة سابقة: مختبر الرياضيات المحمول',
      date: new Date(2026, 2, 15), status: 'COMPLETED',
      description: 'فكرة محمول تعليمي متنقل بين الفصول في العام الماضي.',
      execution: 'جرى تجهيز حقيبة تحتوي أدوات ملموسة لنقلها بين الصفوف.',
      domainId: domainIds[2], subCriterionId: subOf(2, 0, 1),
    },
  })

  // ─── التأمل المهني ───
  await db.reflection.create({
    data: {
      userId: sultan.id, yearId: year.id, term: 'TERM1',
      success: 'أكبر نجاح كان رؤية طالب متعثر يشرح الدوال لزملائه في معرض المشروعات بعد ثمانية أسابيع فقط من البرنامج العلاجي.',
      practice: 'التعلم المقلوب المقرون ببطاقات الإتقان المتدرجة — أثبت أسرع أثر ملحوظ على الفهم العميق.',
      develop: 'التقويم التكويني الرقمي: أطمح لأتمتة كاملة لرصد الأداء المهاري الأسبوعي.',
      nextTerm: 'توسيع برنامج معالجة التعثر ليشمل وحدتي الهندسة والاحتمالات بمنهجية موحدة قابلة للتعميم.',
    },
  })

  // ─── الخطة التطويرية ───
  await db.devPlan.createMany({
    data: [
      { userId: sultan.id, yearId: year.id, goal: 'إتقان أدوات التحليلات التربوية', action: 'إنجاز مسار تحليلات البيانات التعليمية', period: 'الفصل الأول', indicator: 'شهادة المسار', result: 'منجز' },
      { userId: sultan.id, yearId: year.id, goal: 'بناء بنك أسئلة موصفوفة', action: 'بنك 200 سؤال موصوف بالمهارة والمستوى', period: 'العام كامل', indicator: 'اكتمال البنك', result: 'قيد التنفيذ' },
      { userId: sultan.id, yearId: year.id, goal: 'قيادة مجتمع تعلم مهني', action: 'تيسير لقاء شهري لقسم الرياضيات', period: 'العام كامل', indicator: '8 لقاءات موثقة', result: 'منجز' },
    ],
  })

  // ─── إنجاز للمعلمة نورة (جنس مؤنث) — تقرير رسمي أنثوي ───
  await db.achievement.create({
    data: {
      userId: noura.id, yearId: nouraYear.id,
      type: 'INITIATIVE', title: 'مبادرة إذاعة القلم العربي',
      date: daysAgo(25), status: 'COMPLETED',
      description: 'إذاعة صباحية أسبوعية يقودها الطلاب بنصوص أدبية من تأليفهم.',
      problem: 'ضعف الثقة في التعبير الكتابي أمام الجمهور.',
      goalText: 'تهيئة منبر آمن للتعبير الأدبي الحر.',
      execution: 'تناوب الصفوف على الإعداد والتقديم بإشراف معلمة اللغة العربية.',
      results: 'قدّم 140 طالبًا نصوصًا من تأليفهم خلال الفصل.',
      impact: 'تحسن واضح في درجات التعبير الكتابي بالموازنة القبلية/البعدية.',
      domainId: domainIds[0], subCriterionId: subOf(0, 0, 2),
      studentsCount: 140, preScore: 55, postScore: 74,
    },
  })

  const counts = await Promise.all([
    db.user.count(), db.achievement.count(), db.attachment.count(),
    db.goal.count(), db.devPlan.count(),
  ])
  console.log('✓ dev dataset جاهز:', { users: counts[0], achievements: counts[1], attachments: counts[2], goals: counts[3], devPlans: counts[4] })
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
