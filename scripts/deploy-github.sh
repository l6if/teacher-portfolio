#!/usr/bin/env bash
# ═══ النشر التلقائي بعد التفويض — GitHub (l6if) ═════════════════
# يُشغَّل فقط بعد نجاح: gh auth status
# يتحقق من المالك الفعلي قبل أي إنشاء — إن لم يكن l6if يتوقف (بوابة الحساب).
set -e
cd /home/z/my-project

echo "═══ بوابة التحقق: GitHub owner الفعلي ═══"
OWNER=$(gh api user --jq .login 2>/dev/null || echo "")
if [ -z "$OWNER" ]; then echo "⛔ غير مسجل — شغّل gh auth login أولًا"; exit 1; fi
echo "الحساب المتصل: $OWNER"

if [ "$OWNER" != "l6if" ]; then
  echo "⛔ الحساب المتصل ($OWNER) لا يطابق الوجهة المطلوبة (l6if) — لن يُنشأ أو يُدفع أي شيء."
  echo "سجّل الدخول بالحساب الصحيح: gh auth logout ثم gh auth login"
  exit 1
fi

REPO="teacher-portfolio"
echo "═══ إنشاء المستودع الخاص (إن لم يوجد) ═══"
if gh repo view "l6if/$REPO" >/dev/null 2>&1; then
  echo "المستودع موجود بالفعل: l6if/$REPO"
else
  gh repo create "l6if/$REPO" --private --description "منصة ملف إنجاز المعلم الإلكتروني — Next.js + Prisma + PostgreSQL" 2>&1
  echo "أُنشئ: https://github.com/l6if/$REPO (خاص)"
fi

echo "═══ الدفع ═══"
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/l6if/$REPO.git"
git push -u origin main 2>&1 | tail -3
echo "═══ النتيجة ═══"
gh repo view "l6if/$REPO" --json name,visibility,url,updatedAt --jq '"المستودع: \(.url) | الرؤية: \(.visibility)"'
echo "Commit: $(git rev-parse --short HEAD)"
