#!/usr/bin/env python3
"""long-text-test.py — ينشئ إنجازين اختباريين بنصوص طويلة (250/800 كلمة) للتحقق من الطباعة
ثم يحذفهما بعد الاختبار (يُشغل مع --cleanup للحذف فقط)"""
import json, sys, re
import urllib.request

BASE = 'http://localhost:3000'
EMAIL = 'sultan@madrasati.sa'
PASS = '***REMOVED-DEV-SECRET***'

def req(method, path, body=None, cookie=None):
    r = urllib.request.Request(BASE + path, method=method)
    if cookie: r.add_header('Cookie', cookie)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        r.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(r, data) as res:
        setc = res.headers.get('Set-Cookie', '')
        return json.loads(res.read().decode() or '{}'), (setc.split(';')[0] if setc else cookie)

# نص عربي طويل بسطور متصلة قليلة الفواصل
def long_text(words, seed_phrase):
    base = ('تعد مهارة القراءة حجر الأساس في تعلم اللغة العربية وتنمية التفكير الناقد لدى المتعلم '
            'وقد لاحظت خلال عملي في الفصول الدراسية أن الطلبة يتفاوتون في مستويات الطلاقة والاستيعاب '
            'وإن المعالجة الفردية المدروسة ترفع التحصيل بشكل ملحوظ عندما ترتبط باحتياجات حقيقية مقاسة ')
    out = []
    while len(out) < words:
        chunk = base.split()
        take = chunk[:min(len(chunk), words - len(out))]
        out += take
    text = ' '.join(out)
    return text[:len(seed_phrase)] + ' ' + text[len(seed_phrase):]

def main():
    _, cookie = req('POST', '/api/session', {'email': EMAIL, 'password': PASS})

    if '--cleanup' in sys.argv:
        # حذف الإنجازين الاختباريين
        listing, _ = req('GET', '/api/achievements', cookie=cookie)
        deleted = 0
        for a in listing.get('achievements', []):
            if a.get('title', '').startswith('اختبار النص الطويل'):
                req('DELETE', f"/api/achievements/{a['id']}", cookie=cookie)
                deleted += 1
        print(f'deleted {deleted} test achievements')
        return

    # ابحث عن معرف العام الحالي 1448 من جلسة المستخدم
    sess, _ = req('GET', '/api/session', cookie=cookie)
    years = sess.get('years', [])
    year_id = None
    for y in years:
        if '1448' in y['label'] and not y.get('archived'):
            year_id = y['id']; break
    if not year_id and years:
        year_id = [y for y in years if not y.get('archived')][0]['id']

    t250 = long_text(250, 'اختبار النص الطويل 250 كلمة:')
    t800 = long_text(800, 'اختبار النص الطويل 800 كلمة:')

    for title, desc in [('اختبار النص الطويل — 250 كلمة', t250), ('اختبار النص الطويل — 800 كلمة', t800)]:
        body = {
            'type': 'PRACTICE',
            'title': title,
            'description': desc,
            'status': 'COMPLETED',
            'yearId': year_id,
        }
        res, _ = req('POST', '/api/achievements', body, cookie=cookie)
        aid = res.get('achievement', {}).get('id')
        print(f'created: {title} -> {aid}')

if __name__ == '__main__':
    main()
