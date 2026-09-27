#!/usr/bin/env python3
"""مشغّل خادم الإنتاج التجريبي كخفيّ (double-fork) — منفذ 3100 على PG المحلي."""
import os
import sys
import subprocess

PROJECT = '/home/z/my-project'
STANDALONE = os.path.join(PROJECT, '.next/standalone')
LOG = '/tmp/prod-test.log'
ERR = '/tmp/prod-daemon-error.log'

ENV = {
    **os.environ,
    'DATABASE_URL': 'postgres://postgres@127.0.0.1:5433/teacherfolio',
    'DIRECT_URL': 'postgres://postgres@127.0.0.1:5433/teacherfolio',
    'NODE_ENV': 'production',
    'PORT': '3100',
    'HOSTNAME': '127.0.0.1',
}

# SESSION_SECRET من .env (متجاهل من Git) — لا يُطبع أبدًا
with open(os.path.join(PROJECT, '.env')) as f:
    for line in f:
        line = line.strip()
        if line.startswith('SESSION_SECRET='):
            ENV['SESSION_SECRET'] = line.split('=', 1)[1].strip().strip('"').strip("'")
            break


def daemonize_and_exec():
    if os.fork() > 0:
        sys.exit(0)
    os.setsid()
    if os.fork() > 0:
        sys.exit(0)
    os.chdir(STANDALONE)
    os.umask(0)
    fd = os.open(os.devnull, os.O_RDWR)
    os.dup2(fd, 0)
    os.dup2(fd, 1)
    os.dup2(fd, 2)
    if fd > 2:
        os.close(fd)
    try:
        log_fd = os.open(LOG, os.O_WRONLY | os.O_CREAT | os.O_TRUNC)
        subprocess.Popen(
            ['node', 'server.js'],
            cwd=STANDALONE,
            env=ENV,
            stdout=log_fd,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            close_fds=True,
        )
    except Exception as e:
        with open(ERR, 'w') as f:
            f.write(repr(e))


daemonize_and_exec()
