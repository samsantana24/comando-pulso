const express = require('express');
const { requireAuth, requireMaster, requireTotp } = require('../lib/auth');

const router = express.Router();

router.get('/', requireAuth, requireMaster, requireTotp, (req, res) => {
  res.render('stub', { title: 'Configurações', user: req.user, phase: 'Fase 7' });
});

module.exports = router;
