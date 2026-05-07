const router = require('express').Router();
const costs = require('../../db/queries/costs');
const recurrence = require('../../db/queries/recurrence');
const { expandRule } = require('../../lib/recurrence');
const { audit } = require('../../lib/audit');

const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const isNonNegative = (n) => { const x = Number(n); return Number.isFinite(x) && x >= 0; };

router.get('/', (req, res) => {
  const { from, to, scenario_id, status } = req.query;
  let scenarioId;
  if (scenario_id === 'null') scenarioId = null;
  else if (scenario_id === '' || scenario_id === undefined) scenarioId = undefined;
  else scenarioId = Number(scenario_id);
  res.json(costs.list({
    from: from || null,
    to: to || null,
    scenarioId,
    status: status || null,
  }));
});

router.post('/', (req, res) => {
  const b = req.body;
  const isRecurring = b.is_recurring === true || b.is_recurring === 'true';
  if (!b.category) return res.status(400).json({ error: 'category é obrigatório' });
  if (!isNonNegative(b.amount)) return res.status(400).json({ error: 'amount inválido' });

  if (isRecurring) {
    if (!['monthly_day', 'every_n_weeks'].includes(b.recurrence_pattern)) {
      return res.status(400).json({ error: 'recurrence_pattern inválido' });
    }
    const recValue = Number(b.recurrence_value);
    if (!Number.isFinite(recValue) || recValue < 1) {
      return res.status(400).json({ error: 'recurrence_value inválido' });
    }
    if (!isYmd(b.recurrence_start)) return res.status(400).json({ error: 'recurrence_start inválido' });
    if (b.recurrence_end && !isYmd(b.recurrence_end)) return res.status(400).json({ error: 'recurrence_end inválido' });

    const rule = recurrence.create(
      {
        pattern: b.recurrence_pattern,
        pattern_value: recValue,
        start_date: b.recurrence_start,
        end_date: b.recurrence_end || null,
        base_amount: Number(b.amount),
        category: b.category,
        description: b.description || null,
        scenario_id: b.scenario_id ? Number(b.scenario_id) : null,
      },
      req.user.email
    );
    audit(req, 'CREATE', 'recurrence', rule.id, null, rule);

    const dates = expandRule(rule);
    const created = [];
    for (const d of dates) {
      const c = costs.create(
        {
          date: d,
          amount: rule.base_amount,
          category: rule.category,
          description: rule.description,
          status: 'planned',
          recurrence_id: rule.id,
          scenario_id: rule.scenario_id,
        },
        req.user.email
      );
      created.push(c);
    }
    return res.status(201).json({ rule, occurrences: created });
  }

  if (!isYmd(b.date)) return res.status(400).json({ error: 'date inválida (YYYY-MM-DD)' });
  const status = b.status === 'paid' ? 'paid' : 'planned';
  const created = costs.create(
    {
      date: b.date,
      amount: Number(b.amount),
      category: b.category,
      description: b.description || null,
      status,
      scenario_id: b.scenario_id ? Number(b.scenario_id) : null,
    },
    req.user.email
  );
  audit(req, 'CREATE', 'cost', created.id, null, created);
  res.status(201).json(created);
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const before = costs.getById(id);
  if (!before) return res.status(404).json({ error: 'custo não encontrado' });

  const fields = {};
  for (const k of ['date', 'amount', 'category', 'description', 'status', 'scenario_id']) {
    if (k in req.body) fields[k] = req.body[k];
  }
  if (fields.date && !isYmd(fields.date)) return res.status(400).json({ error: 'date inválida' });
  if ('amount' in fields) fields.amount = Number(fields.amount);
  if ('scenario_id' in fields) fields.scenario_id = fields.scenario_id ? Number(fields.scenario_id) : null;
  if ('status' in fields && !['paid', 'planned'].includes(fields.status)) {
    return res.status(400).json({ error: 'status inválido' });
  }

  const updated = costs.update(id, fields);
  audit(req, 'UPDATE', 'cost', id, before, updated);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const before = costs.remove(id);
  if (!before) return res.status(404).json({ error: 'custo não encontrado' });
  audit(req, 'DELETE', 'cost', id, before, null);
  res.status(204).end();
});

module.exports = router;
