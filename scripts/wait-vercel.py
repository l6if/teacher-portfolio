#!/usr/bin/env python3
"""مراقبة نشر Vercel Production — ينتظر جاهزية أحدث deployment لـ main."""
import json
import os
import sys
import time
import urllib.request

TEAM = 'sultans-projects-bce2ab1d'
PROJECT = 'teacher-portfolio'
COMMIT = sys.argv[1] if len(sys.argv) > 1 else None

with open(os.path.expanduser('~/.local/share/com.vercel.cli/auth.json')) as f:
    TOKEN = json.load(f)['token']

def get(url):
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {TOKEN}'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

url = f'https://api.vercel.com/v6/deployments?projectId=&teamSlug={TEAM}&projectId=&app=&limit=10'
url = f'https://api.vercel.com/v6/deployments?teamSlug={TEAM}&app={PROJECT}&limit=10&target=production'

deadline = time.time() + 600
seen = {}
while time.time() < deadline:
    try:
        data = get(url)
        deps = data.get('deployments', [])
        prod = [d for d in deps if d.get('target') == 'production']
        for d in prod:
            sha = (d.get('meta', {}).get('githubCommitSha') or '')[:7]
            if COMMIT and sha != COMMIT:
                continue
            state = d.get('readyState')  # BUILDING | READY | ERROR | QUEUED | CANCELED
            url_out = d.get('url')
            seen[state] = f'{sha} {url_out}'
            if state == 'READY':
                print(f'READY {sha} https://{url_out}')
                sys.exit(0)
            if state == 'ERROR':
                print(f'ERROR {sha} {url_out}')
                sys.exit(1)
        print('waiting…', {k: v for k, v in seen.items()} or 'no production deployment yet', flush=True)
    except Exception as e:
        print('poll error:', e, flush=True)
    time.sleep(15)
print('TIMEOUT')
sys.exit(2)
