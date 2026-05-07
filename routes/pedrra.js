const router = require('express').Router();
const { requireAuth, requireMaster, requireTotp } = require('../lib/auth');
const cashflow = require('../lib/cashflow');
const scenarios = require('../db/queries/scenarios');

router.get('/', requireAuth, requireMaster, requireTotp, (req, res) => {
  const active = scenarios.getActive();
  const data = cashflow.getWeeklyCashflow({
    pastWeeks: 1,
    futureWeeks: 2,
    scenarioId: active ? active.id : null,
  });
  const runway = cashflow.getRunway(active ? active.id : null);

  const lastWeek = data.series.find((s) => s.is_past) || null;
  const currentWeek = data.series.find((s) => s.is_current) || null;
  const futureSeries = data.series.filter((s) => s.is_future);
  const proj2 = futureSeries.slice(0, 2).reduce((a, s) => a + s.week_delta, 0);

  res.render('pedrra', {
    title: 'PEDRRA',
    user: req.user,
    activeScenario: active,
    cashflow: data,
    cashToday: data.cash_today,
    runway,
    lastWeekResult: lastWeek ? lastWeek.week_delta : 0,
    currentWeekResult: currentWeek ? currentWeek.week_delta : 0,
    projection2Weeks: proj2,
  });
});

module.exports = router;
