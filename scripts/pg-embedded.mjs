#!/usr/bin/env node
// خادم PostgreSQL محلي مضمّر (بنيات embedded-postgres، بلا صلاحيات root)
// الاستخدام: node scripts/pg-embedded.mjs start|stop|status
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = '/home/z/my-project/.pgdev'
const BIN = '/home/z/my-project/node_modules/@embedded-postgres/linux-x64/native/bin'
const DATA = join(ROOT, 'data')
const PORT = 5433
const LOG = join(ROOT, 'pg.log')

const run = (cmd, args) =>
  new Promise((resolve) => {
    execFile(cmd, args, { cwd: ROOT }, (err, stdout, stderr) =>
      resolve({ err: err?.message, stdout: stdout.trim(), stderr: stderr.trim() }),
    )
  })

async function start() {
  mkdirSync(ROOT, { recursive: true })
  if (!existsSync(join(DATA, 'PG_VERSION'))) {
    console.log('initialising data dir…')
    const r = await run(`${BIN}/initdb`, ['-D', DATA, '-U', 'postgres', '--no-locale', '-E', 'UTF8', '-A', 'trust'])
    if (r.err) { console.error('initdb failed:', r.stderr || r.err); process.exit(1) }
  }
  // port + unix socket dir
  const conf = join(DATA, 'postgresql.conf')
  const { appendFileSync, readFileSync, writeFileSync } = await import('node:fs')
  let confText = readFileSync(conf, 'utf8')
  if (!confText.includes('# --- pgdev ---')) {
    confText += `\n# --- pgdev ---\nport = ${PORT}\nlisten_addresses = '127.0.0.1'\nunix_socket_directories = '${ROOT}'\nmax_connections = 100\n`
    writeFileSync(conf, confText)
  }
  const up = await run(`${BIN}/pg_ctl`, ['-D', DATA, '-l', LOG, '-w', '-t', '30', 'start'])
  if (up.err) { console.error('start failed:', up.stderr || up.err); process.exit(1) }
  console.log(`PG UP on 127.0.0.1:${PORT} ✓`)
  // إنشاء القاعدة إن لم توجد
  const pg = (await import('pg')).default
  const c = new pg.Client({ connectionString: `postgresql://postgres@127.0.0.1:${PORT}/postgres` })
  await c.connect()
  const exists = await c.query("select 1 from pg_database where datname='teacherfolio'")
  if (exists.rowCount === 0) {
    await c.query('create database teacherfolio')
    console.log('database teacherfolio created ✓')
  }
  await c.end()
}

async function stop() {
  const r = await run(`${BIN}/pg_ctl`, ['-D', DATA, '-m', 'fast', 'stop'])
  console.log(r.err ? 'not running or: ' + (r.stderr || r.err) : 'PG stopped ✓')
}

const [,, cmd] = process.argv
if (cmd === 'start') start()
else if (cmd === 'stop') stop()
else if (cmd === 'status') {
  const r = await run(`${BIN}/pg_ctl`, ['-D', DATA, 'status'])
  console.log(r.stdout || r.stderr || 'unknown')
}
else console.log('usage: node scripts/pg-embedded.mjs start|stop|status')
