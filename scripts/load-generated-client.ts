// ═══ محمّل عملاء Prisma المولّدين لسكربتات الترحيل (آمن للفحص النوعي) ═══
// عميل المصدر (.sqlite-client) وعميل الترحيل (.pg-client) يُولَّدان بأوامر منفصلة
// (bun scripts/use-db.ts pg-tools / generate-tool-clients) — وقد لا يكونان موجودين
// في نسخة جديدة من المستودع. هذا المحمّل يحافظ على فحص نوعي نظيف بلا أخطاء
// TS2307 على استيراد ثابت لمسار مولّد، ويعطي رسالة إرشاد واضحة عند غيابهما.
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { PrismaClient } from '@prisma/client'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function loadGeneratedClient(clientDir: 'sqlite' | 'pg'): PrismaClient {
  const dir = clientDir === 'sqlite' ? '.sqlite-client' : '.pg-client'
  const entry = resolve(ROOT, dir, 'index.js')
  if (!existsSync(entry)) {
    console.error(
      `⛔ عميل ${dir} غير مولّد بعد.\n` +
      `   شغّل أولًا: bun scripts/use-db.ts pg-tools   (يولّد .pg-client من مخطط postgres)\n` +
      `   ولعميل sqlite: bun scripts/generate-tool-clients.ts\n`,
    )
    process.exit(1)
  }
  // تحميل ديناميكي بعد التحقق من الوجود — typecheck نظيف بلا TS2307 على مسار مولّد.
  // النماذج متطابقة بين مخططات الأدوات ومخطط التطبيق (يفرضها generate-tool-clients)
  // لذا عودة النوع كـ PrismaClient التطبيقي مطابقة ثابتة صحيحة.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(entry) as { PrismaClient: new () => PrismaClient }
  return new mod.PrismaClient()
}

/** عميل قراءة المصدر SQLite (مولّد من schema.sqlite.prisma — للقراءة فقط) */
export function loadSqliteClient(): PrismaClient {
  return loadGeneratedClient('sqlite')
}

/** عميل كتابة الهدف PostgreSQL (مولّد من schema.pg.prisma — للترحيل فقط) */
export function loadPgClient(): PrismaClient {
  return loadGeneratedClient('pg')
}
