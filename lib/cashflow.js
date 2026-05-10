const db = require('../db/connection');
const sales = require('../db/queries/sales');
const costsQ = require('../db/queries/costs');
const settingsQ = require('../db/queries/settings');
const funnelQ = require('../db/queries/funnel');
const scenariosQ = require('../db/queries/scenarios');
const receivablesQ = require('../db/queries/receivables');
const weeklyOverrides = require('../db/queries/weeklyOverrides');
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
  const vendasForecast = Math.floor(callsRealizadas * ((funnel.forecast_bonus_pct || 0) / 100));
  const vendasTotais = vendasCall + vendasForecast;
  const receitaBruta = vendasTotais * (funnel.ticket_avg || 0);
  return receitaBruta * (1 - (funnel.payment_tax_pct || 0) / 100);
}

function getProjectedWeeklyNet(scenarioId) {
  if (!scenarioId) return 0;
  const funnel = funnelQ.getByScenario(scenarioId);
  const teamPerf = funnelQ.getTeamPerformance(scenarioId);
  return computeFunnelProjectedNet(funnel, teamPerf);
}

function computeWeeklyEvolutiveNet(week, teamWeekly) {
  if (!week) return 0;
  const sdrs = teamWeekly.filter((t) => t.member_role === 'sdr' && t.active === 1);
  const closers = teamWeekly.filter((t) => t.member_role === 'closer' && t.active === 1);

  const realizedFromSDRs = sdrs.reduce(
    (acc, s) => acc + Number(s.capacity_per_week || 0) * (Number(s.conversion_pct || 0) / 100),
    0
  );
  const avgSdrShow = sdrs.length > 0
    ? sdrs.reduce((a, s) => a + Number(s.conversion_pct || 0), 0) / sdrs.length
    : (Number(week.show_rate_pct) || 70);
  const realizedFromRebarba = (Number(week.rebarba_sb_per_week) || 0) * (avgSdrShow / 100);
  const callsRealizadas = realizedFromSDRs + realizedFromRebarba;

  const avgCloser = closers.length > 0
    ? closers.reduce((a, c) => a + Number(c.conversion_pct || 0), 0) / closers.length
    : (Number(week.call_to_sale_pct) || 25);
  const vendasCall = Math.floor(callsRealizadas * (avgCloser / 100));
  const vendasForecast = Math.floor(callsRealizadas * ((Number(week.forecast_bonus_pct) || 0) / 100));
  const vendasTotais = vendasCall + vendasForecast;
  const receitaBruta = vendasTotais * (Number(week.ticket_avg) || 0);
  return receitaBruta * (1 - (Number(week.payment_tax_pct) || 0) / 100);
}

function getProjectedNetForWeek(scenarioId, weekIndex) {
  if (!scenarioId) return 0;
  const scenario = scenariosQ.getById(scenarioId);
  if (!scenario || !scenario.evolutive_funnel_enabled) return getProjectedWeeklyNet(scenarioId);
  const weekly = funnelQ.getWeeklyForScenario(scenarioId);
  if (!weekly || weekly.length === 0) return getProjectedWeeklyNet(scenarioId);
  const teamWeekly = funnelQ.getTeamWeeklyForScenario(scenarioId);
  const w = weekly.find((x) => x.week_index === weekIndex);
  if (!w) {
    // index além do horizonte configurado: usa última semana como platô
    const last = weekly[weekly.length - 1];
    const teamForLast = teamWeekly.filter((t) => t.week_index === last.week_index);
    return computeWeeklyEvolutiveNet(last, teamForLast);
  }
  const teamForWeek = teamWeekly.filter((t) => t.week_index === weekIndex);
  return computeWeeklyEvolutiveNet(w, teamForWeek);
}

function topCostsForWeek(costs, weekId, n = 3) {
  const byCat = new Map();
  for (const c of costs) {
    const wid = weekIdFromSunday(weekRangeFromDate(c.date).sun);
    if (wid !== weekId) continue;
    if (c.is_ads === 1) continue;
    byCat.set(c.category, (byCat.get(c.category) || 0) + Number(c.amount || 0));
  }
  return Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([category, total]) => ({ category, total }));
}

