// ثوابت النظام — المجالات، أنواع الإنجازات، الحالات، الحقول الديناميكية

export type SectionKey =
  | 'profile' | 'assignment' | 'goals' | 'planning' | 'practices'
  | 'assessment' | 'outcomes' | 'remedial' | 'enrichment' | 'development'
  | 'initiatives' | 'participation' | 'cooperation' | 'awards'
  | 'reflection' | 'devplan'

export type AchievementType =
  | 'PRACTICE' | 'REMEDIAL' | 'ENRICHMENT' | 'PD' | 'INITIATIVE'
  | 'AWARD' | 'PARTICIPATION' | 'CERTIFICATE' | 'ACTIVITY'
  | 'ASSESSMENT' | 'PLAN' | 'COOP' | 'OTHER'

export type AchievementStatus = 'DRAFT' | 'COMPLETED' | 'NEEDS_WORK' | 'APPROVED'

export interface SectionDef {
  key: SectionKey
  title: string
  short: string
  desc: string
  icon: string
  /** المجالات المبنية على الإنجازات */
  content?: boolean
  /** أنواع الإنجاز المرتبطة بهذا المجال */
  types?: AchievementType[]
}

export const SECTIONS: SectionDef[] = [
  { key: 'profile', title: 'البيانات المهنية', short: 'بياناتك', desc: 'هويتك المهنية: المؤهل، الخبرة، الرخصة، والمهام.', icon: 'UserRound' },
  { key: 'assignment', title: 'التكليف والنصاب', short: 'التكليف', desc: 'جدولك الدراسي، نصابك، اللجان والمهام الإضافية.', icon: 'CalendarDays' },
  { key: 'goals', title: 'الأهداف المهنية', short: 'الأهداف', desc: 'أهدافك السنوية والفصلية ومؤشرات قياسها وتقدمها.', icon: 'Target', content: true },
  { key: 'planning', title: 'التخطيط للتدريس', short: 'التخطيط', desc: 'الخطط الفصلية، توزيع المنهج، والتحضيرات الأسبوعية.', icon: 'NotebookPen', content: true, types: ['PLAN'] },
  { key: 'practices', title: 'الممارسات التعليمية', short: 'الممارسات', desc: 'التعلم النشط، التعاوني، المشاريع، والتقنية في التعليم.', icon: 'Lightbulb', content: true, types: ['PRACTICE'] },
  { key: 'assessment', title: 'القياس والتقويم', short: 'التقويم', desc: 'الاختبارات، التقويم التكويني، أدوات القياس وتحليل النتائج.', icon: 'ClipboardCheck', content: true, types: ['ASSESSMENT'] },
  { key: 'outcomes', title: 'نواتج التعلم', short: 'النواتج', desc: 'أثر تعليمك مقيسًا: قبلي، بعدي، ونسبة التحسن.', icon: 'TrendingUp', content: true, types: ['REMEDIAL', 'ENRICHMENT', 'PRACTICE', 'ASSESSMENT'] },
  { key: 'remedial', title: 'الخطط العلاجية', short: 'العلاجية', desc: 'خطط معالجة الفاقد التعليمي والضعف المهاري.', icon: 'HeartPulse', content: true, types: ['REMEDIAL'] },
  { key: 'enrichment', title: 'برامج الإثراء', short: 'الإثراء', desc: 'برامج الطلاب المتفوقين والموهوبين.', icon: 'Sparkles', content: true, types: ['ENRICHMENT'] },
  { key: 'development', title: 'التطوير المهني', short: 'التطوير', desc: 'الدورات، الورش، اللقاءات، وساعاتك التدريبية.', icon: 'GraduationCap', content: true, types: ['PD'] },
  { key: 'initiatives', title: 'المبادرات', short: 'المبادرات', desc: 'مبادراتك المدرسية من الفكرة إلى الأثر.', icon: 'Rocket', content: true, types: ['INITIATIVE'] },
  { key: 'participation', title: 'المشاركات المدرسية', short: 'المشاركات', desc: 'المناسبات، البرامج، المسابقات، والأيام العالمية.', icon: 'School', content: true, types: ['PARTICIPATION', 'ACTIVITY'] },
  { key: 'cooperation', title: 'التعاون المهني', short: 'التعاون', desc: 'الاجتماعات، المجتمعات المهنية، وتبادل الزيارات.', icon: 'Users', content: true, types: ['COOP'] },
  { key: 'awards', title: 'الإنجازات والتكريم', short: 'التكريم', desc: 'شهاداتك وتكريمك على خط زمني جميل.', icon: 'Trophy', content: true, types: ['AWARD', 'CERTIFICATE'] },
  { key: 'reflection', title: 'التأمل المهني', short: 'التأمل', desc: 'أربعة أسئلة قصيرة تلخص فصلك الدراسي.', icon: 'PenLine', content: true },
  { key: 'devplan', title: 'الخطة التطويرية', short: 'الخطة', desc: 'أهدافك التطويرية للفصل القادم ومؤشرات نجاحها.', icon: 'Map', content: true },
]

