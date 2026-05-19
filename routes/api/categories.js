const router = require('express').Router();
const categories = require('../../db/queries/categories');
const { audit } = require('../../lib/audit');
const { requirePerm } = require('../../lib/permissions');

router.get('/', (req, res) => {
  const list = categories.list();
  const grouped = {};
  for (const c of list) {
    if (!grouped[c.group_name]) grouped[c.group_name] = [];
    grouped[c.group_name].push(c);
  }
  res.json({ list, grouped });
});

router.post('/', requirePerm('action.add_category'), (req, res) => {
  const { name, group_name, display_order } = req.body || {};
  const trimmed = name ? String(name).trim() : '';
  if (!trimmed) return res.status(400).json({ error: 'name é obrigatório' });
  if (!group_name) return res.status(400).json({ error: 'group_name é obrigatório' });
  if (categories.getByName(trimmed)) {
    return res.status(400).json({ error: 'já existe categoria com esse nome' });
  }
  const created = categories.create({ name: trimmed, group_name, display_order });
  audit(req, 'CREATE', 'category', created.id, null, created);
  res.status(201).json(created);
});

router.patch('/:id', requirePerm('action.edit_category'), (req, res) => {
  const id = Number(req.params.id);
  const before = categories.getById(id);
  if (!before) return res.status(404).json({ error: 'categoria não encontrada' });
  const fields = {};
  for (const k of ['name', 'group_name', 'display_order']) {
    if (k in req.body) fields[k] = req.body[k];
  }
  if ('name' in fields) {
    const trimmed = String(fields.name).trim();
    if (!trimmed) return res.status(400).json({ error: 'name vazio' });
    if (trimmed !== before.name && categories.getByName(trimmed)) {
      return res.status(400).json({ error: 'já existe outra categoria com esse nome' });
    }
    fields.name = trimmed;
  }
  const updated = categories.update(id, fields);
  audit(req, 'UPDATE', 'category', id, before, updated);
  res.json(updated);
});

router.delete('/:id', requirePerm('action.delete_category'), (req, res) => {
  const id = Number(req.params.id);
  const before = categories.getById(id);
  if (!before) return res.status(404).json({ error: 'categoria não encontrada' });
  const moveTo = req.query.move_to || null;
  try {
    categories.remove(id, { moveTo });
  } catch (err) {
    if (err.code === 'HAS_COSTS') {
      return res.status(400).json({
        error: err.message,
        costs_count: err.costsCount,
        category_name: before.name,
      });
    }
    throw err;
  }
  audit(req, 'DELETE', 'category', id, before, { moveTo });
  res.status(204).end();
});

module.exports = router;
