const db = require('../connection');

const stmts = {
  list: db.prepare(`SELECT * FROM recurrence_rules WHERE active = 1 ORDER BY created_at DESC`),
  listAll: db.prepare(`SELECT * FROM recurrence_rules ORDER BY created_at DESC`),
  getById: db.prepare(`SELECT * FROM recurrence_rules WHERE id = ?`),
  insert: db.prepare(`
    INSERT INTO recurrence_rules
      (pattern, pattern_value, start_date, end_date, base_amount, category, description, scenario_id, active, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?) RETURNING *
  `),
  deactivate: db.prepare(`UPDATE recurrence_rules SET active = 0 WHERE id = ?`),
  detachOccurrences: db.prepare(`UPDATE costs SET recurrence_id = NULL WHERE recurrence_id = ? AND date <= ?`),
  deleteFutureOccurrences: db.prepare(`DELETE FROM costs WHERE recurrence_id = ? AND date > ?`),
};

const FIELDS = ['pattern', 'pattern_value', 'start_date', 'end_date', 'base_amount', 'category', 'description', 'scenario_id', 'active'];

function list({ activeOnly = true } = {}) {
  return activeOnly ? stmts.list.all() : stmts.listAll.all();
}

function getById(id) {
  return stmts.getById.get(id);
}

function create(data, createdBy = null) {
  return stmts.insert.get(
    data.pattern,
    data.pattern_value,
    data.start_date,
    data.end_date ?? null,
    data.base_amount,
    data.category,
    data.description ?? null,
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
    .prepare(`UPDATE recurrence_rules SET ${setClause} WHERE id = ? RETURNING *`)
    .get(...values, id);
}

function deactivate(id) {
  stmts.deactivate.run(id);
  return getById(id);
}

function detachPastOccurrences(recurrenceId, todayIso) {
  stmts.detachOccurrences.run(recurrenceId, todayIso);
}

function clearFutureOccurrences(recurrenceId, todayIso) {
  stmts.deleteFutureOccurrences.run(recurrenceId, todayIso);
}

module.exports = {
  list,
  getById,
  create,
  update,
  deactivate,
  detachPastOccurrences,
  clearFutureOccurrences,
};
