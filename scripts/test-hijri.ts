/**
 * اختبار منطق التحويل الهجري أم القرى — قبل الدمج في الواجهة
 * تشغيل: bun scripts/test-hijri.ts
 */
import {
  toHijri, fromHijri, hijriMonthLength, isValidHijri, formatHijri,
  storedToHijri, hijriToISOInput, dateToISOInput, hijriToday,
} from '../src/lib/hijri'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${extra}`) }
}

console.log('── 1) اليوم والدقة الأساسية ──')
const today = hijriToday()
console.log(`  اليوم: ${formatHijri(new Date())}`)
check('اليوم هجري صالح (سنة 1440-1460 تقريبًا)', today.year > 1440 && today.year < 1460, JSON.stringify(today))

console.log('── 2) ذهاب/عودة (round-trip) عبر سنة كاملة ──')
let rtFail = 0
for (let hm = 1; hm <= 12; hm++) {
  const len = hijriMonthLength(1448, hm)
  if (len !== 29 && len !== 30) { rtFail++; console.log(`  ✗ طول شهر ${hm} غير منطقي: ${len}`) }
  for (let hd = 1; hd <= len; hd++) {
    const g = fromHijri(1448, hm, hd)
    if (!g) { rtFail++; continue }
    const back = toHijri(g)
    if (back.year !== 1448 || back.month !== hm || back.day !== hd) {
      rtFail++
      if (rtFail < 6) console.log(`  ✗ ${hd}/${hm}/1448 → ${g.toISOString()} → ${JSON.stringify(back)}`)
    }
  }
}
check('1448هـ كاملة: كل يوم يذهب ويعود بدقة', rtFail === 0, `أعطال: ${rtFail}`)

console.log('── 3) تواريخ مرجعية معروفة (أم القرى) ──')
// 2026-09-26 = 15 ربيع الآخر 1448 (تم التحقق عبر Intl أعلاه)
check('2026-09-26 → 15 ربيع الآخر 1448', formatHijri('2026-09-26') === '15 ربيع الآخر 1448 هـ', formatHijri('2026-09-26'))
// 1 رمضان 1448 ≈ 2027-02-08 (تقويم أم القرى) — نتحقق عبر fromHijri
const ramadan1 = fromHijri(1448, 9, 1)
check('1 رمضان 1448 موجود (يتبدل الشهر صحيحًا)', ramadan1 !== null)
if (ramadan1) {
  const back = toHijri(ramadan1)
  check('1 رمضان 1448 round-trip', back.month === 9 && back.day === 1 && back.year === 1448, JSON.stringify(back))
  console.log(`    1 رمضان 1448هـ = ${dateToISOInput(ramadan1)}م`)
}
// 9 ذو الحجة (يوم عرفة) موجود
const arafa = fromHijri(1448, 12, 9)
check('9 ذو الحجة 1448 موجود', arafa !== null)
if (arafa) console.log(`    9 ذو الحجة 1448هـ = ${dateToISOInput(arafa)}م`)
// آخر يوم في السنة → أول يوم في السنة التالية = +1 ميلادي
const last1448 = fromHijri(1448, 12, hijriMonthLength(1448, 12))
const first1449 = fromHijri(1449, 1, 1)
if (last1448 && first1449) {
  const gap = Math.round((first1449.getTime() - last1448.getTime()) / 86400000)
  check('انتقال السنة الهجرية متصل (فارق يوم واحد)', gap === 1, `فارق: ${gap}`)
}

console.log('── 4) التواريخ غير الصالحة ──')
const len12 = hijriMonthLength(1448, 12)
check(`اليوم ${len12 + 1} في ذي الحجة مرفوض`, fromHijri(1448, 12, len12 + 1) === null || (len12 === 29 && fromHijri(1448, 12, 30) === null))
check('شهر 13 مرفوض', fromHijri(1448, 13, 1) === null)
check('يوم 0 مرفوض', fromHijri(1448, 5, 0) === null)
check('سنة بعيدة مرفوضة', fromHijri(900, 1, 1) === null)
check('isValidHijri يتطابق مع fromHijri', isValidHijri(1448, 12, 30) === (fromHijri(1448, 12, 30) !== null))

console.log('── 5) حدود فبرايل/الميلادي الداخلية ──')
// قيم ISO بتاريخ فقط تُقرأ حرفيًا دون انزياح منطقة زمنية
check('ISO بتاريخ فقط يُقرأ كما هو (2028-02-29)', formatHijri('2028-02-29') !== '—' && storedToHijri('2028-02-29') !== null)
const h = storedToHijri('2028-02-29')
if (h) {
  const iso = hijriToISOInput(h.year, h.month, h.day)
  check('round-trip عبر 2028-02-29 (كبيسة)', iso === '2028-02-29', `عاد: ${iso}`)
}
check('تاريخ فارغ → —', formatHijri(null) === '—' && formatHijri('') === '—')
check('تاريخ تالف → —', formatHijri('not-a-date') === '—')

console.log('── 6) أطوال الأشهر تتبدل فعليًا حسب السنة/الشهر ──')
const lengths = new Set<number>()
for (let y = 1447; y <= 1449; y++) for (let m = 1; m <= 12; m++) lengths.add(hijriMonthLength(y, m))
check('توجد أشهر 29 و30 (جدول حقيقي لا ثابت)', lengths.has(29) && lengths.has(30), [...lengths].join(','))

console.log(`\nالنتيجة: ${pass} نجاح / ${fail} فشل`)
process.exit(fail ? 1 : 0)
