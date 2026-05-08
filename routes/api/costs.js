const router = require('express').Router();
const costs = require('../../db/queries/costs');
const recurrence = require('../../db/queries/recurrence');
const { expandRule } = require('../../lib/recurrence');
const { audit } = require('../../lib/audit');
const { isDateInRange, isPositive, MIN_DATE, MAX_DATE } = require('../../lib/validators');
const { logWarn } = require('../../lib/log');
const { requirePerm } = require('../../lib/permissions');

const ADS_CATEGORY = 'Tráfego Pago (Google / Meta Ads)';
const ADS_BLOCK_ERROR = "A categoria 'Tráfego Pago (Google / Meta Ads)' só pode ser lançada via 'Investimento em Ads'. Use o botão dedicado.";
const DATE_ERR = `date deve ser entre ${MIN_DATE} e ${MAX_DATE} (YYYY-MM-DD)`;

function rejectsAdsCategory(body, req) {
  if (!body || !body.category) return false;
  if (body.category !== ADS_CATEGORY) {
    if (/ads|tráfego pago|trafego pago/i.test(String(body.category))) {
      logWarn(req, 'categoria customizada com nome ads-like', { category: body.category });
    }
    return false;
  }
  return Number(body.is_ads) !== 1;
}

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

router.post('/', requirePerm('action.add_cost'), (req, res) => {
  const b = req.body;
  const isRecurring = b.is_recurring === true || b.is_recurring === 'true';
  if (!b.category) return res.status(400).json({ error: 'category é obrigatório' });
  if (!isPositive(b.amount)) return res.status(400).json({ error: 'amount deve ser > 0' });
  if (rejectsAdsCategory(b, req)) return res.status(400).json({ error: ADS_BLOCK_ERROR });

  if (isRecurring) {
    if (!['monthly_day', 'every_n_weeks'].includes(b.recurrence_pattern)) {
      return res.status(400).json({ error: 'recurrence_pattern inválido' });
    }
    const recValue = Number(b.recurrence_value);
    if (!Number.isFinite(recValue) || recValue < 1) {
      return res.status(400).json({ error: 'recurrence_value inválido' });
    }
    if (!isDateInRange(b.recurrence_start)) return res.status(400).json({ error: 'recurrence_start: ' + DATE_ERR });
    if (b.recurrence_end && !isDateInRange(b.recurrence_end)) return res.status(400).json({ error: 'recurrence_end: ' + DATE_ERR });

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

  if (!isDateInRange(b.date)) return res.status(400).json({ error: DATE_ERR });
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

router.patch('/:id', requirePerm('action.edit_cost'), (req, res) => {
  const id = Number(req.params.id);
  const before = costs.getById(id);
  if (!before) return res.status(404).json({ error: 'custo não encontrado' });

  const fields = {};
  for (const k of ['date', 'amount', 'category', 'description', 'status', 'scenario_id']) {
    if (k in req.body) fields[k] = req.body[k];
  }
  if (fields.date && !isDateInRange(fields.date)) return res.status(400).json({ error: DATE_ERR });
  if ('amount' in fields) {
    if (!isPositive(fields.amount)) return res.status(400).json({ error: 'amount deve ser > 0' });
    fields.amount = Number(fields.amount);
  }
  if ('scenario_id' in fields) fields.scenario_id = fields.scenario_id ? Number(fields.scenario_id) : null;
  if ('status' in fields && !['paid', 'planned'].includes(fields.status)) {
    return res.status(400).json({ error: 'status inválido' });
  }
  if ('category' in fields && fields.category === ADS_CATEGORY && Number(before.is_ads) !== 1) {
    return res.status(400).json({ error: ADS_BLOCK_ERROR });
  }

  const updated = costs.update(id, fields);
  audit(req, 'UPDATE', 'cost', id, before, updated);
  res.json(updated);
});

router.delete('/:id', requirePerm('action.delete_cost'), (req, res) => {
  const id = Number(req.params.id);
  const before = costs.remove(id);
  if (!before) return res.status(404).json({ error: 'custo não encontrado' });
  audit(req, 'DELETE', 'cost', id, before, null);
  res.status(204).end();
});

module.exports = router;
