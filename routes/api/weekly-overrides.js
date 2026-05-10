const router = require('express').Router();
const overrides = require('../../db/queries/weeklyOverrides');
const { audit } = require('../../lib/audit');
const { requireMaster } = require('../../lib/auth');

const isWeekId = (s) => typeof s === 'string' && /^\d{4}-W\d{2}$/.test(s);

router.get('/', (req, res) => {
  const scenarioId = req.query.scenario_id ? Number(req.query.scenario_id) : null;
  if (!scenarioId) return res.json([]);
  res.json(overrides.listByScenario(scenarioId));
});

router.put('/', requireMaster, (req, res) => {
  const b = req.body || {};
  const scenarioId = Number(b.scenario_id);
  const weekId = String(b.week_id || '');
  const value = Number(b.sales_projected);
  if (!Number.isFinite(scenarioId) || scenarioId <= 0) {
    return res.status(400).json({ error: 'scenario_id inválido' });
  }
  if (!isWeekId(weekId)) {
    return res.status(400).json({ error: 'week_id inválido (esperado formato AAAA-Www)' });
  }
  if (!Number.isFinite(value) || value < 0) {
    return res.status(400).json({ error: 'sales_projected deve ser número >= 0' });
  }
  const row = overrides.upsert({
    scenarioId,
    weekId,
    salesProjected: value,
    updatedBy: req.user.email,
  });
  audit(req, 'UPSERT', 'weekly_sales_override', null, null, row);
  res.json(row);
});

router.delete('/', requireMaster, (req, res) => {
  const scenarioId = Number(req.query.scenario_id);
  const weekId = String(req.query.week_id || '');
  if (!Number.isFinite(scenarioId) || scenarioId <= 0) {
    return res.status(400).json({ error: 'scenario_id inválido' });
  }
  if (!isWeekId(weekId)) {
    return res.status(400).json({ error: 'week_id inválido' });
  }
  overrides.remove(scenarioId, weekId);
  audit(req, 'DELETE', 'weekly_sales_override', null, { scenario_id: scenarioId, week_id: weekId }, null);
  res.status(204).end();
});

module.exports = router;
