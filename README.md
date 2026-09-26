# ملف إنجاز المعلم الإلكتروني — Teacher e-Portfolio

منصة رقمية عربية (RTL) لبناء ملف إنجاز المعلم تدريجيًا على مدار العام: توثيق الإنجازات والشواهد، قياس الأثر (قبلي/بعدي)، التقارير الاحترافية القابلة للطباعة، وإدارة السنوات الدراسية (تقويم هجري) مع الأرشفة.

> تمت مراجعة هذا الإصدار عبر تدقيق جاهزية إنتاج شامل (أمان، صلاحيات، رفع ملفات، سباقات حفظ، تقارير، بناء إنتاجي) — انظر قسم «حالة الجاهزية» آخر الملف.

---

## 1) المكدس التقني (Stack)

| الطبقة | التقنية |
|---|---|
| الإطار | Next.js 16 (App Router, Turbopack, output: standalone) |
| اللغة | TypeScript 5 (strict — البناء يرفض أي خطأ أنواع) |
| الواجهة | React 19 + Tailwind CSS 4 + shadcn/ui + Lucide Icons + TanStack Query + Zustand |
| الخط | Readex Pro (عربي/لاتيني) |
| قاعدة البيانات | SQLite عبر Prisma ORM 6 |
| المصادقة | جلسة كوكي موقّعة HMAC-SHA256 + كلمات مرور scrypt (بدون خدمات خارجية) |
| التخزين | نظام ملفات خارج مجلد public + تقديم عبر مسار API محمي |
| المساعد الذكي | z-ai-web-dev-sdk (من الخادم فقط) — تحرير/تلخيص/اقتراح أثر |

## 2) مخطط قاعدة البيانات (8 جداول)

```
User ──1:N── AcademicYear ──1:N── Goal / Achievement / Attachment / Reflection / DevPlan
EvidenceLink (M2M): Attachment ↔ Achievement | Goal
```

| الجدول | الغرض | حقول مفتاحية | قيود/فهارس |
|---|---|---|---|
| `User` | المستخدم (معلم/مدير) + بياناته المهنية والتكليف | email فريد، passwordHash، role (TEACHER/MANAGER)، school، schedule/committees/extraDuties (JSON) | فهرس role |
| `AcademicYear` | العام الدراسي لكل معلم (مثل 1448هـ) | label، archived | فهارس (userId)، (userId, archived) |
| `Goal` | الهدف المهني ومؤشراته | title، indicator، target/currentValue | فهرس (userId, yearId) |
| `Achievement` | **الوحدة الأساسية** — الإنجاز/التوثيق | type (13 نوعًا)، status (DRAFT/COMPLETED/NEEDS_WORK/APPROVED)، preScore/postScore، hours، beneficiariesCount… | فهارس (userId, yearId)، (yearId, type)، (goalId)، (status) |
| `Attachment` | الشاهد (صورة/PDF/مستند/فيديو/رابط) | kind، url، storagePath (خاص بالملفات المرفوعة) | فهرس (userId, yearId) |
| `EvidenceLink` | ربط شاهد بإنجاز أو هدف — إعادة استخدام دون تكرار | attachmentId + achievementId أو goalId | **فريد** (attachmentId, achievementId)، **فريد** (attachmentId, goalId)، فهارس |
| `Reflection` | التأمل المهني (4 أسئلة لكل فصل) | success/practice/develop/nextTerm | فريد (userId, yearId, term) |
| `DevPlan` | الخطة التطويرية | goal، action، indicator، result | فهرس (userId, yearId) |

- جميع علاقات الملكية `onDelete: Cascade` (حذف المستخدم/العام ينظّف تبعاته)، وربط الإنجاز بهدف `SetNull`.
- حذف إنجاز يحذف روابطه فقط — **الشاهد نفسه يبقى في المكتبة** ولو كان مرتبطًا بعناصر أخرى.
- حذف شاهد يحذف روابطه + **ملفه المرفوع من القرص**.

