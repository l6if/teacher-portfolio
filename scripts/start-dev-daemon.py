#!/usr/bin/env python3
"""مشغّل خادم التطوير كخفيّ (daemon) بنمط double-fork — يهرب من قتل مجموعة العمليات."""
import os
import sys
import subprocess

PROJECT = '/home/z/my-project'
LOG = os.path.join(PROJECT, 'dev.log')

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
    # تشغيل خادم التطوير — dev.log يُكتب عبر tee داخل السكربت نفسه
    subprocess.Popen(['bun', 'run', 'dev'], cwd=PROJECT)

daemonize_and_exec()
