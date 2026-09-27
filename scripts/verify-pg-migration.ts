// ═══ تحقق شامل لترحيل SQLite → PostgreSQL (تطابق 100% إلزامي) ═════════
// الاستخدام:
//   bun scripts/verify-pg-migration.ts <postgres-url> [--from db/custom.db]
//
// يتحقق من:
//   • تطابق الأعداد لكل جدول (8 جداول)
//   • تطابق المعرفات حرفيًا (مجموعة IDs لكل جدول)
//   • سلامة المفاتيح الأجنبية في الهدف (لا يتيمة)
//   • القيود الفريدة في الهدف (لا تكرار User.email / EvidenceLink / Reflection)
//   • تطابق التواريخ (createdAt/updatedAt/date/startDate/endDate) لكل صف
//   • passwordHash موجود بصيغة scrypt$ لكل مستخدم (في القاعدة — لا علاقة بالـ API)
//   • توزيع الأدوار (TEACHER/MANAGER) متطابق
//   • علاقات المعلم↔المدرسة متطابقة
//   • السنوات الدراسية (label/archived/userId) متطابقة
//   • بيانات المرفقات الوصفية (kind/fileName/fileSize/mimeType/url) لكل ID
//   • روابط الشواهد (attachmentId/achievementId/goalId) كاملة الثلاثيات
// يخرج 1 عند أي تفاوت — المصدر يُقرأ فقط ولا يُمس أبدًا.

import { PrismaClient as SrcClient } from '../.sqlite-client'
import { PrismaClient as PgClient } from '../.pg-client'
import { resolve as pathResolve } from 'path'

