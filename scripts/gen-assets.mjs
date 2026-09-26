// توليد أصول بصرية للشواهد التجريبية — شهادات، رسوم، صور توضيحية
import { writeFileSync, mkdirSync } from 'fs'

const OUT = '/home/z/my-project/public/uploads'
mkdirSync(OUT, { recursive: true })

const EMERALD = '#0e7f6e'
const EMERALD_D = '#0a5d51'
const EMERALD_L = '#e3f2ef'
const GOLD = '#c9a227'
const INK = '#1f2d2a'
const MUTED = '#6b7a76'

const font = "Tahoma, 'Noto Sans Arabic', 'Segoe UI', sans-serif"

function save(name, svg) {
  writeFileSync(`${OUT}/${name}`, svg, 'utf8')
  console.log('✓', name)
}

// ─── شهادات ───────────────────────────────────────────────────
function certificate({ title, subtitle, body, footer, seal = true }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="707" viewBox="0 0 1000 707">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fdfcf7"/><stop offset="1" stop-color="#f6f3ea"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d9b64a"/><stop offset=".5" stop-color="${GOLD}"/><stop offset="1" stop-color="#a8851c"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="707" fill="url(#bg)"/>
  <rect x="26" y="26" width="948" height="655" fill="none" stroke="${EMERALD}" stroke-width="3.5" rx="6"/>
  <rect x="40" y="40" width="920" height="627" fill="none" stroke="url(#gold)" stroke-width="1.6" rx="4"/>
  <rect x="40" y="40" width="920" height="96" fill="${EMERALD_L}" rx="4"/>
  <text x="500" y="102" text-anchor="middle" font-family="${font}" font-size="40" font-weight="700" fill="${EMERALD_D}">المملكة العربية السعودية — وزارة التعليم</text>
  <text x="500" y="205" text-anchor="middle" font-family="${font}" font-size="52" font-weight="700" fill="${INK}">${title}</text>
  <text x="500" y="255" text-anchor="middle" font-family="${font}" font-size="26" fill="${MUTED}">${subtitle}</text>
  <line x1="330" y1="285" x2="670" y2="285" stroke="url(#gold)" stroke-width="2.5"/>
  <text x="500" y="345" text-anchor="middle" font-family="${font}" font-size="30" fill="${INK}">تُمنح هذه الشهادة إلى</text>
  <text x="500" y="410" text-anchor="middle" font-family="${font}" font-size="46" font-weight="700" fill="${EMERALD_D}">الأستاذ / سلطان بن حمد الحربي</text>
  <text x="500" y="470" text-anchor="middle" font-family="${font}" font-size="24" fill="${MUTED}">${body}</text>
  ${seal ? `<g transform="translate(780,560)">
    <circle r="58" fill="none" stroke="url(#gold)" stroke-width="3"/>
    <circle r="48" fill="none" stroke="${EMERALD}" stroke-width="1.5"/>
    <path d="M0,-30 L8,-8 L32,-8 L12,6 L20,30 L0,16 L-20,30 L-12,6 L-32,-8 L-8,-8 Z" fill="${GOLD}" opacity=".85"/>
    <text y="52" text-anchor="middle" font-family="${font}" font-size="11" fill="${MUTED}">ختم الاعتماد</text>
  </g>` : ''}
  <g>
    <line x1="120" y1="600" x2="330" y2="600" stroke="${MUTED}" stroke-width="1.5"/>
    <text x="225" y="628" text-anchor="middle" font-family="${font}" font-size="19" fill="${MUTED}">${footer.right}</text>
    <line x1="670" y1="600" x2="880" y2="600" stroke="${MUTED}" stroke-width="1.5"/>
    <text x="775" y="628" text-anchor="middle" font-family="${font}" font-size="19" fill="${MUTED}">${footer.left}</text>
  </g>
</svg>`
}

save('cert-active-learning.svg', certificate({
  title: 'شهادة إتمام برنامج تدريبي',
  subtitle: 'ورشة العمل: استراتيجيات التعلم النشط',
  body: 'إثراءً لمهاراته المهنية وحرصًا على تطوير ممارساته التدريسية',
  footer: { right: 'مكتب التعليم — شرق الرياض', left: 'المشرف التربوي / عبدالله السالم' },
}))

save('cert-thanks.svg', certificate({
  title: 'شهادة شكر وتقدير',
  subtitle: 'وذلك نظير جهوده المتميزة وعطاءه المثمر',
  body: 'تقديرًا لإسهاماته الفاعلة في المناخ المدرسي ودعم مسيرة التعلم',
  footer: { right: 'متوسطة الملك عبدالعزيز', left: 'مديرة المدرسة / نورة القحطاني' },
}))

save('cert-assessment.svg', certificate({
  title: 'شهادة إتمام دورة تدريبية',
  subtitle: 'التقويم التكويني الرقمي — 12 ساعة تدريبية',
  body: 'لاكتسابه المهارات المعلنة في وصف الدورة التدريبية بمستوى إتقان مرتفع',
  footer: { right: 'الأكاديمية المهنية للمعلمين', left: 'مدرب الدورة / د. سعد المطيري' },
}))

save('cert-teacher-day.svg', certificate({
  title: 'شهادة تكريم',
  subtitle: 'بمناسبة اليوم العالمي للمعلم',
  body: 'وفاءً وتقديرًا لجهوده المخلصة في بناء الأجيال',
  footer: { right: 'إدارة التعليم — منطقة الرياض', left: 'مدير عام التعليم' },
}))

// ─── رسم بياني: أثر الخطة العلاجية ────────────────────────────
save('chart-reading.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c9d7d3"/><stop offset="1" stop-color="#e8efed"/>
    </linearGradient>
    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${EMERALD}"/><stop offset="1" stop-color="#12907c"/>
    </linearGradient>
  </defs>
  <rect width="900" height="620" fill="#ffffff" rx="0"/>
  <text x="450" y="70" text-anchor="middle" font-family="${font}" font-size="30" font-weight="700" fill="${INK}">أثر الخطة العلاجية في مهارة القراءة — الصف السابع</text>
  <text x="450" y="105" text-anchor="middle" font-family="${font}" font-size="18" fill="${MUTED}">نسبة إتقان الطلاب المستهدفين (ن = 18)</text>
  <line x1="120" y1="140" x2="120" y2="520" stroke="#d7e0dd" stroke-width="2"/>
  <line x1="120" y1="520" x2="820" y2="520" stroke="#d7e0dd" stroke-width="2"/>
  <g font-family="${font}" font-size="15" fill="${MUTED}" text-anchor="end">
    <text x="108" y="525">0%</text><text x="108" y="440">25%</text><text x="108" y="355">50%</text><text x="108" y="270">75%</text><text x="108" y="185">100%</text>
  </g>
  <g stroke="#e4ebe9" stroke-dasharray="5 6"><line x1="120" y1="440" x2="820" y2="440"/><line x1="120" y1="355" x2="820" y2="355"/><line x1="120" y1="270" x2="820" y2="270"/><line x1="120" y1="185" x2="820" y2="185"/></g>
  <line x1="120" y1="196" x2="820" y2="196" stroke="${GOLD}" stroke-width="2.5" stroke-dasharray="10 7"/>
  <text x="812" y="185" text-anchor="end" font-family="${font}" font-size="16" fill="${GOLD}">المستهدف 85%</text>
  <g>
    <rect x="210" y="270" width="170" height="250" rx="10" fill="url(#g1)"/>
    <text x="295" y="248" text-anchor="middle" font-family="${font}" font-size="34" font-weight="700" fill="${MUTED}">58%</text>
    <text x="295" y="555" text-anchor="middle" font-family="${font}" font-size="20" fill="${INK}">القياس القبلي</text>
  </g>
  <g>
    <rect x="520" y="185" width="170" height="335" rx="10" fill="url(#g2)"/>
    <text x="605" y="163" text-anchor="middle" font-family="${font}" font-size="34" font-weight="700" fill="${EMERALD_D}">83%</text>
    <text x="605" y="555" text-anchor="middle" font-family="${font}" font-size="20" fill="${INK}">القياس البعدي</text>
  </g>
  <g transform="translate(413,320)">
    <path d="M0,-14 L14,0 L0,14 L-14,0 Z" fill="${EMERALD}"/>
    <text x="0" y="38" text-anchor="middle" font-family="${font}" font-size="22" font-weight="700" fill="${EMERALD_D}">+25</text>
  </g>
  <text x="450" y="600" text-anchor="middle" font-family="${font}" font-size="16" fill="${MUTED}">مدة التنفيذ: 4 أسابيع — رصد أسبوعي للتقدم</text>
</svg>`)

