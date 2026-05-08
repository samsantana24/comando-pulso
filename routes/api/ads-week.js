const router = require('express').Router();
const db = require('../../db/connection');
const { weekRangeFromDate, ymd, weekIdFromSunday, weekLabel } = require('../../lib/weeks');
const { audit } = require('../../lib/audit');
const { requireMaster } = require('../../lib/auth');

const ADS_CATEGORY = 'Tráfego Pago (Google / Meta Ads)';
const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

router.get('/', (req, res) => {
  const { from, to, scenario_id } = req.query;
  const where = ['is_ads = 1'];
  const params = [];
  if (from) { where.push('date >= ?'); params.push(from); }
  if (to) { where.push('date <= ?'); params.push(to); }
  if (scenario_id === 'null') {
    where.push('scenario_id IS NULL');
  } else if (scenario_id) {
    where.push('(scenario_id IS NULL OR scenario_id = ?)');
    params.push(Number(scenario_id));
  }
  const rows = db.prepare(`SELECT * FROM costs WHERE ${where.join(' AND ')} ORDER BY date`).all(...params);
  const byWeek = new Map();
  for (const r of rows) {
    const range = weekRangeFromDate(r.date);
    const wid = weekIdFromSunday(range.sun);
    if (!byWeek.has(wid)) {
      byWeek.set(wid, {
        week_id: wid,
        sun: ymd(range.sun),
        sat: ymd(range.sat),
        label: weekLabel(range.sun, range.sat),
        total: 0,
        count: 0,
      });
    }
    const e = byWeek.get(wid);
    e.total += Number(r.amount || 0);
    e.count++;
  }
  res.json(Array.from(byWeek.values()).sort((a, b) => a.sun.localeCompare(b.sun)));
});

router.post('/', requireMaster, (req, res) => {
  const b = req.body || {};
  const total = Number(b.total_amount);
  if (!Number.isFinite(total) || total < 0) {
    return res.status(400).json({ error: 'total_amount inválido' });
  }
  const seedDate = b.week_start_date || b.date;
  if (!isYmd(seedDate)) {
    return res.status(400).json({ error: 'week_start_date (ou date) é obrigatório no formato YYYY-MM-DD' });
  }
  const sunDate = weekRangeFromDate(seedDate).sun;
  const startD = ymd(sunDate);
  const endD = ymd(new Date(sunDate.getFullYear(), sunDate.getMonth(), sunDate.getDate() + 6));
  const scenarioId = b.scenario_id ? Number(b.scenario_id) : null;
  const dailyAmount = total / 7;

  const tx = db.transaction(() => {
    if (scenarioId === null) {
      db.prepare(`DELETE FROM costs WHERE is_ads = 1 AND scenario_id IS NULL AND date >= ? AND date <= ?`).run(startD, endD);
    } else {
      db.prepare(`DELETE FROM costs WHERE is_ads = 1 AND scenario_id = ? AND date >= ? AND date <= ?`).run(scenarioId, startD, endD);
    }
    const insert = db.prepare(`
      INSERT INTO costs (date, amount, category, description, status, recurrence_id, scenario_id, created_by, is_ads)
      VALUES (?, ?, ?, ?, 'planned', NULL, ?, ?, 1) RETURNING *
    `);
    const created = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(sunDate.getFullYear(), sunDate.getMonth(), sunDate.getDate() + i);
      const c = insert.get(ymd(day), dailyAmount, ADS_CATEGORY, 'Ads dia ' + ymd(day), scenarioId, req.user.email);
      created.push(c);
    }
    return created;
  });

  const created = tx();
  audit(req, 'UPSERT', 'ads_week', null, null, { week_start: startD, total, daily: dailyAmount, scenario_id: scenarioId, count: created.length });
  res.status(201).json({
    week_id: weekIdFromSunday(sunDate),
    week_start: startD,
    total_amount: total,
    daily_amount: dailyAmount,
    occurrences: created,
  });
});

router.delete('/', requireMaster, (req, res) => {
  const { week_start_date, scenario_id } = req.query;
  if (!isYmd(week_start_date)) return res.status(400).json({ error: 'week_start_date inválido' });
  const sunDate = weekRangeFromDate(week_start_date).sun;
  const startD = ymd(sunDate);
  const endD = ymd(new Date(sunDate.getFullYear(), sunDate.getMonth(), sunDate.getDate() + 6));
  let result;
  if (!scenario_id || scenario_id === 'null') {
    result = db.prepare(`DELETE FROM costs WHERE is_ads = 1 AND scenario_id IS NULL AND date >= ? AND date <= ?`).run(startD, endD);
  } else {
    result = db.prepare(`DELETE FROM costs WHERE is_ads = 1 AND scenario_id = ? AND date >= ? AND date <= ?`).run(Number(scenario_id), startD, endD);
  }
  audit(req, 'DELETE', 'ads_week', null, { week_start: startD, removed: result.changes }, null);
  res.status(204).end();
});

module.exports = router;
