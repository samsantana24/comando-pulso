const router = require('express').Router();
const { requireAuth, requireMaster, requireTotp } = require('../lib/auth');
const cashflow = require('../lib/cashflow');
const scenarios = require('../db/queries/scenarios');
const receivables = require('../db/queries/receivables');
const settings = require('../db/queries/settings');
const { todayYmd, ymd } = require('../lib/weeks');

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
  const adsCurrentWeek = currentWeek ? (Number(currentWeek.ads_paid || 0) + Number(currentWeek.ads_planned || 0)) : 0;

  const today = todayYmd();
  const horizon7 = ymd(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const upcomingReceivables = receivables.list({ status: 'pending', from: today, to: horizon7 });
  const upcomingTotal = upcomingReceivables.reduce((a, r) => a + Number(r.expected_amount || 0), 0);

  let visibleScenarioIds = [];
  try {
    const raw = settings.get('pedrra_visible_scenario_ids');
    visibleScenarioIds = JSON.parse(raw || '[]');
    if (!Array.isArray(visibleScenarioIds)) visibleScenarioIds = [];
  } catch (_) { visibleScenarioIds = []; }

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
    adsCurrentWeek,
    upcomingReceivables,
    upcomingReceivablesTotal: upcomingTotal,
    visibleScenarioIds,
  });
});

module.exports = router;
