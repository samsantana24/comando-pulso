const db = require('../connection');

const stmts = {
  getByScenario: db.prepare(`SELECT * FROM scenario_funnel WHERE scenario_id = ?`),
  upsert: db.prepare(`
    INSERT INTO scenario_funnel
      (scenario_id, ads_per_week, cpl, rebarba_sb_per_week, show_rate_pct, call_to_sale_pct, forecast_bonus_pct, ticket_avg, payment_tax_pct, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(scenario_id) DO UPDATE SET
      ads_per_week = excluded.ads_per_week,
      cpl = excluded.cpl,
      rebarba_sb_per_week = excluded.rebarba_sb_per_week,
      show_rate_pct = excluded.show_rate_pct,
      call_to_sale_pct = excluded.call_to_sale_pct,
      forecast_bonus_pct = excluded.forecast_bonus_pct,
      ticket_avg = excluded.ticket_avg,
      payment_tax_pct = excluded.payment_tax_pct,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `),
  perfList: db.prepare(`
    SELECT stp.*, tm.name AS member_name, tm.role AS member_role
    FROM scenario_team_performance stp
    JOIN team_members tm ON tm.id = stp.team_member_id
    WHERE stp.scenario_id = ?
    ORDER BY tm.role, tm.name
  `),
  perfDelete: db.prepare(`DELETE FROM scenario_team_performance WHERE scenario_id = ?`),
  perfInsert: db.prepare(`
    INSERT INTO scenario_team_performance (scenario_id, team_member_id, capacity_per_week, conversion_pct)
    VALUES (?, ?, ?, ?)
  `),
};

function getByScenario(scenarioId) {
  return stmts.getByScenario.get(scenarioId);
}

function upsert(scenarioId, data) {
  return stmts.upsert.get(
    scenarioId,
    data.ads_per_week ?? 0,
    data.cpl ?? 0,
    data.rebarba_sb_per_week ?? 0,
    data.show_rate_pct ?? 70,
    data.call_to_sale_pct ?? 25,
    data.forecast_bonus_pct ?? 5,
    data.ticket_avg ?? 10000,
    data.payment_tax_pct ?? 12
  );
}

function getTeamPerformance(scenarioId) {
  return stmts.perfList.all(scenarioId);
}

const replaceTeamPerformance = db.transaction((scenarioId, perfArray) => {
  stmts.perfDelete.run(scenarioId);
  for (const p of perfArray || []) {
    stmts.perfInsert.run(
      scenarioId,
      p.team_member_id,
      p.capacity_per_week ?? 0,
      p.conversion_pct ?? 0
    );
  }
});

module.exports = { getByScenario, upsert, getTeamPerformance, replaceTeamPerformance };
