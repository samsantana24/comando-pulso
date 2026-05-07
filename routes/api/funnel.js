const router = require('express').Router();
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

module.exports = router;
