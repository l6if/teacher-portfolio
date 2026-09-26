// ═══ مبدّل مزوّد قاعدة البيانات (SQLite ⇄ PostgreSQL) — أدوات الترحيل ═════════
// الاستخدام:
//   bun scripts/use-db.ts sqlite    → يعيد schema.prisma إلى SQLite ويولّد عميل التطبيق
//   bun scripts/use-db.ts postgres  → يحوّل schema.prisma إلى PostgreSQL ويولّد عميل التطبيق
//   bun scripts/use-db.ts pg-tools  → يشتق prisma/schema.pg.prisma ويولّد عميل ترحيل منفصل (.pg-client)
//
// ملاحظات:
// - لا يغيّر أي نموذج أو حقل — يبدّل سطر المزوّد وسطر directUrl فقط (ضرورة ترحيل حصرية).
// - عميل الترحيل (.pg-client) منفصل تمامًا عن عميل التطبيق فلا يتعارضان.
// - PostgreSQL هو مزوّد الإنتاج الملتزم (Supabase) — SQLite للنسخ الاحتياطي والتجربة المحلية فقط.
// - بعد التبديل اضبط DATABASE_URL (و DIRECT_URL للـ postgres) في .env وأعد تشغيل الخادم.

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMA = resolve(ROOT, 'prisma/schema.prisma')
const PG_SCHEMA = resolve(ROOT, 'prisma/schema.pg.prisma')

type Mode = 'sqlite' | 'postgres' | 'pg-tools'

const SQLITE_LINE = 'provider = "sqlite"'
const POSTGRES_LINE = 'provider = "postgresql"'
const DIRECT_URL_LINE = '  directUrl = env("DIRECT_URL")'

function readSchema(): string {
  return readFileSync(SCHEMA, 'utf8')
}

/** إزالة سطر directUrl إن وُجد (وضع SQLite — لا معنى له ويمنع أي استهداف عرضي) */
function stripDirectUrl(src: string): string {
  return src
    .split('\n')
    .filter((l) => !l.trim().startsWith('directUrl'))
    .join('\n')
}

/** إضافة سطر directUrl بعد url إن لم يوجد (وضع PostgreSQL — للمهاجرات عبر اتصال مباشر) */
function ensureDirectUrl(src: string): string {
  if (src.split('\n').some((l) => l.trim().startsWith('directUrl'))) return src
  return src.replace(
    /(\s*url\s*=\s*env\("DATABASE_URL"\))/,
    `$1\n${DIRECT_URL_LINE}`,
  )
}

/** يضبط سطر المزوّد (وسطر directUrl) في schema.prisma الرئيسي دون لمس أي شيء آخر */
function setProvider(target: 'sqlite' | 'postgresql'): string {
  const src = readSchema()
  let out: string
  if (src.includes(SQLITE_LINE)) {
    out = src.replace(SQLITE_LINE, target === 'sqlite' ? SQLITE_LINE : POSTGRES_LINE)
  } else if (src.includes(POSTGRES_LINE)) {
    out = src.replace(POSTGRES_LINE, target === 'sqlite' ? SQLITE_LINE : POSTGRES_LINE)
  } else {
    console.error('⛔ لم أجد سطر المزوّد في prisma/schema.prisma — راجع الملف يدويًا.')
    process.exit(1)
  }
  // directUrl: موجود مع postgresql فقط (اتصال مباشر للمهاجرات — Supabase DIRECT_URL)
  if (target === 'postgresql') out = ensureDirectUrl(out)
  else out = stripDirectUrl(out)
  if (out === src) {
    console.log(`ℹ المزوّد مطابق بالفعل: ${target === 'sqlite' ? 'sqlite' : 'postgresql'}`)
    return src
  }
  writeFileSync(SCHEMA, out)
  console.log(`✓ تم ضبط المزوّد في prisma/schema.prisma → ${target}${target === 'postgresql' ? ' (+ directUrl للمهاجرات)' : ' (بلا directUrl)'}`)
  return out
}

/** يشتق prisma/schema.pg.prisma من المخطط الرئيسي (نفس النماذج حرفيًا) مع مخرج عميل منفصل */
function derivePgSchema(): void {
  let src = readSchema()
  // 1) المزوّد → postgresql (إن كان sqlite) + ضمان directUrl
  if (src.includes(SQLITE_LINE)) src = src.replace(SQLITE_LINE, POSTGRES_LINE)
  src = ensureDirectUrl(src)
  // 2) عميل الترحيل بمخرج منفصل حتى لا يمس عميل التطبيق
  const derived = src.replace(
    'generator client {\n  provider = "prisma-client-js"\n}',
    'generator client {\n  provider = "prisma-client-js"\n  output   = "../.pg-client"\n}',
  )
  writeFileSync(PG_SCHEMA, derived)
  if (!derived.includes('../.pg-client')) {
    console.error('⛔ تعذّر اشتقاق prisma/schema.pg.prisma — تأكد أن كتلة generator client بالشكل القياسي.')
    process.exit(1)
  }
  console.log('✓ اشتُق prisma/schema.pg.prisma (نفس النماذج + مزوّد postgresql + directUrl + مخرج .pg-client)')
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
  const mode = process.argv[2] as Mode | undefined
  if (mode !== 'sqlite' && mode !== 'postgres' && mode !== 'pg-tools') {
    console.error('الاستخدام: bun scripts/use-db.ts <sqlite|postgres|pg-tools>')
    console.error('  sqlite    → عميل التطبيق على SQLite (الافتراضي للتطوير)')
    console.error('  postgres  → عميل التطبيق على PostgreSQL (للنشر الإنتاجي)')
    console.error('  pg-tools  → أدوات الترحيل فقط (schema.pg.prisma + .pg-client)')
    process.exit(1)
  }

  if (mode === 'pg-tools') {
    derivePgSchema()
    const code = await run(['bunx', 'prisma', 'generate', '--schema', 'prisma/schema.pg.prisma'])
    if (code !== 0) process.exit(code)
    console.log('✓ عميل الترحيل جاهز في .pg-client (لا يمس عميل التطبيق في node_modules)')
    return
  }
  const target = mode === 'sqlite' ? 'sqlite' : 'postgresql'
  setProvider(target)
  const code = await run(['bunx', 'prisma', 'generate'])
  if (code !== 0) process.exit(code)

  console.log('')
  console.log('═══ الخطوة التالية ═══')
  if (target === 'postgresql') {
    console.log('اضبط في .env:  DATABASE_URL="postgresql://user:pass@host:5432/db"  و DIRECT_URL="postgresql://user:pass@host:5432/db"')
    console.log('في Supabase: DATABASE_URL = التجميعي (منفذ 6543) و DIRECT_URL = المباشر (منفذ 5432)')
    console.log('ثم انقل بياناتك:  bun scripts/migrate-to-postgres.ts "postgresql://user:pass@host:5432/db"')
  } else {
    console.log('اضبط في .env:  DATABASE_URL="file:/abs/path/db/custom.db"')
  }
  console.log('وأعد تشغيل الخادم بعد التغيير.')
}

const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
