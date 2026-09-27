#!/usr/bin/env python3
"""مشغّل خادم التطوير كخفيّ (double-fork) على PostgreSQL المحلي.

يقرأ .env بنفسه ويبني بيئة نظيفة (يحذف أي DATABASE_URL/DIRECT_URL موروثة من
جلسة الشل حتى لا تتغلب على .env — Next.js لا يستبدل المتغيرات الموجودة).
"""
import os
import sys
import subprocess

PROJECT = '/home/z/my-project'
LOG = os.path.join(PROJECT, 'dev.log')

# بيئة نظيفة: الأساسيات فقط + قيم .env (بلا تلوث من جلسة الشل)
BASE_ENV = {
    'PATH': os.environ.get('PATH', '/usr/local/bin:/usr/bin:/bin'),
    'HOME': os.environ.get('HOME', '/home/z'),
    'LANG': 'en_US.UTF-8',
    'TERM': 'xterm',
}


def read_env_file(path):
    values = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, val = line.split('=', 1)
                values[key.strip()] = val.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return values


ENV = {**BASE_ENV, **read_env_file(os.path.join(PROJECT, '.env'))}


def daemonize_and_exec():
    # Fork أول: ينفصل عن جلسة الأمر
    if os.fork() > 0:
        sys.exit(0)
    os.setsid()
    # Fork ثانٍ: يضمن عدم اكتساب طرفية تحكم جديدة أبدًا
    if os.fork() > 0:
        sys.exit(0)
    os.chdir(PROJECT)
    os.umask(0)
    # إغلاق جميع الواصفات القياسية
    fd = os.open(os.devnull, os.O_RDWR)
    os.dup2(fd, 0)
    os.dup2(fd, 1)
    os.dup2(fd, 2)
    if fd > 2:
        os.close(fd)
    # dev.log يُكتب عبر tee داخل سكربت npm run dev نفسه
    subprocess.Popen(['bun', 'run', 'dev'], cwd=PROJECT, env=ENV,
                     stdin=subprocess.DEVNULL)


daemonize_and_exec()
