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

// === Evolutive funnel ===
const stmtsEvo = {
  getWeekly: db.prepare(`SELECT * FROM scenario_funnel_weekly WHERE scenario_id = ? ORDER BY week_index ASC`),
  getWeeklyByIndex: db.prepare(`SELECT * FROM scenario_funnel_weekly WHERE scenario_id = ? AND week_index = ?`),
  upsertWeekly: db.prepare(`
    INSERT INTO scenario_funnel_weekly (scenario_id, week_index, ads_per_week, cpl, rebarba_sb_per_week, show_rate_pct, call_to_sale_pct, forecast_bonus_pct, ticket_avg, payment_tax_pct)
    VALUES (@scenario_id, @week_index, @ads_per_week, @cpl, @rebarba_sb_per_week, @show_rate_pct, @call_to_sale_pct, @forecast_bonus_pct, @ticket_avg, @payment_tax_pct)
    ON CONFLICT(scenario_id, week_index) DO UPDATE SET
      ads_per_week = excluded.ads_per_week,
      cpl = excluded.cpl,
      rebarba_sb_per_week = excluded.rebarba_sb_per_week,
      show_rate_pct = excluded.show_rate_pct,
      call_to_sale_pct = excluded.call_to_sale_pct,
      forecast_bonus_pct = excluded.forecast_bonus_pct,
      ticket_avg = excluded.ticket_avg,
      payment_tax_pct = excluded.payment_tax_pct
  `),
  deleteWeeklyAfter: db.prepare(`DELETE FROM scenario_funnel_weekly WHERE scenario_id = ? AND week_index > ?`),
  getTeamWeekly: db.prepare(`
    SELECT stw.*, tm.name AS member_name, tm.role AS member_role
    FROM scenario_team_weekly stw
    JOIN team_members tm ON tm.id = stw.team_member_id
    WHERE stw.scenario_id = ?
    ORDER BY stw.week_index, tm.role, tm.name
  `),
  upsertTeamWeekly: db.prepare(`
    INSERT INTO scenario_team_weekly (scenario_id, team_member_id, week_index, capacity_per_week, conversion_pct, active)
    VALUES (@scenario_id, @team_member_id, @week_index, @capacity_per_week, @conversion_pct, @active)
    ON CONFLICT(scenario_id, team_member_id, week_index) DO UPDATE SET
      capacity_per_week = excluded.capacity_per_week,
      conversion_pct = excluded.conversion_pct,
      active = excluded.active
  `),
  deleteTeamWeeklyAfter: db.prepare(`DELETE FROM scenario_team_weekly WHERE scenario_id = ? AND week_index > ?`),
};

function getWeeklyForScenario(scenarioId) {
  return stmtsEvo.getWeekly.all(scenarioId);
}

const upsertWeekly = db.transaction((rows) => {
  for (const r of rows) stmtsEvo.upsertWeekly.run(r);
});

function trimWeeksTo(scenarioId, n) {
  stmtsEvo.deleteWeeklyAfter.run(scenarioId, n);
  stmtsEvo.deleteTeamWeeklyAfter.run(scenarioId, n);
}

function getTeamWeeklyForScenario(scenarioId) {
  return stmtsEvo.getTeamWeekly.all(scenarioId);
}

const upsertTeamWeekly = db.transaction((rows) => {
  for (const r of rows) stmtsEvo.upsertTeamWeekly.run(r);
});

module.exports = {
  getByScenario, upsert, getTeamPerformance, replaceTeamPerformance,
  getWeeklyForScenario, upsertWeekly, trimWeeksTo,
  getTeamWeeklyForScenario, upsertTeamWeekly,
};
