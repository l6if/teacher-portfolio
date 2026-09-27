// ═══ اختبار تدفق التخزين الكامل (رفع → تقديم → تحسين → صلاحيات → حذف يتامى) ═══
// يعمل ضد خادم قائم (الافتراضي 3000) — التطوير محليًا أو الإنتاج على 3100:
//   BASE_URL=http://localhost:3000 bun scripts/test-storage-flow.ts
// ⛔ الاستيراد لا ينفّذ شيئًا — تشغيل مباشر فقط.

const BASE = process.env.BASE_URL || 'http://localhost:3000'

let passed = 0
let failed = 0
function ok(name: string, cond: boolean, extra = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`) }
  else { failed++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`) }
}

async function login(email: string, password = process.env.TEACHER_PASSWORD ?? '') {
  const res = await fetch(`${BASE}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const cookie = res.headers.get('set-cookie')?.split(';')[0] ?? ''
  return { res, cookie }
}

async function main() {
  console.log(`═══ اختبار تدفق التخزين ضد ${BASE} ═══`)

  // صورة كبيرة حقيقية (JPEG صحيح البصمة) لتشغيل مسار التحسين
  const sharp = (await import('sharp')).default
  const bigJpeg = await sharp({
    create: { width: 3200, height: 2200, channels: 3, background: { r: 60, g: 120, b: 90 } },
  }).jpeg({ quality: 95 }).toBuffer()

  // ── 1) دخول سلطان ──
  const s = await login('sultan@madrasati.sa')
  ok('دخول المعلم', s.res.ok)
  const me = await (await fetch(`${BASE}/api/dashboard`, { headers: { cookie: s.cookie } })).json()
  const yearId = me?.years?.find((y: any) => !y.archived)?.id ?? me?.years?.[0]?.id
  ok('جلب السنة النشطة', !!yearId)

  // ── 2) رفع proxy ──
  const fd = new FormData()
  fd.append('file', new File([new Uint8Array(bigJpeg)], 'اختبار-التدفق.jpg', { type: 'image/jpeg' }))
  fd.append('yearId', yearId)
  const up = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { cookie: s.cookie }, body: fd })
  const upData = await up.json().catch(() => null)
  ok('رفع صورة JPEG عبر الوكيل', up.status === 201 && !!upData?.attachment?.id, `status=${up.status}`)
  const att = upData?.attachment
  if (att) {
    // العقد الأمني (إصلاح 2026-09-27): storagePath مسار داخلي لا يغادر الخادم أبدًا
    ok('storagePath لا يظهر في استجابة الرفع (عقد أمني)', !('storagePath' in att))
    ok('الاسم الأصلي محفوظ Metadata', att.fileName === 'اختبار-التدفق.jpg')
    ok('mimeType من القائمة البيضاء', att.mimeType === 'image/jpeg')
    ok('fileSize مسجل', att.fileSize === bigJpeg.length, `${att.fileSize} bytes`)

    // بنية المسار school/user/year/attachment-id/file — تُتحقق من جهة القرص
    // (مزوّد التطوير المحلي يكتب تحت storage/uploads بنفس بنية مسارات الإنتاج)
    const { readdir } = await import('fs/promises')
    const { join } = await import('path')
    async function walk(dir: string, base = ''): Promise<string[]> {
      const out: string[] = []
      let entries: import('fs').Dirent[]
      try { entries = await readdir(dir, { withFileTypes: true }) } catch { return out }
      for (const e of entries) {
        const rel = base ? `${base}/${e.name}` : e.name
        if (e.isDirectory()) out.push(...(await walk(join(dir, e.name), rel)))
        else if (e.isFile()) out.push(rel)
      }
      return out
    }
    const upRoot = process.env.UPLOAD_DIR || join(process.cwd(), 'storage', 'uploads')
    const allFiles = await walk(upRoot)
    const mine = allFiles.filter((f) => f.includes(`/${att.id}/`))
    ok('بنية المسار school/user/year/attachment-id/file (تحقق قرصي)',
      mine.length === 1 && new RegExp('\\/[^/]+\\/[^/]+\\/[^/]+\\/[^/]+\\/[^/]+\\.(jpg|jpeg)$').test('/' + mine[0]),
      mine[0] ?? 'لم يُعثر على الملف')

    // ── 3) التقديم الأصلي ──
    const raw = await fetch(`${BASE}/api/files/${att.id}`, { headers: { cookie: s.cookie } })
    ok('تقديم الملف للمالك', raw.status === 200 && raw.headers.get('content-type') === 'image/jpeg')
    const rawBytes = Buffer.from(await raw.arrayBuffer())
    ok('المحتوى مطابق للأصل المرفوع', rawBytes.equals(bigJpeg), `${rawBytes.length} bytes`)

    // ── 4) النسخة المحسّنة ──
    const opt = await fetch(`${BASE}/api/files/${att.id}?w=1600&q=82`, { headers: { cookie: s.cookie } })
    const optBytes = Buffer.from(await opt.arrayBuffer())
    ok('النسخة المحسنة تُقدَّم', opt.status === 200 && opt.headers.get('content-type') === 'image/jpeg')
    ok('النسخة أصغر من الأصل', optBytes.length < bigJpeg.length && optBytes.length > 0, `${(bigJpeg.length / 1024).toFixed(0)}KB → ${(optBytes.length / 1024).toFixed(0)}KB`)
    const meta = await sharp(optBytes).metadata()
    ok('عرض النسخة = 1600', meta.width === 1600, `width=${meta.width}`)

    // ── 5) الصلاحيات ──
    const anon = await fetch(`${BASE}/api/files/${att.id}`)
    ok('غير المسجل → 401', anon.status === 401)
    const a = await login('ahmed@madrasati.sa')
    const other = await fetch(`${BASE}/api/files/${att.id}`, { headers: { cookie: a.cookie } })
    ok('معلم آخر → 403', other.status === 403)
    const n = await login('noura@madrasati.sa')
    const mgr = await fetch(`${BASE}/api/files/${att.id}`, { headers: { cookie: n.cookie } })
    ok('مدير نفس المدرسة → 200', mgr.status === 200)
    const tampered = await fetch(`${BASE}/api/files/${att.id}`, { headers: { cookie: 'pf_session=forged.9999999999.AAAA' } })
    ok('كوكي مزوّر → 401', tampered.status === 401)

    // ── 6) حمايات الرفع ──
    const fd2 = new FormData()
    fd2.append('file', new File([new Uint8Array(Buffer.from('<!doctype html><script>alert(1)</script>'))], 'evil.html', { type: 'text/html' }))
    const bad1 = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { cookie: s.cookie }, body: fd2 })
    ok('HTML بامتداد مسموح csv → مرفوض بالبصمة', bad1.status === 400, `status=${bad1.status}`)
    const fd3 = new FormData()
    fd3.append('file', new File([new Uint8Array(Buffer.from('MZfakeexecutable'.padEnd(64, 'x')))], 'evil.jpg', { type: 'image/jpeg' }))
    const bad2 = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { cookie: s.cookie }, body: fd3 })
    ok('تنفيذي متنكر كصورة → مرفوض', bad2.status === 400, `status=${bad2.status}`)
    const fd4 = new FormData()
    fd4.append('file', new File([new Uint8Array(bigJpeg)], 'ok.exe', { type: 'image/jpeg' }))
    const bad3 = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { cookie: s.cookie }, body: fd4 })
    ok('امتداد غير مسموح → مرفوض', bad3.status === 400, `status=${bad3.status}`)
    const noAuth = await fetch(`${BASE}/api/upload`, { method: 'POST', body: fd })
    ok('رفع بلا جلسة → 401', noAuth.status === 401)

    // ── 7) حذف مع حماية اليتامى ──
    // 7-أ) شاهد بلا روابط → يُحذف الملف
    const del = await fetch(`${BASE}/api/attachments/${att.id}`, { method: 'DELETE', headers: { cookie: s.cookie } })
    const delData = await del.json().catch(() => null)
    ok('حذف شاهد غير مرتبط', del.status === 200 && delData?.ok === true)
    ok('الملف حُذف من التخزين (لا مرجع متبقٍ)', delData?.fileRemoved === true, `reason=${delData?.fileKeptReason ?? 'none'}`)
    const gone = await fetch(`${BASE}/api/files/${att.id}`, { headers: { cookie: s.cookie } })
    ok('الملف لم يعد متاحًا بعد الحذف', gone.status === 404)

    // 7-ب) شاهد مربوط بإنجازين → الملف يُحتفظ به
    const fd5 = new FormData()
    fd5.append('file', new File([new Uint8Array(bigJpeg)], 'مشترك.jpg', { type: 'image/jpeg' }))
    fd5.append('yearId', yearId)
    const up2 = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { cookie: s.cookie }, body: fd5 })
    const att2 = (await up2.json()).attachment
    const achievements = await (await fetch(`${BASE}/api/achievements?yearId=${yearId}`, { headers: { cookie: s.cookie } })).json()
    const ids = achievements.achievements.slice(0, 2).map((x: any) => x.id)
    for (const aid of ids) {
      await fetch(`${BASE}/api/attachments/link`, {
        method: 'POST', headers: { cookie: s.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ attachmentId: att2.id, achievementId: aid }),
      })
    }
    const del2 = await fetch(`${BASE}/api/attachments/${att2.id}`, { method: 'DELETE', headers: { cookie: s.cookie } })
    const del2Data = await del2.json().catch(() => null)
    ok('حذف شاهد متعدد الاستخدام → الملف محتفظ به', del2Data?.fileRemoved === false && del2Data?.fileKeptReason === 'multi-use', `reason=${del2Data?.fileKeptReason}`)
    // بقايا ملف 7-ب اليتيمة تنظَّف عبر scripts/storage-doctor.ts --clean (الأداة المخصصة لذلك)

    // ── 8) فك الربط (unlink) + دورة حياة نظيفة كاملة ──
    const fd6 = new FormData()
    fd6.append('file', new File([new Uint8Array(bigJpeg)], 'دورة-كاملة.jpg', { type: 'image/jpeg' }))
    fd6.append('yearId', yearId)
    const up3 = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { cookie: s.cookie }, body: fd6 })
    const att3 = (await up3.json()).attachment
    ok('رفع شاهد دورة الحياة', up3.status === 201 && !!att3?.id)
    const link = (attachmentId: string, achievementId: string, action?: string) =>
      fetch(`${BASE}/api/attachments/link`, {
        method: 'POST', headers: { cookie: s.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ attachmentId, achievementId, ...(action ? { action } : {}) }),
      }).then((r) => r.json())
    const ids3 = achievements.achievements.slice(0, 2).map((x: any) => x.id)
    const l1 = await link(att3.id, ids3[0])
    const l2 = await link(att3.id, ids3[1])
    ok('ربط الشاهد بإنجازين → رابطان', (l1?.links?.length ?? 0) === 1 && (l2?.links?.length ?? 0) === 2)
    const dup = await link(att3.id, ids3[0])
    ok('ربط مكرر → لا تكرار (idempotent)', (dup?.links?.length ?? 0) === 2)
    const u1 = await link(att3.id, ids3[0], 'remove')
    ok('فك ربط الشاهد من إنجاز → بقي رابط واحد', (u1?.links?.length ?? 0) === 1)
    const u2 = await link(att3.id, ids3[1], 'remove')
    ok('فك الرابط الأخير → صفر روابط', (u2?.links?.length ?? 0) === 0)
    const del3 = await fetch(`${BASE}/api/attachments/${att3.id}`, { method: 'DELETE', headers: { cookie: s.cookie } })
    const del3Data = await del3.json().catch(() => null)
    ok('حذف شاهد بلا روابط → الملف حُذف (لا يتيمة)', del3Data?.fileRemoved === true)
    const gone3 = await fetch(`${BASE}/api/files/${att3.id}`, { headers: { cookie: s.cookie } })
    ok('الملف لم يعد متاحاً بعد دورة الحياة', gone3.status === 404)
  }

  console.log(`\n═══ النتيجة: ${passed} ناجح / ${failed} فاشل ═══`)
  if (failed > 0) process.exit(1)
}

const isDirectRun = (import.meta as { main?: boolean }).main === true
if (isDirectRun) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
