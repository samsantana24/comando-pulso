const router = require('express').Router();
const audit = require('../../db/queries/audit');
const { requireMaster } = require('../../lib/auth');

router.get('/', requireMaster, (req, res) => {
  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
  res.json(audit.list(limit));
});

module.exports = router;
