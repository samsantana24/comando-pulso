const db = require('../connection');

const stmts = {
  list: db.prepare(`SELECT * FROM team_members WHERE active = 1 ORDER BY role, name`),
  listAll: db.prepare(`SELECT * FROM team_members ORDER BY role, name`),
  listByRole: db.prepare(`SELECT * FROM team_members WHERE active = 1 AND role = ? ORDER BY name`),
  getById: db.prepare(`SELECT * FROM team_members WHERE id = ?`),
  create: db.prepare(`INSERT INTO team_members (name, role) VALUES (?, ?) RETURNING *`),
  softDelete: db.prepare(`UPDATE team_members SET active = 0 WHERE id = ?`),
  hardDelete: db.prepare(`DELETE FROM team_members WHERE id = ?`),
  countSales: db.prepare(`SELECT COUNT(*) AS c FROM sales WHERE closer_id = ?`),
};

function list({ activeOnly = true, role = null } = {}) {
  if (role) return stmts.listByRole.all(role);
  return activeOnly ? stmts.list.all() : stmts.listAll.all();
}

function getById(id) {
  return stmts.getById.get(id);
}

function create(name, role) {
  return stmts.create.get(name, role);
}

function update(id, fields) {
  const keys = Object.keys(fields).filter((k) => ['name', 'role', 'active'].includes(k));
  if (keys.length === 0) return getById(id);
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  return db
    .prepare(`UPDATE team_members SET ${setClause} WHERE id = ? RETURNING *`)
    .get(...values, id);
}

function remove(id) {
  const { c } = stmts.countSales.get(id);
  if (c > 0) {
    stmts.softDelete.run(id);
    return { mode: 'soft', id };
  }
  stmts.hardDelete.run(id);
  return { mode: 'hard', id };
}

module.exports = { list, getById, create, update, remove };
