#!/bin/bash
# الاختبارات الأمنية بعد الإصلاحات — Production Readiness Audit v2
BASE="http://localhost:3000"
JAR_A=/tmp/jar2-teacherA.txt
JAR_B=/tmp/jar2-teacherB.txt
JAR_M=/tmp/jar2-manager.txt
rm -f $JAR_A $JAR_B $JAR_M

echo "════ A) المصادقة ════"
echo -n "دليل المستخدمين بدون جلسة (يجب user:null): "; curl -s $BASE/api/session; echo
echo -n "دخول ببيانات صحيحة: "; curl -s -c $JAR_A -X POST $BASE/api/session -H 'Content-Type: application/json' -d '{"email":"sultan@madrasati.sa","password":"***REMOVED-DEV-SECRET***"}' -o /tmp/ra.json -w "[%{http_code}] "; grep -o '"role":"[A-Z]*"' /tmp/ra.json; echo
echo -n "دخول بكلمة مرور خاطئة (يجب 401): "; curl -s -X POST $BASE/api/session -H 'Content-Type: application/json' -d '{"email":"sultan@madrasati.sa","password":"wrong"}' -w " [%{http_code}]\n" -o /dev/null
echo -n "دخول JSON تالف (يجب 400/401 لا 500): "; curl -s -X POST $BASE/api/session -H 'Content-Type: application/json' -d '{bad' -w " [%{http_code}]\n" -o /dev/null
curl -s -c $JAR_B -X POST $BASE/api/session -H 'Content-Type: application/json' -d '{"email":"ahmed@madrasati.sa","password":"***REMOVED-DEV-SECRET***"}' -o /dev/null
curl -s -c $JAR_M -X POST $BASE/api/session -H 'Content-Type: application/json' -d '{"email":"noura@madrasati.sa","password":"***REMOVED-DEV-SECRET***"}' -o /dev/null
TEACHER_B_ID=$(curl -s -b $JAR_B $BASE/api/me | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
MANAGER_ID=$(curl -s -b $JAR_M $BASE/api/me | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  B=$TEACHER_B_ID M=$MANAGER_ID"

echo ""
echo "════ B) تزوير الجلسة ════"
echo -n "كوكي خام بمعرف B (يجب 401): "; curl -s -H "Cookie: pf_session=$TEACHER_B_ID" $BASE/api/me -o /dev/null -w "[%{http_code}]\n"
echo -n "كوكي بتوقيع مزوّر (يجب 401): "; curl -s -H "Cookie: pf_session=$TEACHER_B_ID.99999999999999.AAAAAAAAAAA" $BASE/api/me -o /dev/null -w "[%{http_code}]\n"
echo -n "توكن منتهي الصلاحية (يجب 401): "; curl -s -H "Cookie: pf_session=fakeuser.1000000.x" $BASE/api/me -o /dev/null -w "[%{http_code}]\n"

echo ""
echo "════ C) IDOR ════"
echo -n "A يقرأ achievements?userId=B (يجب 403): "; curl -s -b $JAR_A "$BASE/api/achievements?userId=$TEACHER_B_ID" -o /dev/null -w "[%{http_code}]\n"
ACH_B=$(curl -s -b $JAR_B "$BASE/api/achievements" | grep -o '"id":"[^"]*"' | sed -n '2p' | cut -d'"' -f4)
echo -n "A يعدّل إنجاز B (يجب 403): "; curl -s -b $JAR_A -X PATCH "$BASE/api/achievements/$ACH_B" -H 'Content-Type: application/json' -d '{"title":"x"}' -o /dev/null -w "[%{http_code}]\n"
echo -n "A يحذف إنجاز B (يجب 403): "; curl -s -b $JAR_A -X DELETE "$BASE/api/achievements/$ACH_B" -o /dev/null -w "[%{http_code}]\n"
ATT_B=$(curl -s -b $JAR_B "$BASE/api/attachments" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo -n "POST achievements مع attachmentIds لشاهد B (يجب 201 بلا ربط أو 403 — لا 500): "; curl -s -b $JAR_A -X POST "$BASE/api/achievements" -H 'Content-Type: application/json' -d "{\"type\":\"OTHER\",\"title\":\"اختبار IDOR v2\",\"attachmentIds\":[\"$ATT_B\"]}" -o /tmp/ridor.json -w "[%{http_code}]\n"
TEST_ACH=$(grep -o '"id":"[^"]*"' /tmp/ridor.json | head -1 | cut -d'"' -f4)
LINKED=$(grep -c "attachmentId" /tmp/ridor.json || true)
echo "  روابط شاهد B داخل إنجاز A (يجب 0): $LINKED"
[ -n "$TEST_ACH" ] && curl -s -b $JAR_A -X DELETE "$BASE/api/achievements/$TEST_ACH" -o /dev/null && echo "  (حُذف إنجاز الاختبار)"

echo ""
echo "════ D) نطاق المدير ════"
echo -n "المديرة ترى قائمة المعلمين: "; N=$(curl -s -b $JAR_M $BASE/api/manager/teachers | grep -o '"name"' | wc -l); echo "$N معلمين (متوقع 4 — كلهم بمدرستها)"
echo -n "المعلم يفتح قائمة المعلمين (يجب 403): "; curl -s -b $JAR_A $BASE/api/manager/teachers -o /dev/null -w "[%{http_code}]\n"
echo -n "المديرة تقرأ ملف معلم (مسموح 200): "; curl -s -b $JAR_M "$BASE/api/dashboard?userId=$TEACHER_B_ID" -o /dev/null -w "[%{http_code}]\n"
echo -n "المديرة تكتب في ملف معلم (يجب 403): "; curl -s -b $JAR_M -X POST "$BASE/api/achievements?userId=$TEACHER_B_ID" -H 'Content-Type: application/json' -d '{"type":"OTHER","title":"x"}' -o /dev/null -w "[%{http_code}]\n"
echo -n "المديرة تفتح ملف مدير آخر (يجب 403): "; curl -s -b $JAR_M "$BASE/api/profile?userId=$MANAGER_ID" -o /dev/null -w "[%{http_code}]\n"

echo ""
echo "════ E) رفع الملفات ════"
printf 'hello upload test' > /tmp/test-ok.txt
echo -n '%PDF-1.4 fake pdf content' > /tmp/test.pdf
printf '<html><script>alert(1)</script></html>' > /tmp/evil.html
printf 'MZ fake exe binary' > /tmp/evil.exe
printf 'GIF89a' > /tmp/fake.jpg
head -c 200 /dev/urandom > /tmp/random.png
echo -n "ملف pdf صالح البنية: "; curl -s -b $JAR_A -X POST $BASE/api/upload -F "file=@/tmp/test.pdf;type=application/pdf" -o /tmp/up1.json -w "[%{http_code}] "; grep -o '"kind":"[A-Z]*"' /tmp/up1.json | head -1; echo
echo -n "ملف exe (يجب رفض 400): "; curl -s -b $JAR_A -X POST $BASE/api/upload -F "file=@/tmp/evil.exe" -o /tmp/up2.json -w "[%{http_code}] "; grep -o '"error":"[^"]*"' /tmp/up2.json | head -c 80; echo
echo -n "ملف html متنكر (يجب رفض): "; curl -s -b $JAR_A -X POST $BASE/api/upload -F "file=@/tmp/evil.html" -o /tmp/up3.json -w "[%{http_code}] "; grep -o '"error":"[^"]*"' /tmp/up3.json | head -c 60; echo
echo -n "jpg مزيف البصمة (يجب رفض): "; curl -s -b $JAR_A -X POST $BASE/api/upload -F "file=@/tmp/fake.jpg;type=image/jpeg" -o /tmp/up4.json -w "[%{http_code}]\n"
echo -n "امتداد غير مسموح .txt (يجب رفض): "; curl -s -b $JAR_A -X POST $BASE/api/upload -F "file=@/tmp/test-ok.txt" -o /tmp/up5.json -w "[%{http_code}]\n"
echo -n "رفع بدون جلسة (يجب 401): "; curl -s -X POST $BASE/api/upload -F "file=@/tmp/test.pdf" -o /dev/null -w "[%{http_code}]\n"
UP_ID=$(grep -o '"id":"[^"]*"' /tmp/up1.json | head -1 | cut -d'"' -f4)
echo "═══ تقديم الملف المرفوع عبر /api/files ═══"
echo -n "صاحب الملف يجلب الملف: "; curl -s -b $JAR_A "$BASE/api/files/$UP_ID" -o /dev/null -w "[%{http_code}]\n"
echo -n "معلم آخر (يجب 403): "; curl -s -b $JAR_B "$BASE/api/files/$UP_ID" -o /dev/null -w "[%{http_code}]\n"
echo -n "المديرة (مسموح 200): "; curl -s -b $JAR_M "$BASE/api/files/$UP_ID" -o /dev/null -w "[%{http_code}]\n"
echo -n "بدون جلسة (يجب 401): "; curl -s "$BASE/api/files/$UP_ID" -o /dev/null -w "[%{http_code}]\n"
echo -n "معرف وهمي (يجب 404): "; curl -s -b $JAR_A "$BASE/api/files/fake-id" -o /dev/null -w "[%{http_code}]\n"

echo ""
echo "════ F) حذف شاهد مرتبط — سلامة M2M ════"
# إنشاء إنجاز اختباري وربط شاهد به ثم حذف الإنجاز والتحقق من بقاء الشاهد
curl -s -b $JAR_A -X POST $BASE/api/achievements -H 'Content-Type: application/json' -d '{"type":"OTHER","title":"اختبار حذف إنجاز بشاهد"}' -o /tmp/m2m.json
M2M_ACH=$(grep -o '"id":"[^"]*"' /tmp/m2m.json | head -1 | cut -d'"' -f4)
curl -s -b $JAR_A -X POST $BASE/api/attachments/link -H 'Content-Type: application/json' -d "{\"attachmentId\":\"$UP_ID\",\"achievementId\":\"$M2M_ACH\"}" -o /dev/null
echo -n "ربط مكرر لنفس الشاهد بنفس الإنجاز (idempotent): "; curl -s -b $JAR_A -X POST $BASE/api/attachments/link -H 'Content-Type: application/json' -d "{\"attachmentId\":\"$UP_ID\",\"achievementId\":\"$M2M_ACH\"}" -o /dev/null -w "[%{http_code}]\n"
curl -s -b $JAR_A -X DELETE "$BASE/api/achievements/$M2M_ACH" -o /dev/null
echo -n "الشاهد بعد حذف الإنجاز (يجب 200 — يبقى): "; curl -s -b $JAR_A "$BASE/api/files/$UP_ID" -o /dev/null -w "[%{http_code}]\n"
echo -n "حذف الشاهد (يجب 200 ويحذف الملف من القرص): "; curl -s -b $JAR_A -X DELETE "$BASE/api/attachments/$UP_ID" -o /dev/null -w "[%{http_code}]\n"
echo -n "الملف بعد حذف الشاهد (يجب 404): "; curl -s -b $JAR_A "$BASE/api/files/$UP_ID" -o /dev/null -w "[%{http_code}]\n"

echo ""
echo "════ G) أخطاء شائعة ════"
echo -n "JSON تالف في POST إنجاز (يجب 400): "; curl -s -b $JAR_A -X POST $BASE/api/achievements -H 'Content-Type: application/json' -d '{bad' -o /dev/null -w "[%{http_code}]\n"
echo -n "JSON تالف في PATCH هدف (يجب 400): "; curl -s -b $JAR_A -X PATCH "$BASE/api/goals/fakeid" -H 'Content-Type: application/json' -d '{bad' -o /dev/null -w "[%{http_code}]\n"
echo -n "رابط شاهد بخط javascript: (يجب 400): "; curl -s -b $JAR_A -X POST $BASE/api/attachments -H 'Content-Type: application/json' -d '{"kind":"LINK","url":"javascript:alert(1)","title":"x"}' -o /dev/null -w "[%{http_code}]\n"
echo -n "404 route وهمي: "; curl -s $BASE/api/nonexistent -o /dev/null -w "[%{http_code}]\n"
