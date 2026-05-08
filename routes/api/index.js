const router = require('express').Router();
const { requireAuth, requireTotp } = require('../../lib/auth');

router.use(requireAuth, requireTotp);

router.use('/sales', require('./sales'));
router.use('/costs', require('./costs'));
router.use('/recurrences', require('./recurrences'));
router.use('/team', require('./team'));
router.use('/scenarios', require('./scenarios'));
router.use('/funnel', require('./funnel'));
router.use('/cashflow', require('./cashflow'));
router.use('/settings', require('./settings'));
router.use('/audit', require('./audit'));
router.use('/export', require('./export'));
router.use('/categories', require('./categories'));
router.use('/ads-week', require('./ads-week'));
router.use('/receivables', require('./receivables'));

router.use((req, res) => res.status(404).json({ error: 'endpoint não encontrado' }));

router.use((err, req, res, next) => {
  console.error('[api] erro:', err);
  res.status(500).json({ error: err.message || 'erro interno' });
});

module.exports = router;
