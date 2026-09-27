// ═══ ترحيل البيانات: SQLite → PostgreSQL (نفس المعرفات والعلاقات والطوابع الزمنية) ═══
// الاستخدام:
//   bun scripts/migrate-to-postgres.ts <postgres-url> [--from <ملف-sqlite>] [--fresh]
//
// مثال:
//   bun scripts/migrate-to-postgres.ts "postgresql://postgres@localhost:5433/teacherfolio"
//
// - المصدر الافتراضي: DATABASE_URL الحالي إذا كان ملف SQLite (file:...)
//   أو حدده صراحة: --from db/custom.db  أو  --from "file:/abs/path.db"
// - الهدف: رابط PostgreSQL (وسيطة موضعية)
// - --fresh : مسح جداول الهدف أولًا (ترحيل نظيف قابل للتكرار) — علم صريح فقط؛
//   الافتراضي يرفض التنفيذ إذا وُجدت بيانات في الهدف حتى لا تختلط بيانات مصدرين.
// - قراءة المصدر عبر عميل التطبيق (SQLite) وكتابة الهدف عبر عميل ترحيل منفصل
//   (.pg-client) لا يمس عميل التطبيق. لا عمليات كتابة على المصدر إطلاقًا.
// - ملاحظة: شغّل الترحيل قبل تبديل التطبيق إلى postgres (bun scripts/use-db.ts postgres).
// - يتحقق من تطابق عدد الصفوف لكل جدول بعد الترحيل.

import { loadSqliteClient, loadPgClient } from './load-generated-client'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ترتيب آمن للعلاقات (الآباء قبل الأبناء) + الترتيب العكسي للمسح
const MODELS = [
  'user', 'academicYear', 'goal', 'achievement',
  'attachment', 'evidenceLink', 'reflection', 'devPlan',
] as const
const REVERSE_MODELS = [...MODELS].reverse()

function parseSqlitePath(raw: string | undefined): string | null {
  if (!raw) return null
  const v = raw.trim()
  if (v.startsWith('file:')) return v.slice(5).replace(/\?+.*$/, '')
  if (v.startsWith('/') || v.startsWith('./') || !v.includes('://')) return v
  return null // postgres/mysql/... — ليس ملف sqlite
}

function toSqliteUrl(file: string): string {
  return file.startsWith('file:') ? file : `file:${resolve(file)}`
}

function run(cmd: string[], env?: Record<string, string>): Promise<number> {
  return new Promise((res, rej) => {
    const child = spawn(cmd[0], cmd.slice(1), {
      cwd: ROOT,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: 'inherit',
    })
    child.on('error', rej)
    child.on('exit', (code) => res(code ?? 1))
  })
}

