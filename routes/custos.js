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
  const costsByCatWeek = {};
  for (const c of nonAdsCosts) {
    const wid = weekIdFromSunday(weekRangeFromDate(c.date).sun);
    if (!(wid in salesByWeek)) continue;
    const group = catToGroup.get(c.category) || 'Outros Custos';
    if (!costsByGroup[group]) costsByGroup[group] = {};
    if (!costsByGroup[group][c.category]) costsByGroup[group][c.category] = {};
    if (!costsByGroup[group][c.category][wid]) costsByGroup[group][c.category][wid] = 0;
    costsByGroup[group][c.category][wid] += Number(c.amount || 0);

    if (!costsByCatWeek[c.category]) costsByCatWeek[c.category] = {};
    costsByCatWeek[c.category][wid] = (costsByCatWeek[c.category][wid] || 0) + Number(c.amount || 0);
  }

  const adsByWeek = {};
  for (const w of weeks) adsByWeek[w.week_id] = 0;
  for (const c of adsCosts) {
    const wid = weekIdFromSunday(weekRangeFromDate(c.date).sun);
    if (wid in adsByWeek) adsByWeek[wid] += Number(c.amount || 0);
  }

  const subtotalByGroupWeek = {};
  for (const group of Object.keys(costsByGroup)) {
    subtotalByGroupWeek[group] = {};
    for (const w of weeks) {
      let s = 0;
      for (const cat of Object.keys(costsByGroup[group])) {
        s += costsByGroup[group][cat][w.week_id] || 0;
      }
      subtotalByGroupWeek[group][w.week_id] = s;
    }
  }

  const balanceByWeek = {};
  for (const w of weeks) {
    let costsTotal = 0;
    for (const group of Object.keys(costsByGroup)) {
      costsTotal += subtotalByGroupWeek[group][w.week_id] || 0;
    }
    costsTotal += adsByWeek[w.week_id] || 0;
    balanceByWeek[w.week_id] = (salesByWeek[w.week_id] || 0) - costsTotal;
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
    subtotalByGroupWeek,
    orderedGroupsPresent,
    adsByWeek,
    adsByWeekRows,
    balanceByWeek,
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
