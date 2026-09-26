#!/usr/bin/env bash
# خادم الإنتاج المستقل على المنفذ 3100 (مفصول عن الجلسة الطرفية)
cd /home/z/my-project/.next/standalone
SECRET=$(grep SESSION_SECRET /home/z/my-project/.env | cut -d= -f2)
setsid nohup env \
  DATABASE_URL="file:/home/z/my-project/db/custom.db" \
  SESSION_SECRET="$SECRET" \
  UPLOAD_DIR="/home/z/my-project/storage/uploads" \
  PORT=3100 \
  node server.js > /tmp/prod-test/prod.log 2>&1 < /dev/null &
echo "started pid $!"
sleep 4
curl -s -o /dev/null -w "prod root: %{http_code}\n" http://localhost:3100/
