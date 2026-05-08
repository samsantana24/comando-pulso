const auditDb = require('../db/queries/audit');
const { logError } = require('./log');

function audit(req, action, entityType, entityId, before, after) {
  const userEmail = (req && req.user && req.user.email) ? req.user.email : 'system';
  try {
    auditDb.log({
      userEmail,
      action,
      entityType,
      entityId,
      before: before === undefined ? null : before,
      after: after === undefined ? null : after,
    });
  } catch (err) {
    logError(req, err, { source: 'audit' });
  }
}

module.exports = { audit };
