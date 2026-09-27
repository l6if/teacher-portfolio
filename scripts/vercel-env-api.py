#!/usr/bin/env python3
"""ضبط متغيرات بيئة Vercel الإنتاجية عبر REST API (بلا مطالبات تفاعلية).

يقرأ: توكن CLI من ~/.local/share/com.vercel.cli/auth.json
      القيم من الملفات المحجوبة فقط (.env.supabase-project / .env.production-secrets)
يطبع: أسماء المتغيرات وأكواد HTTP فقط — لا قيم مطلقًا.
"""
import json
import os
import sys
import urllib.request

TEAM = 'sultans-projects-bce2ab1d'
PROJECT = 'teacher-portfolio'
API = f'https://api.vercel.com/v10/projects/{PROJECT}/env'

with open(os.path.expanduser('~/.local/share/com.vercel.cli/auth.json')) as f:
    TOKEN = json.load(f)['token']


def read_env(path):
    d = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                d[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    return d


SUPA = read_env('/home/z/my-project/.env.supabase-project')
SECR = read_env('/home/z/my-project/.env.production-secrets')

VARS = [
    ('DATABASE_URL', SUPA.get('DATABASE_URL', '')),
    ('DIRECT_URL', SUPA.get('DIRECT_URL', '')),
    ('SESSION_SECRET', SECR.get('SESSION_SECRET', '')),
    ('SUPABASE_URL', SUPA.get('SUPABASE_URL', '')),
    ('SUPABASE_SERVICE_ROLE_KEY', SUPA.get('SUPABASE_SERVICE_ROLE_KEY', '')),
    ('SUPABASE_STORAGE_BUCKET', 'teacher-evidence'),
    ('NEXT_PUBLIC_SUPABASE_URL', SUPA.get('SUPABASE_URL', '')),
    ('NEXT_PUBLIC_SUPABASE_ANON_KEY', SUPA.get('SUPABASE_ANON_KEY', '')),
    ('NEXT_PUBLIC_STORAGE_BUCKET', 'teacher-evidence'),
    ('NEXT_PUBLIC_PROXY_UPLOAD_LIMIT_MB', '4'),
    ('GROQ_API_KEY', SECR.get('GROQ_API_KEY', '')),
    ('GROQ_MODEL', 'llama-3.3-70b-versatile'),
    ('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
]

fail = 0
for name, value in VARS:
    if not value:
        print(f'✗ {name}: EMPTY VALUE — skipped')
        fail = 1
        continue
    body = json.dumps({
        'key': name,
        'value': value,
        'type': 'encrypted',
        'target': ['production'],
    }).encode()
    req = urllib.request.Request(
        f'{API}?teamId={TEAM}&upsert=true',
        data=body,
        method='POST',
        headers={
            'Authorization': f'Bearer {TOKEN}',
            'Content-Type': 'application/json',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            code = resp.status
            data = json.loads(resp.read().decode())
            # لا نطبع أي محتوى قد يحمل القيمة — الاسم والنوع فقط
            print(f'✓ {name}: HTTP {code} | target={data.get("target") or data.get("type", "?")} [len={len(value)}]')
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()[:200]
        # تنظيف أي احتمال لظهور القيمة في نص الخطأ
        if value[:12] in err_body:
            err_body = '(error body hidden — contains value)'
        print(f'✗ {name}: HTTP {e.code} — {err_body}')
        fail = 1

print('────────────')
print('✅ ALL SET' if fail == 0 else '⚠ SOME FAILED')
sys.exit(fail)
