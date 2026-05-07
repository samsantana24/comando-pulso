const express = require('express');
const { requireAuth, requireTotp } = require('../lib/auth');

const router = express.Router();

router.get('/', requireAuth, requireTotp, (req, res) => {
  if (req.user.role === 'master') return res.redirect('/pedrra');
  return res.redirect('/custos');
});

module.exports = router;
