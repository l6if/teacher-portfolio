#!/bin/bash
# اختبارات أمنية فعلية — Production Readiness Audit
BASE="http://localhost:3000"
JAR_A=/tmp/cookies-teacherA.txt
JAR_B=/tmp/cookies-teacherB.txt
JAR_M=/tmp/cookies-manager.txt
rm -f $JAR_A $JAR_B $JAR_M

echo "════ A) الحصول على هويات المستخدمين (عبر الثغرة الحالية) ════"
USERS=$(curl -s $BASE/api/session)
echo "$USERS" | head -c 600; echo
TEACHER_A_ID=$(echo "$USERS" | grep -o '"id":"[^"]*"' | sed -n '1p' | cut -d'"' -f4)
TEACHER_B_ID=$(echo "$USERS" | grep -o '"id":"[^"]*"' | sed -n '3p' | cut -d'"' -f4)
MANAGER_ID=$(echo "$USERS" | grep -o '"id":"[^"]*"' | sed -n '2p' | cut -d'"' -f4)
echo "A=$TEACHER_A_ID B=$TEACHER_B_ID M=$MANAGER_ID"

curl -s -c $JAR_A -X POST $BASE/api/session -H 'Content-Type: application/json' -d "{\"userId\":\"$TEACHER_A_ID\"}" > /dev/null
curl -s -c $JAR_B -X POST $BASE/api/session -H 'Content-Type: application/json' -d "{\"userId\":\"$TEACHER_B_ID\"}" > /dev/null
curl -s -c $JAR_M -X POST $BASE/api/session -H 'Content-Type: application/json' -d "{\"userId\":\"$MANAGER_ID\"}" > /dev/null

echo ""
echo "════ B) مستخدم غير مسجل ════"
echo -n "GET /api/achievements (بدون جلسة): "; curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/achievements
echo -n "GET /api/dashboard (بدون جلسة): "; curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/dashboard
echo -n "GET /api/report (بدون جلسة): "; curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/report

echo ""
echo "════ C) IDOR — المعلم A يحاول الوصول لبيانات المعلم B ════"
echo -n "GET /api/achievements?userId=B: "; curl -s -b $JAR_A -o /tmp/r1.json -w "%{http_code}\n" "$BASE/api/achievements?userId=$TEACHER_B_ID"; head -c 120 /tmp/r1.json; echo
echo -n "GET /api/attachments?userId=B: "; curl -s -b $JAR_A -o /tmp/r2.json -w "%{http_code}\n" "$BASE/api/attachments?userId=$TEACHER_B_ID"; head -c 120 /tmp/r2.json; echo
echo -n "GET /api/report?userId=B: "; curl -s -b $JAR_A -o /dev/null -w "%{http_code}\n" "$BASE/api/report?userId=$TEACHER_B_ID"
echo -n "GET /api/profile?userId=B: "; curl -s -b $JAR_A -o /dev/null -w "%{http_code}\n" "$BASE/api/profile?userId=$TEACHER_B_ID"

# معرف إنجاز يخص B
ACH_B=$(curl -s -b $JAR_B "$BASE/api/achievements" | grep -o '"id":"[^"]*"' | sed -n '2p' | cut -d'"' -f4)
echo "إنجاز يخص B: $ACH_B"
if [ -n "$ACH_B" ]; then
  echo -n "GET /api/achievements/<B-achievement>: "; curl -s -b $JAR_A -o /tmp/r3.json -w "%{http_code}\n" "$BASE/api/achievements/$ACH_B"; head -c 120 /tmp/r3.json; echo
  echo -n "PATCH /api/achievements/<B-achievement>: "; curl -s -b $JAR_A -o /tmp/r4.json -w "%{http_code}\n" -X PATCH "$BASE/api/achievements/$ACH_B" -H 'Content-Type: application/json' -d '{"title":"اختبار اختراق"}'; head -c 120 /tmp/r4.json; echo
  echo -n "DELETE /api/achievements/<B-achievement>: "; curl -s -b $JAR_A -o /dev/null -w "%{http_code}\n" -X DELETE "$BASE/api/achievements/$ACH_B"
fi

