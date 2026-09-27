// ═══ تحقق بنيوي مباشر من قاعدة PostgreSQL بعد migrate deploy ═══
// الاستخدام: bun scripts/validate-pg-schema.ts <postgres-url>
// يفحص: الجداول العشر + الأعمدة الحرجة + القيود الفريدة + FKs + الافتراضات
// (الأسماء والأنواع مطابقة لـ prisma/schema.prisma — مصدر الحقيقة الوحيد)

// تعريف محلي محدود لـ Bun runtime (السكربت يُنفَّذ بـ bun فقط — التطبيق نفسه على Node)
declare const Bun: { SQL: new (url: string) => any }

const url = process.argv[2]
if (!url || !url.startsWith('postgres')) {
  console.error('الاستخدام: bun scripts/validate-pg-schema.ts <postgres-url>')
  process.exit(1)
}

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`)
}

const sql = new Bun.SQL(url)

try {
  // ── 1) الجداول العشر ──
  const tables = (await sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`).map((r: any) => r.tablename)
  const expected = ['User', 'AcademicYear', 'Goal', 'Achievement', 'Attachment',
    'EvidenceLink', 'Reflection', 'DevPlan', 'PasswordResetToken', 'AiUsageLog']
  console.log('【1】 الجداول')
  for (const t of expected) check(`جدول ${t}`, tables.includes(t))
  const extra = tables.filter((t: string) => !expected.includes(t) && t !== '_prisma_migrations')
  check('لا جداول زائدة', extra.length === 0, extra.join(','))

  // ── 2) أعمدة User الحرجة (المصادقة والإدارة) ──
  console.log('【2】 أعمدة User (auth/admin/demo)')
  const userCols = new Map<string, any>((await sql`
    SELECT column_name, data_type, column_default FROM information_schema.columns
    WHERE table_name='User' AND table_schema='public'`).map((r: any) => [r.column_name, r] as [string, any]))
  // Prisma DateTime → timestamp(3) without time zone في PostgreSQL
  const critical: Array<[string, string, RegExp | null]> = [
    ['email', 'text', null],
    ['passwordHash', 'text', null],
    ['role', 'text', /TEACHER/],
    ['status', 'text', /ACTIVE/],
    ['gender', 'text', null],
    ['isDemo', 'boolean', /false/],
    ['sessionEpoch', 'integer', /0/],
    ['lastLoginAt', 'timestamp without time zone', null],
    ['educationAdmin', 'text', null],
    ['educationOffice', 'text', null],
    ['principalName', 'text', null],
  ]
  for (const [col, type, defRe] of critical) {
    const c = userCols.get(col)
    const typeOk = c?.data_type === type
    const defOk = !defRe || (c?.column_default ?? '').match(defRe) !== null
    check(`User.${col} (${type})${defRe ? ' + افتراض' : ''}`, typeOk && defOk,
      `found=${c?.data_type ?? 'MISSING'} def=${c?.column_default ?? ''}`)
  }

  // ── 3) أعمدة الإنجاز (حقول التقرير الرسمي بأسمائها الفعلية في المخطط) ──
  console.log('【3】 أعمدة Achievement (التقرير الرسمي)')
  const achCols = new Set<string>((await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='Achievement' AND table_schema='public'`).map((r: any) => String(r.column_name)))
  for (const col of ['execution', 'results', 'problem', 'impact', 'studentsCount',
    'beneficiariesCount', 'preScore', 'postScore', 'actions', 'hours', 'date'])
    check(`Achievement.${col}`, achCols.has(col))

  // ── 4) القيود الفريدة (بأسماء الفهارس — مطابقة تامة) ──
  console.log('【4】 القيود الفريدة')
  const idx = new Set<string>((await sql`
    SELECT indexname FROM pg_indexes WHERE schemaname='public'`).map((r: any) => String(r.indexname)))
  for (const [name, label] of [
    ['User_email_key', 'User.email فريد'],
    ['PasswordResetToken_tokenHash_key', 'PasswordResetToken.tokenHash فريد'],
    ['EvidenceLink_attachmentId_achievementId_key', 'EvidenceLink (attachment, achievement) فريد'],
    ['EvidenceLink_attachmentId_goalId_key', 'EvidenceLink (attachment, goal) فريد'],
    ['Reflection_userId_yearId_term_key', 'Reflection (user, year, term) فريد'],
  ] as Array<[string, string]>) check(label, idx.has(name), name)

  // ── 5) المفاتيح الأجنبية وسلوك الحذف (pg_constraint — المصدر الرسمي) ──
  console.log('【5】 المفاتيح الأجنبية')
  const fks = (await sql`
    SELECT child.relname AS child, parent.relname AS parent, con.confdeltype, con.confupdtype, con.conname
    FROM pg_constraint con
    JOIN pg_class child ON con.conrelid = child.oid
    JOIN pg_class parent ON con.confrelid = parent.oid
    WHERE con.contype='f' AND con.connamespace='public'::regnamespace`).map((r: any) => r)
  check(`عدد FKs (17)`, fks.length === 17, `${fks.length}`)
  // أبناء User المباشرون بحذف CASCADE = 7 (EvidenceLink بلا userId أصلًا — يتبع المرفق)
  const userCascade = fks.filter((f: any) => f.parent === 'User' && f.confdeltype === 'c').length
  check('حذف User → CASCADE لأبنائه السبعة', userCascade === 7, `${userCascade}`)
  const evAtt = fks.find((f: any) => f.conname === 'EvidenceLink_attachmentId_fkey')
  check('حذف Attachment → CASCADE لروابط الشواهد', evAtt?.confdeltype === 'c')
  const achGoal = fks.find((f: any) => f.conname === 'Achievement_goalId_fkey')
  check('حذف Goal → الإنجاز يبقى (SET NULL)', achGoal?.confdeltype === 'n')
  const aiUser = fks.find((f: any) => f.conname === 'AiUsageLog_userId_fkey')
  check('حذف User → سجل الذكاء يبقى مجهولًا (SET NULL)', aiUser?.confdeltype === 'n')

  // ── 6) الافتراضات الزمنية والمنطقية ──
  console.log('【6】 الافتراضات المنطقية')
  const yearDef = (await sql`
    SELECT column_default FROM information_schema.columns
    WHERE table_name='AcademicYear' AND column_name='archived'`)[0]
  check('AcademicYear.archived افتراضي false', String(yearDef?.column_default).includes('false'))
  const aiDef = (await sql`
    SELECT column_default FROM information_schema.columns
    WHERE table_name='AiUsageLog' AND column_name='success'`)[0]
  check('AiUsageLog.success افتراضي true', String(aiDef?.column_default).includes('true'))
  // EvidenceLink وReflection بلا createdAt بالتصميم (تحكم كامل عبر الوالدين)
  const created = (await sql`
    SELECT COUNT(*)::int AS n FROM information_schema.columns
    WHERE table_schema='public' AND column_name='createdAt'`)[0]
  check('createdAt في الجداول الثماني المصممة', created.n === 8, `${created.n}`)

  // ── 7) سجل المهاجرات ──
  console.log('【7】 سجل المهاجرات')
  const applied = await sql`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY migration_name`
  check(`المهاجرتان المسجلتان (${applied.length})`, applied.length === 2, `${applied.length}`)
  for (const m of applied) check(`${m.migration_name}: finished`, m.finished_at != null)

  console.log('─'.repeat(64))
  if (failures > 0) {
    console.error(`⛔ ${failures} فشل — المخطط غير مطابق للمطلوب.`)
    process.exit(1)
  }
  console.log('✓ التحقق البنيوي كامل: الجداول والأعمدة والقيود والافتراضات والفهارس كلها صحيحة.')
} finally {
  await sql.end()
}

export {}
