const router = require('express').Router();
const { requireAuth, requireMaster, requireTotp } = require('../lib/auth');
const settings = require('../db/queries/settings');
const team = require('../db/queries/team');
const audit = require('../db/queries/audit');
const { CATEGORIES_BY_GROUP } = require('../lib/categories');

router.get('/', requireAuth, requireMaster, requireTotp, (req, res) => {
  res.render('configuracoes', {
    title: 'Configurações',
    user: req.user,
    settings: settings.getAll(),
    team: team.list({ activeOnly: false }),
    auditEntries: audit.list(100),
    categoriesByGroup: CATEGORIES_BY_GROUP,
  });
});

module.exports = router;
