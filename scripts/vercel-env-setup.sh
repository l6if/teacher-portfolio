#!/usr/bin/env bash
# ═══ ضبط متغيرات بيئة Vercel الإنتاجية عبر stdin (القيم لا تظهر في argv) ═══
# يقرأ القيم من الملفات المحجوبة فقط: .env.supabase-project + .env.production-secrets
# الاستخدام: bash scripts/vercel-env-setup.sh
set -u
cd /home/z/my-project
export PATH="$HOME/.local/bin:$PATH"

TEAM="sultans-projects-bce2ab1d"

getval() { grep "^$1=" "$2" | head -1 | cut -d= -f2-; }

SUPA=".env.supabase-project"
SECR=".env.production-secrets"

# name → "source_file:KEY"
declare -A VARS=(
  [DATABASE_URL]="$SUPA:DATABASE_URL"
  [DIRECT_URL]="$SUPA:DIRECT_URL"
  [SESSION_SECRET]="$SECR:SESSION_SECRET"
  [SUPABASE_URL]="$SUPA:SUPABASE_URL"
  [SUPABASE_SERVICE_ROLE_KEY]="$SUPA:SUPABASE_SERVICE_ROLE_KEY"
  [SUPABASE_STORAGE_BUCKET]="$SUPA:SUPABASE_STORAGE_BUCKET"
  [NEXT_PUBLIC_SUPABASE_URL]="$SUPA:SUPABASE_URL"
  [NEXT_PUBLIC_SUPABASE_ANON_KEY]="$SUPA:SUPABASE_ANON_KEY"
  [NEXT_PUBLIC_STORAGE_BUCKET]="$SUPA:SUPABASE_STORAGE_BUCKET"
  [NEXT_PUBLIC_PROXY_UPLOAD_LIMIT_MB]="literal:4"
  [GROQ_API_KEY]="$SECR:GROQ_API_KEY"
  [GROQ_MODEL]="literal:llama-3.3-70b-versatile"
  [GROQ_BASE_URL]="literal:https://api.groq.com/openai/v1"
)

ORDER=(
  DATABASE_URL DIRECT_URL SESSION_SECRET
  SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_STORAGE_BUCKET
  NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY NEXT_PUBLIC_STORAGE_BUCKET
  NEXT_PUBLIC_PROXY_UPLOAD_LIMIT_MB
  GROQ_API_KEY GROQ_MODEL GROQ_BASE_URL
)

# التأكد أن bucket literal موجود (غير موجود في ملف المشروع — نضيفه أدناه)
if ! grep -q '^SUPABASE_STORAGE_BUCKET=' "$SUPA" 2>/dev/null; then
  echo 'SUPABASE_STORAGE_BUCKET=teacher-evidence' >> "$SUPA"
fi

FAIL=0
for name in "${ORDER[@]}"; do
  spec="${VARS[$name]}"
  if [[ "$spec" == literal:* ]]; then
    value="${spec#literal:}"
  else
    file="${spec%%:*}"; key="${spec##*:}"
    value="$(getval "$key" "$file")"
  fi
  if [ -z "$value" ]; then
    echo "✗ $name: قيمة فارغة — تخطّي"
    FAIL=1
    continue
  fi
  # حذف أي نسخة سابقة ثم الإضافة (idempotent)
  printf '%s' "$value" | vercel env rm "$name" production --yes >/dev/null 2>&1
  OUT="$(printf '%s' "$value" | vercel env add "$name" production 2>&1 | tr -d '\033' | grep -viE 'retrieving|downloading' | head -3)"
  if echo "$OUT" | grep -qiE 'success|added'; then
    echo "✓ $name: ADDED (production) [len=${#value}]"
  else
    echo "✗ $name: FAILED — $OUT"
    FAIL=1
  fi
done

echo "────────────"
if [ "$FAIL" -eq 0 ]; then echo "✅ كل المتغيرات مضبوطة لبيئة production"; else echo "⚠ فشل بعض المتغيرات — أعد الفحص"; fi
exit $FAIL
