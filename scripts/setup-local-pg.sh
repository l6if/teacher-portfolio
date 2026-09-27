#!/usr/bin/env bash
# إعداد PostgreSQL 16.4 محمول على 5433 (نفس بنية البيئة السابقة — zonky binaries)
set -e
cd /home/z/my-project
mkdir -p .pg
cd .pg
# استخراج ثنائيات postgres من حزمة zonky jar (jar → txz → شجرة bin/share/lib)
if [ ! -x bin/postgres ]; then
  cd /home/z/my-project/.pg-downloads
  unzip -oq pg-bin.jar -d /home/z/my-project/.pg
  cd /home/z/my-project/.pg
  tar -xJf postgres-linux-x86_64.txz
  chmod +x /home/z/my-project/.pg/bin/* 2>/dev/null || true
  rm -f postgres-linux-x86_64.txz
fi
cd /home/z/my-project/.pg
export PGROOT=/home/z/my-project/.pg
# مجلدات runtime المطلوبة
mkdir -p pg_tblspc pg_stat_tmp
# إنشاء الكلاستر في data/
if [ ! -f data/PG_VERSION ]; then
  ./bin/initdb -D data -U postgres --encoding=UTF8 --locale=C -E UTF8 > initdb.log 2>&1
  echo "initdb done"
fi
# ضبط المنفذ 5433 + الاستماع المحلي فقط
cat > data/postgresql.conf <<'EOF'
listen_addresses = '127.0.0.1'
port = 5433
unix_socket_directories = '/home/z/my-project/.pg'
max_connections = 100
shared_buffers = 64MB
EOF
# إقلاع
./bin/pg_ctl -D data -l /home/z/my-project/.pg/pg.log -w -t 30 start
sleep 1
# قاعدة التطبيق
./bin/psql -h 127.0.0.1 -p 5433 -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='teacherfolio'" | grep -q 1 || \
  ./bin/createdb -h 127.0.0.1 -p 5433 -U postgres teacherfolio
# قاعدة تحقق المهاجرات الفارغة
./bin/psql -h 127.0.0.1 -p 5433 -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='migration_check'" | grep -q 1 || \
  ./bin/createdb -h 127.0.0.1 -p 5433 -U postgres migration_check
./bin/psql -h 127.0.0.1 -p 5433 -U postgres -tc "SELECT version()"
echo "PG_READY on 127.0.0.1:5433 (teacherfolio + migration_check)"
