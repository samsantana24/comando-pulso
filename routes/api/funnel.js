const router = require('express').Router();
const db = require('../../db/connection');
const funnel = require('../../db/queries/funnel');
const scenarios = require('../../db/queries/scenarios');
const { audit } = require('../../lib/audit');
const { requireMaster } = require('../../lib/auth');

function resolveScenarioId(req) {
  const q = req.query.scenario_id;
  if (q) return Number(q);
  const active = scenarios.getActive();
  return active ? active.id : null;
}

router.get('/', requireMaster, (req, res) => {
  const scenarioId = resolveScenarioId(req);
  if (!scenarioId) return res.status(400).json({ error: 'scenario_id ausente e nenhum cenário ativo' });
  const data = funnel.getByScenario(scenarioId);
  const teamPerf = funnel.getTeamPerformance(scenarioId);
  res.json({ scenario_id: scenarioId, funnel: data, team_performance: teamPerf });
});

router.put('/', requireMaster, (req, res) => {
  const scenarioId = resolveScenarioId(req);
  if (!scenarioId) return res.status(400).json({ error: 'scenario_id ausente e nenhum cenário ativo' });
  const before = {
    funnel: funnel.getByScenario(scenarioId),
    team_performance: funnel.getTeamPerformance(scenarioId),
  };

  const body = req.body || {};
  const updated = funnel.upsert(scenarioId, {
    ads_per_week: Number(body.ads_per_week) || 0,
    cpl: Number(body.cpl) || 0,
    rebarba_sb_per_week: Number(body.rebarba_sb_per_week) || 0,
    show_rate_pct: Number(body.show_rate_pct) || 0,
    call_to_sale_pct: Number(body.call_to_sale_pct) || 0,
    forecast_bonus_pct: Number(body.forecast_bonus_pct) || 0,
    ticket_avg: Number(body.ticket_avg) || 0,
    payment_tax_pct: Number(body.payment_tax_pct) || 0,
  });

  const perf = Array.isArray(body.team_performance) ? body.team_performance : [];
  funnel.replaceTeamPerformance(scenarioId, perf.map((p) => ({
    team_member_id: Number(p.team_member_id),
    capacity_per_week: Number(p.capacity_per_week) || 0,
    conversion_pct: Number(p.conversion_pct) || 0,
  })));

  const after = {
    funnel: funnel.getByScenario(scenarioId),
    team_performance: funnel.getTeamPerformance(scenarioId),
  };
  audit(req, 'UPDATE', 'scenario_funnel', scenarioId, before, after);
  res.json(after);
});

// === Funil evolutivo (timeline semana a semana) ===

router.get('/evolutive/:scenarioId', requireMaster, (req, res) => {
  const sid = Number(req.params.scenarioId);
  const scenario = scenarios.getById(sid);
  if (!scenario) return res.status(404).json({ error: 'cenário não encontrado' });
  res.json({
    scenario_id: sid,
    enabled: !!scenario.evolutive_funnel_enabled,
    weeks_count: Number(scenario.evolutive_funnel_weeks) || 12,
    funnel_weekly: funnel.getWeeklyForScenario(sid),
    team_weekly: funnel.getTeamWeeklyForScenario(sid),
  });
});

