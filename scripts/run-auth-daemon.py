#!/usr/bin/env python3
"""مشغّل عام لأوامر التفويض كخفيّ (double-fork) مع التقاط المخرجات لملف سجل.

الاستخدام: python3 run-auth-daemon.py <logfile> <command> [args...]

الغرض: أوامر login ذات التدفق البطيء (gh/vercel/supabase) تحتاج البقاء حية
بين استدعاءات الأدوات — النمط المزدوج fork ينجو كما ينجو خادم postgres.
"""
import os
import sys
import subprocess

PROJECT = '/home/z/my-project'


def main():
    if len(sys.argv) < 3:
        print('usage: run-auth-daemon.py <logfile> <command> [args...]')
        sys.exit(2)
    logfile = os.path.abspath(sys.argv[1])
    cmd = sys.argv[2:]

    if os.fork() > 0:
        sys.exit(0)
    os.setsid()
    if os.fork() > 0:
        sys.exit(0)
    os.chdir(PROJECT)
    os.umask(0o077)  # ملفات السجل حساسة محتملًا — صلاحيات خاصة فقط

    out = open(logfile, 'ab', buffering=0)
    fd = os.open(os.devnull, os.O_RDWR)
    os.dup2(fd, 0)
    os.dup2(out.fileno(), 1)
    os.dup2(out.fileno(), 2)
    if fd > 2:
        os.close(fd)

    env = {
        'PATH': os.environ.get('PATH', '/usr/local/bin:/usr/bin:/bin'),
        'HOME': os.environ.get('HOME', '/home/z'),
        'LANG': 'en_US.UTF-8',
        'TERM': 'xterm',
    }
    subprocess.Popen(cmd, cwd=PROJECT, env=env, stdin=subprocess.DEVNULL,
                     stdout=out, stderr=subprocess.STDOUT)
    out.flush()


if __name__ == '__main__':
    main()
