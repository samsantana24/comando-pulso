const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const users = require('../db/queries/users');

function configurePassport() {
  const allowedDomain = (process.env.ALLOWED_DOMAIN || 'usepulso.org').toLowerCase();

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => {
    try {
      const u = users.getById(id);
      if (!u) return done(null, false);
      done(null, u);
    } catch (err) {
      done(err);
    }
  });

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('[comando-pulso] AVISO: GOOGLE_CLIENT_ID/SECRET ausentes — login Google não vai funcionar até preencher .env');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      (accessToken, refreshToken, profile, done) => {
        try {
          const email = (profile.emails && profile.emails[0] && profile.emails[0].value || '').toLowerCase();
          if (!email || !email.endsWith('@' + allowedDomain)) {
            return done(null, false, { message: 'Domínio não autorizado' });
          }
          const existing = users.getByEmail(email);
          if (!existing) {
            return done(null, false, { message: 'Email não cadastrado no Comando Pulso' });
          }
          users.setGoogleProfile(email, profile.id, profile.displayName || existing.name || email);
          users.updateLastLogin(existing.id);
          const fresh = users.getByEmail(email);
          return done(null, fresh);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.redirect('/login');
}

function requireMaster(req, res, next) {
  if (!req.user) return res.redirect('/login');
  if (req.user.role !== 'master') return res.redirect('/custos');
  return next();
}

function requireTotp(req, res, next) {
  if (!req.user) return res.redirect('/login');
  if (req.user.totp_enabled && !req.session.totp_verified) {
    return res.redirect('/totp/verify');
  }
  if (!req.user.totp_enabled) {
    return res.redirect('/totp/setup');
  }
  return next();
}

module.exports = { configurePassport, requireAuth, requireMaster, requireTotp };
