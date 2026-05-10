const db = require('../connection');

const stmts = {
  listByScenario: db.prepare(`SELECT week_id, sales_projected FROM weekly_sales_overrides WHERE scenario_id = ?`),
  get: db.prepare(`SELECT * FROM weekly_sales_overrides WHERE scenario_id = ? AND week_id = ?`),
  upsert: db.prepare(`
    INSERT INTO weekly_sales_overrides (scenario_id, week_id, sales_projected, updated_by, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(scenario_id, week_id) DO UPDATE SET
      sales_projected = excluded.sales_projected,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `),
  remove: db.prepare(`DELETE FROM weekly_sales_overrides WHERE scenario_id = ? AND week_id = ?`),
};

function listByScenario(scenarioId) {
  if (!scenarioId) return [];
  return stmts.listByScenario.all(scenarioId);
}

function mapByScenario(scenarioId) {
  const out = new Map();
  for (const r of listByScenario(scenarioId)) {
    out.set(r.week_id, Number(r.sales_projected));
  }
  return out;
}

function upsert({ scenarioId, weekId, salesProjected, updatedBy = null }) {
  return stmts.upsert.get(scenarioId, weekId, Number(salesProjected), updatedBy);
}

function remove(scenarioId, weekId) {
  stmts.remove.run(scenarioId, weekId);
}

module.exports = { listByScenario, mapByScenario, upsert, remove };
