/**
 * التسميات العربية الواعية بالجنس — المصدر المركزي الوحيد.
 * لا if statements متناثرة في المكونات ولا استبدال نص أعمى (replace("معلم","معلمة")).
 * قاموس كامل للمسميات المهنية لكل صيغة.
 */

export type GenderValue = 'MALE' | 'FEMALE' | null | undefined

export interface GenderedLabels {
  /** معلم / معلمة / معلم/ـة */
  teacher: string
  /** المعلم / المعلمة / المعلم/ـة */
  theTeacher: string
  /** اسم المعلم / اسم المعلمة / اسم المعلم/ـة */
  teacherName: string
  /** منفذ البرنامج / منفذة البرنامج / منفذ/ة البرنامج */
  executor: string
  /** مسؤول التنفيذ / مسؤولة التنفيذ / مسؤول/ة التنفيذ */
  executorTitle: string
  /** توقيع المعلم / توقيع المعلمة / توقيع المعلم/ـة */
  teacherSignature: string
  /** ملف إنجاز المعلم / المعلمة / المعلم/ـة */
  portfolio: string
  /** اسم مدير/ة المدرسة (للتوقيع الثاني) */
  principal: string
  /** تحية: أهلاً بك أيها المعلم / أهلاً بك أيتها المعلمة */
  greeting: string
  /** الرحلة المهنية للمعلم... */
  journey: string
  /** أستاذ / أستاذة / فارغ (محايد) — يحتاج الاسم بعده */
  honorific: string
}

const MALE_LABELS: GenderedLabels = {
  teacher: 'معلم',
  theTeacher: 'المعلم',
  teacherName: 'اسم المعلم',
  executor: 'منفذ البرنامج',
  executorTitle: 'مسؤول التنفيذ',
  teacherSignature: 'توقيع المعلم',
  portfolio: 'ملف إنجاز المعلم',
  principal: 'اسم مدير المدرسة',
  greeting: 'أهلاً بك، أيها المعلم',
  journey: 'الرحلة المهنية للمعلم',
  honorific: 'أستاذ',
}

const FEMALE_LABELS: GenderedLabels = {
  teacher: 'معلمة',
  theTeacher: 'المعلمة',
  teacherName: 'اسم المعلمة',
  executor: 'منفذة البرنامج',
  executorTitle: 'مسؤولة التنفيذ',
  teacherSignature: 'توقيع المعلمة',
  portfolio: 'ملف إنجاز المعلمة',
  principal: 'اسم مديرة المدرسة',
  greeting: 'أهلاً بك، أيتها المعلمة',
  journey: 'الرحلة المهنية للمعلمة',
  honorific: 'أستاذة',
}

const NEUTRAL_LABELS: GenderedLabels = {
  teacher: 'معلم/ـة',
  theTeacher: 'المعلم/ـة',
  teacherName: 'اسم المعلم/ـة',
  executor: 'منفذ/ة البرنامج',
  executorTitle: 'مسؤول/ة التنفيذ',
  teacherSignature: 'توقيع المعلم/ـة',
  portfolio: 'ملف إنجاز المعلم/ـة',
  principal: 'اسم مدير/ة المدرسة',
  greeting: 'أهلاً بك',
  journey: 'الرحلة المهنية للمعلم/ـة',
  honorific: '',
}

/**
 * قاموس التسميات وفق الجنس.
 * غير محدد (null) = صياغة محايدة مؤقتة حتى يختار المستخدم من ملفه المهني.
 */
export function getGenderedLabels(gender: GenderValue): GenderedLabels {
  if (gender === 'MALE') return MALE_LABELS
  if (gender === 'FEMALE') return FEMALE_LABELS
  return NEUTRAL_LABELS
}