// ─── صور توضيحية (أسلوب مسطح) ────────────────────────────────
function photoFrame(inner, caption, tag) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f0f7f5"/><stop offset="1" stop-color="#e3efec"/>
    </linearGradient>
  </defs>
  <rect width="900" height="620" fill="url(#sky)"/>
  <circle cx="80" cy="80" r="120" fill="#d3e8e2" opacity=".55"/>
  <circle cx="840" cy="540" r="150" fill="#d3e8e2" opacity=".4"/>
  ${inner}
  <rect x="0" y="500" width="900" height="120" fill="#ffffff" opacity=".94"/>
  <text x="450" y="556" text-anchor="middle" font-family="${font}" font-size="24" font-weight="700" fill="${INK}">${caption}</text>
  <text x="450" y="590" text-anchor="middle" font-family="${font}" font-size="16" fill="${MUTED}">${tag}</text>
</svg>`
}

function student(x, y, color, size = 1) {
  return `<g transform="translate(${x},${y}) scale(${size})">
    <circle cx="0" cy="-14" r="15" fill="${color}"/>
    <rect x="-19" y="4" width="38" height="34" rx="13" fill="${color}" opacity=".82"/>
  </g>`
}

save('photo-initiative.svg', photoFrame(`
  <g transform="translate(450,250)">
    <rect x="-160" y="70" width="70" height="26" rx="6" fill="#b8d8d0"/>
    <rect x="-140" y="96" width="70" height="26" rx="6" fill="#a5cfc5"/>
    <rect x="-120" y="122" width="70" height="26" rx="6" fill="#8fc2b6"/>
    <rect x="-100" y="148" width="70" height="26" rx="6" fill="#7ab3a6"/>
    <g transform="rotate(-8)">
      <path d="M-20,95 L-20,20 Q45,-8 110,20 L110,95 Z" fill="${EMERALD}"/>
      <path d="M20,95 L20,20 Q45,6 70,20 L70,95 Z" fill="#ffffff" opacity=".28"/>
      <line x1="45" y1="14" x2="45" y2="95" stroke="#ffffff" stroke-width="3" opacity=".5"/>
    </g>
    <g transform="rotate(9) translate(120,0)">
      <path d="M-20,95 L-20,20 Q45,-8 110,20 L110,95 Z" fill="#12907c"/>
      <line x1="45" y1="14" x2="45" y2="95" stroke="#ffffff" stroke-width="3" opacity=".5"/>
    </g>
    <g fill="${GOLD}">
      <circle cx="-190" cy="-10" r="7"/><circle cx="-210" cy="30" r="5"/>
      <circle cx="205" cy="-30" r="7"/><circle cx="230" cy="12" r="5"/>
      <path d="M-60,-60 l4,10 10,4 -10,4 -4,10 -4,-10 -10,-4 10,-4 Z"/>
      <path d="M150,-70 l3,8 8,3 -8,3 -3,8 -3,-8 -8,-3 8,-3 Z"/>
    </g>
  </g>
  ${student(180, 320, '#3c5750')}
  ${student(700, 300, '#946b4a')}
  ${student(240, 420, '#946b4a', .8)}
  ${student(660, 420, '#3c5750', .8)}
