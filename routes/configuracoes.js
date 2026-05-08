const router = require('express').Router();
const { requireAuth, requireMaster, requireTotp } = require('../lib/auth');
const settings = require('../db/queries/settings');
const team = require('../db/queries/team');
const audit = require('../db/queries/audit');
const categories = require('../db/queries/categories');
const { GROUP_ORDER } = require('../lib/categories');

router.get('/', requireAuth, requireMaster, requireTotp, (req, res) => {
  const cats = categories.list();
  const grouped = {};
  for (const c of cats) {
    if (!grouped[c.group_name]) grouped[c.group_name] = [];
    grouped[c.group_name].push(c);
  }
  const orderedGroups = GROUP_ORDER.filter((g) => grouped[g] && grouped[g].length > 0);
  for (const g of Object.keys(grouped)) {
    if (!orderedGroups.includes(g)) orderedGroups.push(g);
  }

  res.render('configuracoes', {
    title: 'Configurações',
    user: req.user,
    settings: settings.getAll(),
    team: team.list({ activeOnly: false }),
    auditEntries: audit.list(100),
    categoriesGrouped: grouped,
    orderedGroups,
    groupOrder: GROUP_ORDER,
  });
});

module.exports = router;