const MODELS = [
  'user', 'academicYear', 'goal', 'achievement',
  'attachment', 'evidenceLink', 'reflection', 'devPlan',
] as const

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`)
}

/** مفتاح مقارنة زمني: SQLite قد يعيد Date أو سلسلة — نطبّق إلى ms UTC */
function toMs(v: unknown): number | null {
  if (v == null) return null
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'string' || typeof v === 'number') return new Date(v).getTime()
  return null
}

let dateMismatchCount = 0
function cmpDates(label: string, s: unknown, t: unknown) {
  const a = toMs(s), b = toMs(t)
  if (a === null && b === null) return
  if (a === null || b === null || a !== b) {
    dateMismatchCount++
    check(label, false, `مصدر=${s} هدف=${t}`)
  }
}

function norm(v: unknown): unknown {
  if (v instanceof Date) return v.getTime()
  return v
}

function rowKey(row: Record<string, unknown>, fields: string[]): string {
  return fields.map((f) => String(norm(row[f]) ?? '∅')).join('|')
}

async function main() {
  const args = process.argv.slice(2)
  const fromIdx = args.indexOf('--from')
  const sqliteFile = fromIdx >= 0 ? args[fromIdx + 1] : (process.env.SQLITE_FILE || 'db/custom.db')
  const targetUrl = args.find((a) => a.startsWith('postgres'))

  if (!targetUrl) {
    console.error('الاستخدام: bun scripts/verify-pg-migration.ts <postgres-url> [--from db/custom.db]')
    process.exit(1)
  }

  console.log('═══ تحقق الترحيل: SQLite → PostgreSQL ═══')
  console.log(`المصدر (قراءة فقط): ${sqliteFile}`)
  console.log(`الهدف: ${targetUrl.replace(/\/\/[^@]*@/, '//***@')}`)
  console.log('─'.repeat(64))

  // ── قراءة المصدر كاملة (عميل SQLite مخصص) ──
  process.env.DATABASE_URL = `file:${pathResolve(sqliteFile)}`
  const src = new SrcClient()
  const srcData: Record<string, any[]> = {}
  const srcCounts: Record<string, number> = {}
  for (const m of MODELS) {
    srcData[m] = await (src as any)[m].findMany()
    srcCounts[m] = srcData[m].length
  }
  await src.$disconnect()

  // ── قراءة الهدف كاملة (عميل PG مخصص) ──
  process.env.DATABASE_URL = targetUrl
  const pg = new PgClient()
  const pgData: Record<string, any[]> = {}
  const pgCounts: Record<string, number> = {}
  for (const m of MODELS) {
    pgData[m] = await (pg as any)[m].findMany()
    pgCounts[m] = pgData[m].length
  }

  // ── 1) الأعداد ──
  console.log('【1】 تطابق الأعداد')
  console.log('النموذج             | المصدر | الهدف')
  console.log('────────────────────┼────────┼───────')
  for (const m of MODELS) {
    const ok = srcCounts[m] === pgCounts[m]
    if (!ok) failures++
    console.log(`${m.padEnd(19)} | ${String(srcCounts[m]).padStart(6)} | ${String(pgCounts[m]).padStart(5)} ${ok ? '✓' : '✗'}`)
  }

  // ── 2) المعرفات حرفيًا ──
  console.log('─'.repeat(64))
  console.log('【2】 تطابق المعرفات (حرفيًا)')
  for (const m of MODELS) {
    const s = new Set(srcData[m].map((r) => r.id))
    const t = new Set(pgData[m].map((r) => r.id))
    const missing = [...s].filter((id) => !t.has(id))
    const extra = [...t].filter((id) => !s.has(id))
    check(`${m}: ${s.size} معرفًا`, missing.length === 0 && extra.length === 0,
      `مفقود=${missing.slice(0, 3).join(',')} زائد=${extra.slice(0, 3).join(',')}`)
  }

  // ── 3) سلامة المفاتيح الأجنبية في الهدف ──
  console.log('─'.repeat(64))
  console.log('【3】 سلامة المفاتيح الأجنبية في الهدف (لا صفوف يتيمة)')
  const fkChecks: Array<[string, string, string]> = [
    ['academicYear', 'userId', 'user'],
    ['goal', 'userId', 'user'], ['goal', 'yearId', 'academicYear'],
    ['achievement', 'userId', 'user'], ['achievement', 'yearId', 'academicYear'],
    ['attachment', 'userId', 'user'], ['attachment', 'yearId', 'academicYear'],
    ['evidenceLink', 'attachmentId', 'attachment'],
    ['reflection', 'userId', 'user'], ['reflection', 'yearId', 'academicYear'],
    ['devPlan', 'userId', 'user'], ['devPlan', 'yearId', 'academicYear'],
  ]
  for (const [child, field, parent] of fkChecks) {
    const parentIds = new Set(pgData[parent].map((r) => r.id))
    const orphans = pgData[child].filter((r) => r[field] != null && !parentIds.has(r[field]))
    check(`${child}.${field} → ${parent}`, orphans.length === 0, `${orphans.length} يتيمة`)
  }
  // FKs الاختيارية (nullable)
  const optFk: Array<[string, string, string]> = [
    ['achievement', 'goalId', 'goal'],
    ['evidenceLink', 'achievementId', 'achievement'],
    ['evidenceLink', 'goalId', 'goal'],
  ]
  for (const [child, field, parent] of optFk) {
    const parentIds = new Set(pgData[parent].map((r) => r.id))
    const bad = pgData[child].filter((r) => r[field] != null && !parentIds.has(r[field]))
    check(`${child}.${field} → ${parent} (اختياري)`, bad.length === 0, `${bad.length} غير سليمة`)
  }

  // ── 4) القيود الفريدة في الهدف ──
  console.log('─'.repeat(64))
  console.log('【4】 القيود الفريدة في الهدف')
  const uniqEmail = new Map<string, number>()
  for (const u of pgData.user) uniqEmail.set(u.email, (uniqEmail.get(u.email) ?? 0) + 1)
  check('User.email فريد', [...uniqEmail.values()].every((n) => n === 1))
  const seenLink = new Set<string>()
  let dupLinks = 0
  for (const l of pgData.evidenceLink) {
    const k = `${l.attachmentId}|${l.achievementId ?? ''}|${l.goalId ?? ''}`
    if (seenLink.has(k)) dupLinks++
    seenLink.add(k)
  }
  check('EvidenceLink (attachment, achievement, goal) بلا تكرار', dupLinks === 0, `${dupLinks} مكررة`)
  const seenRefl = new Set<string>()
  let dupRefl = 0
  for (const r of pgData.reflection) {
    const k = `${r.userId}|${r.yearId}|${r.term}`
    if (seenRefl.has(k)) dupRefl++
    seenRefl.add(k)
  }
  check('Reflection (user, year, term) بلا تكرار', dupRefl === 0, `${dupRefl} مكررة`)

  // ── 5) التواريخ + المحتوى الحساس حقليًا ──
  console.log('─'.repeat(64))
  console.log('【5】 تطابق التواريخ والمحتوى (صف مقابل صف)')
  type DateSpec = { model: string; fields: string[] }
  const dateSpecs: DateSpec[] = [
    { model: 'user', fields: ['createdAt', 'updatedAt'] },
    { model: 'academicYear', fields: ['createdAt'] },
    { model: 'goal', fields: ['createdAt', 'updatedAt', 'startDate', 'endDate'] },
    { model: 'achievement', fields: ['createdAt', 'updatedAt', 'date'] },
    { model: 'attachment', fields: ['createdAt'] },
    { model: 'reflection', fields: ['updatedAt'] },
    { model: 'devPlan', fields: ['createdAt'] },
  ]
  for (const spec of dateSpecs) {
    const sm = new Map(srcData[spec.model].map((r) => [r.id, r]))
    for (const t of pgData[spec.model]) {
      const s = sm.get(t.id)
      if (!s) continue
      for (const f of spec.fields) {
        cmpDates(`${spec.model}.${f}[${t.id.slice(-6)}]`, s[f], t[f])
      }
    }
  }
  check('كل التواريخ متطابقة (ms UTC)', dateMismatchCount === 0, `${dateMismatchCount} تفاوت`)

  // ── 6) passwordHash + roles + school ──
  console.log('─'.repeat(64))
  console.log('【6】 passwordHash والأدوار والمدارس')
  const usersNoHash = pgData.user.filter((u) => !u.passwordHash || !String(u.passwordHash).startsWith('scrypt$'))
  check(`passwordHash بصيغة scrypt$ لكل ${pgData.user.length} مستخدمًا`, usersNoHash.length === 0,
    `${usersNoHash.length} بدون هاش صالح`)
  const srcRoleMap = new Map(srcData.user.map((u) => [u.id, u.role]))
  const roleMismatch = pgData.user.filter((u) => srcRoleMap.get(u.id) !== u.role)
  check('الأدوار متطابقة (TEACHER/MANAGER)', roleMismatch.length === 0)
  const srcSchoolMap = new Map(srcData.user.map((u) => [u.id, u.school ?? '']))
  const schoolMismatch = pgData.user.filter((u) => (srcSchoolMap.get(u.id) ?? '') !== (u.school ?? ''))
  check('علاقات المعلم↔المدرسة متطابقة', schoolMismatch.length === 0)
  const srcHashSample = new Map(srcData.user.map((u) => [u.id, u.passwordHash]))
  const hashMismatch = pgData.user.filter((u) => srcHashSample.get(u.id) !== u.passwordHash)
  check('قيم passwordHash منقولة حرفيًا (تحقق دخول لاحقًا)', hashMismatch.length === 0)

  // ── 7) السنوات الدراسية ──
  console.log('─'.repeat(64))
  console.log('【7】 السنوات الدراسية')
  const srcYears = new Map(srcData.academicYear.map((y) => [y.id, y]))
  const yearMismatch = pgData.academicYear.filter((y) => {
    const s = srcYears.get(y.id)
    return !s || s.label !== y.label || Boolean(s.archived) !== Boolean(y.archived) || s.userId !== y.userId
  })
  check(`السنوات (label/archived/userId) — ${pgData.academicYear.length} سنوات`, yearMismatch.length === 0)

  // ── 8) بيانات المرفقات الوصفية ──
  console.log('─'.repeat(64))
  console.log('【8】 بيانات المرفقات الوصفية')
  const srcAttach = new Map(srcData.attachment.map((a) => [a.id, a]))
  const attachFields = ['kind', 'fileName', 'mimeType', 'url', 'storagePath', 'userId', 'yearId']
  const attachMismatch: string[] = []
  for (const a of pgData.attachment) {
    const s = srcAttach.get(a.id)
    if (!s) continue
    for (const f of attachFields) {
      if ((s[f] ?? '') !== (a[f] ?? '')) attachMismatch.push(`${a.id}.${f}: ${s[f]} → ${a[f]}`)
    }
    if ((s.fileSize ?? null) !== (a.fileSize ?? null)) attachMismatch.push(`${a.id}.fileSize`)
  }
  check(`المرفقات (${pgData.attachment.length}) — كل البيانات الوصفية`, attachMismatch.length === 0,
    attachMismatch.slice(0, 3).join(' | '))

  // ─ـ 9) روابط الشواهد كاملة ──
  console.log('─'.repeat(64))
  console.log('【9】 روابط الشواهد (ثلاثيات كاملة)')
  const srcLinkKeys = new Set(srcData.evidenceLink.map((l) => rowKey(l, ['attachmentId', 'achievementId', 'goalId'])))
  const pgLinkKeys = pgData.evidenceLink.map((l) => rowKey(l, ['attachmentId', 'achievementId', 'goalId']))
  const linksMissing = pgLinkKeys.filter((k) => !srcLinkKeys.has(k)).length
  const pgKeySet = new Set(pgLinkKeys)
  const linksLost = [...srcLinkKeys].filter((k) => !pgKeySet.has(k)).length
  check(`${pgData.evidenceLink.length} رابطًا — الثلاثيات متطابقة`, linksMissing === 0 && linksLost === 0,
    `زائدة=${linksMissing} مفقودة=${linksLost}`)

  // ── 10) المحتوى النصي للإنجازات (عينة موجزة) ──
  console.log('─'.repeat(64))
  console.log('【10】 عينة محتوى الإنجازات')
  const srcAch = new Map(srcData.achievement.map((a) => [a.id, a]))
  const achFields = ['type', 'title', 'status', 'goalId', 'yearId']
  const achMismatch: string[] = []
  for (const a of pgData.achievement) {
    const s = srcAch.get(a.id)
    if (!s) continue
    for (const f of achFields) if ((s[f] ?? '') !== (a[f] ?? '')) achMismatch.push(`${a.id}.${f}`)
  }
  check(`${pgData.achievement.length} إنجازًا — الحقول الأساسية`, achMismatch.length === 0, achMismatch.slice(0, 3).join(', '))

  await pg.$disconnect()

  console.log('─'.repeat(64))
  if (failures > 0) {
    console.error(`⛔ ${failures} فشل — الترحيل غير مطابق 100%. لا تمس المصدر وشخّص السبب.`)
    process.exit(1)
  }
  console.log('✓ تطابق 100% — المعرفات والعلاقات والتواريخ والبيانات كلها كما كانت في SQLite.')
  console.log('  (المصدر SQLite لم يُمس — يبقى نسخة احتياطية دائمة)')
}

const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
