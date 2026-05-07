const router = require('express').Router();
const cashflow = require('../../lib/cashflow');
const scenarios = require('../../db/queries/scenarios');
const { requireMaster } = require('../../lib/auth');

function resolveScenarioId(req) {
  if (req.query.scenario_id) return Number(req.query.scenario_id);
  const active = scenarios.getActive();
  return active ? active.id : null;
}

router.get('/', requireMaster, (req, res) => {
  const past = Math.max(0, Math.min(20, Number(req.query.past) || 1));
  const future = Math.max(0, Math.min(20, Number(req.query.future) || 2));
  const sid = resolveScenarioId(req);
  res.json(cashflow.getWeeklyCashflow({ pastWeeks: past, futureWeeks: future, scenarioId: sid }));
});

router.get('/runway', requireMaster, (req, res) => {
  const sid = resolveScenarioId(req);
  res.json(cashflow.getRunway(sid));
});

module.exports = router;
