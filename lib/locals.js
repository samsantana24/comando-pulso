const scenarios = require('../db/queries/scenarios');
const settings = require('../db/queries/settings');
const { formatBrl, formatDateShort, formatPaymentMethod, parseParcel } = require('./format');
const { userCan } = require('./permissions');

function injectLocals(req, res, next) {
  if (req.user) {
    try {
      res.locals.scenarios = scenarios.list();
      res.locals.activeScenario = scenarios.getActive();
    } catch (err) {
      res.locals.scenarios = [];
      res.locals.activeScenario = null;
    }
    try {
      const raw = settings.get('pedrra_visible_scenario_ids') || '[]';
      const parsed = JSON.parse(raw);
      res.locals.visibleScenarioIds = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      res.locals.visibleScenarioIds = [];
    }
  }
  res.locals.formatBrl = formatBrl;
  res.locals.formatDateShort = formatDateShort;
  res.locals.formatPaymentMethod = formatPaymentMethod;
  res.locals.parseParcel = parseParcel;
  res.locals.currentPath = req.path;
  res.locals.user = req.user || null;
  res.locals.userCan = (key) => userCan(req.user, key);
  next();
}

module.exports = { injectLocals, injectScenarios: injectLocals };
