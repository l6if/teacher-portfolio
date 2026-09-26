#!/usr/bin/env bash
# تشغيل خادم التطوير بشكل مستقر (يفصل عن الجلسة الطرفية)
cd /home/z/my-project
rm -f dev.log
setsid nohup node node_modules/next/dist/bin/next dev -p 3000 > dev.log 2>&1 < /dev/null &
echo "started pid $!"
sleep 12
curl -s -o /dev/null -w "root: %{http_code}\n" http://localhost:3000/
