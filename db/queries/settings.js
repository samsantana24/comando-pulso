const db = require('../connection');

const stmts = {
  get: db.prepare(`SELECT value FROM settings WHERE key = ?`),
  getAll: db.prepare(`SELECT key, value FROM settings`),
  upsert: db.prepare(`
    INSERT INTO settings (key, value, updated_by, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `),
};

function get(key) {
  const row = stmts.get.get(key);
  return row ? row.value : null;
}

function getAll() {
  const rows = stmts.getAll.all();
  return rows.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {});
}

function set(key, value, updatedBy = null) {
  stmts.upsert.run(key, String(value), updatedBy);
}

const batchUpdate = db.transaction((obj, updatedBy = null) => {
  for (const [key, value] of Object.entries(obj)) {
    stmts.upsert.run(key, String(value), updatedBy);
  }
});

module.exports = { get, getAll, set, batchUpdate };
