const db = require('../connection');

const stmts = {
  list: db.prepare(`SELECT * FROM categories WHERE active = 1 ORDER BY group_name, display_order, name`),
  listAll: db.prepare(`SELECT * FROM categories ORDER BY group_name, display_order, name`),
  getById: db.prepare(`SELECT * FROM categories WHERE id = ?`),
  getByName: db.prepare(`SELECT * FROM categories WHERE name = ?`),
  insert: db.prepare(`
    INSERT INTO categories (name, group_name, display_order)
    VALUES (?, ?, COALESCE(?, 0))
    RETURNING *
  `),
  countCosts: db.prepare(`SELECT COUNT(*) AS c FROM costs WHERE category = ?`),
  renameCosts: db.prepare(`UPDATE costs SET category = ? WHERE category = ?`),
  deleteById: db.prepare(`DELETE FROM categories WHERE id = ?`),
  updateById: db.prepare(`UPDATE categories SET name = ?, group_name = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`),
};

function list({ activeOnly = true } = {}) {
  return activeOnly ? stmts.list.all() : stmts.listAll.all();
}

function getById(id) { return stmts.getById.get(id); }
function getByName(name) { return stmts.getByName.get(name); }

function create(data) {
  return stmts.insert.get(data.name, data.group_name, data.display_order ?? 0);
}

const update = db.transaction((id, fields) => {
  const before = stmts.getById.get(id);
  if (!before) return null;
  const newName = fields.name ?? before.name;
  const newGroup = fields.group_name ?? before.group_name;
  const newOrder = fields.display_order ?? before.display_order;
  if (newName !== before.name) {
    stmts.renameCosts.run(newName, before.name);
  }
  stmts.updateById.run(newName, newGroup, newOrder, id);
  return stmts.getById.get(id);
});

function countCostsForCategory(name) {
  return stmts.countCosts.get(name).c;
}

const remove = db.transaction((id, opts = {}) => {
  const cat = stmts.getById.get(id);
  if (!cat) return null;
  const count = stmts.countCosts.get(cat.name).c;
  if (count > 0 && !opts.moveTo) {
    const err = new Error(`Categoria tem ${count} custo(s) associado(s)`);
    err.costsCount = count;
    err.code = 'HAS_COSTS';
    throw err;
  }
  if (count > 0 && opts.moveTo) {
    stmts.renameCosts.run(opts.moveTo, cat.name);
  }
  stmts.deleteById.run(id);
  return cat;
});

function listGrouped({ activeOnly = true } = {}) {
  const items = list({ activeOnly });
  const grouped = {};
  for (const c of items) {
    if (!grouped[c.group_name]) grouped[c.group_name] = [];
    grouped[c.group_name].push(c);
  }
  return grouped;
}

function buildNameToGroupMap() {
  const map = new Map();
  for (const c of list({ activeOnly: false })) map.set(c.name, c.group_name);
  return map;
}

module.exports = {
  list, listGrouped, getById, getByName, create, update, remove,
  countCostsForCategory, buildNameToGroupMap,
};
