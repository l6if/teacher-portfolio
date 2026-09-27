// ═══ إنشاء قواعد PostgreSQL المحلية على 5433 (إن لم تكن موجودة) ═══
// الاستخدام: bun scripts/create-local-pg-dbs.ts
// - idempotent: يتخطى القاعدة الموجودة
// - يستخدم Bun.sql المدمج — بلا تبعيات جديدة

// تعريف محلي محدود لـ Bun runtime (السكربت يُنفَّذ بـ bun فقط — التطبيق نفسه على Node)
declare const Bun: { SQL: new (url: string) => any }

const PG_BASE = process.env.LOCAL_PG_URL ?? 'postgres://postgres@127.0.0.1:5433/postgres'
const DBS = ['teacherfolio', 'migration_check']

const sql = new Bun.SQL(PG_BASE)
try {
  for (const db of DBS) {
    const exists = await sql`SELECT 1 FROM pg_database WHERE datname = ${db}`
    if (exists.length > 0) {
      console.log(`ℹ القاعدة «${db}» موجودة بالفعل — تخطّي`)
    } else {
      // CREATE DATABASE لا يقبل معاملًا مُجهزًا — الاسم من قائمة ثابتة آمنة أعلاه فقط
      await sql.unsafe(`CREATE DATABASE "${db}" ENCODING 'UTF8'`)
      console.log(`✓ أُنشئت القاعدة «${db}»`)
    }
  }
  const list = await sql`SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY 1`
  console.log('القواعد الحالية:', list.map((r: any) => r.datname).join(', '))
} finally {
  await sql.end()
}

export {}