`, 'مبادرة القراءة الواعية', 'أسبوع القراءة — متوسطة الملك عبدالعزيز — سبتمبر 2026'))

save('photo-coop.svg', photoFrame(`
  <g>
    <rect x="230" y="260" width="440" height="30" rx="15" fill="#c69a6b"/>
    <rect x="245" y="290" width="410" height="130" fill="#e8dcc9"/>
  </g>
  ${student(300, 250, '#3c5750')}
  ${student(450, 245, '#946b4a')}
  ${student(600, 250, '#5d7d74')}
  ${student(370, 420, '#946b4a', .85)}
  ${student(530, 420, '#3c5750', .85)}
  <g transform="translate(450,120)">
    <rect x="-95" y="-38" width="190" height="62" rx="20" fill="${EMERALD}"/>
    <path d="M-20,24 L-34,44 L-6,24 Z" fill="${EMERALD}"/>
    <text x="0" y="2" text-anchor="middle" font-family="${font}" font-size="21" font-weight="700" fill="#ffffff">مجموعات العمل</text>
  </g>
  <g transform="translate(250,110)">
    <rect x="-70" y="-30" width="140" height="46" rx="16" fill="#ffffff" stroke="#cfe0dc"/>
    <text x="0" y="2" text-anchor="middle" font-family="${font}" font-size="16" fill="${EMERALD_D}">تحليل النص</text>
  </g>
  <g transform="translate(655,110)">
    <rect x="-70" y="-30" width="140" height="46" rx="16" fill="#ffffff" stroke="#cfe0dc"/>
    <text x="0" y="2" text-anchor="middle" font-family="${font}" font-size="16" fill="${EMERALD_D}">عرض النتائج</text>
  </g>
