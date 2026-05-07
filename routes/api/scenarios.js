const router = require('express').Router();
const scenarios = require('../../db/queries/scenarios');
const { audit } = require('../../lib/audit');
const { requireMaster } = require('../../lib/auth');

router.get('/', (req, res) => {
  res.json(scenarios.list());
});

router.post('/', requireMaster, (req, res) => {
  const { name, description, color } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'name é obrigatório' });
  }
  const created = scenarios.create({
    name: String(name).trim(),
    description: description || null,
    color: color || null,
    createdBy: req.user.email,
  });
  audit(req, 'CREATE', 'scenario', created.id, null, created);
  res.status(201).json(created);
});

router.patch('/:id', requireMaster, (req, res) => {
  const id = Number(req.params.id);
  const before = scenarios.getById(id);
  if (!before) return res.status(404).json({ error: 'cenário não encontrado' });
  const fields = {};
  for (const k of ['name', 'description', 'color']) {
    if (k in req.body) fields[k] = req.body[k];
  }
  if ('name' in fields) fields.name = String(fields.name).trim();
  const updated = scenarios.update(id, fields);
  audit(req, 'UPDATE', 'scenario', id, before, updated);
  res.json(updated);
});

router.delete('/:id', requireMaster, (req, res) => {
  const id = Number(req.params.id);
  const before = scenarios.getById(id);
  if (!before) return res.status(404).json({ error: 'cenário não encontrado' });
  try {
    scenarios.remove(id);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (!scenarios.getActive()) {
    const remaining = scenarios.list();
    if (remaining.length > 0) scenarios.activate(remaining[0].id);
  }
  audit(req, 'DELETE', 'scenario', id, before, null);
  res.status(204).end();
});

router.post('/:id/activate', requireMaster, (req, res) => {
  const id = Number(req.params.id);
  const before = scenarios.getActive();
  const target = scenarios.getById(id);
  if (!target) return res.status(404).json({ error: 'cenário não encontrado' });
  const activated = scenarios.activate(id);
  audit(req, 'ACTIVATE', 'scenario', id, before, activated);
  res.json(activated);
});

router.post('/:id/duplicate', requireMaster, (req, res) => {
  const id = Number(req.params.id);
  const source = scenarios.getById(id);
  if (!source) return res.status(404).json({ error: 'cenário não encontrado' });
  const newName = (req.body && req.body.name)
    ? String(req.body.name).trim()
    : `${source.name} (cópia)`;
  let novo;
  try {
    novo = scenarios.duplicate({
      sourceId: id,
      newName,
      createdBy: req.user.email,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  audit(req, 'DUPLICATE', 'scenario', novo.id, source, novo);
  res.status(201).json(novo);
});

module.exports = router;
