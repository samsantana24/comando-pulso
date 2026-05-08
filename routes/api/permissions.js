const router = require('express').Router();
const { requireMaster } = require('../../lib/auth');
const { listForRole, setMany, PERM_KEYS, applyPreset } = require('../../lib/permissions');
const { audit } = require('../../lib/audit');

router.get('/', requireMaster, (req, res) => {
  const role = (req.query.role || 'financeiro').toString();
  res.json({ role, items: listForRole(role) });
});

router.put('/', requireMaster, (req, res) => {
  const role = (req.body && req.body.role) || 'financeiro';
  const updates = Array.isArray(req.body && req.body.updates) ? req.body.updates : [];
  const clean = updates
    .filter((u) => u && PERM_KEYS.has(u.key))
    .map((u) => ({ key: u.key, allowed: !!u.allowed }));
  if (clean.length === 0) return res.status(400).json({ error: 'nenhum campo válido' });
  const before = listForRole(role);
  setMany(role, clean, req.user.email);
  const after = listForRole(role);
  audit(req, 'UPDATE', 'permissions', null, before, after);
  res.json({ role, items: after });
});

router.post('/preset', requireMaster, (req, res) => {
  const role = (req.body && req.body.role) || 'financeiro';
  const preset = (req.body && req.body.preset) || '';
  if (!['default', 'all-on', 'all-off'].includes(preset)) {
    return res.status(400).json({ error: 'preset inválido' });
  }
  const before = listForRole(role);
  applyPreset(role, preset, req.user.email);
  const after = listForRole(role);
  audit(req, 'UPDATE', 'permissions', null, { preset, before }, after);
  res.json({ role, preset, items: after });
});

module.exports = router;
