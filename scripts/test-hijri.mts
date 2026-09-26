/**
 * اختبار وحدة طبقة التحويل الهجري — أم القرى (src/lib/hijri.ts)
 * يتحقق من: الدوران الكامل، أطوال الأشهر، رمضان وذو الحجة، انتقال السنة،
 * التواريخ غير الصالحة، صيغة العرض، وحدود فبراير الميلادية.
 * تشغيل: bun /home/z/my-project/scripts/test-hijri.mts
 */
import {
  toHijri, fromHijri, hijriToday, hijriMonthLength, isValidHijri,
  formatHijri, storedToHijri, hijriToISOInput, dateToISOInput, HIJRI_MONTHS,
} from '../src/lib/hijri'

let pass = 0
let fail = 0
const t = (name: string, cond: boolean, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`) }
}

console.log('═'.repeat(60))
console.log('1) الدوران الكامل stored → hijri → stored (3650 يومًا متتاليًا)')
{
  let bad = 0
  const start = new Date(2015, 0, 1)
  for (let i = 0; i < 3650; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const iso = dateToISOInput(d)
    const h = storedToHijri(iso)
    const back = h ? hijriToISOInput(h.year, h.month, h.day) : null
    if (!h || !back || back !== iso) {
      bad++
      if (bad <= 3) console.log(`    انزياح: ${iso} → ${h ? `${h.year}-${h.month}-${h.day}` : 'null'} → ${back}`)
    }
  }
  t('كل الأيام العشرة أعوام تعود لنفس التاريخ المخزن', bad === 0, `${bad} حالات فشل`)
}

console.log('═'.repeat(60))
console.log('2) تاريخ اليوم الهجري')
{
  const h = hijriToday()
  const back = fromHijri(h.year, h.month, h.day)
  t('اليوم صالح ويُحوَّل إلى تاريخ ميلادي', back !== null)
  t('fromHijri(toHijri(d)) يعيد نفس اليوم', back ? toHijri(back).day === h.day && toHijri(back).month === h.month : false)
}

console.log('═'.repeat(60))
console.log('3) أطوال الأشهر: كلها 29 أو 30 فقط')
{
  let bad = 0
  for (let y = 1440; y <= 1452; y++) {
    for (let m = 1; m <= 12; m++) {
      const len = hijriMonthLength(y, m)
      if (len !== 29 && len !== 30) bad++
    }
  }
  t('1440هـ–1452هـ: 156 شهرًا كلها 29 أو 30 يومًا', bad === 0, `${bad} شذوذًا`)
}

console.log('═'.repeat(60))
console.log('4) رمضان وذو الحجة عبر سنوات متعددة')
{
  const rows: string[] = []
  for (let y = 1446; y <= 1450; y++) {
    rows.push(`    ${y}هـ: رمضان ${hijriMonthLength(y, 9)} يومًا • ذو الحجة ${hijriMonthLength(y, 12)} يومًا`)
  }
  rows.forEach((r) => console.log(r))
  t('رمضان وذو الحجة دائمًا 29/30', [1446, 1447, 1448, 1449, 1450].every((y) => [29, 30].includes(hijriMonthLength(y, 9)) && [29, 30].includes(hijriMonthLength(y, 12))))
}

console.log('═'.repeat(60))
console.log('5) انتقال السنة الهجرية: ذو الحجة 30 (أو 29) → محرم')
{
  // آخر يوم في ذي الحجة 1448
  const len = hijriMonthLength(1448, 12)
  const last = fromHijri(1448, 12, len)
  const next = fromHijri(1449, 1, 1)
  t(`آخر يوم من ذي الحجة 1448 (${len} يومًا) موجود`, last !== null)
  t('1 محرم 1449 = اليوم التالي مباشرة', last && next ? next.getTime() - last.getTime() === 86400000 : false)
  const nh = next ? toHijri(next) : null
  t('toHijri(1 محرم 1449) يؤكد الشهر=1 والسنة=1449', nh ? nh.month === 1 && nh.year === 1449 && nh.day === 1 : false)
}

console.log('═'.repeat(60))
console.log('6) تواريخ غير صالحة')
{
  // ابحث عن شهر من 29 يومًا في 1448 وجرب يوم 30 فيه
  let shortMonth: [number, number] | null = null
  for (let m = 1; m <= 12; m++) if (hijriMonthLength(1448, m) === 29) { shortMonth = [1448, m]; break }
  if (shortMonth) {
    const [y, m] = shortMonth
    t(`يوم 30 من ${HIJRI_MONTHS[m - 1]} 1448 (شهر من 29) = غير صالح`, !isValidHijri(y, m, 30) && fromHijri(y, m, 30) === null)
  }
  t('شهر 13 غير صالح', fromHijri(1448, 13, 1) === null)
  t('يوم 0 غير صالح', fromHijri(1448, 1, 0) === null)
  t('يوم 31 غير صالح', fromHijri(1448, 1, 31) === null)
  t('سنة خارج النطاق (1000) غير صالحة', fromHijri(1000, 1, 1) === null)
}

console.log('═'.repeat(60))
console.log('7) صيغة العرض')
{
  // 1 ربيع الآخر 1448 هـ → تحقق من الصيغة والمعرِّف «هـ»
  const iso = hijriToISOInput(1448, 4, 16)
  const text = iso ? formatHijri(iso) : ''
  console.log(`    مثال: اختيار 16 ربيع الآخر 1448 → مخزن ${iso} → يُعرض «${text}»`)
  t('العرض بصيغة «يوم شهر سنة هـ»', /^16 ربيع الآخر 1448 هـ$/.test(text))
  t('القيمة المخزنة ISO صالحة', Boolean(iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)))
}

console.log('═'.repeat(60))
console.log('8) حدود ميلادية داخلية (فبراير وقفزات السنة)')
{
  // 29 فبراير 2028 (سنة كبيسة) يجب أن يعمل دون مشاكل
  const leap = new Date(2028, 1, 29)
  const iso = dateToISOInput(leap)
  const h = storedToHijri(iso)
  const back = h ? hijriToISOInput(h.year, h.month, h.day) : null
  console.log(`    29 فبراير 2028 → ${iso} → ${h ? `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year}هـ` : 'null'}`)
  t('فبراير الكبيس يُدار سليمًا', back === iso)
  // 28 فبراير 2027 (غير كبيسة)
  const nonLeap = dateToISOInput(new Date(2027, 1, 28))
  const h2 = storedToHijri(nonLeap)
  const back2 = h2 ? hijriToISOInput(h2.year, h2.month, h2.day) : null
  t('28 فبراير العادي يُدار سليمًا', back2 === nonLeap)
}

console.log('═'.repeat(60))
console.log('9) قيم مخزنة بصيغ مختلفة')
{
  // ISO مع وقت (كما تعيده Prisma) يجب ألا ينزاح
  const withTime = '2026-09-26T00:00:00.000Z'
  const h = storedToHijri(withTime)
  console.log(`    ${withTime} → ${h ? `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year}هـ` : 'null'}`)
  const plain = storedToHijri('2026-09-26')
  t('ISO مع وقت = نفس يوم ISO المجرد', h && plain ? h.day === plain.day && h.month === plain.month : false)
  t('null/fارغ يعرض شرطة', formatHijri(null) === '—' && formatHijri('') === '—')
}

console.log('═'.repeat(60))
console.log(`النتيجة: ${pass} ناجحًا • ${fail} فاشلًا`)
process.exit(fail === 0 ? 0 : 1)
