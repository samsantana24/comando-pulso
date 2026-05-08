const router = require('express').Router();
const ExcelJS = require('exceljs');
const db = require('../../db/connection');
const { requireMaster } = require('../../lib/auth');
const sales = require('../../db/queries/sales');
const costs = require('../../db/queries/costs');
const receivables = require('../../db/queries/receivables');
const { requirePerm } = require('../../lib/permissions');
const { isDateInRange } = require('../../lib/validators');
const { formatPaymentMethod } = require('../../lib/format');
const { logError } = require('../../lib/log');

// === GET / : backup JSON completo (master only) ===
const TABLES = [
  'settings', 'team_members', 'scenarios', 'sales',
  'recurrence_rules', 'costs', 'scenario_funnel',
  'scenario_team_performance', 'audit_log',
];

router.get('/', requireMaster, (req, res) => {
  const data = {
    _exported_at: new Date().toISOString(),
    _version: '1',
  };
  for (const t of TABLES) {
    try { data[t] = db.prepare(`SELECT * FROM ${t}`).all(); } catch (_) { data[t] = []; }
  }
  res.setHeader('Content-Disposition', `attachment; filename="comando-pulso-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(data);
});

// === POST / : export filtrado XLSX/CSV ===
router.post('/', requirePerm('action.export_data'), async (req, res) => {
  try {
    const b = req.body || {};
    const { format, from, to, include = {}, scenario_id = null } = b;

    if (!['xlsx', 'csv'].includes(format)) return res.status(400).json({ error: 'format inválido' });
    if (!isDateInRange(from)) return res.status(400).json({ error: 'from inválido' });
    if (!isDateInRange(to)) return res.status(400).json({ error: 'to inválido' });
    if (from > to) return res.status(400).json({ error: 'from deve ser <= to' });

    const wantSales = include.sales !== false;
    const wantCosts = include.costs !== false;
    const wantAds = include.ads !== false;
    const wantReceivables = include.receivables !== false;
    if (!wantSales && !wantCosts && !wantAds && !wantReceivables) {
      return res.status(400).json({ error: 'selecione ao menos um tipo' });
    }

    const fname = `comando-pulso-${from}-a-${to}`;

    if (format === 'csv') {
      const rows = collectAllAsRows({ from, to, include, scenarioId: scenario_id });
      const csv = toCsv(rows);
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fname}.csv"`,
      });
      return res.send('﻿' + csv);
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Comando Pulso';
    wb.created = new Date();

    if (wantSales) addSalesSheet(wb, { from, to });
    if (wantCosts) addCostsSheet(wb, { from, to, scenarioId: scenario_id, isAds: false });
    if (wantAds) addCostsSheet(wb, { from, to, scenarioId: scenario_id, isAds: true });
    if (wantReceivables) addReceivablesSheet(wb, { from, to });
    addSummarySheet(wb, { from, to, include, scenarioId: scenario_id });

    const buf = await wb.xlsx.writeBuffer();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fname}.xlsx"`,
    });
    return res.send(Buffer.from(buf));
  } catch (err) {
    logError(req, err);
    return res.status(500).json({ error: 'falha ao gerar export' });
  }
});

function collectAllAsRows({ from, to, include, scenarioId }) {
  const rows = [];
  if (include.sales !== false) {
    for (const s of sales.list({ from, to })) {
      rows.push({
        type: 'sale', date: s.date, category: '',
        description: s.notes || '',
        gross_amount: Number(s.gross_amount || 0),
        net_amount: Number(s.net_amount || 0),
        amount: '',
        status: 'real',
        payment_method: formatPaymentMethod(s.payment_method) || '',
        client_name: s.client_name || '',
        scenario: '',
      });
    }
  }
  if (include.costs !== false) {
    for (const c of costs.list({ from, to, scenarioId, ads: 'exclude' })) {
      rows.push({
        type: 'cost', date: c.date, category: c.category || '',
        description: c.description || '',
        gross_amount: '', net_amount: '',
        amount: Number(c.amount || 0),
        status: c.status,
        payment_method: '', client_name: '', scenario: c.scenario_id || 'global',
      });
    }
  }
  if (include.ads !== false) {
    for (const c of costs.list({ from, to, scenarioId, ads: 'only' })) {
      rows.push({
        type: 'ads', date: c.date, category: c.category || 'Ads',
        description: c.description || '',
        gross_amount: '', net_amount: '',
        amount: Number(c.amount || 0),
        status: c.status,
        payment_method: '', client_name: '', scenario: c.scenario_id || 'global',
      });
    }
  }
  if (include.receivables !== false) {
    for (const r of receivables.list({ from, to })) {
      rows.push({
        type: 'receivable', date: r.expected_date, category: '',
        description: '',
        gross_amount: '', net_amount: '',
        amount: Number(r.expected_amount || 0),
        status: r.status,
        payment_method: formatPaymentMethod(r.payment_method) || '',
        client_name: r.client_name || '',
        scenario: '',
      });
    }
  }
  return rows;
}

