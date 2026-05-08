const router = require('express').Router();
const sales = require('../../db/queries/sales');
const { audit } = require('../../lib/audit');
const { isDateInRange, isNonNegative, MIN_DATE, MAX_DATE } = require('../../lib/validators');
const { requirePerm } = require('../../lib/permissions');

const DATE_ERR = `date deve ser entre ${MIN_DATE} e ${MAX_DATE} (YYYY-MM-DD)`;

router.get('/', (req, res) => {
  const { from, to, limit } = req.query;
  res.json(sales.list({
    from: from || null,
    to: to || null,
    limit: limit ? Number(limit) : null,
  }));
});

router.post('/', requirePerm('action.add_sale'), (req, res) => {
  const b = req.body;
  if (!isDateInRange(b.date)) return res.status(400).json({ error: DATE_ERR });
  if (!isNonNegative(b.gross_amount)) return res.status(400).json({ error: 'gross_amount deve ser >= 0' });
  if (!isNonNegative(b.net_amount)) return res.status(400).json({ error: 'net_amount deve ser >= 0' });

  const created = sales.create(
    {
      date: b.date,
      gross_amount: Number(b.gross_amount),
      net_amount: Number(b.net_amount),
      client_name: b.client_name || null,
      closer_id: b.closer_id ? Number(b.closer_id) : null,
      payment_method: b.payment_method || null,
      notes: b.notes || null,
    },
    req.user.email
  );
  audit(req, 'CREATE', 'sale', created.id, null, created);
  res.status(201).json(created);
});

router.patch('/:id', requirePerm('action.edit_sale'), (req, res) => {
  const id = Number(req.params.id);
  const before = sales.getById(id);
  if (!before) return res.status(404).json({ error: 'venda não encontrada' });

  const fields = {};
  for (const k of ['date', 'gross_amount', 'net_amount', 'client_name', 'closer_id', 'payment_method', 'notes']) {
    if (k in req.body) fields[k] = req.body[k];
  }
  if (fields.date && !isDateInRange(fields.date)) return res.status(400).json({ error: DATE_ERR });
  if ('gross_amount' in fields) {
    if (!isNonNegative(fields.gross_amount)) return res.status(400).json({ error: 'gross_amount deve ser >= 0' });
    fields.gross_amount = Number(fields.gross_amount);
  }
  if ('net_amount' in fields) {
    if (!isNonNegative(fields.net_amount)) return res.status(400).json({ error: 'net_amount deve ser >= 0' });
    fields.net_amount = Number(fields.net_amount);
  }
  if ('closer_id' in fields) fields.closer_id = fields.closer_id ? Number(fields.closer_id) : null;

  const updated = sales.update(id, fields);
  audit(req, 'UPDATE', 'sale', id, before, updated);
  res.json(updated);
});

router.delete('/:id', requirePerm('action.delete_sale'), (req, res) => {
  const id = Number(req.params.id);
  const before = sales.remove(id);
  if (!before) return res.status(404).json({ error: 'venda não encontrada' });
  audit(req, 'DELETE', 'sale', id, before, null);
  res.status(204).end();
});

module.exports = router;
