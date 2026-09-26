#!/bin/bash
# gen-reports.sh — يولّد كل أنواع التقارير PDF عبر المتصفح للفحص البصري
# الاستخدام: bash scripts/gen-reports.sh [teacher_email] [password]
EMAIL=${1:-sultan@madrasati.sa}
PASS=${2:-***REMOVED-DEV-SECRET***}
cd /home/z/my-project

gen () {
  local mode="$1"; local out="$2"; local extra="$3"
  agent-browser open http://localhost:3000/ >/dev/null 2>&1
  sleep 2
  # اذهب لصفحة التقارير
  agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim().includes('التقارير'));if(b){b.click();return 'nav'}return 'no'})()" >/dev/null
  sleep 1.5
  # المخصص: اختر أول مجالين ذي محتوى
  if [ "$mode" = "custom" ]; then
    agent-browser eval "(()=>{const boxes=[...document.querySelectorAll('label')].filter(l=>l.querySelector('input[type=checkbox]'));boxes[1]?.click();boxes[4]?.click();return 'custom:'+boxes.length})()" >/dev/null
    sleep 0.6
  fi
  # اضغط زر الإنشاء المناسب (ترتيب الأزرار: كامل، ملخص، أثر، تطوير، مبادرات، مخصص)
  agent-browser eval "(()=>{const btns=[...document.querySelectorAll('button')].filter(x=>x.textContent.includes('إنشاء PDF')||x.textContent.includes('إنشاء التقرير'));const idx={full:0,summary:1,impact:2,pd:3,initiatives:4,custom:5}['$mode'];if(btns[idx]){btns[idx].click();return 'gen:$mode'}return 'no:'+btns.length})()" >/dev/null
  # انتظر التحميل والصور
  sleep 4
  agent-browser pdf "screenshots/$out" 2>&1 | tail -1
  pdfinfo "screenshots/$out" 2>/dev/null | rg "Pages|File size" | tr '\n' ' '
  echo "  <- $out"
}

# تسجيل الدخول مرة واحدة
agent-browser open http://localhost:3000/ >/dev/null 2>&1
sleep 2
agent-browser eval "(()=>{const e=document.querySelector('input[type=email]');const p=document.querySelector('input[type=password]');if(e&&p){return 'login-form'}return 'already'})()" | rg -q "login-form" && {
  agent-browser find role textbox fill --name "البريد الإلكتروني" "$EMAIL" >/dev/null 2>&1 || true
  agent-browser find role textbox fill --name "كلمة المرور" "$PASS" >/dev/null 2>&1 || true
  agent-browser find role button click --name "تسجيل الدخول" >/dev/null 2>&1 || true
  sleep 2.5
}

gen full   report-full-v4.pdf
gen summary report-summary-v4.pdf
gen impact report-impact-v4.pdf
gen pd     report-pd-v4.pdf
gen initiatives report-initiatives-v4.pdf
gen custom report-custom-v4.pdf
echo "=== all generated ==="