function toCsv(rows) {
  const headers = ['type', 'date', 'category', 'description', 'gross_amount', 'net_amount', 'amount', 'status', 'payment_method', 'client_name', 'scenario'];
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(','));
  return lines.join('\n');
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function applyHeaderStyle(sheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF2E5A' } };
  header.alignment = { vertical: 'middle', horizontal: 'left' };
  header.height = 22;
}

function addSalesSheet(wb, { from, to }) {
  const sheet = wb.addWorksheet('Vendas');
  sheet.columns = [
    { header: 'Data', key: 'date', width: 12 },
    { header: 'Bruto', key: 'gross', width: 14, style: { numFmt: '"R$" #,##0.00' } },
    { header: 'Líquido', key: 'net', width: 14, style: { numFmt: '"R$" #,##0.00' } },
    { header: 'Pagamento', key: 'pmt', width: 18 },
    { header: 'Cliente', key: 'client', width: 24 },
    { header: 'Observações', key: 'notes', width: 30 },
  ];
  for (const s of sales.list({ from, to })) {
    sheet.addRow({
      date: s.date,
      gross: Number(s.gross_amount),
      net: Number(s.net_amount),
      pmt: formatPaymentMethod(s.payment_method) || '',
      client: s.client_name || '',
      notes: s.notes || '',
    });
  }
  applyHeaderStyle(sheet);
}

function addCostsSheet(wb, { from, to, scenarioId, isAds }) {
  const sheet = wb.addWorksheet(isAds ? 'Investimento em Ads' : 'Custos');
  sheet.columns = [
    { header: 'Data', key: 'date', width: 12 },
    { header: 'Categoria', key: 'cat', width: 28 },
    { header: 'Descrição', key: 'desc', width: 36 },
    { header: 'Valor', key: 'amount', width: 14, style: { numFmt: '"R$" #,##0.00' } },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Cenário', key: 'scenario', width: 12 },
  ];
  const list = costs.list({ from, to, scenarioId, ads: isAds ? 'only' : 'exclude' });
  for (const c of list) {
    sheet.addRow({
      date: c.date,
      cat: c.category || '',
      desc: c.description || '',
      amount: Number(c.amount),
      status: c.status,
      scenario: c.scenario_id || 'global',
    });
  }
  applyHeaderStyle(sheet);
}

function addReceivablesSheet(wb, { from, to }) {
  const sheet = wb.addWorksheet('Recebíveis');
  sheet.columns = [
    { header: 'Vencimento', key: 'date', width: 14 },
    { header: 'Cliente', key: 'client', width: 24 },
    { header: 'Valor previsto', key: 'expected', width: 16, style: { numFmt: '"R$" #,##0.00' } },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Pagamento', key: 'pmt', width: 18 },
    { header: 'Recebido em', key: 'received', width: 14 },
    { header: 'Valor recebido', key: 'recvAmt', width: 16, style: { numFmt: '"R$" #,##0.00' } },
  ];
  const list = receivables.list({ from, to });
  for (const r of list) {
    sheet.addRow({
      date: r.expected_date,
      client: r.client_name || '',
      expected: Number(r.expected_amount),
      status: r.status,
      pmt: formatPaymentMethod(r.payment_method) || '',
      received: r.received_date || '',
      recvAmt: r.received_amount ? Number(r.received_amount) : '',
    });
  }
  applyHeaderStyle(sheet);
}

function addSummarySheet(wb, { from, to, include, scenarioId }) {
  const sheet = wb.addWorksheet('Resumo');
  sheet.columns = [
    { header: 'Tipo', key: 'type', width: 22 },
    { header: 'Quantidade', key: 'count', width: 12 },
    { header: 'Total', key: 'total', width: 16, style: { numFmt: '"R$" #,##0.00' } },
  ];
  if (include.sales !== false) {
    const list = sales.list({ from, to });
    sheet.addRow({ type: 'Vendas (líquido)', count: list.length, total: list.reduce((a, s) => a + Number(s.net_amount || 0), 0) });
  }
  if (include.costs !== false) {
    const list = costs.list({ from, to, scenarioId, ads: 'exclude' });
    sheet.addRow({ type: 'Custos', count: list.length, total: list.reduce((a, c) => a + Number(c.amount || 0), 0) });
  }
  if (include.ads !== false) {
    const list = costs.list({ from, to, scenarioId, ads: 'only' });
    sheet.addRow({ type: 'Investimento em Ads', count: list.length, total: list.reduce((a, c) => a + Number(c.amount || 0), 0) });
  }
  if (include.receivables !== false) {
    const list = receivables.list({ from, to });
    sheet.addRow({ type: 'Recebíveis', count: list.length, total: list.reduce((a, r) => a + Number(r.expected_amount || 0), 0) });
  }
  applyHeaderStyle(sheet);
}

module.exports = router;
