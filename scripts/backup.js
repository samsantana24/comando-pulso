const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.join(__dirname, '..');
const SOURCE = path.join(PROJECT_DIR, 'data.db');
const BACKUP_DIR = process.env.BACKUP_DIR || '/var/backups/comando-pulso';
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS) || 30;

const KEEP_REGEX = /^\d{4}-\d{2}-\d{2}-\d{6}\.(db|db-wal|db-shm)$/;

function pad2(n) { return String(n).padStart(2, '0'); }
function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.copyFileSync(src, dest);
  return true;
}

function run() {
  if (!fs.existsSync(SOURCE)) {
    console.error('[backup] data.db não encontrado:', SOURCE);
    process.exit(1);
  }
  ensureDir(BACKUP_DIR);
  const ts = timestamp();
  const dbDest = path.join(BACKUP_DIR, `${ts}.db`);
  fs.copyFileSync(SOURCE, dbDest);
  console.log('[backup] criado:', dbDest);
  copyIfExists(SOURCE + '-wal', path.join(BACKUP_DIR, `${ts}.db-wal`));
  copyIfExists(SOURCE + '-shm', path.join(BACKUP_DIR, `${ts}.db-shm`));

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const f of fs.readdirSync(BACKUP_DIR)) {
    if (!KEEP_REGEX.test(f)) continue;
    const full = path.join(BACKUP_DIR, f);
    const st = fs.statSync(full);
    if (st.mtimeMs < cutoff) {
      fs.unlinkSync(full);
      removed++;
    }
  }
  if (removed > 0) console.log('[backup] removidos antigos:', removed);
  console.log('[backup] OK');
}

run();