echo ""
echo "════ D) المدير ════"
echo -n "GET /api/manager/teachers (مدير): "; curl -s -b $JAR_M -o /tmp/r5.json -w "%{http_code}\n" $BASE/api/manager/teachers; echo "  عدد المعلمين الظاهرين: $(echo "$(< /tmp/r5.json)" | grep -o '"id"' | wc -l)"
echo -n "GET /api/manager/teachers (معلم): "; curl -s -b $JAR_A -o /dev/null -w "%{http_code}\n" $BASE/api/manager/teachers
echo -n "GET /api/achievements?userId=B (مدير — قراءة مسموحة): "; curl -s -b $JAR_M -o /dev/null -w "%{http_code}\n" "$BASE/api/achievements?userId=$TEACHER_B_ID"
echo -n "POST /api/achievements?userId=B (مدير يحاول الكتابة): "; curl -s -b $JAR_M -o /tmp/r6.json -w "%{http_code}\n" -X POST "$BASE/api/achievements?userId=$TEACHER_B_ID" -H 'Content-Type: application/json' -d '{"type":"OTHER","title":"محاولة كتابة"}'; head -c 150 /tmp/r6.json; echo
echo -n "GET /api/report?userId=المدير نفسه (مدير يفتح ملف مدير آخر): "; curl -s -b $JAR_M -o /dev/null -w "%{http_code}\n" "$BASE/api/report?userId=$MANAGER_ID"

echo ""
echo "════ E) رفع الملفات ════"
echo "test upload" > /tmp/test.txt
echo -n "POST /api/upload (ملف نصي): "; curl -s -b $JAR_A -o /tmp/r7.json -w "%{http_code}\n" -X POST $BASE/api/upload -F "file=@/tmp/test.txt"; head -c 200 /tmp/r7.json; echo

echo ""
echo "════ F) تزوير الجلسة — كوكي بخام user-id ════"
echo -n "كوكي مزوّر بمعرف B: "; curl -s -o /tmp/r8.json -w "%{http_code}\n" -H "Cookie: pf_session=$TEACHER_B_ID" "$BASE/api/me"; grep -o '"name":"[^"]*"' /tmp/r8.json | head -1

echo ""
echo "════ G) IDOR روابط الشواهد — A يربط شاهد B بإنجازه ════"
ATT_B=$(curl -s -b $JAR_B "$BASE/api/attachments" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "شاهد يخص B: $ATT_B"
if [ -n "$ATT_B" ] && [ -n "$ACH_B" ]; then
  echo -n "POST /api/attachments/link بربط شاهد B بإنجاز A: "; curl -s -b $JAR_A -o /tmp/r9.json -w "%{http_code}\n" -X POST $BASE/api/attachments/link -H 'Content-Type: application/json' -d "{\"attachmentId\":\"$ATT_B\",\"achievementId\":\"$ACH_B\"}"; head -c 150 /tmp/r9.json; echo
fi
# POST /api/achievements مع attachmentIds تخص B
if [ -n "$ATT_B" ]; then
  echo -n "POST /api/achievements مع attachmentIds لشاهد B: "; curl -s -b $JAR_A -o /tmp/r10.json -w "%{http_code}\n" -X POST "$BASE/api/achievements" -H 'Content-Type: application/json' -d "{\"type\":\"OTHER\",\"title\":\"اختبار IDOR شواهد\",\"attachmentIds\":[\"$ATT_B\"]}"; echo "  → "; grep -o '"attachmentId":"[^"]*"' /tmp/r10.json | head -3
  # نظّف الإنجاز الاختباري
  TEST_ACH=$(grep -o '"id":"[^"]*"' /tmp/r10.json | head -1 | cut -d'"' -f4)
  [ -n "$TEST_ACH" ] && curl -s -b $JAR_A -X DELETE "$BASE/api/achievements/$TEST_ACH" -o /dev/null && echo "  (تم حذف الإنجاز الاختباري)"
fi

echo ""
echo "════ H) كشف أخطاء النظام ════"
echo -n "PATCH /api/achievements/<id-غير-موجود>: "; curl -s -b $JAR_A -o /tmp/r11.json -w "%{http_code}\n" -X PATCH "$BASE/api/achievements/nonexistent-id" -H 'Content-Type: application/json' -d '{"title":"x"}'; head -c 100 /tmp/r11.json; echo
echo -n "POST /api/session بمعرف وهمي: "; curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/api/session -H 'Content-Type: application/json' -d '{"userId":"fake-id-123"}'
echo -n "GET /api/achievements/<id-وهمي>: "; curl -s -b $JAR_A -o /dev/null -w "%{http_code}\n" "$BASE/api/achievements/fake-id"
echo -n "جسم JSON تالف في POST: "; curl -s -b $JAR_A -o /tmp/r12.json -w "%{http_code}\n" -X POST $BASE/api/achievements -H 'Content-Type: application/json' -d '{invalid-json'; head -c 150 /tmp/r12.json; echo
