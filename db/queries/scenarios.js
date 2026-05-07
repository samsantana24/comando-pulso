const db = require('../connection');

const stmts = {
  list: db.prepare(`SELECT * FROM scenarios ORDER BY created_at`),
  getById: db.prepare(`SELECT * FROM scenarios WHERE id = ?`),
  getActive: db.prepare(`SELECT * FROM scenarios WHERE is_active = 1 LIMIT 1`),
  countAll: db.prepare(`SELECT COUNT(*) AS c FROM scenarios`),
  insert: db.prepare(`
    INSERT INTO scenarios (name, description, is_active, color, created_by)
    VALUES (?, ?, 0, COALESCE(?, '#2DD4BF'), ?) RETURNING *
  `),
  insertFunnelDefault: db.prepare(`INSERT INTO scenario_funnel (scenario_id) VALUES (?)`),
  deactivateAll: db.prepare(`UPDATE scenarios SET is_active = 0 WHERE id != ?`),
  activateOne: db.prepare(`UPDATE scenarios SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`),
  deleteById: db.prepare(`DELETE FROM scenarios WHERE id = ?`),
  copyFunnel: db.prepare(`
    INSERT INTO scenario_funnel
      (scenario_id, ads_per_week, cpl, rebarba_sb_per_week, show_rate_pct, call_to_sale_pct, forecast_bonus_pct, ticket_avg, payment_tax_pct)
    SELECT ?, ads_per_week, cpl, rebarba_sb_per_week, show_rate_pct, call_to_sale_pct, forecast_bonus_pct, ticket_avg, payment_tax_pct
    FROM scenario_funnel WHERE scenario_id = ?
  `),
  copyTeamPerf: db.prepare(`
    INSERT INTO scenario_team_performance (scenario_id, team_member_id, capacity_per_week, conversion_pct)
    SELECT ?, team_member_id, capacity_per_week, conversion_pct
    FROM scenario_team_performance WHERE scenario_id = ?
  `),
  copyHypotheticalCosts: db.prepare(`
    INSERT INTO costs (date, amount, category, description, status, scenario_id, created_by)
    SELECT date, amount, category, description, status, ?, created_by
    FROM costs WHERE scenario_id = ?
  `),
};

function list() {
  return stmts.list.all();
}

function getById(id) {
  return stmts.getById.get(id);
}

function getActive() {
  return stmts.getActive.get();
}

const create = db.transaction(({ name, description = null, color = null, createdBy = null }) => {
  const scenario = stmts.insert.get(name, description, color, createdBy);
  stmts.insertFunnelDefault.run(scenario.id);
  return scenario;
});

function update(id, fields) {
  const keys = Object.keys(fields).filter((k) => ['name', 'description', 'color'].includes(k));
  if (keys.length === 0) return getById(id);
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  return db
    .prepare(`UPDATE scenarios SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`)
    .get(...values, id);
}

const activate = db.transaction((id) => {
  stmts.deactivateAll.run(id);
  stmts.activateOne.run(id);
  return getById(id);
});

function remove(id) {
  const { c } = stmts.countAll.get();
  if (c <= 1) {
    throw new Error('Não é possível excluir o único cenário existente');
  }
  stmts.deleteById.run(id);
  return { id };
}

const duplicate = db.transaction(({ sourceId, newName, createdBy = null }) => {
  const src = stmts.getById.get(sourceId);
  if (!src) throw new Error(`Cenário ${sourceId} não encontrado`);
  const novo = stmts.insert.get(newName, src.description, src.color, createdBy);
  stmts.copyFunnel.run(novo.id, sourceId);
  stmts.copyTeamPerf.run(novo.id, sourceId);
  stmts.copyHypotheticalCosts.run(novo.id, sourceId);
  return novo;
});

module.exports = { list, getById, getActive, create, update, activate, remove, duplicate };
