const db = require('../connection');

const insertStmt = db.prepare(`
  INSERT INTO audit_log (user_email, action, entity_type, entity_id, before_value, after_value)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const listStmt = db.prepare(`
  SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?
`);

function log({ userEmail, action, entityType, entityId = null, before = null, after = null }) {
  const beforeJson = before === null ? null : JSON.stringify(before);
  const afterJson = after === null ? null : JSON.stringify(after);
  insertStmt.run(userEmail, action, entityType, entityId, beforeJson, afterJson);
}

function list(limit = 100) {
  return listStmt.all(limit).map((row) => ({
    ...row,
    before_value: row.before_value ? JSON.parse(row.before_value) : null,
    after_value: row.after_value ? JSON.parse(row.after_value) : null,
  }));
}

module.exports = { log, list };