## 3) نظام المصادقة (Authentication)

- **دخول بالبريد وكلمة المرور** فقط — لا قوائم حسابات عامة.
- كلمات المرور: `scrypt` بملح عشوائي لكل مستخدم (Node crypto، دون مكتبات خارجية)، مقارنة زمن ثابت.
- الجلسة: كوكي `pf_session` (httpOnly, sameSite=lax) يحمل توكنًا `userId.expiry.signature` موقّعًا HMAC-SHA256 بـ `SESSION_SECRET`:
  - لا يمكن انتحال مستخدم بتغيير الكوكي (التوقيع يُرفض).
  - التوكن ينتهي بعد 30 يومًا والتحقق يتم من جهة الخادم.
- في الإنتاج: **يجب** ضبط `SESSION_SECRET` (32+ حرفًا عشوائيًا) وإلا يرفض الخادم الإقلاع.

## 4) نظام الصلاحيات (Authorization — server-side)

كل مسار API يتحقق من الجلسة والملكية قبل أي عملية:

| العملية | القاعدة |
|---|---|
| قراءة/تعديل/حذف | المعلم على بياناته فقط — محاولة الوصول لمعرّف غيرك تعيد 403 (لا يكفي إخفاء الأزرار) |
| المدير (قراءة فقط) | يفتح ملفات **المعلمين** فقط، ويُحصر في **معلمي مدرسته** إن كانت له مدرسة (المشرف بلا مدرسة يرى الكل). لا يرى ملفات مديرين آخرين، ولا يستطيع الكتابة في أي ملف (403) |
| الشواهد والملفات | `/api/files/<id>` يتحقق: المالك، أو مدير النطاق — الملفات **ليست عامة برابط مباشر** |

## 5) نظام التخزين (Storage)

- بنية المسار الموحدة: `school/user/year/attachment-id/file` — **خارج مجلد `public/`** في كل الأحوال (الأصل اسم ملف عشوائي UUID؛ اسم الملف الأصلي Metadata فقط).
- مزوّدان بنفس الواجهة: **Supabase Storage** (الإنتاج — حاوية خاصة عبر Service Role من الخادم فقط) و**محلي** (التطوير — `storage/uploads/` بنفس البنية). التقديم حصريًا عبر `/api/files/<attachmentId>` بجلسة + ملكية — لا روابط عامة دائمة أبدًا.
- تُقدَّم حصريًا عبر `/api/files/<attachmentId>` بجلسة + ملكية، مع `X-Content-Type-Options: nosniff` و`Cache-Control: private`.
- حماية الرفع: قائمة بيضاء للامتدادات (صور/PDF/Office/جداول/فيديو) + **فحص بصمة المحتوى (magic bytes)** يرفض التنفيذيات وHTML/السكربتات والملفات المتنكرة + حد الحجم (25MB عام، 100MB فيديو) + أسماء تخزين عشوائية.
- أصول العرض التجريبية القديمة في `public/uploads/` هي ملفات seed ثابتة فقط (للتطوير).

## 6) متغيرات البيئة (أسماء فقط — لا قيم)

