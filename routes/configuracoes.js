const router = require('express').Router();
const { requireAuth, requireMaster, requireTotp, requireNav } = require('../lib/auth');
const settings = require('../db/queries/settings');
const team = require('../db/queries/team');
const audit = require('../db/queries/audit');
const categories = require('../db/queries/categories');
const { GROUP_ORDER } = require('../lib/categories');
const { listForRole, PERM_CATALOG } = require('../lib/permissions');

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

  const rachelPerms = listForRole('financeiro');
  const permsByGroup = {};
  for (const p of rachelPerms) {
    if (!permsByGroup[p.group]) permsByGroup[p.group] = [];
    permsByGroup[p.group].push(p);
  }

  res.render('configuracoes', {
    title: 'Configurações',
    user: req.user,
    userCan: res.locals.userCan,
    settings: settings.getAll(),
    team: team.list({ activeOnly: false }),
    auditEntries: audit.list(100),
    categoriesGrouped: grouped,
    orderedGroups,
    groupOrder: GROUP_ORDER,
    permsByGroup,
    permGroupOrder: ['Navegação', 'Vendas', 'Custos', 'Ads', 'Visualização'],
  });
});

module.exports = router;
