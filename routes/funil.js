const router = require('express').Router();
const { requireAuth, requireTotp, requireNav } = require('../lib/auth');
const team = require('../db/queries/team');
const funnel = require('../db/queries/funnel');
const scenarios = require('../db/queries/scenarios');

router.get('/', requireAuth, requireNav('nav.funil'), requireTotp, (req, res) => {
  const active = scenarios.getActive();
  if (!active) {
    return res.render('error', { code: 400, message: 'Nenhum cenário ativo. Crie ou ative um cenário pelo header.' });
  }
  const funnelData = funnel.getByScenario(active.id) || {
    ads_per_week: 0, cpl: 0, rebarba_sb_per_week: 0,
    show_rate_pct: 70, call_to_sale_pct: 25, forecast_bonus_pct: 5,
    ticket_avg: 10000, payment_tax_pct: 12,
  };
  const teamPerf = funnel.getTeamPerformance(active.id);
  const teamPerfMap = Object.fromEntries(teamPerf.map((p) => [p.team_member_id, p]));

  const sdrs = team.list({ role: 'sdr' });
  const closers = team.list({ role: 'closer' });

  function joinPerf(member) {
    const p = teamPerfMap[member.id];
    return {
      ...member,
      capacity_per_week: p ? p.capacity_per_week : 0,
      conversion_pct: p ? p.conversion_pct : (member.role === 'sdr' ? 70 : 25),
    };
  }

  const evolutiveEnabled = !!active.evolutive_funnel_enabled;
  const evolutiveWeeks = Number(active.evolutive_funnel_weeks) || 12;
  const funnelWeekly = evolutiveEnabled ? funnel.getWeeklyForScenario(active.id) : [];
  const teamWeekly = evolutiveEnabled ? funnel.getTeamWeeklyForScenario(active.id) : [];

  res.render('funil', {
    title: 'Funil',
    user: req.user,
    userCan: res.locals.userCan,
    activeScenario: active,
    funnel: funnelData,
    sdrs: sdrs.map(joinPerf),
    closers: closers.map(joinPerf),
    evolutiveEnabled,
    evolutiveWeeks,
    funnelWeekly,
    teamWeekly,
    allTeam: [...sdrs, ...closers],
  });
});

module.exports = router;
