const scenarios = require('../db/queries/scenarios');

function injectScenarios(req, res, next) {
  if (req.user) {
    try {
      res.locals.scenarios = scenarios.list();
      res.locals.activeScenario = scenarios.getActive();
    } catch (err) {
      res.locals.scenarios = [];
      res.locals.activeScenario = null;
    }
  }
  next();
}

module.exports = { injectScenarios };