async function main() {
  const args = process.argv.slice(2)
  const fresh = args.includes('--fresh')
  const fromIdx = args.indexOf('--from')
  const fromArg = fromIdx >= 0 ? args[fromIdx + 1] : undefined
  const positional = args.find((a, i) => i > 0 && !a.startsWith('--') && args[i - 1] !== '--from')
    ?? args.find((a) => a.startsWith('postgres'))

  // ─── تحديد المصدر والهدف ─────────────────────────────────────
  const sqliteFile = parseSqlitePath(fromArg) ?? parseSqlitePath(process.env.DATABASE_URL)
  const targetUrl = positional

  if (!sqliteFile || !existsSync(resolve(sqliteFile))) {
    console.error('⛔ المصدر غير صالح: حدد ملف SQLite موجود.')
    console.error('   bun scripts/migrate-to-postgres.ts <postgres-url> --from db/custom.db')
    process.exit(1)
  }
  if (!targetUrl || !/^postgres(ql)?:\/\//.test(targetUrl)) {
    console.error('⛔ الهدف غير صالح: مرر رابط PostgreSQL.')
    console.error('   مثال: bun scripts/migrate-to-postgres.ts "postgresql://postgres@localhost:5433/teacherfolio"')
    process.exit(1)
  }

  console.log('═══ ترحيل البيانات: SQLite → PostgreSQL ═══')
  console.log(`المصدر (قراءة فقط): ${resolve(sqliteFile)}`)
  console.log(`الهدف: ${targetUrl.replace(/\/\/[^@]*@/, '//***@')}`)

  // ─── توليد أدوات الترحيل إن لم تكن موجودة ────────────────────
  if (!existsSync(resolve(ROOT, '.pg-client')) || !existsSync(resolve(ROOT, '.sqlite-client'))) {
    console.log('→ توليد أدوات الترحيل (عملاء منفصلان عن عميل التطبيق)...')
    if (!existsSync(resolve(ROOT, '.sqlite-client'))) {
      const code = await run(['bunx', 'prisma', 'generate', '--schema', 'prisma/schema.sqlite.prisma'])
      if (code !== 0) process.exit(1)
    }
    if (!existsSync(resolve(ROOT, '.pg-client'))) {
      const code = await run(['bun', 'scripts/use-db.ts', 'pg-tools'])
      if (code !== 0) process.exit(1)
    }
  }

  // ─── التأكد من وجود مخطط الهدف (إنشاء عبر db push عند اللزوم) ──
  process.env.DATABASE_URL = targetUrl
  const probe = loadPgClient()
  let schemaReady = true
  try {
    await probe.user.count()
  } catch {
    schemaReady = false
  }
  await probe.$disconnect().catch(() => {})
  if (!schemaReady) {
    console.log('→ إنشاء المخطط في الهدف عبر prisma db push...')
    const code = await run(
      ['bunx', 'prisma', 'db', 'push', '--schema', 'prisma/schema.pg.prisma'],
      { DATABASE_URL: targetUrl },
    )
    if (code !== 0) process.exit(1)
  }

  // ─── المرحلة 1: قراءة المصدر بالكامل (env = ملف SQLite) ───────
  // ملاحظة مهمة: عميل Prisma يحل DATABASE_URL وقت أول استعلام (لا وقت الإنشاء)،
  // لذا نلتزم بترتيب صارم: كل استعلامات المصدر تنفَّذ بـ env=sqlite ثم كل استعلامات
  // الهدف بـ env=postgres — لا تخلط بينهما أبدًا.
  process.env.DATABASE_URL = toSqliteUrl(sqliteFile)
  const src = loadSqliteClient()
  const batches: { model: string; rows: Record<string, unknown>[] }[] = []
  const sourceCounts: Record<string, number> = {}
  for (const m of MODELS) {
    const rows = await (src as any)[m].findMany()
    batches.push({ model: m as string, rows })
    sourceCounts[m] = rows.length
  }
  await src.$disconnect().catch(() => {})
  const totalRows = batches.reduce((a, b) => a + b.rows.length, 0)
  if (totalRows === 0) {
    console.error('⛔ المصدر فارغ — لا شيء لترحيله.')
    process.exit(1)
  }

  // ─── المرحلة 2: الكتابة والتحقق في الهدف (env = postgres) ──────
  process.env.DATABASE_URL = targetUrl
  const pg = loadPgClient()
  try {
    // حماية الهدف: بيانات موجودة تتطلب --fresh
    const targetCounts: Record<string, number> = {}
    for (const m of MODELS) targetCounts[m] = await (pg as any)[m].count()
    const total = Object.values(targetCounts).reduce((a, b) => a + b, 0)
    if (total > 0 && !fresh) {
      console.error(`⛔ الهدف يحتوي بيانات بالفعل (${total} صفًا) — أضف --fresh للترحيل النظيف (يمسح جداول الهدف فقط، المصدر لا يُمس أبدًا).`)
      process.exit(1)
    }
    if (total > 0 && fresh) {
      console.warn(`⚠️ --fresh: مسح ${total} صفًا من جداول الهدف (المصدر لا يُمس)...`)
      await pg.$transaction(REVERSE_MODELS.map((m) => (pg as any)[m].deleteMany()))
    }

    console.log(`→ نقل ${totalRows} صفًا (${batches.map((b) => `${b.model}:${b.rows.length}`).join(' + ')})`)
    await pg.$transaction(
      batches.map((b) => (pg as any)[b.model].createMany({ data: b.rows })),
    )

    // ─── تحقق نهائي: تطابق الأعداد (مصدر مُلتقط قبل التبديل مقابل هدف حي) ──
    let allMatch = true
    console.log('')
    console.log('النموذج            | المصدر | الهدف | الحالة')
    console.log('───────────────────┼────────┼───────┼─────────')
    for (const m of MODELS) {
      const s = sourceCounts[m]
      const t = await (pg as any)[m].count()
      const ok = s === t
      if (!ok) allMatch = false
      console.log(`${m.padEnd(18)} | ${String(s).padStart(6)} | ${String(t).padStart(5)} | ${ok ? '✓' : '✗ تفاوت!'}`)
    }
    if (!allMatch) {
      console.error('⛔ فشل التحقق — راجع الجدول أعلاه.')
      process.exit(1)
    }
    console.log('')
    console.log('✓ اكتمل الترحيل بنجاح — المعرفات والعلاقات والطوابع الزمنية كما كانت تمامًا.')
    console.log('   لتشغيل التطبيق على PostgreSQL: bun scripts/use-db.ts postgres  ثم اضبط DATABASE_URL في .env')
  } finally {
    await pg.$disconnect().catch(() => {})
  }
}

const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
