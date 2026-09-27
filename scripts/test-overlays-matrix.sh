#!/bin/bash
# مصفوفة اختبار overlays — قياس حي لكل عرض: Select الإنجاز + محدد السنة
# الاستخدام: bash /home/z/my-project/scripts/test-overlays-matrix.sh
set -u
RESULTS=""
for W in 360 375 390 412; do
  agent-browser set viewport $W 740 >/dev/null 2>&1
  agent-browser wait 400 >/dev/null 2>&1
  # فتح Select الإنجاز (combobox «اختيار الإنجاز»)
  REF=$(agent-browser snapshot -i 2>/dev/null | grep 'combobox "اختيار الإنجاز"' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
  agent-browser find role combobox click --name "اختيار الإنجاز" >/dev/null 2>&1
  agent-browser wait 600 >/dev/null 2>&1
  SEL=$(agent-browser eval "(() => { const c = document.querySelector('[data-slot=select-content]'); if (!c) return JSON.stringify({err:'no-content'}); const r = c.getBoundingClientRect(); const se = document.scrollingElement; return JSON.stringify({ l: Math.round(r.left), rr: Math.round(r.right), w: Math.round(r.width), okL: r.left >= 0, okR: r.right <= window.innerWidth, hs: se.scrollWidth > se.clientWidth }); })()" 2>/dev/null | tr -d '"' | sed 's/^"//;s/"$//')
  agent-browser press Escape >/dev/null 2>&1; agent-browser wait 300 >/dev/null 2>&1
  # فتح محدد السنة (زر «تبديل العام الدراسي»)
  agent-browser find role button click --name "تبديل العام الدراسي" >/dev/null 2>&1
  agent-browser wait 500 >/dev/null 2>&1
  DD=$(agent-browser eval "(() => { const c = document.querySelector('[data-slot=dropdown-menu-content]'); if (!c) return JSON.stringify({err:'no-content'}); const r = c.getBoundingClientRect(); return JSON.stringify({ l: Math.round(r.left), rr: Math.round(r.right), w: Math.round(r.width), okL: r.left >= 0, okR: r.right <= window.innerWidth }); })()" 2>/dev/null | tr -d '"' | sed 's/^"//;s/"$//')
  agent-browser press Escape >/dev/null 2>&1; agent-browser wait 300 >/dev/null 2>&1
  RESULTS="$RESULTS
${W}px | Select: $SEL | YearMenu: $DD"
done
echo "==== OVERLAY MATRIX (after fix) ====$RESULTS"
