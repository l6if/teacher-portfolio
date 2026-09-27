#!/bin/bash
# اختبار المعاينة على الجوال: تولبار (رجوع+طباعة+PDF) ظاهر، لا تمرير أفقي، شريط التنقل فوق شريط التطبيق
set -u
echo "==== MOBILE PREVIEW MATRIX ===="
for W in 320 360 375 390 412; do
  agent-browser set viewport $W 780 >/dev/null 2>&1
  agent-browser wait 500 >/dev/null 2>&1
  R=$(agent-browser snapshot -i 2>/dev/null | grep "معاينة التقرير" | sed -n '4p' | grep -oE 'e[0-9]+')
  [ -z "$R" ] && { echo "$W: NO PREVIEW BUTTON"; continue; }
  agent-browser click @$R >/dev/null 2>&1
  agent-browser wait 6000 >/dev/null 2>&1
  RES=$(agent-browser eval "
(() => {
  const o = document.querySelector('#report-preview-overlay');
  if (!o) return JSON.stringify({ err: 'no-overlay' });
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > 0 && r.left <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight + 1; };
  const btns = Array.from(o.querySelectorAll('.rp-toolbar button'));
  const back = btns.find(b => b.textContent.includes('رجوع'));
  const print = btns.find(b => b.textContent.includes('طباعة'));
  const pdf = btns.find(b => b.textContent.includes('PDF'));
  const zoom = btns.filter(b => /تصغير|تكبير|ملاءمة/.test(b.getAttribute('aria-label') || ''));
  const nav = o.querySelector('.rp-nav');
  const navR = nav ? nav.getBoundingClientRect() : null;
  const se = document.scrollingElement;
  return JSON.stringify({
    back: Boolean(back && vis(back)), print: Boolean(print && vis(print)), pdf: Boolean(pdf && vis(pdf)),
    zoomButtons: zoom.filter(z => vis(z)).length,
    navVisible: navR ? (navR.left >= 0 && navR.right <= window.innerWidth && navR.bottom <= window.innerHeight) : false,
    horizScroll: se.scrollWidth > se.clientWidth,
    pages: o.querySelectorAll('.rp-card').length,
  });
})()" 2>/dev/null | tr -d '"')
  # إغلاق المعاينة للعرض التالي
  agent-browser eval "
(() => { const o = document.querySelector('#report-preview-overlay'); if (o) { const b = Array.from(o.querySelectorAll('button')).find(x => x.textContent.includes('رجوع')); if (b) b.click(); } return 'ok'; })()" >/dev/null 2>&1
  agent-browser wait 900 >/dev/null 2>&1
  echo "${W}px | $RES"
done
