const db = require('../connection');

const stmts = {
  getById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  getByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
  getByGoogleId: db.prepare(`SELECT * FROM users WHERE google_id = ?`),
  list: db.prepare(`SELECT * FROM users ORDER BY created_at`),
  setGoogleProfile: db.prepare(`
    UPDATE users SET google_id = ?, name = ? WHERE email = ?
  `),
  updateLastLogin: db.prepare(`
    UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?
  `),
  setTotpSecret: db.prepare(`
    UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?
  `),
  enableTotp: db.prepare(`
    UPDATE users SET totp_enabled = 1 WHERE id = ?
  `),
  disableTotp: db.prepare(`
    UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?
  `),
};

module.exports = {
  getById: (id) => stmts.getById.get(id),
  getByEmail: (email) => stmts.getByEmail.get(email),
  getByGoogleId: (googleId) => stmts.getByGoogleId.get(googleId),
  list: () => stmts.list.all(),
  setGoogleProfile: (email, googleId, name) => stmts.setGoogleProfile.run(googleId, name, email),
  updateLastLogin: (id) => stmts.updateLastLogin.run(id),
  setTotpSecret: (id, secret) => stmts.setTotpSecret.run(secret, id),
  enableTotp: (id) => stmts.enableTotp.run(id),
  disableTotp: (id) => stmts.disableTotp.run(id),
};
