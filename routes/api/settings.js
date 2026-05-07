const router = require('express').Router();
const settings = require('../../db/queries/settings');
const { audit } = require('../../lib/audit');
const { requireMaster } = require('../../lib/auth');

router.get('/', (req, res) => {
  res.json(settings.getAll());
});

router.put('/', requireMaster, (req, res) => {
  const allowed = new Set([
    'initial_cash_brl',
    'include_initial_cash',
    'default_payment_tax_pct',
  ]);
  const body = req.body || {};
  const updates = {};
  for (const [k, v] of Object.entries(body)) {
    if (allowed.has(k)) updates[k] = String(v);
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'nenhum campo válido' });
  }
  const before = settings.getAll();
  settings.batchUpdate(updates, req.user.email);
  const after = settings.getAll();
  audit(req, 'UPDATE', 'setting', null, before, after);
  res.json(after);
});

module.exports = router;