| المتغير | إلزامي؟ | الغرض |
|---|---|---|
| `DATABASE_URL` | نعم | PostgreSQL (التطوير: `postgresql://postgres@127.0.0.1:5433/teacherfolio` — الإنتاج: رابط Supabase التجميعي منفذ 6543) |
| `DIRECT_URL` | نعم (PG) | اتصال مباشر للمهاجرات (`prisma migrate deploy`) — Supabase: منفذ 5432 |
| `SUPABASE_URL` | الإنتاج | `https://<ref>.supabase.co` — يفعّل مزوّد Supabase Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | الإنتاج | ⚠️ مفتاح الخدمة — **جانب الخادم حصرًا**، ممنوع في أي متغير `NEXT_PUBLIC_*` |
| `SUPABASE_STORAGE_BUCKET` | لا | اسم الحاوية (افتراضي `teacher-evidence`) — يجب أن تكون خاصة (Private) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_STORAGE_BUCKET` | الإنتاج | لرفع الملفات الكبيرة عبر روابط موقعة (anon العام بالتصميم — لا يمنح قراءة) |
| `NEXT_PUBLIC_PROXY_UPLOAD_LIMIT_MB` | لا | حد الرفع عبر الوكيل بالـMB (افتراضي 4) — الأكبر يرفع مباشرًا بروابط موقعة |
| `SESSION_SECRET` | **نعم في الإنتاج** | مفتاح توقيع الجلسات — 32+ حرفًا عشوائيًا (`openssl rand -hex 32`) |
| `UPLOAD_DIR` | لا | مجلد التخزين (افتراضي `<cwd>/storage/uploads`) — ضعه خارج مجلد البناء في الإنتاج |
| `UPLOAD_MAX_MB` | لا | حد حجم الملفات العامة (افتراضي 25) |
| `UPLOAD_VIDEO_MAX_MB` | لا | حد الفيديو (افتراضي 100) |
| `SEED_PASSWORD` | لا | كلمة مرور حسابات seed التطويرية (افتراضي `***REMOVED-DEV-SECRET***`) |
| `NODE_ENV` | — | `production` عند التشغيل الإنتاجي |
| (مفاتيح مزوّد الذكاء الاصطناعي) | لتشغيل المساعد الذكي | يقرؤها z-ai-web-dev-sdk من بيئة الخادم — لا تضعها في العميل أبدًا |

> ملف `.env` مستثنى من Git (`.gitignore`) — لا قيم سرية داخل المستودع.

## 7) التشغيل محليًا (التطوير)

```bash
bun install
cp .env.example .env            # ثم اضبط DATABASE_URL/DIRECT_URL على PostgreSQL المحلي

# قاعدة التطوير الحالية (PostgreSQL محلي على 5433 — انظر § 8 للتفاصيل):
DATABASE_URL="postgresql://postgres@127.0.0.1:5433/teacherfolio" \
DIRECT_URL="postgresql://postgres@127.0.0.1:5433/teacherfolio" \
bunx prisma migrate deploy      # ينشئ الجداول من migrations الحقيقية (لا db push)

bun run dev                     # http://localhost:3000

# بيانات تجريبية كاملة (عبر SQLite ثم ترحيل مُتحقق — seed يعمل على SQLite فقط بحكم حماياته):
#   bun scripts/use-db.ts sqlite && bun run db:seed --reset   (على نسخة تطوير)
#   ثم bun scripts/migrate-to-postgres.ts <url> + bun scripts/verify-pg-migration.ts <url>
```

حسابات seed (تطوير فقط): `sultan@madrasati.sa` (معلم)، `noura@madrasati.sa` (مديرة) — وكلمة المرور `***REMOVED-DEV-SECRET***` (أو قيمة `SEED_PASSWORD`).

### أمان seed (شرط أمان أساسي — مُختبر فعليًا)

- **الاستيراد لا ينفّذ شيئًا أبدًا**: أي `import` لملف `prisma/seed.ts` (أو أي سكربت) لا يمس البيانات — التنفيذ فقط بتشغيل مباشر.
- **علم `--reset` صريح مطلوب** حتى في التطوير: `bun prisma/seed.ts --reset` — التشغيل العرضي بلا علم يُرفض فورًا.
- **رفض قاطع في الإنتاج**: إذا `NODE_ENV=production` أو كان `DATABASE_URL` غير ملف SQLite محلي (postgres/mysql/...) يُرفض التنفيذ نهائيًا حتى مع `--reset` — رسالة واضحة تحوّلك إلى `scripts/create-user.ts`.
- نفس حماية الاستيراد مطبّقة على كل السكربتات (`create-user.ts`, `restore-assignment.ts`, `use-db.ts`, `migrate-to-postgres.ts`).
- `db:push` بلا `--accept-data-loss`: أي تغيير هدمي على المخطط يتطلب تأكيدًا تفاعليًا صريحًا.

فحوصات الجودة:
```bash
bun run typecheck   # صفر أخطاء TypeScript
bun run lint        # صفر أخطاء/تحذيرات ESLint
```

## 8) النشر الإنتاجي

### الخيار أ — SQLite (خادم واحد)

```bash
# 1) تجهيز البيئة
export DATABASE_URL="file:/var/lib/teacherfolio/custom.db"   # مسار مطلق خارج البناء
export SESSION_SECRET="$(openssl rand -hex 32)"
export UPLOAD_DIR="/var/lib/teacherfolio/uploads"            # ثابت عبر إعادة النشر
export NODE_ENV=production