router.put('/evolutive/:scenarioId', requireMaster, (req, res) => {
  const sid = Number(req.params.scenarioId);
  const scenario = scenarios.getById(sid);
  if (!scenario) return res.status(404).json({ error: 'cenário não encontrado' });

  const b = req.body || {};
  const weekly = Array.isArray(b.funnel_weekly) ? b.funnel_weekly : [];
  const team = Array.isArray(b.team_weekly) ? b.team_weekly : [];
  const maxWeeks = Number(scenario.evolutive_funnel_weeks) || 12;

  for (const w of weekly) {
    if (!Number.isInteger(w.week_index) || w.week_index < 1 || w.week_index > maxWeeks) {
      return res.status(400).json({ error: 'week_index inválido' });
    }
    if (Number(w.ads_per_week) < 0 || Number(w.cpl) < 0 || Number(w.show_rate_pct) < 0 || Number(w.show_rate_pct) > 100) {
      return res.status(400).json({ error: `valores inválidos na semana ${w.week_index}` });
    }
    if (Number(w.call_to_sale_pct) < 0 || Number(w.call_to_sale_pct) > 100) {
      return res.status(400).json({ error: `conv inválida na semana ${w.week_index}` });
    }
  }

  const beforeFunnel = funnel.getWeeklyForScenario(sid);
  const beforeTeam = funnel.getTeamWeeklyForScenario(sid);

  funnel.upsertWeekly(weekly.map((w) => ({
    scenario_id: sid,
    week_index: Number(w.week_index),
    ads_per_week: Number(w.ads_per_week) || 0,
    cpl: Number(w.cpl) || 0,
    rebarba_sb_per_week: Number(w.rebarba_sb_per_week) || 0,
    show_rate_pct: Number(w.show_rate_pct) || 0,
    call_to_sale_pct: Number(w.call_to_sale_pct) || 0,
    forecast_bonus_pct: Number(w.forecast_bonus_pct) || 0,
    ticket_avg: Number(w.ticket_avg) || 0,
    payment_tax_pct: Number(w.payment_tax_pct) || 0,
  })));

  funnel.upsertTeamWeekly(team.map((t) => ({
    scenario_id: sid,
    team_member_id: Number(t.team_member_id),
    week_index: Number(t.week_index),
    capacity_per_week: Number(t.capacity_per_week) || 0,
    conversion_pct: Number(t.conversion_pct) || 0,
    active: t.active === false || t.active === 0 ? 0 : 1,
  })));

  const after = {
    funnel_weekly: funnel.getWeeklyForScenario(sid),
    team_weekly: funnel.getTeamWeeklyForScenario(sid),
  };
  audit(req, 'UPDATE', 'scenario_funnel_weekly', sid, { funnel_weekly: beforeFunnel, team_weekly: beforeTeam }, after);
  res.json({ ok: true, ...after });
});

router.post('/evolutive/:scenarioId/enable', requireMaster, (req, res) => {
  const sid = Number(req.params.scenarioId);
  const scenario = scenarios.getById(sid);
  if (!scenario) return res.status(404).json({ error: 'cenário não encontrado' });
  const weeksReq = Number((req.body || {}).weeks) || 12;
  if (![4, 8, 12, 24].includes(weeksReq)) return res.status(400).json({ error: 'weeks deve ser 4, 8, 12 ou 24' });

  const baseFunnel = funnel.getByScenario(sid) || {
    ads_per_week: 0, cpl: 0, rebarba_sb_per_week: 0,
    show_rate_pct: 70, call_to_sale_pct: 25, forecast_bonus_pct: 5,
    ticket_avg: 10000, payment_tax_pct: 12,
  };
  const baseTeam = funnel.getTeamPerformance(sid) || [];

  const rows = [];
  for (let i = 1; i <= weeksReq; i++) {
    rows.push({
      scenario_id: sid,
      week_index: i,
      ads_per_week: baseFunnel.ads_per_week || 0,
      cpl: baseFunnel.cpl || 0,
      rebarba_sb_per_week: baseFunnel.rebarba_sb_per_week || 0,
      show_rate_pct: baseFunnel.show_rate_pct || 70,
      call_to_sale_pct: baseFunnel.call_to_sale_pct || 25,
      forecast_bonus_pct: baseFunnel.forecast_bonus_pct || 5,
      ticket_avg: baseFunnel.ticket_avg || 10000,
      payment_tax_pct: baseFunnel.payment_tax_pct || 12,
    });
  }
  funnel.upsertWeekly(rows);

  const teamRows = [];
  for (let i = 1; i <= weeksReq; i++) {
    for (const p of baseTeam) {
      teamRows.push({
        scenario_id: sid,
        team_member_id: p.team_member_id,
        week_index: i,
        capacity_per_week: p.capacity_per_week || 0,
        conversion_pct: p.conversion_pct || 0,
        active: 1,
      });
    }
  }
  if (teamRows.length > 0) funnel.upsertTeamWeekly(teamRows);

  funnel.trimWeeksTo(sid, weeksReq);

  db.prepare('UPDATE scenarios SET evolutive_funnel_enabled = 1, evolutive_funnel_weeks = ? WHERE id = ?').run(weeksReq, sid);
  audit(req, 'UPDATE', 'scenarios', sid, { evolutive_funnel_enabled: 0 }, { evolutive_funnel_enabled: 1, evolutive_funnel_weeks: weeksReq });
  res.json({ ok: true, weeks_count: weeksReq });
});

