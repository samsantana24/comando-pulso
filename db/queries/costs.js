const db = require('../connection');

const stmts = {
  getById: db.prepare(`SELECT * FROM costs WHERE id = ?`),
  insert: db.prepare(`
    INSERT INTO costs (date, amount, category, description, status, recurrence_id, scenario_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
  `),
  deleteById: db.prepare(`DELETE FROM costs WHERE id = ?`),
};

const FIELDS = ['date', 'amount', 'category', 'description', 'status', 'recurrence_id', 'scenario_id'];

function list({ from = null, to = null, scenarioId = undefined, status = null } = {}) {
  const where = [];
  const params = [];
  if (from) {
    where.push('date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('date <= ?');
    params.push(to);
  }
  if (scenarioId === null) {
    where.push('scenario_id IS NULL');
  } else if (scenarioId !== undefined) {
    where.push('(scenario_id IS NULL OR scenario_id = ?)');
    params.push(scenarioId);
  }
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  const sql = `SELECT * FROM costs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY date DESC, id DESC`;
  return db.prepare(sql).all(...params);
}

function getById(id) {
  return stmts.getById.get(id);
}

function create(data, createdBy = null) {
  return stmts.insert.get(
    data.date,
    data.amount,
    data.category,
    data.description ?? null,
    data.status ?? 'planned',
    data.recurrence_id ?? null,
    data.scenario_id ?? null,
    createdBy
  );
}

function update(id, fields) {
  const keys = Object.keys(fields).filter((k) => FIELDS.includes(k));
  if (keys.length === 0) return getById(id);
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  return db
    .prepare(`UPDATE costs SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`)
    .get(...values, id);
}

function remove(id) {
  const before = getById(id);
  if (!before) return null;
  stmts.deleteById.run(id);
  return before;
}

module.exports = { list, getById, create, update, remove };