# 2) بناء
bun install
bun run build        # يفحص TypeScript صرامة ثم يبني standalone

# 3) أول مستخدم (قاعدة نظيفة بلا seed!)
bun scripts/create-user.ts admin@school.sa 'كلمة-مرور-قوية' 'اسم المدير' MANAGER 'اسم المدرسة'

# 4) تشغيل (منفذ 3000 مثلاً)
PORT=3000 bun .next/standalone/server.js
```

### الخيار ب — PostgreSQL (مُختبر فعليًا بنفس البيانات والمعرفات)

ترحيل كامل ومُتحقق منه: 81 صفًا (5 مستخدمين + 40 إنجازًا + 12 رابط شاهد...) بنفس المعرفات والعلاقات والطوابع الزمنية، والتطبيق يجتاز الدخول/اللوحة/الإنجازات/البحث/التقارير على PostgreSQL.

```bash
# 1) قاعدة PostgreSQL جاهزة (مثال):
#    createdb teacherfolio

# 2) ترحيل البيانات من SQLite (قبل تبديل التطبيق):
bun scripts/migrate-to-postgres.ts "postgresql://user:pass@host:5432/teacherfolio"
#    --fresh لإعادة ترحيل نظيف (يمسح الهدف فقط — المصدر لا يُمس أبدًا)
#    --from db/custom.db لتحديد مصدر غير الافتراضي
#    يتحقق من تطابق عدد الصفوف لكل جدول قبل النجاح

# 3) تبديل التطبيق إلى PostgreSQL:
bun scripts/use-db.ts postgres        # يبدّل سطر المزوّد فقط ثم prisma generate
export DATABASE_URL="postgresql://user:pass@host:5432/teacherfolio"

