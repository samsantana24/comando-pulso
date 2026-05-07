const db = require('../db/connection');
const sales = require('../db/queries/sales');
const costsQ = require('../db/queries/costs');
const settingsQ = require('../db/queries/settings');
const funnelQ = require('../db/queries/funnel');
const { getWeeks, weekRangeFromDate, weekIdFromSunday, todayYmd } = require('./weeks');

const sumSalesUntil = db.prepare(`SELECT COALESCE(SUM(net_amount),0) AS s FROM sales WHERE date <= ?`);
const sumPaidCostsUntil = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM costs WHERE status='paid' AND date <= ?`);
const sumSalesBefore = db.prepare(`SELECT COALESCE(SUM(net_amount),0) AS s FROM sales WHERE date < ?`);
const sumPaidCostsBefore = db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM costs WHERE status='paid' AND date < ?`);

function getInitialCashSetting() {
  const include = settingsQ.get('include_initial_cash') === '1';
  const initial = include ? Number(settingsQ.get('initial_cash_brl') || 0) : 0;
  return { include, initial };
}

function getCashToday() {
  const { initial } = getInitialCashSetting();
  const today = todayYmd();
  const sales = Number(sumSalesUntil.get(today).s) || 0;
  const paid = Number(sumPaidCostsUntil.get(today).s) || 0;
  return initial + sales - paid;
}

function computeFunnelProjectedNet(funnel, teamPerf) {
  if (!funnel) return 0;
  const sdrs = teamPerf.filter((p) => p.member_role === 'sdr');
  const closers = teamPerf.filter((p) => p.member_role === 'closer');

  const realizedFromSDRs = sdrs.reduce(
    (acc, s) => acc + s.capacity_per_week * (s.conversion_pct / 100),
    0
  );
  const avgSdrShow = sdrs.length > 0
    ? sdrs.reduce((a, s) => a + s.conversion_pct, 0) / sdrs.length
    : (funnel.show_rate_pct || 70);
  const realizedFromRebarba = (funnel.rebarba_sb_per_week || 0) * (avgSdrShow / 100);
  const callsRealizadas = realizedFromSDRs + realizedFromRebarba;

  const avgCloser = closers.length > 0
    ? closers.reduce((a, c) => a + c.conversion_pct, 0) / closers.length
    : (funnel.call_to_sale_pct || 25);
  const vendasCall = Math.floor(callsRealizadas * (avgCloser / 100));
  const receitaBruta = vendasCall * (funnel.ticket_avg || 0);
  return receitaBruta * (1 - (funnel.payment_tax_pct || 0) / 100);
}

function getProjectedWeeklyNet(scenarioId) {
  if (!scenarioId) return 0;
  const funnel = funnelQ.getByScenario(scenarioId);
  const teamPerf = funnelQ.getTeamPerformance(scenarioId);
  return computeFunnelProjectedNet(funnel, teamPerf);
}

function getWeeklyCashflow({ pastWeeks = 1, futureWeeks = 2, scenarioId = null, anchor = null } = {}) {
  const weeks = getWeeks({ pastWeeks, futureWeeks, anchor });
  if (weeks.length === 0) return { cash_at_start: 0, cash_today: getCashToday(), series: [] };

  const fromDate = weeks[0].sun;
  const toDate = weeks[weeks.length - 1].sat;

  const allSales = sales.list({ from: fromDate, to: toDate });
  const allCosts = costsQ.list({ from: fromDate, to: toDate, scenarioId: scenarioId === null ? undefined : scenarioId });
  const projectedNet = getProjectedWeeklyNet(scenarioId);

  const byWeek = new Map();
  for (const w of weeks) {
    byWeek.set(w.week_id, {
      ...w,
      sales_real: 0,
      costs_paid: 0,
      costs_planned: 0,
      sales_projected: w.is_future ? projectedNet : 0,
    });
  }

  for (const s of allSales) {
    const wid = weekIdFromSunday(weekRangeFromDate(s.date).sun);
    const w = byWeek.get(wid);
    if (w) w.sales_real += Number(s.net_amount || 0);
  }
  for (const c of allCosts) {
    const wid = weekIdFromSunday(weekRangeFromDate(c.date).sun);
    const w = byWeek.get(wid);
    if (!w) continue;
    if (c.status === 'paid') w.costs_paid += Number(c.amount || 0);
    else w.costs_planned += Number(c.amount || 0);
  }

  const { initial } = getInitialCashSetting();
  const beforeSales = Number(sumSalesBefore.get(fromDate).s) || 0;
  const beforePaid = Number(sumPaidCostsBefore.get(fromDate).s) || 0;
  const cashAtStart = initial + beforeSales - beforePaid;

  let cum = cashAtStart;
  const series = [];
  for (const w of weeks) {
    const data = byWeek.get(w.week_id);
    const delta = (w.is_past || w.is_current)
      ? data.sales_real - data.costs_paid
      : data.sales_projected - data.costs_planned;
    cum += delta;
    series.push({ ...data, week_delta: delta, cash_after: cum });
  }

  return {
    cash_at_start: cashAtStart,
    cash_today: getCashToday(),
    projected_weekly_net: projectedNet,
    series,
  };
}

function getRunway(scenarioId) {
  const cashToday = getCashToday();
  const data = getWeeklyCashflow({ pastWeeks: 0, futureWeeks: 4, scenarioId });
  const future = data.series.filter((s) => s.is_future);
  if (future.length === 0) return { runway_weeks: '52+', current_cash: cashToday, weekly_burn: 0 };
  let totalBurn = 0;
  for (const s of future) totalBurn += Math.max(0, s.costs_planned - s.sales_projected);
  const weeklyBurn = totalBurn / future.length;
  if (weeklyBurn <= 0) return { runway_weeks: '52+', current_cash: cashToday, weekly_burn: 0 };
  const w = cashToday / weeklyBurn;
  return {
    runway_weeks: w >= 52 ? '52+' : Math.round(w * 10) / 10,
    weekly_burn: weeklyBurn,
    current_cash: cashToday,
  };
}

module.exports = {
  getCashToday,
  getInitialCashSetting,
  getWeeklyCashflow,
  getProjectedWeeklyNet,
  getRunway,
};
