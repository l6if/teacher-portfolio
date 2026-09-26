// ═══ فحص أسرار المستودع قبل أي Push (إلزامي) ═══════════════════
// يفحص كل الملفات التي ستدخل Git (tracked + untracked غير المُستثناة)
// ضد: قيم الأسرار الفعلية، أنماط المفاتيح، قواعد بيانات، نسخ احتياطية.
import { execSync } from 'child_process'
import { readFileSync, statSync } from 'fs'

// 1) قائمة الملفات التي ستدخل الالتزام (كل ما يراه git عدا المستثنى)
const files = execSync('git ls-files --cached --others --exclude-standard', { cwd: '/home/z/my-project' })
  .toString()
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean)

console.log(`الملفات التي ستدخل Git: ${files.length}`)

// 2) محتويات .env الفعلية (قيم حقيقية للمطابقة — لا تُطبع)
const envValues: Record<string, string> = {}
for (const line of readFileSync('/home/z/my-project/.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?\s*$/)
  if (m && m[2].length > 8) envValues[m[1]] = m[2]
}

/** هل القيمة تحمل اعتمادات فعلية (user:pass@ أو توكن طويل)؟ — الروابط المحلية بلا كلمة مرور ليست سرًا */
function isCredential(value: string): boolean {
  if (/:\/\/[^@/\s]+:[^@/\s]+@/.test(value)) return true // user:pass@
  if (/^(gsk_|ghp_|sbp_|vercel_|eyJ)/.test(value)) return true // مفاتيح
  if (value.length >= 32 && /^[A-Za-z0-9_-]+$/.test(value)) return true // توكن عشوائي
  return false
}

const violations: string[] = []
const MAX_SCAN = 2 * 1024 * 1024 // 2MB نص
let scanned = 0

for (const rel of files) {
  const full = `/home/z/my-project/${rel}`
  let st
  try { st = statSync(full) } catch { continue }
  if (!st.isFile() || st.size > MAX_SCAN) continue
  if (/\.(png|jpg|jpeg|webp|ico|pdf|zip|gz|tgz|jar|db|woff2?)$/i.test(rel)) continue
  scanned++
  const content = readFileSync(full, 'utf8')

  // قيم حقيقية من .env — فقط التي تحمل اعتمادات فعلية (روابط محلية بلا مرور = تطوير موثّق، ليست سرًا)
  for (const [key, value] of Object.entries(envValues)) {
    if (isCredential(value) && content.includes(value)) violations.push(`${rel}: يحتوي القيمة الفعلية لـ ${key}`)
  }
  // أنماط عامة — مع استبعاد العناصر النائبة التوثيقية (user:pass@host / <pass> / <ref>)
  const placeholders = /(?:user:pass@|<pass>|<ref>|<password>|:PASS@|user:password@)/
  const patterns: [string, RegExp][] = [
    ['مفتاح Groq (gsk_...)', /gsk_[A-Za-z0-9]{20,}/],
    ['Service Role Supabase (eyJ...service)', /eyJ[A-Za-z0-9_-]{50,}\.eyJ[A-Za-z0-9_-]{30,}/],
    ['هاش scrypt', /scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}/],
    ['رابط postgres بكلمة مرور', /postgres(?:ql)?:\/\/[^@\s]+:[^@\s]+@/],
    ['مفتاح Vercel', /vercel_[A-Za-z0-9]{20,}/],
    ['توكن GitHub (ghp_/github_pat_)', /(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
    ['توكن Supabase (sbp_...)', /sbp_[A-Za-z0-9]{30,}/],
  ]
  for (const [name, re] of patterns) {
    const match = content.match(re)
    if (match && !placeholders.test(match[0])) violations.push(`${rel}: نمط ${name}`)
  }
  // أسماء متغيرات ممنوعة في أي ملف مصدر (غير .example وغير أدوات الفحص نفسها التي تكشفها)
  const isScannerTool = /^scripts\/scan-(client|repo)-secrets\.ts$/.test(rel)
  if (!rel.endsWith('.example') && !rel.endsWith('.md') && !isScannerTool) {
    if (content.includes('NEXT_PUBLIC_GROQ_API_KEY')) violations.push(`${rel}: NEXT_PUBLIC_GROQ_API_KEY ممنوع`)
    if (content.includes('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY')) violations.push(`${rel}: NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ممنوع`)
  }
  // كلمات مرور معروفة من بيانات التطوير داخل الكود المصدري (seed يمر عبر env فقط)
}

// 3) ملفات لا يجوز أن تكون في Git إطلاقًا
const forbiddenFiles = [
  '.env', 'db/custom.db', 'dev.log', 'server.log',
]
for (const f of forbiddenFiles) {
  if (files.includes(f)) violations.push(`الملف ${f} موجود في Git!`)
}
for (const f of files) {
  if (f.startsWith('.pg/') || f.startsWith('db/backups/') || f.startsWith('storage/uploads/')) {
    violations.push(`مسار محظور في Git: ${f}`)
  }
}

// 4) .env.example لا يحوي قيمًا حقيقية ذات اعتمادات
const example = readFileSync('/home/z/my-project/.env.example', 'utf8')
for (const [key, value] of Object.entries(envValues)) {
  if (isCredential(value) && example.includes(value)) violations.push(`.env.example يحتوي القيمة الحقيقية لـ ${key}`)
}

console.log(`فُحص ${scanned} ملفًا نصيًا`)
if (violations.length) {
  console.log('\n⛔ انتهاكات أمنية — يُمنع الدفع:')
  violations.forEach((v) => console.log('  • ' + v))
  process.exit(1)
}
console.log('\n✓ المستودع نظيف — لا أسرار ولا بيانات محظورة تدخل Git')
