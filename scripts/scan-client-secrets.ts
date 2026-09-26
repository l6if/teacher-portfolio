// ═══ فحص الأسرار في حزمة العميل (إلزامي بعد أي Production Build) ═══
// المطلوب: 0 occurrences لـ GROQ_API_KEY وقيمته الفعلية وSESSION_SECRET
// ومفتاح Supabase الخدمي في أي ملف يُخدم للمتصفح (.next/static + standalone).
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

const ROOT = '/home/z/my-project/.next'

// القيم الحساسة الفعلية من البيئة (المقارنة بالقيمة لا بالاسم فقط)
const secrets: { name: string; value: string | undefined }[] = [
  { name: 'GROQ_API_KEY', value: process.env.GROQ_API_KEY },
  { name: 'SESSION_SECRET', value: process.env.SESSION_SECRET },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', value: process.env.SUPABASE_SERVICE_ROLE_KEY },
]

// أسماء ممنوعة نهائيًا في أي كود عميل
const forbiddenNames = ['NEXT_PUBLIC_GROQ_API_KEY', 'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY']

const clientDirs = [join(ROOT, 'static'), join(ROOT, 'standalone', '.next', 'static')]

function* walk(dir: string): Generator<string> {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else yield full
  }
}

let scanned = 0
const violations: string[] = []

for (const dir of clientDirs) {
  for (const file of walk(dir)) {
    if (!/\.(js|css|html|json|map|txt)$/.test(file)) continue
    scanned++
    const content = readFileSync(file, 'utf8')
    for (const { name, value } of secrets) {
      if (value && value.length > 8 && content.includes(value)) {
        violations.push(`${file}: يحتوي قيمة ${name}!`)
      }
    }
    for (const forbidden of forbiddenNames) {
      if (content.includes(forbidden)) {
        violations.push(`${file}: يحتوي الاسم المحظور ${forbidden}`)
      }
    }
    // مفتاح groq بصيغة gsk_ (نمط القيمة حتى لو تغير المتغير)
    if (/gsk_[A-Za-z0-9]{20,}/.test(content)) {
      violations.push(`${file}: نمط مفتاح Groq (gsk_...) ظاهر!`)
    }
  }
}

console.log(`فُحص ${scanned} ملفًا من حزمة العميل (static + standalone/static)`)
if (violations.length) {
  console.log('⛔ انتهاكات:')
  violations.forEach((v) => console.log('  • ' + v))
  process.exit(1)
}
console.log('✓ 0 occurrences — لا سر يغادر الخادم إلى المتصفح')