export const SECTION_MAP: Record<string, SectionDef> = Object.fromEntries(
  SECTIONS.map((s) => [s.key, s]),
)

export interface TypeDef {
  key: AchievementType
  label: string
  section: SectionKey
  icon: string
  desc: string
}

export const TYPES: TypeDef[] = [
  { key: 'PRACTICE', label: 'ممارسة تعليمية', section: 'practices', icon: 'Lightbulb', desc: 'استراتيجية أو نشاط نفذته داخل الفصل' },
  { key: 'REMEDIAL', label: 'خطة علاجية', section: 'remedial', icon: 'HeartPulse', desc: 'معالجة ضعف مهارة لدى فئة من الطلاب' },
  { key: 'ENRICHMENT', label: 'برنامج إثرائي', section: 'enrichment', icon: 'Sparkles', desc: 'توسعة للمتفوقين والموهوبين' },
  { key: 'PD', label: 'تطوير مهني', section: 'development', icon: 'GraduationCap', desc: 'دورة، ورشة، لقاء، أو مؤتمر' },
  { key: 'INITIATIVE', label: 'مبادرة', section: 'initiatives', icon: 'Rocket', desc: 'فكرة قادتها لمعالجة حاجة' },
  { key: 'AWARD', label: 'إنجاز وتكريم', section: 'awards', icon: 'Trophy', desc: 'تكريم أو فوز أو تقدير' },
  { key: 'PARTICIPATION', label: 'مشاركة', section: 'participation', icon: 'School', desc: 'مناسبة، برنامج، يوم عالمي' },
  { key: 'CERTIFICATE', label: 'شهادة', section: 'awards', icon: 'Award', desc: 'شهادة أو اعتماد مهني' },
  { key: 'ACTIVITY', label: 'نشاط', section: 'participation', icon: 'PartyPopper', desc: 'نشاط طلابي أو مدرسي' },
  { key: 'ASSESSMENT', label: 'تقويم وقياس', section: 'assessment', icon: 'ClipboardCheck', desc: 'اختبار، أداة قياس، تحليل نتائج' },
  { key: 'COOP', label: 'تعاون مهني', section: 'cooperation', icon: 'Users', desc: 'اجتماع، زيارة، مجتمع مهني' },
  { key: 'OTHER', label: 'أخرى', section: 'planning', icon: 'CircleDashed', desc: 'أي عمل مهني آخر' },
]

export const TYPE_MAP: Record<string, TypeDef> = Object.fromEntries(
  TYPES.map((t) => [t.key, t]),
)

export const TYPE_LABEL = (key: string) => TYPE_MAP[key]?.label ?? 'إنجاز'
export const TYPE_ICON = (key: string) => TYPE_MAP[key]?.icon ?? 'CircleDashed'
export const TYPE_SECTION = (key: string) => TYPE_MAP[key]?.section ?? 'planning'

export const STATUS_META: Record<AchievementStatus, { label: string; tone: string }> = {
  DRAFT: { label: 'مسودة', tone: 'muted' },
  COMPLETED: { label: 'مكتمل', tone: 'success' },
  NEEDS_WORK: { label: 'يحتاج استكمالًا', tone: 'warning' },
  APPROVED: { label: 'معتمد', tone: 'info' },
}

export const STATUS_LABEL = (s: string) => STATUS_META[s as AchievementStatus]?.label ?? s

// ─── تعريف حقول النموذج حسب النوع ────────────────────────────
export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'score-pair' | 'hours' | 'beneficiaries'
  placeholder?: string
  hint?: string
  optional?: boolean
  span?: 1 | 2
}

