const router = require('express').Router();
const db = require('../../db/connection');
const receivables = require('../../db/queries/receivables');
const sales = require('../../db/queries/sales');
const { audit } = require('../../lib/audit');

const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

router.get('/', (req, res) => {
  const { status, from, to } = req.query;
  res.json(receivables.list({ status: status || null, from: from || null, to: to || null }));
});

router.post('/', (req, res) => {
  const b = req.body || {};
  if (!isYmd(b.expected_date)) return res.status(400).json({ error: 'expected_date inválido' });
  const amount = Number(b.expected_amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'expected_amount inválido' });
  const created = receivables.create(b, req.user.email);
  audit(req, 'CREATE', 'receivable', created.id, null, created);
  res.status(201).json(created);
});

router.post('/sale-with-installments', (req, res) => {
  const b = req.body || {};
  if (!isYmd(b.date)) return res.status(400).json({ error: 'date inválida' });
  const grossAmount = Number(b.gross_amount);
  const netAmount = Number(b.net_amount);
  if (!Number.isFinite(grossAmount) || grossAmount < 0) return res.status(400).json({ error: 'gross_amount inválido' });
  if (!Number.isFinite(netAmount) || netAmount < 0) return res.status(400).json({ error: 'net_amount inválido' });
  if (!Array.isArray(b.installments)) return res.status(400).json({ error: 'installments deve ser array' });

  for (const inst of b.installments) {
    if (!isYmd(inst.expected_date)) return res.status(400).json({ error: 'parcela com expected_date inválido' });
    if (!Number.isFinite(Number(inst.expected_amount)) || Number(inst.expected_amount) <= 0) {
      return res.status(400).json({ error: 'parcela com expected_amount inválido' });
    }
  }

  const tx = db.transaction(() => {
    const sale = sales.create({
      date: b.date,
      gross_amount: grossAmount,
      net_amount: netAmount,
      client_name: b.client_name || null,
      closer_id: b.closer_id ? Number(b.closer_id) : null,
      payment_method: b.payment_method || null,
      notes: b.notes || null,
    }, req.user.email);
    const created = [];
    for (const inst of b.installments) {
      const r = receivables.create({
        sale_id: sale.id,
        expected_date: inst.expected_date,
        expected_amount: Number(inst.expected_amount),
        payment_method: inst.payment_method || b.payment_method || null,
        client_name: b.client_name || null,
      }, req.user.email);
      created.push(r);
    }
    return { sale, receivables: created };
  });

  const result = tx();
  audit(req, 'CREATE', 'sale_with_installments', result.sale.id, null, {
    sale_id: result.sale.id,
    installments_count: result.receivables.length,
  });
  res.status(201).json(result);
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const before = receivables.getById(id);
  if (!before) return res.status(404).json({ error: 'recebível não encontrado' });
  const fields = {};
  for (const k of ['expected_date', 'expected_amount', 'payment_method', 'status', 'client_name', 'notes']) {
    if (k in req.body) fields[k] = req.body[k];
  }
  if (fields.expected_date && !isYmd(fields.expected_date)) return res.status(400).json({ error: 'expected_date inválido' });
  if ('expected_amount' in fields) fields.expected_amount = Number(fields.expected_amount);
  if ('status' in fields && !['pending', 'received', 'cancelled'].includes(fields.status)) {
    return res.status(400).json({ error: 'status inválido' });
  }
  const updated = receivables.update(id, fields);
  audit(req, 'UPDATE', 'receivable', id, before, updated);
  res.json(updated);
});

router.post('/:id/mark-received', (req, res) => {
  const id = Number(req.params.id);
  const before = receivables.getById(id);
  if (!before) return res.status(404).json({ error: 'recebível não encontrado' });
  if (before.status !== 'pending') return res.status(400).json({ error: 'recebível não está pending' });

  const receivedDate = req.body.received_date && isYmd(req.body.received_date)
    ? req.body.received_date
    : before.expected_date;
  const netAmount = Number(req.body.net_amount ?? before.expected_amount);
  if (!Number.isFinite(netAmount) || netAmount < 0) return res.status(400).json({ error: 'net_amount inválido' });

  const tx = db.transaction(() => {
    const newSale = sales.create({
      date: receivedDate,
      gross_amount: Number(before.expected_amount),
      net_amount: netAmount,
      client_name: before.client_name,
      payment_method: before.payment_method,
      notes: 'Recebido (recebível #' + before.id + ')',
    }, req.user.email);
    const updated = receivables.markReceived(id, { receivedDate, receivedSaleId: newSale.id });
    return { sale: newSale, receivable: updated };
  });

  const result = tx();
  audit(req, 'RECEIVE', 'receivable', id, before, result.receivable);
  res.json(result);
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const before = receivables.getById(id);
  if (!before) return res.status(404).json({ error: 'recebível não encontrado' });
  if (before.sale_id) {
    receivables.cancel(id);
    audit(req, 'CANCEL', 'receivable', id, before, { ...before, status: 'cancelled' });
  } else {
    receivables.remove(id);
    audit(req, 'DELETE', 'receivable', id, before, null);
  }
  res.status(204).end();
});

module.exports = router;
