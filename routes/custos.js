const router = require('express').Router();
const { requireAuth, requireTotp } = require('../lib/auth');
const sales = require('../db/queries/sales');
const costs = require('../db/queries/costs');
const team = require('../db/queries/team');
const scenarios = require('../db/queries/scenarios');
const { getWeeksFromTotal, weekRangeFromDate, weekIdFromSunday, todayYmd } = require('../lib/weeks');
const { CATEGORIES_BY_GROUP } = require('../lib/categories');
const { formatBrl, formatDateShort, formatPaymentMethod } = require('../lib/format');

router.get('/', requireAuth, requireTotp, (req, res) => {
  const totalWeeks = Math.max(1, Math.min(10, Number(req.query.weeks) || 4));
  const weeks = getWeeksFromTotal(totalWeeks);
  const fromDate = weeks[0].sun;
  const toDate = weeks[weeks.length - 1].sat;
  const activeScenario = scenarios.getActive();

  const salesData = sales.list({ from: fromDate, to: toDate });
  const costsData = costs.list({
    from: fromDate, to: toDate,
    scenarioId: activeScenario ? activeScenario.id : null,
  });

  const salesByWeek = {};
  for (const w of weeks) salesByWeek[w.week_id] = 0;
  for (const s of salesData) {
    const wid = weekIdFromSunday(weekRangeFromDate(s.date).sun);
    if (wid in salesByWeek) salesByWeek[wid] += Number(s.net_amount || 0);
  }

  const costsByCatWeek = {};
  for (const c of costsData) {
    const wid = weekIdFromSunday(weekRangeFromDate(c.date).sun);
    if (!(wid in salesByWeek)) continue;
    if (!costsByCatWeek[c.category]) {
      costsByCatWeek[c.category] = {};
      for (const w of weeks) costsByCatWeek[c.category][w.week_id] = 0;
    }
    costsByCatWeek[c.category][wid] += Number(c.amount || 0);
  }
  const categoriesPresent = Object.keys(costsByCatWeek).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const balanceByWeek = {};
  for (const w of weeks) {
    let costsTotal = 0;
    for (const cat of categoriesPresent) costsTotal += costsByCatWeek[cat][w.week_id] || 0;
    balanceByWeek[w.week_id] = (salesByWeek[w.week_id] || 0) - costsTotal;
  }

  const recentSales = sales.list({ limit: 12 });
  const recentCosts = costs.list({
    from: fromDate, to: toDate,
    scenarioId: activeScenario ? activeScenario.id : null,
  }).slice(0, 12);

  const closers = team.list({ role: 'closer' });

  res.render('custos', {
    title: 'Custos e Vendas',
    user: req.user,
    weeks,
    salesByWeek,
    costsByCatWeek,
    categoriesPresent,
    balanceByWeek,
    recentSales,
    recentCosts,
    totalWeeks,
    activeScenario,
    closers,
    categoriesByGroup: CATEGORIES_BY_GROUP,
    today: todayYmd(),
    formatBrl, formatDateShort, formatPaymentMethod,
  });
});

module.exports = router;
