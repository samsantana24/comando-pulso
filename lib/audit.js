const auditDb = require('../db/queries/audit');

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
    console.error('[audit] erro ao registrar:', err.message);
  }
}

module.exports = { audit };
