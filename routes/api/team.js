const router = require('express').Router();
const team = require('../../db/queries/team');
const { audit } = require('../../lib/audit');
const { requireMaster } = require('../../lib/auth');

router.get('/', (req, res) => {
  const { role, all } = req.query;
  res.json(team.list({ role: role || null, activeOnly: all !== '1' }));
});

router.post('/', requireMaster, (req, res) => {
  const { name, role } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name é obrigatório' });
  if (!['sdr', 'closer'].includes(role)) return res.status(400).json({ error: 'role deve ser sdr ou closer' });
  const created = team.create(String(name).trim(), role);
  audit(req, 'CREATE', 'team_member', created.id, null, created);
  res.status(201).json(created);
});

router.patch('/:id', requireMaster, (req, res) => {
  const id = Number(req.params.id);
  const before = team.getById(id);
  if (!before) return res.status(404).json({ error: 'membro não encontrado' });
  const fields = {};
  for (const k of ['name', 'role', 'active']) {
    if (k in req.body) fields[k] = req.body[k];
  }
  if ('role' in fields && !['sdr', 'closer'].includes(fields.role)) {
    return res.status(400).json({ error: 'role inválida' });
  }
  if ('active' in fields) fields.active = fields.active ? 1 : 0;
  if ('name' in fields) fields.name = String(fields.name).trim();
  const updated = team.update(id, fields);
  audit(req, 'UPDATE', 'team_member', id, before, updated);
  res.json(updated);
});

router.delete('/:id', requireMaster, (req, res) => {
  const id = Number(req.params.id);
  const before = team.getById(id);
  if (!before) return res.status(404).json({ error: 'membro não encontrado' });
  const result = team.remove(id);
  audit(req, 'DELETE', 'team_member', id, before, { mode: result.mode });
  res.json(result);
});

module.exports = router;