const F = {
  title: { key: 'title', label: 'عنوان الإنجاز', type: 'text', placeholder: 'مثال: خطة علاجية لتنمية مهارات الضرب', span: 2 } as FieldDef,
  date: { key: 'date', label: 'التاريخ', type: 'date', optional: true } as FieldDef,
  description: { key: 'description', label: 'وصف مختصر', type: 'textarea', placeholder: 'سطران يلخصان ما قمت به…', optional: true, span: 2 } as FieldDef,
  goalText: { key: 'goalText', label: 'الهدف من الإنجاز', type: 'textarea', placeholder: 'ما الذي أردت تحقيقه؟', span: 2 } as FieldDef,
  problem: { key: 'problem', label: 'المشكلة أو الحاجة', type: 'textarea', placeholder: 'ما الوضع الذي انطلقت منه؟', span: 2 } as FieldDef,
  execution: { key: 'execution', label: 'ماذا نُفِّذ؟ وكيف؟', type: 'textarea', placeholder: 'طريقة التنفيذ خطوة بخطوة…', span: 2 } as FieldDef,
  actions: { key: 'actions', label: 'مراحل التنفيذ', type: 'textarea', placeholder: 'المرحلة 1 — المرحلة 2 — …', optional: true, span: 2 } as FieldDef,
  beneficiaries: { key: 'beneficiaries', label: 'الفئة المستفيدة', type: 'text', placeholder: 'مثال: طلاب الصف السابع', optional: true } as FieldDef,
  studentsCount: { key: 'studentsCount', label: 'عدد الطلاب', type: 'number', placeholder: '0', optional: true } as FieldDef,
  beneficiariesCount: { key: 'beneficiariesCount', label: 'عدد المستفيدين', type: 'number', placeholder: '0', optional: true } as FieldDef,
  durationText: { key: 'durationText', label: 'مدة التنفيذ', type: 'text', placeholder: 'مثال: 4 أسابيع', optional: true } as FieldDef,
  prePost: { key: 'prePost', label: 'القياس القبلي والبعدي', type: 'score-pair', optional: true, span: 2 } as FieldDef,
  results: { key: 'results', label: 'النتائج', type: 'textarea', placeholder: 'ماذا وجدت بعد التنفيذ؟', span: 2 } as FieldDef,
  impact: { key: 'impact', label: 'الأثر', type: 'textarea', placeholder: 'ما الذي تغيّر فعلًا؟', span: 2 } as FieldDef,
  notes: { key: 'notes', label: 'ملاحظات', type: 'textarea', placeholder: 'أي ملاحظة تود إضافتها…', optional: true, span: 2 } as FieldDef,
  provider: { key: 'provider', label: 'الجهة', type: 'text', placeholder: 'مثال: مكتب التعليم', optional: true } as FieldDef,
  hours: { key: 'hours', label: 'عدد الساعات', type: 'hours', placeholder: '0', optional: true } as FieldDef,
  keywords: { key: 'keywords', label: 'كلمات مفتاحية', type: 'text', placeholder: 'مثال: قراءة، تعاوني، تقويم', optional: true, span: 2, hint: 'تساعدك في البحث لاحقًا — افصل بينها بفاصلة' } as FieldDef,
}

export const TYPE_FIELDS: Record<AchievementType, FieldDef[]> = {
  PRACTICE: [F.title, F.date, F.goalText, F.execution, F.beneficiaries, F.studentsCount, F.prePost, F.results, F.impact, F.keywords, F.notes],
  REMEDIAL: [F.title, F.date, F.problem, F.goalText, F.beneficiaries, F.studentsCount, F.durationText, F.execution, F.actions, F.prePost, F.results, F.impact, F.keywords, F.notes],
  ENRICHMENT: [F.title, F.date, F.problem, F.goalText, F.beneficiaries, F.studentsCount, F.durationText, F.execution, F.prePost, F.results, F.impact, F.keywords, F.notes],
  PD: [F.title, F.date, F.provider, F.hours, F.description, F.goalText, F.execution, F.results, F.impact, F.keywords, F.notes],
  INITIATIVE: [F.title, F.date, F.problem, F.goalText, F.beneficiaries, F.beneficiariesCount, F.durationText, F.actions, F.execution, F.results, F.impact, F.keywords, F.notes],
  AWARD: [F.title, F.date, F.provider, F.description, F.results, F.impact, F.keywords],
  CERTIFICATE: [F.title, F.date, F.provider, F.description, F.results, F.keywords],
  PARTICIPATION: [F.title, F.date, F.goalText, F.execution, F.beneficiaries, F.beneficiariesCount, F.durationText, F.results, F.impact, F.keywords],
  ACTIVITY: [F.title, F.date, F.goalText, F.execution, F.beneficiaries, F.beneficiariesCount, F.durationText, F.results, F.impact, F.keywords],
  ASSESSMENT: [F.title, F.date, F.goalText, F.execution, F.beneficiaries, F.studentsCount, F.prePost, F.results, F.impact, F.keywords, F.notes],
  PLAN: [F.title, F.date, F.goalText, F.durationText, F.execution, F.results, F.impact, F.keywords, F.notes],
  COOP: [F.title, F.date, F.goalText, F.execution, F.beneficiaries, F.durationText, F.results, F.impact, F.keywords, F.notes],
  OTHER: [F.title, F.date, F.description, F.goalText, F.execution, F.results, F.impact, F.keywords, F.notes],
}

