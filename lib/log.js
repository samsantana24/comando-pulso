const isProduction = process.env.NODE_ENV === 'production';

function ctxFromReq(req) {
  if (!req) return {};
  return {
    route: req.path,
    method: req.method,
    user: req.user && req.user.email,
  };
}

function logError(req, err, extra = {}) {
  const msg = err && err.message ? err.message : String(err);
  if (isProduction) {
    console.error(JSON.stringify({
      level: 'error',
      ts: new Date().toISOString(),
      ...ctxFromReq(req),
      msg,
      stack: err && err.stack ? err.stack : undefined,
      ...extra,
    }));
  } else {
    const tag = req ? '[' + (req.method || '?') + ' ' + (req.path || '?') + ']' : '[error]';
    console.error(tag, msg);
    if (err && err.stack) console.error(err.stack);
  }
}

function logWarn(req, msg, extra = {}) {
  if (isProduction) {
    console.warn(JSON.stringify({
      level: 'warn',
      ts: new Date().toISOString(),
      ...ctxFromReq(req),
      msg,
      ...extra,
    }));
  } else {
    const tag = req ? '[' + (req.method || '?') + ' ' + (req.path || '?') + ']' : '[warn]';
    console.warn(tag, msg, Object.keys(extra).length ? extra : '');
  }
}

module.exports = { logError, logWarn };
