const db = require('../connection');

const stmts = {
  listRange: db.prepare(`SELECT * FROM sales WHERE date >= ? AND date <= ? ORDER BY date DESC, id DESC`),
  listAll: db.prepare(`SELECT * FROM sales ORDER BY date DESC, id DESC`),
  recent: db.prepare(`SELECT * FROM sales ORDER BY date DESC, id DESC LIMIT ?`),
  getById: db.prepare(`SELECT * FROM sales WHERE id = ?`),
  insert: db.prepare(`
    INSERT INTO sales (date, gross_amount, net_amount, client_name, closer_id, payment_method, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
  `),
  deleteById: db.prepare(`DELETE FROM sales WHERE id = ?`),
};

const FIELDS = ['date', 'gross_amount', 'net_amount', 'client_name', 'closer_id', 'payment_method', 'notes'];

function list({ from = null, to = null, limit = null } = {}) {
  if (from && to) return stmts.listRange.all(from, to);
  if (limit) return stmts.recent.all(limit);
  return stmts.listAll.all();
}

function getById(id) {
  return stmts.getById.get(id);
}

function create(data, createdBy = null) {
  return stmts.insert.get(
    data.date,
    data.gross_amount,
    data.net_amount,
    data.client_name ?? null,
    data.closer_id ?? null,
    data.payment_method ?? null,
    data.notes ?? null,
    createdBy
  );
}

function update(id, fields) {
  const keys = Object.keys(fields).filter((k) => FIELDS.includes(k));
  if (keys.length === 0) return getById(id);
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  return db
    .prepare(`UPDATE sales SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`)
    .get(...values, id);
}

function remove(id) {
  const before = getById(id);
  if (!before) return null;
  stmts.deleteById.run(id);
  return before;
}

module.exports = { list, getById, create, update, remove };
