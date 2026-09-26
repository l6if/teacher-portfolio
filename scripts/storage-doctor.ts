// ═══ فحص وصيانة تخزين الشواهد (Orphan Protection) ═════════════
// الاستخدام:
//   bun scripts/storage-doctor.ts              → تقرير فقط (لقراءة فقط دائمًا)
//   bun scripts/storage-doctor.ts --clean      → حذف ملفات التخزين اليتيمة (بلا أي مرجع في قاعدة البيانات)
//
// ما يفحصه:
//   1) DB → التخزين: كل مرفق له storagePath — هل الكائن موجود فعلًا؟ (تسريب مراجع)
//   2) التخزين → DB: كل كائن مخزَّن — هل له سجل مرفق يشير إليه؟ (ملفات يتيمة)
//   3) مراجع مشتركة: أكثر من سجل يشترك في نفس المسار
//
// ⛔ الاستيراد من أي ملف لا ينفّذ شيئًا — التنفيذ بتشغيل مباشر فقط.
// ⚠️ --clean يحذف من وحدة التخزين فقط الكائنات التي لا يشير إليها أي سجل —
//    قاعدة البيانات لا تُمس إطلاقًا، والمسح يُطبع كائنًا كائنًا قبل التنفيذ.

import { PrismaClient } from '@prisma/client'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { getStorage, supabaseStorageEnv, isSafeRelativePath } from '../src/lib/storage'

const db = new PrismaClient()

// ─── جرد التخزين المحلي (مشي متعدي) ──────────────────────────
async function walkLocal(dir: string, base = ''): Promise<string[]> {
  const out: string[] = []
  let entries: import('fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name
    if (e.isDirectory()) out.push(...(await walkLocal(join(dir, e.name), rel)))
    else if (e.isFile()) out.push(rel)
  }
  return out
}

// ─── جرد Supabase Storage (قوائم متكررة عبر list API) ───────
async function walkSupabase(prefix: string, depth = 0): Promise<string[]> {
  const env = supabaseStorageEnv()
  if (!env) return []
  if (depth > 8) return []
  const out: string[] = []
  try {
    const res = await fetch(`${env.url}/storage/v1/object/list/${env.bucket}`, {
      method: 'POST',
      headers: {
        apikey: env.serviceKey,
        authorization: `Bearer ${env.serviceKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
    })
    if (!res.ok) {
      console.error(`  ⛔ تعذر جرد الحاوية (HTTP ${res.status}) — تحقق من المفاتيح والصلاحيات`)
      process.exitCode = 1
      return out
    }
    const items = (await res.json()) as Array<{ name: string; prefix?: string }>
    for (const it of items) {
      if (it.prefix) {
        // مجلد — ننزل داخله
        out.push(...(await walkSupabase(it.prefix, depth + 1)))
      } else if (it.name) {
        out.push(prefix ? `${prefix}${it.name}` : it.name)
      }
    }
  } catch (e) {
    console.error('  ⛔ فشل جلب القائمة من Supabase:', (e as Error).message)
    process.exitCode = 1
  }
  return out
}

async function main() {
  const clean = process.argv.includes('--clean')

  console.log('═══ فحص تخزين الشواهد (storage-doctor) ═══')
  const storage = getStorage()
  console.log(`المزوّد: ${storage.kind === 'supabase' ? `Supabase (حاوية ${storage.bucket})` : 'قرص محلي (تطوير)'}`)

  // ── 1) كل سجلات المرفقات ذات storagePath ──
  const attachments = await db.attachment.findMany({
    where: { storagePath: { not: null } },
    select: { id: true, storagePath: true, userId: true, fileName: true },
  })
  const pathToIds = new Map<string, string[]>()
  for (const a of attachments) {
    const p = a.storagePath as string
    pathToIds.set(p, [...(pathToIds.get(p) ?? []), a.id])
  }

  // ── 2) DB → التخزين: مراجع بلا كائن ──
  console.log(`\n[1] مراجع قاعدة البيانات → التخزين (${attachments.length} مرفقًا بملفات)`)
  const missing: string[] = []
  for (const [p, ids] of pathToIds) {
    if (!isSafeRelativePath(p)) {
      console.log(`  ✗ مسار غير آمن مخزَّن: ${p} → ${ids.join(', ')}`)
      missing.push(p)
      continue
    }
    const exists = await storage.exists(p)
    if (!exists) {
      console.log(`  ✗ كائن مفقود: ${p} → مرفقات: ${ids.join(', ')}`)
      missing.push(p)
    }
  }
  if (!missing.length) console.log('  ✓ كل المسارات المخزَّنة موجودة فعلًا في التخزين')

  // ── 3) مراجع مشتركة ──
  const shared = [...pathToIds.entries()].filter(([, ids]) => ids.length > 1)
  console.log(`\n[2] مراجع مشتركة (أكثر من سجل لنفس المسار)`)
  if (!shared.length) console.log('  ✓ لا مسارات مشتركة — كل مرفق له مساره الفريد')
  for (const [p, ids] of shared) console.log(`  ⚠ ${p} → ${ids.length} سجلات: ${ids.join(', ')}`)

  // ── 4) التخزين → DB: كائنات يتيمة ──
  console.log(`\n[3] جرد التخزين واكتشاف اليتامى`)
  const objects = storage.kind === 'supabase'
    ? await walkSupabase('')
    : await walkLocal(process.env.UPLOAD_DIR || join(process.cwd(), 'storage', 'uploads'))
  console.log(`  إجمالي الكائنات في التخزين: ${objects.length}`)
  const orphans = objects.filter((o) => !pathToIds.has(o))
  let removedCount = 0
  if (!orphans.length) {
    console.log('  ✓ لا كائنات يتيمة — كل ملف في التخزين له سجل يشير إليه')
  } else {
    console.log(`  ⚠ ${orphans.length} كائنًا يتيمًا (بلا أي مرجع في قاعدة البيانات):`)
    for (const o of orphans.slice(0, 50)) console.log(`     - ${o}`)
    if (orphans.length > 50) console.log(`     ... و${orphans.length - 50} أخرى`)

    if (clean) {
      console.log(`\n[--clean] حذف الكائنات اليتيمة (${orphans.length})...`)
      let removed = 0
      for (const o of orphans) {
        const ok = await storage.remove(o)
        if (ok) { removed++; console.log(`  🗑 حُذف: ${o}`) }
        else console.log(`  ✗ تعذر حذف: ${o}`)
      }
      removedCount = removed
      console.log(`  ✓ أُزيل ${removed}/${orphans.length}`)
    } else {
      console.log('  ℹ للتنظيف الصريح: bun scripts/storage-doctor.ts --clean')
    }
  }
  // ── الخلاصة ──
  console.log('\n═══ الخلاصة ═══')
  console.log(`مرفقات بملفات: ${attachments.length} | مسارات فريدة: ${pathToIds.size}`)
  console.log(`كائنات التخزين: ${objects.length} | يتامى متبقون: ${clean ? orphans.length - removedCount : orphans.length} | مراجع مفقودة: ${missing.length}`)
  if (missing.length > 0) {
    console.log('⚠ سجلات تشير لملفات غير موجودة — راجع النسخ الاحتياطية أو أعد رفع الملفات.')
    process.exitCode = 1
  }
}

const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  }).finally(() => {
    void db.$disconnect()
  })
}
