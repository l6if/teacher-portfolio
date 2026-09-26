#!/usr/bin/env bash
# خادم الإنتاج المستقل على المنفذ 3100 (مفصول عن الجلسة الطرفية)
# الإنتاج الاختباري محليًا: PostgreSQL (5433) + تخزين محلي بعلم صريح
# (STORAGE_ALLOW_LOCAL_IN_PROD=1 — مخرج الاختبار المحلي المصمم لهذا الغرض؛
#  في Vercel الإنتاجي لا يُضبط هذا العلم إطلاقًا وتُستخدم Supabase Storage).
cd /home/z/my-project/.next/standalone
mkdir -p /tmp/prod-test
SECRET=$(grep '^SESSION_SECRET' /home/z/my-project/.env | cut -d= -f2 | tr -d '"')
setsid nohup env \
  NODE_ENV=production \
  DATABASE_URL="postgresql://postgres@127.0.0.1:5433/teacherfolio" \
  DIRECT_URL="postgresql://postgres@127.0.0.1:5433/teacherfolio" \
  SESSION_SECRET="$SECRET" \
  UPLOAD_DIR="/home/z/my-project/storage/uploads" \
  STORAGE_ALLOW_LOCAL_IN_PROD=1 \
  PORT=3100 \
  node server.js > /tmp/prod-test/prod.log 2>&1 < /dev/null &
echo "started pid $!"
sleep 5
curl -s -o /dev/null -w "prod root: %{http_code}\n" http://localhost:3100/
