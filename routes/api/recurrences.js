const router = require('express').Router();
const recurrence = require('../../db/queries/recurrence');
const costs = require('../../db/queries/costs');
const db = require('../../db/connection');
const { expandRule } = require('../../lib/recurrence');
const { todayYmd } = require('../../lib/weeks');
const { audit } = require('../../lib/audit');

const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

router.get('/', (req, res) => {
  res.json(recurrence.list({ activeOnly: true }));
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const before = recurrence.getById(id);
  if (!before) return res.status(404).json({ error: 'regra não encontrada' });

  const fields = {};
  for (const k of ['pattern', 'pattern_value', 'start_date', 'end_date', 'base_amount', 'category', 'description', 'scenario_id', 'active']) {
    if (k in req.body) fields[k] = req.body[k];
  }
  if (fields.start_date && !isYmd(fields.start_date)) return res.status(400).json({ error: 'start_date inválido' });
  if (fields.end_date && !isYmd(fields.end_date)) return res.status(400).json({ error: 'end_date inválido' });
  const updated = recurrence.update(id, fields);

  const today = todayYmd();
  recurrence.detachPastOccurrences(id, today);
  recurrence.clearFutureOccurrences(id, today);

  if (updated.active) {
    const newDates = expandRule(updated, { fromDate: today });
    for (const d of newDates) {
      if (d <= today) continue;
      costs.create(
        {
          date: d,
          amount: updated.base_amount,
          category: updated.category,
          description: updated.description,
          status: 'planned',
          recurrence_id: id,
          scenario_id: updated.scenario_id,
        },
        req.user.email
      );
    }
  }

  audit(req, 'UPDATE', 'recurrence', id, before, updated);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const before = recurrence.getById(id);
  if (!before) return res.status(404).json({ error: 'regra não encontrada' });

  const today = todayYmd();
  recurrence.detachPastOccurrences(id, today);
  recurrence.clearFutureOccurrences(id, today);
  db.prepare(`DELETE FROM recurrence_rules WHERE id = ?`).run(id);

  audit(req, 'DELETE', 'recurrence', id, before, null);
  res.status(204).end();
});

module.exports = router;