# 4) بناء وتشغيل كالمعتاد + أول مستخدم عبر create-user
bun run build
bun scripts/create-user.ts admin@school.sa 'كلمة-مرور-قوية' 'اسم المدير' MANAGER 'اسم المدرسة'
```

- للعودة إلى SQLite: `bun scripts/use-db.ts sqlite` + `DATABASE_URL=file:...` (عكس كامل مُختبر).
- عميل الترحيل (`.pg-client`) منفصل عن عميل التطبيق فلا يتعارضان.
- نفس نماذج البيانات وأسماء الحقول حرفيًا — لا تغيير مخطط إطلاقًا.

### الخيار ج — Supabase + Vercel (البنية الإنتاجية النهائية — جاهز، بانتظار بيانات الاعتماد)

التطبيق الآن PostgreSQL حصريًا (مخطط migrations حقيقي `0001_init`) + طبقة تخزين موحدة (Supabase حاوية خاصة / محلي للتطوير) + تهيئة Vercel جاهزة (`vercel.json`: buildCommand = `prisma generate && prisma migrate deploy && next build`).

**خطوات Supabase:**
```bash
# 1) أنشئ مشروعًا على supabase.com ثم من Settings → Database انسخ رابطي الاتصال
#    DATABASE_URL  = Connection pooling (pgbouncer, منفذ 6543) — للتطبيق
#    DIRECT_URL    = Direct connection (منفذ 5432) — للمهاجرات
# 2) شغّل المخطط على قاعدة فارغة (كما اختُبر محليًا — نفس 0001_init):
DIRECT_URL="<direct-5432>" bunx prisma migrate deploy
# 3) أنشئ حاوية تخزين خاصة (Storage → New bucket → اسمها teacher-evidence → Private ✔ لا Public أبدًا)
# 4) من Settings → API: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (خادمي فقط!) + anon key (للعميل)
```

**خطوات Vercel:**
```bash
# 1) اربط المستودع بمشروع Vercel (Framework: Next.js — الإعداد في vercel.json جاهز)
# 2) أضف متغيرات البيئة (Production + Preview) — كلها في .env.example:
#    DATABASE_URL, DIRECT_URL, SESSION_SECRET,
#    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET,
#    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_STORAGE_BUCKET
# 3) أول نشر: prisma generate + migrate deploy يجريان ضمن buildCommand تلقائيًا
# 4) أول مستخدم إنتاجي (بلا seed — مرفوض في الإنتاج أصلًا):
DATABASE_URL="<pooled-6543>" SESSION_SECRET="<قوية>" \
  bun scripts/create-user.ts admin@school.sa 'كلمة-مرور-قوية' 'اسم المدير' MANAGER 'اسم المدرسة'
