// ═══ أداة إدارة PostgreSQL المحلي (5433) — بلا psql ═════════════════════
// الاستخدام:
//   bun scripts/pg-admin.ts list
//   bun scripts/pg-admin.ts create <dbname>
//   bun scripts/pg-admin.ts drop   <dbname>
//   bun scripts/pg-admin.ts sql    "SELECT ..."        (على قاعدة الإدارة postgres)
//   bun scripts/pg-admin.ts sql    <dbname> "SELECT ..." (على قاعدة محددة)
// الاتصال: postgresql://postgres@127.0.0.1:5433 — لا كلمات مرور مطبوعة.

const HOST = process.env.PG_HOST || '127.0.0.1'
const PORT = process.env.PG_PORT || '5433'
const USER = process.env.PG_USER || 'postgres'
const ADMIN_URL = `postgresql://${USER}@${HOST}:${PORT}/postgres`

async function client(url: string) {
  const { PrismaClient } = (await import('../.pg-client/index.js')) as {
    PrismaClient: new () => {
      $queryRaw: any
      $executeRaw: any
      $queryRawUnsafe: (q: string) => Promise<any>
      $executeRawUnsafe: (q: string) => Promise<number>
      $disconnect: () => Promise<void>
    }
  }
  process.env.DATABASE_URL = url
  return new PrismaClient()
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  if (!cmd) {
    console.error('الاستخدام: bun scripts/pg-admin.ts <list|create|drop|sql> [dbname] ["sql"]')
    process.exit(1)
  }

  if (cmd === 'list') {
    const c = await client(ADMIN_URL)
    const dbs = await c.$queryRaw`SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`
    console.log('القواعد:', (dbs as any[]).map((d) => d.datname).join(', '))
    await c.$disconnect()
    return
  }

  if (cmd === 'create' || cmd === 'drop') {
    const name = rest[0]
    if (!name || !/^[a-z_][a-z0-9_]*$/i.test(name)) {
      console.error('اسم قاعدة غير صالح')
      process.exit(1)
    }
    const c = await client(ADMIN_URL)
    const sql = cmd === 'create'
      ? `CREATE DATABASE "${name}"`
      : `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`
    try {
      await c.$executeRawUnsafe(sql)
      console.log(`✓ ${cmd === 'create' ? 'أُنشئت' : 'حُذفت'} القاعدة: ${name}`)
    } catch (e: any) {
      console.error(`✗ فشل ${cmd}: ${e.message}`)
      process.exit(1)
    } finally {
      await c.$disconnect()
    }
    return
  }

  if (cmd === 'sql') {
    // sql "SELECT ..."  → على postgres (الإدارة)
    // sql <db> "SELECT ..." → على قاعدة محددة
    const two = rest.length >= 2 && !/^\s*(select|insert|update|delete|create|drop|alter|grant|show)\b/i.test(rest[0])
    const dbname = two ? rest[0] : 'postgres'
    const sql = two ? rest[1] : rest[0]
    if (!sql) { console.error('أمر SQL مفقود'); process.exit(1) }
    const c = await client(`postgresql://${USER}@${HOST}:${PORT}/${dbname}`)
    try {
      const rows = await c.$queryRawUnsafe(sql)
      console.log(JSON.stringify(rows, (_, v) => (typeof v === 'bigint' ? Number(v) : v), 1))
    } catch (e: any) {
      console.error(`✗ ${e.message}`)
      process.exit(1)
    } finally {
      await c.$disconnect()
    }
    return
  }

  console.error(`أمر غير معروف: ${cmd}`)
  process.exit(1)
}

const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
