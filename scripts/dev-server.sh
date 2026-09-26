#!/usr/bin/env bash
# تشغيل خادم التطوير بشكل مستقر (يفصل عن الجلسة الطرفية)
# مهم: نُعقّم متغيرات قاعدة البيانات من بيئة الجلسة الحالية أولاً
# حتى يكون .env هو المصدر الوحيد للحقيقة (وإلا تتقدم القيمة المُصدَّرة
# في الشل على الملف وتكسر الإعداد — كما حدث أثناء التحويل إلى PostgreSQL).
cd /home/z/my-project
unset DATABASE_URL DIRECT_URL SESSION_SECRET
unset SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_STORAGE_BUCKET STORAGE_DRIVER
rm -f dev.log
setsid nohup node node_modules/next/dist/bin/next dev -p 3000 > dev.log 2>&1 < /dev/null &
echo "started pid $!"
sleep 12
curl -s -o /dev/null -w "root: %{http_code}\n" http://localhost:3000/