function getWeeklyCashflow({ pastWeeks = 1, futureWeeks = 2, scenarioId = null, anchor = null } = {}) {
  const weeks = getWeeks({ pastWeeks, futureWeeks, anchor });
  if (weeks.length === 0) return { cash_at_start: 0, cash_today: getCashToday(), series: [] };

  const fromDate = weeks[0].sun;
  const toDate = weeks[weeks.length - 1].sat;

  const allSales = sales.list({ from: fromDate, to: toDate });
  const allCosts = costsQ.list({
    from: fromDate, to: toDate,
    scenarioId: scenarioId === null ? undefined : scenarioId,
  });
  const projectedNet = getProjectedWeeklyNet(scenarioId);
  const scenarioRow = scenarioId ? scenariosQ.getById(scenarioId) : null;
  const isEvolutive = !!(scenarioRow && scenarioRow.evolutive_funnel_enabled);
  const overridesMap = scenarioId ? weeklyOverrides.mapByScenario(scenarioId) : new Map();

  const includeAdsInRunway = settingsQ.get('include_ads_in_runway') !== '0';
  const includeReceivables = settingsQ.get('include_receivables_in_projection') === '1';

  let pendingReceivablesByWeek = {};
  if (includeReceivables) {
    const pending = receivablesQ.list({ status: 'pending', from: fromDate, to: toDate });
    for (const r of pending) {
      const wid = weekIdFromSunday(weekRangeFromDate(r.expected_date).sun);
      pendingReceivablesByWeek[wid] = (pendingReceivablesByWeek[wid] || 0) + Number(r.expected_amount || 0);
    }
  }

  const byWeek = new Map();
  let evoWeekIndex = 0;
  for (const w of weeks) {
    let salesProj = 0;
    let salesProjOverridden = false;
    if (w.is_future) {
      if (overridesMap.has(w.week_id)) {
        salesProj = overridesMap.get(w.week_id);
        salesProjOverridden = true;
      } else if (isEvolutive) {
        evoWeekIndex += 1;
        salesProj = getProjectedNetForWeek(scenarioId, evoWeekIndex);
      } else {
        salesProj = projectedNet;
      }
    }
    byWeek.set(w.week_id, {
      ...w,
      sales_real: 0,
      costs_paid: 0,
      costs_planned: 0,
      ads_paid: 0,
      ads_planned: 0,
      sales_projected: salesProj,
      sales_projected_overridden: salesProjOverridden,
      receivables_projected: w.is_future ? (pendingReceivablesByWeek[w.week_id] || 0) : 0,
      top_costs: [],
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
    const isAds = c.is_ads === 1;
    const amt = Number(c.amount || 0);
    if (c.status === 'paid') {
      if (isAds) w.ads_paid += amt;
      else w.costs_paid += amt;
    } else {
      if (isAds) w.ads_planned += amt;
      else w.costs_planned += amt;
    }
  }

  for (const w of weeks) {
    const data = byWeek.get(w.week_id);
    data.top_costs = topCostsForWeek(allCosts, w.week_id, 3);
  }

  const { initial } = getInitialCashSetting();
  const beforeSales = Number(sumSalesBefore.get(fromDate).s) || 0;
  const beforePaid = Number(sumPaidCostsBefore.get(fromDate).s) || 0;
  const cashAtStart = initial + beforeSales - beforePaid;

  let cum = cashAtStart;
  const series = [];
  for (const w of weeks) {
    const data = byWeek.get(w.week_id);
    let delta;
    if (w.is_past) {
      const adsContrib = includeAdsInRunway ? data.ads_paid : 0;
      delta = data.sales_real - data.costs_paid - adsContrib;
    } else if (w.is_current) {
      const adsContrib = includeAdsInRunway ? (data.ads_paid + data.ads_planned) : 0;
      delta = data.sales_real - data.costs_paid - data.costs_planned - adsContrib;
    } else {
      const adsContrib = includeAdsInRunway ? data.ads_planned : 0;
      const receivableContrib = includeReceivables ? data.receivables_projected : 0;
      delta = data.sales_projected + receivableContrib - data.costs_planned - adsContrib;
    }
    cum += delta;
    series.push({ ...data, week_delta: delta, cash_after: cum });
  }

  return {
    cash_at_start: cashAtStart,
    cash_today: getCashToday(),
    projected_weekly_net: projectedNet,
    include_ads_in_runway: includeAdsInRunway,
    include_receivables_in_projection: includeReceivables,
    series,
  };
}

function getRunway(scenarioId) {
  const cashToday = getCashToday();
  const data = getWeeklyCashflow({ pastWeeks: 0, futureWeeks: 4, scenarioId });
  const future = data.series.filter((s) => s.is_future);
  if (future.length === 0) return { runway_weeks: '52+', current_cash: cashToday, weekly_burn: 0 };
  let totalBurn = 0;
  for (const s of future) {
    const adsContrib = data.include_ads_in_runway ? (s.ads_planned + s.ads_paid) : 0;
    const receivableContrib = data.include_receivables_in_projection ? s.receivables_projected : 0;
    const burn = (s.costs_planned + s.costs_paid + adsContrib) - s.sales_projected - receivableContrib;
    if (burn > 0) totalBurn += burn;
  }
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
  getProjectedNetForWeek,
  getRunway,
};
