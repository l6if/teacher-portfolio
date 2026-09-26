#!/bin/bash
# mobile-audit.sh — يقيس التجاوز الأفقي لكل شاشة على مقاس معين
# الاستخدام: bash scripts/mobile-audit.sh 360 800
W=${1:-360}; H=${2:-800}
cd /home/z/my-project
BASE=${BASE:-http://localhost:3000}

check () {
  local label="$1"; local js="$2"
  agent-browser eval "$js" > /tmp/nav.out 2>&1
  sleep 1.2
  local m=$(agent-browser eval "JSON.stringify({sw:document.documentElement.scrollWidth,iw:window.innerWidth,h:document.querySelector('h1,h2,h3')?.textContent?.slice(0,26)||''})" 2>/dev/null | tail -1 | sed 's/\\\\//g')
  local sw=$(echo "$m" | rg -o '"sw\\?":[0-9]+' | rg -o '[0-9]+')
  local iw=$(echo "$m" | rg -o '"iw\\?":[0-9]+' | rg -o '[0-9]+')
  local title=$(echo "$m" | rg -o '"h\\?":"[^"]*"' | cut -d'"' -f4)
  if [ "$sw" -gt $((iw + 2)) ] 2>/dev/null; then
    echo "❌ $label | sw=$sw iw=$iw | $title"
  else
    echo "✅ $label | sw=$sw iw=$iw | $title"
  fi
}

click_text () { agent-browser eval "(()=>{const t='$1';const b=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim().includes(t));if(b){b.click();return 'ok'}return 'missing'})()"; }

echo "== VIEWPORT ${W}x${H} =="

# 1) الرئيسية
check "Dashboard" "1"

# 2) ملف الإنجاز
click_text "ملف إنجازي" > /dev/null; check "Portfolio" "1"

# 3) مجال (أول بطاقة مجال — زر داخل عنوانه)
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].filter(x=>x.querySelector('h3'));b[0]?.click();'ok'})()" > /dev/null
check "Section (مجال)" "1"

# 4) الشواهد
click_text "الشواهد" > /dev/null; check "Evidence" "1"

# 5) التقارير
click_text "التقارير" > /dev/null; check "Reports" "1"

# 6) الرحلة المهنية
click_text "رحلتي" > /dev/null; check "Journey" "1"

# 7) إضافة إنجاز — شاشة اختيار النوع
agent-browser eval "(()=>{const b=[...document.querySelectorAll('header button')].find(x=>x.textContent.includes('إضافة')||x.querySelector('svg'));b?.click();'ok'})()" > /dev/null
sleep 1
check "TypePicker" "1"
agent-browser screenshot screenshots/audit-${W}-typepicker.png > /dev/null 2>&1

# 8) نموذج الإنجاز (اختيار نوع)
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[data-slot=sheet-content] button')].find(x=>x.textContent.trim().length>3&&x.querySelector('svg')&&x.closest('.grid'));b?.click();'ok'})()" > /dev/null
sleep 1.5
check "AchievementForm" "1"
agent-browser screenshot screenshots/audit-${W}-form.png > /dev/null 2>&1

# إغلاق الورقة
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='إغلاق');b?.click();'ok'})()" > /dev/null
sleep 0.8

# 9) البحث الشامل
agent-browser eval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='بحث شامل');b?.click();'ok'})()" > /dev/null
sleep 1
check "SearchOverlay" "1"
agent-browser screenshot screenshots/audit-${W}-search.png > /dev/null 2>&1
agent-browser eval "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));'esc'" > /dev/null

echo "== done ${W}x${H} =="
