const router = require('express').Router();
const db = require('../../db/connection');
const { requireMaster } = require('../../lib/auth');

const TABLES = [
  'settings', 'team_members', 'scenarios', 'sales',
  'recurrence_rules', 'costs', 'scenario_funnel',
  'scenario_team_performance', 'audit_log',
];

router.get('/', requireMaster, (req, res) => {
  const data = {
    _exported_at: new Date().toISOString(),
    _version: '1',
  };
  for (const t of TABLES) {
    data[t] = db.prepare(`SELECT * FROM ${t}`).all();
  }
  res.setHeader('Content-Disposition', `attachment; filename="comando-pulso-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(data);
});

module.exports = router;