```

**قواعد ثابتة في هذه البنية:**
- `SUPABASE_SERVICE_ROLE_KEY` لا يدخل حزمة العميل أبدًا (لا `NEXT_PUBLIC_` معه مطلقًا) — التحقق: كل استخداماته في `src/lib/storage/` خادمية فقط.
- الملفات لا تُقدَّم بروابط عامة دائمة — `/api/files` وكيل مصادَق (جلسة + ملكية + نطاق المدير)، والرفع الكبير عبر روابط رفع موقعة قصيرة العمر بلا مرور بدالة الخادم.
- التخزين المحلي يُرفض قاطعًا في الإنتاج (رسالة صريحة مبكرة) — القرص مؤقت في serverless.
- Vercel بلا قرص دائم: لا UPLOAD_DIR ولا SQLite ولا cache كبيانات دائمة — الأصل دائمًا من Supabase Storage، وذاكرة sharp للقرص مؤقتة فقط (تُبنى تلقائيًا من الأصل).

**ترحيل بيانات موجودة من SQLite إلى Supabase (اختياري — إن أردت نقل بيانات التطوير):**
```bash
bun scripts/migrate-to-postgres.ts "<supabase-direct-5432-url>" --from db/custom.db
bun scripts/verify-pg-migration.ts "<supabase-direct-5432-url>"   # تطابق 100% إلزامي
```

ملاحظات نشر مهمة:
- **لا تشغّل `db:seed` في الإنتاج** — يُرفض تلقائيًا أصلًا (انظر أمان seed أعلاه) — أنشئ الحسابات عبر `scripts/create-user.ts`.
- اعمل نسخًا احتياطية دورية من قاعدة البيانات ومجلد `UPLOAD_DIR`.
- خلف وكيل عكسي (Nginx/Caddy) مع HTTPS، وحدّ حجم جسم الطلب بما يوازي حدود الرفع.
- خادم واحد فقط يفتح قاعدة SQLite (للتوسع الأفقي استخدم الخيار ب — PostgreSQL).

## 9) المساعد الذكي (حدود واضحة)

- ذكاء اصطناعي **حقيقي** عبر z-ai-web-dev-sdk من الخادم فقط (لا مفاتيح في العميل).
- ثلاث عمليات فقط: تحسين صياغة، اقتراح أثر مهني، تلخيص — تعمل على **النص الذي أدخله المعلم حصرًا**.
- التعليمات تمنع صراحة اختلاق أرقام أو نتائج، وكل اقتراح يُطبَّق في الحقل **قابل للتعديل/الرفض قبل الحفظ**، ولا يرسل أي بيانات طلاب شخصية.

## 10) حالة الجاهزية للإنتاج

**جاهز (مُختبر فعليًا):**
- مصادقة بريد/كلمة مرور + جلسات موقعة (تزوير الكوكي والانتهاء مرفوضان — مختبر).
- عزل بيانات المعلمين (IDOR) ونطاق المدير بالمدرسة — مختبر عبر HTTP لكل المسارات.
- رفع ملفات آمن (امتداد + بصمة + حجم + ملكية) وتقديم خاص عبر `/api/files` — مختبر.
- سلامة روابط الشواهد M2M (لا تكرار — قيد فريد، حذف إنجاز لا يحذف شاهدًا مشتركًا — مختبر).
- الحفظ التلقائي: مسودة واحدة مهما تزامنت الكتابة (مختبر بـ3 مدخلات متزامنة)، والاستعادة بعد انقطاع الشبكة تعمل.
- السنوات: إنشاء نظيف بلا تكرار إنجازات، أرشفة تحفظ البيانات، استعادة عبر API — مختبر (الاستعادة متاحة API فقط؛ الواجهة تعرض الأرشفة).
- التقارير الستة + تقرير مخصص؛ تقرير كامل 31 صفحة RTL بلا قطع بطاقات/جداول، صور أفقية/رأسية بإطار `object-fit`، تذييل ثابت — مختبر بصريًا.
- بناء إنتاجي ناجح مع فحص TypeScript صارم + خادم standalone يجتاز دخول/لوحة/رفع/تقرير/بحث/ملفات (منفذ 3100).
- lint وtypecheck: صفر أخطاء. كونسول المتصفح: نظيف عبر الواجهات (سطح مكتب + iPhone 14 محاكى).

**يحتاج إعدادًا قبل الإطلاق:**
- `SESSION_SECRET` قوي، و`DATABASE_URL`/`UPLOAD_DIR` بمسارات مطلقة ثابتة + نسخ احتياطي.
- مفاتيح مزوّد الذكاء الاصطناعي في بيئة الخادم (بدونها يظهر خطأ لطيف عند طلب المساعدة فقط — بقية النظام لا يتأثر).
- وكيل عكسي HTTPS وضبط حدود جسم الطلب.

**غير مكتمل / حدود معروفة:**
- الاستعجال الواجهي: استعادة العام المؤرشف متاحة عبر API دون زر في الواجهة.
- روابط عميقة: التطبيق SPA بعرض واحد `/` — التحديث يعيدك للوحة الرئيسية (لا يوجد routing داخلي بالعناوين).
- ترقيم الصفحات: قوائم الإنجازات كاملة بلا تقسيم صفحات (كافٍ لمئات العناصر؛ البحث والشواهد محدودة النتائج).
- صفحة 404 الإنجليزية الافتراضية لروابط غير موجودة.
- المتصفحات: مُختبر على Chromium (وواجهة جوال محاكاة iPhone 14) — **لم يُختبر فعليًا على Edge/Safari/أجهزة حقيقية**.

**المخاطر المتبقية:**
- SQLite + تخزين ملفات محلي: مناسب لمدرسة/مدرستين على خادم واحد؛ التوسع الأفقي يتطلب الانتقال إلى Postgres وتخزين كائني.
- عرض المدير يحسب الاكتمال لكل معلم ببضعة استعلامات (حلقة لكل معلم) — مقبول حتى ~50 معلمًا؛ بعده يلزم تجميع استعلام واحد.
- لا Rate-limiting على تسجيل الدخول ولا قفل حساب بعد محاولات فاشلة (يُنصح به خلف الوكيل العكسي أو في طبقة لاحقة).
- نسيت كلمة المرور غير منفذة — تُدار حاليًا عبر مسؤول النظام (أداة create-user لإنشاء/إعادة إنشاء).
