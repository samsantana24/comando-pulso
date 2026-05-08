const db = require('../connection');

const stmts = {
  getById: db.prepare(`SELECT * FROM receivables WHERE id = ?`),
  insert: db.prepare(`
    INSERT INTO receivables (sale_id, expected_date, expected_amount, payment_method, status, client_name, notes, created_by)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?) RETURNING *
  `),
  delete: db.prepare(`DELETE FROM receivables WHERE id = ?`),
  cancel: db.prepare(`UPDATE receivables SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`),
  markReceived: db.prepare(`
    UPDATE receivables
    SET status = 'received', received_date = ?, received_sale_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? RETURNING *
  `),
};

const FIELDS = ['expected_date', 'expected_amount', 'payment_method', 'status', 'client_name', 'notes'];

function list({ status = null, from = null, to = null } = {}) {
  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (from) { where.push('expected_date >= ?'); params.push(from); }
  if (to) { where.push('expected_date <= ?'); params.push(to); }
  const sql = `SELECT * FROM receivables ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY expected_date, id`;
  return db.prepare(sql).all(...params);
}

function getById(id) { return stmts.getById.get(id); }

function create(data, createdBy = null) {
  return stmts.insert.get(
    data.sale_id ?? null,
    data.expected_date,
    Number(data.expected_amount),
    data.payment_method || null,
    data.client_name || null,
    data.notes || null,
    createdBy
  );
}

function update(id, fields) {
  const keys = Object.keys(fields).filter((k) => FIELDS.includes(k));
  if (keys.length === 0) return getById(id);
  const set = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  return db.prepare(`UPDATE receivables SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`).get(...values, id);
}

function markReceived(id, { receivedDate, receivedSaleId }) {
  return stmts.markReceived.get(receivedDate, receivedSaleId, id);
}

function cancel(id) { stmts.cancel.run(id); return getById(id); }
function remove(id) { stmts.delete.run(id); }

module.exports = { list, getById, create, update, markReceived, cancel, remove };
