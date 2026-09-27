#!/bin/bash
# ═══ فحص الأسرار الشامل: working tree + staged + git history ═══
# قيم الأسرار "المعروفة" تُقرأ من .secret-patterns (محجوب من Git) إن وُجد —
# بلا أي قيمة حرفية داخل هذا السكربت نفسه (حتى لا يلوث المستودع).
# أنماط التوكنات العامة هنا آمنة (أشكال لا قيم).
# الاستخدام: bash scripts/scan-secrets-full.sh
set -u
cd /home/z/my-project

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
FAIL=0

# القيم المعروفة من ملف محجوب (سطر = نمط regex)
KNOWN_FILE=".secret-patterns"
KNOWN_PAT=""
if [ -f "$KNOWN_FILE" ]; then
  KNOWN_PAT=$(grep -vE '^\s*(#|$)' "$KNOWN_FILE" | paste -sd'|' -)
fi

# أنماط أشكال التوكنات (آمنة كنصوص)
TOKEN_PAT='ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|gsk_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|r8_[A-Za-z0-9]{20,}|re_[A-Za-z0-9]{20,}|sbp_[A-Za-z0-9]{20,}'

# الجمع الكلي
FULL_PAT="$TOKEN_PAT"
[ -n "$KNOWN_PAT" ] && FULL_PAT="$TOKEN_PAT|$KNOWN_PAT"

echo "════════════════════════════════════════════════════"
echo " 1) WORKING TREE (الملفات المتتبعة فقط)"
echo "══════════════════════════════════════════════════"
HITS=$(git grep -lE "$FULL_PAT" -- . ':(exclude)scripts/scan-secrets-full.sh' 2>/dev/null | head -5)
if [ -n "$HITS" ]; then echo -e "${RED}✗ أسرار معروفة/توكنات في: $HITS${NC}"; FAIL=1
else echo -e "${GREEN}✓ لا أسرار معروفة ولا توكنات في الشجرة المتتبعة${NC}"; fi

ENV_TRACKED=$(git ls-files | grep -E "^\.env$|^\.env\.[a-z.]+$" | grep -v ".env.example" | head -3)
if [ -n "$ENV_TRACKED" ]; then echo -e "${RED}✗ ملفات env متتبعة: $ENV_TRACKED${NC}"; FAIL=1
else echo -e "${GREEN}✓ لا ملفات env متتبعة (سوى .env.example)${NC}"; fi

DB_TRACKED=$(git ls-files | grep -E "\.db$|\.sqlite$|\.dump$" | head -3)
if [ -n "$DB_TRACKED" ]; then echo -e "${RED}✗ ملفات قواعد متتبعة: $DB_TRACKED${NC}"; FAIL=1
else echo -e "${GREEN}✓ لا ملفات قواعد بيانات متتبعة${NC}"; fi

echo ""
echo "════════════════════════════════════════════════════"
echo " 2) STAGED"
echo "══════════════════════════════════════════════════"
STAGED_N=$(git diff --cached | grep -cE "$FULL_PAT" || true)
if [ "$STAGED_N" -gt 0 ]; then echo -e "${RED}✗ أسرار في المُدرج للالتزام ($STAGED_N سطرًا)!${NC}"; FAIL=1
else echo -e "${GREEN}✓ لا أسرار في المُدرج${NC}"; fi

echo ""
echo "════════════════════════════════════════════════════"
echo " 3) GIT HISTORY (كل الكوميتات — محتوى)"
echo "══════════════════════════════════════════════════"
BAD_PATHS=$(git log --all --pretty=format:"" --name-only | sort -u | grep -cE "^\.env$|^\.pg/|^\.pg-client|^\.pg-downloads|^\.sqlite-client|^db/|^tool-results/|^screenshots/|^worklog.md$|^download/|^\.zscripts/|^tests/|^Caddyfile$|^storage/|^\.secret-patterns$" || true)
if [ "$BAD_PATHS" -gt 0 ]; then echo -e "${RED}✗ مسارات محجوبة لا تزال في التاريخ ($BAD_PATHS)${NC}"; FAIL=1
else echo -e "${GREEN}✓ لا مسارات محجوبة في التاريخ${NC}"; fi

HIST_HITS=0
for c in $(git rev-list --all); do
  if [ -n "$FULL_PAT" ] && git grep -qE "$FULL_PAT" $c -- . ':(exclude)scripts/scan-secrets-full.sh' 2>/dev/null; then
    echo -e "${RED}✗ سر في كوميت $c${NC}"; HIST_HITS=$((HIST_HITS+1)); FAIL=1
  fi
done
[ "$HIST_HITS" -eq 0 ] && echo -e "${GREEN}✓ لا قيم أسرار في محتوى التاريخ كاملًا${NC}"

SCRYPT=$(git grep -l 'scrypt\$' $(git rev-list --all) -- ':(exclude)src/lib/auth.ts' ':(exclude)scripts/*' 2>/dev/null | head -3)
if [ -n "$SCRYPT" ]; then echo -e "${YELLOW}⚠ هاشات scrypt في: $SCRYPT (راجعها)${NC}"
else echo -e "${GREEN}✓ لا هاشات كلمات مرور خارج كود المصادقة${NC}"; fi

echo ""
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✅ الفحص الشامل نظيف${NC}"
else
  echo -e "${RED}⛔ فشل — نظّف قبل أي دفع${NC}"
fi
exit $FAIL
