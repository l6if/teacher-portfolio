// ═══ إعداد بيانات اختبار Production (PART 6) ═══
// حساب معلم مؤقت + إنجاز كامل: عنوان/هدف/مشكلة/تنفيذ/مراحل/نتائج/أثر
// + صورتين حقيقيتين (PNG) + مرفق PDF + رابط شاهد خارجي — وروابطهم بالإنجاز.
// يعمل ضد الإنتاج الحقيقي عبر signup العام (لا يمس بيانات أي مستخدم آخر).
import { deflateSync } from 'zlib'

const BASE = process.env.BASE_URL || 'https://teacher-portfolio-sultans-projects-bce2ab1d.vercel.app'
const EMAIL = `qa-patch-${Date.now().toString(36)}@patchtest.sa`
const PASSWORD = 'QaProd!2026x'
const NAME = 'مختبر الرقعة الإنتاجي'

/** صورة PNG حقيقية (مستطيل مخطط بلون) — بكسلات فعلية قابلة للطباعة */
function makePng(w: number, h: number, r: number, g: number, b: number, seed: number): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3))
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 3)
    raw[row] = 0 // filter: none
    for (let x = 0; x < w; x++) {
      const i = row + 1 + x * 3
      const stripe = Math.floor((x / w) * 9 + seed) % 2
      raw[i] = stripe ? Math.min(255, r + 45) : r
      raw[i + 1] = stripe ? Math.min(255, g + 45) : g
      raw[i + 2] = stripe ? Math.min(255, b + 45) : b
    }
  }
  const crc32 = (buf: Buffer) => {
    let c = ~0
    for (const byte of buf) {
      c ^= byte
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1))
    }
    return ~c >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type, 'latin1')
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
    return Buffer.concat([len, t, data, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolor
  const idat = deflateSync(raw)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ])
}

/** PDF صغير حقيقي صالح البنية (%PDF-1.4 + صفحة واحدة + xref) */
function makePdf(title: string): Buffer {
  const text = title.replace(/[^\u0000-\u00ff]/g, '?')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length + 40} >>\nstream\nBT /F1 18 Tf 72 770 Td (${text}) Tj ET\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xrefPos = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  offsets.forEach((off) => { out += `${String(off).padStart(10, '0')} 00000 n \n` })
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`
  return Buffer.from(out, 'latin1')
}

async function j(url: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${url}`, init)
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body, headers: res.headers }
}