router.post('/evolutive/:scenarioId/disable', requireMaster, (req, res) => {
  const sid = Number(req.params.scenarioId);
  const scenario = scenarios.getById(sid);
  if (!scenario) return res.status(404).json({ error: 'cenário não encontrado' });
  db.prepare('UPDATE scenarios SET evolutive_funnel_enabled = 0 WHERE id = ?').run(sid);
  audit(req, 'UPDATE', 'scenarios', sid, { evolutive_funnel_enabled: 1 }, { evolutive_funnel_enabled: 0 });
  res.json({ ok: true });
});

router.post('/evolutive/:scenarioId/apply-curve', requireMaster, (req, res) => {
  const sid = Number(req.params.scenarioId);
  const scenario = scenarios.getById(sid);
  if (!scenario) return res.status(404).json({ error: 'cenário não encontrado' });
  const b = req.body || {};
  const plateauWeek = Number(b.plateau_week) || 0;
  const growth = b.growth || {};
  const adsPct = Number(growth.ads_pct) || 0;
  const cplPct = Number(growth.cpl_pct) || 0;
  const showPp = Number(growth.show_rate_pp) || 0;
  const convPp = Number(growth.conv_pp) || 0;

  const all = funnel.getWeeklyForScenario(sid);
  if (all.length === 0) return res.status(400).json({ error: 'cenário não tem timeline; ative o modo evolutivo primeiro' });

  const updated = [{ ...all[0] }];
  for (let i = 2; i <= all.length; i++) {
    const prev = updated[i - 2];
    const stayConstant = plateauWeek > 0 && i > plateauWeek;
    const ads = stayConstant ? prev.ads_per_week : prev.ads_per_week * (1 + adsPct / 100);
    const cpl = stayConstant ? prev.cpl : Math.max(0, prev.cpl * (1 + cplPct / 100));
    const showRate = stayConstant ? prev.show_rate_pct : Math.min(100, prev.show_rate_pct + showPp);
    const conv = stayConstant ? prev.call_to_sale_pct : Math.min(100, prev.call_to_sale_pct + convPp);
    updated.push({
      ...prev,
      week_index: i,
      ads_per_week: Math.round(ads),
      cpl: Math.round(cpl * 100) / 100,
      show_rate_pct: Math.round(showRate * 10) / 10,
      call_to_sale_pct: Math.round(conv * 10) / 10,
    });
  }

  funnel.upsertWeekly(updated.map((w) => ({
    scenario_id: sid,
    week_index: w.week_index,
    ads_per_week: w.ads_per_week,
    cpl: w.cpl,
    rebarba_sb_per_week: w.rebarba_sb_per_week,
    show_rate_pct: w.show_rate_pct,
    call_to_sale_pct: w.call_to_sale_pct,
    forecast_bonus_pct: w.forecast_bonus_pct,
    ticket_avg: w.ticket_avg,
    payment_tax_pct: w.payment_tax_pct,
  })));

  audit(req, 'UPDATE', 'scenario_funnel_weekly', sid, { applied_curve: false }, { applied_curve: true, plateau_week: plateauWeek, growth });
  res.json({ ok: true, weeks: updated });
});

module.exports = router;
