const router = require('express').Router();
const { requireAuth, requireTotp } = require('../lib/auth');
const sales = require('../db/queries/sales');
const costs = require('../db/queries/costs');
const team = require('../db/queries/team');
const scenarios = require('../db/queries/scenarios');
const categories = require('../db/queries/categories');
const receivables = require('../db/queries/receivables');
const { getWeeksFromTotal, weekRangeFromDate, weekIdFromSunday, todayYmd, ymd } = require('../lib/weeks');
const { GROUP_ORDER } = require('../lib/categories');
const { formatBrl, formatDateShort, formatPaymentMethod } = require('../lib/format');

const ADS_GROUP_LABEL = 'INVESTIMENTO EM ADS';

router.get('/', requireAuth, requireTotp, (req, res) => {
  const totalWeeks = Math.max(1, Math.min(10, Number(req.query.weeks) || 4));
  const weeks = getWeeksFromTotal(totalWeeks);
  const fromDate = weeks[0].sun;
  const toDate = weeks[weeks.length - 1].sat;
  const activeScenario = scenarios.getActive();
  const scenarioId = activeScenario ? activeScenario.id : null;

  const salesData = sales.list({ from: fromDate, to: toDate });
  const nonAdsCosts = costs.list({ from: fromDate, to: toDate, scenarioId, ads: 'exclude' });
  const adsCosts = costs.list({ from: fromDate, to: toDate, scenarioId, ads: 'only' });

  const salesByWeek = {};
  for (const w of weeks) salesByWeek[w.week_id] = 0;
  for (const s of salesData) {
    const wid = weekIdFromSunday(weekRangeFromDate(s.date).sun);
    if (wid in salesByWeek) salesByWeek[wid] += Number(s.net_amount || 0);
  }

  const catToGroup = categories.buildNameToGroupMap();
  const orderedGroups = [];
  for (const g of GROUP_ORDER) orderedGroups.push(g);

  const costsByGroup = {};
  const costsByGroupPaid = {};
  const costsByGroupPlanned = {};
  const costIdsByGroupCatWeek = {};
  for (const c of nonAdsCosts) {
    const wid = weekIdFromSunday(weekRangeFromDate(c.date).sun);
    if (!(wid in salesByWeek)) continue;
    const group = catToGroup.get(c.category) || 'Outros Custos';
    const amount = Number(c.amount || 0);
    const target = c.status === 'paid' ? costsByGroupPaid : costsByGroupPlanned;
    if (!costsByGroup[group]) costsByGroup[group] = {};
    if (!costsByGroup[group][c.category]) costsByGroup[group][c.category] = {};
    costsByGroup[group][c.category][wid] = (costsByGroup[group][c.category][wid] || 0) + amount;
    if (!target[group]) target[group] = {};
    if (!target[group][c.category]) target[group][c.category] = {};
    target[group][c.category][wid] = (target[group][c.category][wid] || 0) + amount;

    if (!costIdsByGroupCatWeek[group]) costIdsByGroupCatWeek[group] = {};
    if (!costIdsByGroupCatWeek[group][c.category]) costIdsByGroupCatWeek[group][c.category] = {};
    if (!costIdsByGroupCatWeek[group][c.category][wid]) costIdsByGroupCatWeek[group][c.category][wid] = { paid: [], planned: [] };
    costIdsByGroupCatWeek[group][c.category][wid][c.status === 'paid' ? 'paid' : 'planned'].push(c.id);
  }

  const adsByWeek = {};
  const adsPaidByWeek = {};
  const adsPlannedByWeek = {};
  for (const w of weeks) { adsByWeek[w.week_id] = 0; adsPaidByWeek[w.week_id] = 0; adsPlannedByWeek[w.week_id] = 0; }
  for (const c of adsCosts) {
    const wid = weekIdFromSunday(weekRangeFromDate(c.date).sun);
    if (!(wid in adsByWeek)) continue;
    const amount = Number(c.amount || 0);
    adsByWeek[wid] += amount;
    if (c.status === 'paid') adsPaidByWeek[wid] += amount;
    else adsPlannedByWeek[wid] += amount;
  }

  const subtotalByGroupWeek = {};
  const subtotalByGroupPaid = {};
  const subtotalByGroupPlanned = {};
  for (const group of Object.keys(costsByGroup)) {
    subtotalByGroupWeek[group] = {};
    subtotalByGroupPaid[group] = {};
    subtotalByGroupPlanned[group] = {};
    for (const w of weeks) {
      let total = 0, paid = 0, planned = 0;
      for (const cat of Object.keys(costsByGroup[group])) {
        total += costsByGroup[group][cat][w.week_id] || 0;
        paid += (costsByGroupPaid[group] && costsByGroupPaid[group][cat] && costsByGroupPaid[group][cat][w.week_id]) || 0;
        planned += (costsByGroupPlanned[group] && costsByGroupPlanned[group][cat] && costsByGroupPlanned[group][cat][w.week_id]) || 0;
      }
      subtotalByGroupWeek[group][w.week_id] = total;
      subtotalByGroupPaid[group][w.week_id] = paid;
      subtotalByGroupPlanned[group][w.week_id] = planned;
    }
  }

  const balanceByWeek = {};
  const balanceByWeekSplit = {};
  for (const w of weeks) {
    let costsTotal = 0, costsPaid = 0, costsPlanned = 0;
    for (const group of Object.keys(costsByGroup)) {
      costsTotal += subtotalByGroupWeek[group][w.week_id] || 0;
      costsPaid += subtotalByGroupPaid[group][w.week_id] || 0;
      costsPlanned += subtotalByGroupPlanned[group][w.week_id] || 0;
    }
    costsTotal += adsByWeek[w.week_id] || 0;
    costsPaid += adsPaidByWeek[w.week_id] || 0;
    costsPlanned += adsPlannedByWeek[w.week_id] || 0;
    const sales = salesByWeek[w.week_id] || 0;
    balanceByWeek[w.week_id] = sales - costsTotal;
    balanceByWeekSplit[w.week_id] = {
      paid: sales - costsPaid,
      planned: -costsPlanned,
      total: sales - costsTotal,
    };
  }

  const recentSales = sales.list({ limit: 12 });
  const recentCosts = costs.list({ from: fromDate, to: toDate, scenarioId, ads: 'exclude' }).slice(0, 12);

  const today = todayYmd();
  const horizon60 = ymd(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));
  const pendingReceivables = receivables.list({ status: 'pending', from: today.slice(0, 4) + '-01-01', to: horizon60 })
    .sort((a, b) => a.expected_date.localeCompare(b.expected_date));

  const closers = team.list({ role: 'closer' });
  const adsByWeekRows = weeks.map((w) => ({
    week_id: w.week_id,
    sun: w.sun,
    sat: w.sat,
    label: w.label,
    total: adsByWeek[w.week_id] || 0,
    is_current: w.is_current,
  }));

  const orderedGroupsPresent = orderedGroups.filter((g) => costsByGroup[g] && Object.keys(costsByGroup[g]).length > 0);
  for (const g of Object.keys(costsByGroup)) {
    if (!orderedGroupsPresent.includes(g)) orderedGroupsPresent.push(g);
  }

  const allCategoriesGrouped = {};
  for (const c of categories.list()) {
    if (!allCategoriesGrouped[c.group_name]) allCategoriesGrouped[c.group_name] = [];
    allCategoriesGrouped[c.group_name].push(c.name);
  }

  res.render('custos', {
    title: 'Custos e Vendas',
    user: req.user,
    userCan: res.locals.userCan,
    weeks,
    salesByWeek,
    costsByGroup,
    costsByGroupPaid,
    costsByGroupPlanned,
    subtotalByGroupWeek,
    subtotalByGroupPaid,
    subtotalByGroupPlanned,
    orderedGroupsPresent,
    adsByWeek,
    adsPaidByWeek,
    adsPlannedByWeek,
    adsByWeekRows,
    balanceByWeek,
    balanceByWeekSplit,
    recentSales,
    recentCosts,
    pendingReceivables,
    totalWeeks,
    activeScenario,
    closers,
    categoriesByGroup: allCategoriesGrouped,
    today,
    todayDate: today,
    formatBrl, formatDateShort, formatPaymentMethod,
  });
});

module.exports = router;