async function main() {
  console.log('الهدف:', BASE)

  // 1) حساب معلم مؤقت عبر signup العام (يُنشئ سنة افتراضية بالهجري تلقائيًا)
  const signup = await j('/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD }),
  })
  if (signup.status !== 201 && signup.status !== 200) {
    console.error('فشل إنشاء الحساب:', signup.status, signup.body)
    process.exit(1)
  }
  const login = await j('/api/session', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''
  const H = { cookie }
  console.log('✓ حساب مؤقت:', EMAIL)

  // بيانات الترويسة الرسمية (اسم/جنس/إدارة/مكتب/مدير) — تُظهر الترويسة كاملة في التقرير
  await j('/api/profile', {
    method: 'PUT', headers: { ...H, 'content-type': 'application/json' },
    body: JSON.stringify({ name: NAME, gender: 'MALE', educationAdmin: 'إدارة تعليم الرياض', educationOffice: 'مكتب تعليم شمال الرياض', principalName: 'عبدالله المطيري' }),
  })

  // 2) سنة دراسية
  const me = await j('/api/me', { headers: H })
  let yearId: string | undefined = me.body.year?.id ?? me.body.years?.[0]?.id
  if (!yearId) {
    const y = await j('/api/years', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ label: '1448هـ' }) })
    yearId = y.body.years?.[0]?.id ?? y.body.year?.id
  }
  console.log('✓ سنة:', yearId)

  // 3) الشواهد: صورتان + PDF (رفع فعلي عبر الوكيل)
  const up = async (name: string, buf: Buffer, type: string) => {
    const fd = new FormData()
    fd.append('file', new Blob([new Uint8Array(buf)], { type }), name)
    fd.append('yearId', yearId ?? '')
    const res = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: H, body: fd })
    const body = await res.json().catch(() => ({}))
    if (res.status !== 201) {
      console.error(`فشل رفع ${name}:`, res.status, body)
      process.exit(1)
    }
    return body.attachment as { id: string; kind: string; url?: string }
  }
  const img1 = await up('صورة قاعة الاختبار.png', makePng(640, 420, 14, 127, 110, 1), 'image/png')
  const img2 = await up('صورة تنفيذ النشاط.png', makePng(640, 420, 46, 94, 168, 2), 'image/png')
  console.log('✓ صورتان PNG:', img1.id, img2.id, '| urls =', img1.url, '|', img2.url)

  const pdf = await up('خطة تنفيذ البرنامج.pdf', makePdf('Test Evidence Document'), 'application/pdf')
  console.log('✓ PDF:', pdf.id, '| url =', pdf.url)

  // 4) رابط شاهد خارجي
  const link = await j('/api/attachments', {
    method: 'POST', headers: { ...H, 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'LINK', title: 'توثيق النشاط على منصة مدرستي', url: 'https://schools.madrasati.sa/activities/qa-patch', yearId }),
  })
  if (link.status !== 201) { console.error('فشل الرابط:', link.status, link.body); process.exit(1) }
  console.log('✓ رابط خارجي:', link.body.attachment.id)

  // 5) إنجاز PART 6 كامل الحقول + الشواهد الأربعة مربوطة
  const ach = await j('/api/achievements', {
    method: 'POST', headers: { ...H, 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'INITIATIVE',
      title: 'مبادرة «سفراء القراءة الرقمية»',
      status: 'COMPLETED',
      yearId,
      date: new Date().toISOString().slice(0, 10),
      description: 'مبادرة نوعية لتنمية مهارات القراءة الرقمية الآمنة لدى طلاب المرحلة المتوسطة عبر محطات أسبوعية موجهة داخل مكتبة المدرسة.',
      goalText: 'رفع مستوى الوعي القرائي الرقمي ومهارات التحقق من المعلومات لدى الطلاب المشاركين.',
      problem: 'لاحظ الفريق تراجعًا في تمييز الطلاب للمصادر الموثوقة أثناء البحث الرقمي، مع اعتماد واسع على أول نتيجة تظهر في المحركات دون تحقق.',
      execution: 'نُفذت المبادرة على أربع محطات أسبوعية داخل مكتبة المدرسة: تدريب على استراتيجيات البحث، ثم ورشة التحقق من المصادر، فتحدي القراءة النقدية، وأخيرًا معرض المنتجات الرقمية.',
      actions: '1. التهيئة وتحديد الفئة المستهدفة.\n2. بناء أدلة المحطات الأربع مع فريق اللغة العربية.\n3. التنفيذ الأسبوعي والتوثيق المصور.\n4. القياس الختامي وعرض المنتجات.',
      results: 'أسهم التنفيذ في تعزيز ثقافة التحقق من المصادر لدى المشاركين، وأنتج الطلاب مواد عرض رقمية موثقة داخل القاعة.',
      impact: 'تجاوز أثر المبادرة حدود الفصل المشارك؛ إذ تبنت المدرسة المحطات نشاطًا دائمًا في الخطة الفصلية، واطلع أولياء الأمور على منتجات أبنائهم عبر منصة مدرستي.',
      notes: 'شاهد مرافق: خطة التنفيذ التفصيلية وتوثيق المحطات.',
      beneficiaries: 'طلاب المرحلة المتوسطة',
      beneficiariesCount: 42,
      durationText: 'أربعة أسابيع',
      attachmentIds: [img1.id, img2.id, pdf.id, link.body.attachment.id],
    }),
  })
  if (ach.status !== 201) { console.error('فشل الإنجاز:', ach.status, ach.body); process.exit(1) }
  console.log('✓ إنجاز PART 6:', ach.body.achievement.id)

  // 6) إنجازات إضافية طويلة (10+ صفحات للتقرير الكامل — PART 8)
  for (let i = 1; i <= 6; i++) {
    const long = 'نفّذ النشاط على مدى أسابيع بمراحل متدرجة شملت التهيئة والتخطيط والتنفيذ والمتابعة والقياس مع توثيق مستمر ومشاركة فاعلة من الطلبة والمعلمين والإدارة. '.repeat(6)
    await j('/api/achievements', {
      method: 'POST', headers: { ...H, 'content-type': 'application/json' },
      body: JSON.stringify({
        type: i % 2 === 0 ? 'PRACTICE' : 'INITIATIVE',
        title: `نشاط توثيقي رقم ${i} — مراجعة أدوات التقويم الصفي`,
        status: 'COMPLETED', yearId,
        description: `وصف توثيقي تفصيلي للنشاط رقم ${i} ضمن ملف الإنجاز.`,
        problem: long.slice(0, 600),
        execution: long,
        results: long.slice(0, 800),
        impact: long.slice(0, 500),
      }),
    })
  }
  console.log('✓ 6 إنجازات إضافية طويلة (لتقرير 10+ صفحات)')

  // 7) تحقق فوري: كل روابط الشواهد مشتقة
  const report = await j(`/api/report?yearId=${yearId}`, { headers: H })
  const a = (report.body.achievements ?? []).find((x: any) => x.title.includes('سفراء القراءة'))
  const links = a?.links ?? []
  console.log('✓ روابط الإنجاز في التقرير:', links.map((l: any) => `${l.attachment?.kind}:${l.attachment?.url ? 'url✓' : 'NULL'}`).join(' | '))
  const allUrls = links.length === 4 && links.every((l: any) => Boolean(l.attachment?.url))

  console.log(`\nCREDENTIALS=${EMAIL}|${PASSWORD}`)
  console.log(`ACHIEVEMENT_ID=${ach.body.achievement.id}`)
  console.log(allUrls ? 'SETUP=OK' : 'SETUP=FAIL')
  process.exit(allUrls ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
