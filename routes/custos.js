const express = require('express');
const { requireAuth, requireTotp } = require('../lib/auth');

const router = express.Router();

router.get('/', requireAuth, requireTotp, (req, res) => {
  res.render('stub', { title: 'Custos e Vendas', user: req.user, phase: 'Fase 3' });
});

module.exports = router;