`, 'التعلم التعاوني — درس الظواهر اللغوية', 'توثيق الممارسة الصفية — الصف الثالث المتوسط'))

save('photo-exhibition.svg', photoFrame(`
  <g>
    <rect x="120" y="150" width="230" height="170" rx="10" fill="#ffffff" stroke="#d5e4e0" stroke-width="4"/>
    <rect x="140" y="170" width="190" height="130" fill="${EMERALD_L}"/>
    <text x="235" y="245" text-anchor="middle" font-family="${font}" font-size="19" fill="${EMERALD_D}">إبداعات الطلاب</text>
    <rect x="560" y="150" width="230" height="170" rx="10" fill="#ffffff" stroke="#d5e4e0" stroke-width="4"/>
    <rect x="580" y="170" width="190" height="130" fill="#f6efdd"/>
    <text x="675" y="245" text-anchor="middle" font-family="${font}" font-size="19" fill="#8a6d14">معرض المخطوطات</text>
    <rect x="340" y="200" width="230" height="120" rx="10" fill="#ffffff" stroke="#d5e4e0" stroke-width="4"/>
    <rect x="360" y="220" width="190" height="80" fill="#dbeae6"/>
    <text x="455" y="268" text-anchor="middle" font-family="${font}" font-size="19" fill="${EMERALD_D}">ركن القصة</text>
    <path d="M330,340 Q450,400 570,340 L570,360 Q450,420 330,360 Z" fill="${GOLD}" opacity=".8"/>
    ${student(250, 400, '#3c5750', .9)}
    ${student(640, 400, '#946b4a', .9)}
    ${student(450, 430, '#5d7d74', .95)}
  </g>
`, 'معرض المواهب والقدرات', 'المشاركات المدرسية — العام الدراسي 1448هـ'))

// ─── مستندات ─────────────────────────────────────────────────
function docPage({ title, subtitle, lines, table = false }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="920" viewBox="0 0 700 920">
  <rect width="700" height="920" fill="#ffffff"/>
  <rect x="0" y="0" width="700" height="120" fill="${EMERALD}"/>
  <rect x="0" y="120" width="700" height="8" fill="${GOLD}"/>
  <text x="350" y="58" text-anchor="middle" font-family="${font}" font-size="27" font-weight="700" fill="#ffffff">${title}</text>
  <text x="350" y="95" text-anchor="middle" font-family="${font}" font-size="17" fill="#d8ece8">${subtitle}</text>
  <g fill="#eef2f1">
    ${lines.map((w, i) => `<rect x="${i % 3 === 0 ? 90 : 70}" y="${190 + i * 44}" width="${w}" height="17" rx="8"/>`).join('\n    ')}
  </g>
  ${table ? `<g>
    <rect x="70" y="620" width="560" height="200" rx="8" fill="none" stroke="#d7e0dd" stroke-width="2"/>
    <line x1="70" y1="670" x2="630" y2="670" stroke="#d7e0dd" stroke-width="2"/>
    <line x1="70" y1="720" x2="630" y2="720" stroke="#d7e0dd" stroke-width="2"/>
    <line x1="70" y1="770" x2="630" y2="770" stroke="#d7e0dd" stroke-width="2"/>
    <line x1="350" y1="620" x2="350" y2="820" stroke="#d7e0dd" stroke-width="2"/>
    <text x="210" y="652" text-anchor="middle" font-family="${font}" font-size="16" fill="${MUTED}">البند</text>
    <text x="490" y="652" text-anchor="middle" font-family="${font}" font-size="16" fill="${MUTED}">التفصيل</text>
    <rect x="100" y="690" width="180" height="14" rx="7" fill="#eef2f1"/>
    <rect x="380" y="690" width="220" height="14" rx="7" fill="#eef2f1"/>
    <rect x="100" y="740" width="150" height="14" rx="7" fill="#eef2f1"/>
    <rect x="380" y="740" width="200" height="14" rx="7" fill="#eef2f1"/>
    <rect x="100" y="790" width="170" height="14" rx="7" fill="#eef2f1"/>
    <rect x="380" y="790" width="190" height="14" rx="7" fill="#eef2f1"/>
  </g>` : ''}
  <text x="660" y="890" text-anchor="end" font-family="${font}" font-size="15" fill="#b9c6c3">ملف إنجاز المعلم — 1448هـ</text>
</svg>`
}

save('doc-remedial-plan.svg', docPage({
  title: 'خطة علاجية — مهارة القراءة',
  subtitle: 'الصف السابع / الفصل الدراسي الأول 1448هـ',
  lines: [520, 470, 500, 430, 510, 460, 490, 440, 500, 460],
  table: true,
}))

save('doc-curriculum-distribution.svg', docPage({
  title: 'توزيع منهج اللغة العربية',
  subtitle: 'المرحلة المتوسطة — الفصل الدراسي الأول 1448هـ',
  lines: [540, 480, 520, 450, 530, 470, 510, 460, 500, 440, 480, 460],
  table: true,
}))

console.log('تم توليد الأصول بنجاح')
