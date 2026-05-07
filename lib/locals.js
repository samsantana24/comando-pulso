const scenarios = require('../db/queries/scenarios');
const { formatBrl, formatDateShort, formatPaymentMethod } = require('./format');

function injectLocals(req, res, next) {
  if (req.user) {
    try {
      res.locals.scenarios = scenarios.list();
      res.locals.activeScenario = scenarios.getActive();
    } catch (err) {
      res.locals.scenarios = [];
      res.locals.activeScenario = null;
    }
  }
  res.locals.formatBrl = formatBrl;
  res.locals.formatDateShort = formatDateShort;
  res.locals.formatPaymentMethod = formatPaymentMethod;
  next();
}

module.exports = { injectLocals, injectScenarios: injectLocals };