// أنواع الإضافة السريعة من الصفحة الرئيسية
export const QUICK_ADD: { type: AchievementType; label: string; icon: string }[] = [
  { type: 'PRACTICE', label: 'ممارسة تعليمية', icon: 'Lightbulb' },
  { type: 'REMEDIAL', label: 'خطة علاجية', icon: 'HeartPulse' },
  { type: 'PD', label: 'تطوير مهني', icon: 'GraduationCap' },
  { type: 'INITIATIVE', label: 'مبادرة', icon: 'Rocket' },
  { type: 'AWARD', label: 'شهادة أو تكريم', icon: 'Trophy' },
  { type: 'ASSESSMENT', label: 'تقويم وقياس', icon: 'ClipboardCheck' },
]

// نص التوصية لكل مجال
export const SECTION_ACTION: Partial<Record<SectionKey, { label: string; type?: AchievementType }>> = {
  profile: { label: 'أكمل بياناتك المهنية' },
  assignment: { label: 'أكمل التكليف والنصاب' },
  goals: { label: 'أضف هدفًا مهنيًا' },
  planning: { label: 'أضف خطة أو تحضيرًا', type: 'PLAN' },
  practices: { label: 'أضف ممارسة تعليمية', type: 'PRACTICE' },
  assessment: { label: 'أضف أداة قياس', type: 'ASSESSMENT' },
  outcomes: { label: 'وثّق قياسًا قبليًا وبعديًا', type: 'REMEDIAL' },
  remedial: { label: 'أضف خطة علاجية', type: 'REMEDIAL' },
  enrichment: { label: 'أضف برنامجًا إثرائيًا', type: 'ENRICHMENT' },
  development: { label: 'أضف نشاطًا تدريبيًا', type: 'PD' },
  initiatives: { label: 'أضف مبادرة', type: 'INITIATIVE' },
  participation: { label: 'أضف مشاركة', type: 'PARTICIPATION' },
  cooperation: { label: 'أضف تعاونًا مهنيًا', type: 'COOP' },
  awards: { label: 'أضف إنجازًا أو شهادة', type: 'AWARD' },
  reflection: { label: 'أجب عن أسئلة التأمل' },
  devplan: { label: 'أضف هدفًا تطويريًا' },
}

export const ATTACHMENT_KINDS: Record<string, { label: string; icon: string; color: string }> = {
  IMAGE: { label: 'صورة', icon: 'Image', color: '#0e7f6e' },
  PDF: { label: 'ملف PDF', icon: 'FileText', color: '#c0392b' },
  DOC: { label: 'مستند', icon: 'FileText', color: '#2d6a9f' },
  SHEET: { label: 'جدول', icon: 'Table', color: '#1e7d46' },
  VIDEO: { label: 'فيديو', icon: 'Video', color: '#8e44ad' },
  LINK: { label: 'رابط', icon: 'Link', color: '#7f8c8d' },
  OTHER: { label: 'ملف', icon: 'Paperclip', color: '#7f8c8d' },
}

export const TERM_LABELS: Record<string, string> = {
  TERM1: 'الفصل الدراسي الأول',
  TERM2: 'الفصل الدراسي الثاني',
}

export const SCOPE_LABELS: Record<string, string> = {
  YEAR: 'سنوي',
  TERM1: 'الفصل الأول',
  TERM2: 'الفصل الثاني',
}

export function fileKind(mime: string | null, name: string | null): string {
  if (!mime && !name) return 'OTHER'
  const n = (name ?? '').toLowerCase()
  if (mime?.startsWith('image/')) return 'IMAGE'
  if (mime?.startsWith('video/')) return 'VIDEO'
  if (mime === 'application/pdf' || n.endsWith('.pdf')) return 'PDF'
  if (/\.(doc|docx|txt|rtf)$/.test(n) || mime?.includes('word')) return 'DOC'
  if (/\.(xls|xlsx|csv)$/.test(n) || mime?.includes('sheet') || mime?.includes('excel')) return 'SHEET'
  return 'OTHER'
}
