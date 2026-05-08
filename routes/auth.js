const express = require('express');
const passport = require('passport');
const users = require('../db/queries/users');
const totp = require('../lib/totp');
const { requireAuth } = require('../lib/auth');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  const error = req.query.error || null;
  res.render('login', { error });
});

router.get('/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect('/login?error=' + encodeURIComponent('Login Google ainda não configurado (faltam credenciais no .env)'));
  }
  return passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })(req, res, next);
});

router.get(
  '/auth/google/callback',
  (req, res, next) => {
    passport.authenticate('google', (err, user, info) => {
      if (err) return res.redirect('/login?error=' + encodeURIComponent(err.message || 'Erro na autenticação'));
      if (!user) {
        const msg = info && info.message ? info.message : 'Login não autorizado';
        return res.redirect('/login?error=' + encodeURIComponent(msg));
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) return res.redirect('/login?error=' + encodeURIComponent('Falha ao iniciar sessão'));
        // Regenerar session ID após login bem-sucedido (defesa contra Session Fixation)
        req.session.regenerate((regenErr) => {
          if (regenErr) return res.redirect('/login?error=' + encodeURIComponent('Falha de sessão'));
          req.session.passport = { user: user.id };
          req.session.save((saveErr) => {
            if (saveErr) return res.redirect('/login?error=' + encodeURIComponent('Falha ao salvar sessão'));
            if (user.totp_enabled) {
              return res.redirect('/totp/verify');
            }
            return res.redirect('/totp/setup');
          });
        });
      });
    })(req, res, next);
  }
);

router.get('/totp/setup', requireAuth, async (req, res) => {
  if (req.user.totp_enabled) {
    return res.redirect('/');
  }
  let secretBase32 = req.session.pending_totp_secret;
  let otpauthUrl = req.session.pending_totp_otpauth;
  if (!secretBase32 || !otpauthUrl) {
    const generated = totp.generateSecret(req.user.email);
    secretBase32 = generated.base32;
    otpauthUrl = generated.otpauthUrl;
    req.session.pending_totp_secret = secretBase32;
    req.session.pending_totp_otpauth = otpauthUrl;
  }
  const qrDataUrl = await totp.generateQRCodeDataUrl(otpauthUrl);
  res.render('totp-setup', {
    user: req.user,
    secretBase32,
    qrDataUrl,
    error: req.query.error || null,
  });
});

router.post('/totp/setup', requireAuth, (req, res) => {
  if (req.user.totp_enabled) return res.redirect('/');
  const pendingSecret = req.session.pending_totp_secret;
  if (!pendingSecret) return res.redirect('/totp/setup');
  const ok = totp.verifyToken(pendingSecret, req.body.token);
  if (!ok) {
    return res.redirect('/totp/setup?error=' + encodeURIComponent('Código inválido. Tente de novo.'));
  }
  users.setTotpSecret(req.user.id, pendingSecret);
  users.enableTotp(req.user.id);
  delete req.session.pending_totp_secret;
  delete req.session.pending_totp_otpauth;
  req.session.totp_verified = true;
  res.redirect('/');
});

router.get('/totp/verify', requireAuth, (req, res) => {
  if (!req.user.totp_enabled) return res.redirect('/totp/setup');
  if (req.session.totp_verified) return res.redirect('/');
  res.render('totp-verify', { user: req.user, error: req.query.error || null });
});

router.post('/totp/verify', requireAuth, (req, res) => {
  if (!req.user.totp_enabled) return res.redirect('/totp/setup');
  const ok = totp.verifyToken(req.user.totp_secret, req.body.token);
  if (!ok) {
    return res.redirect('/totp/verify?error=' + encodeURIComponent('Código inválido. Tente de novo.'));
  }
  // Regenerar session ID após escalonamento de privilégio (TOTP verificado)
  const userId = req.user.id;
  req.session.regenerate((regenErr) => {
    if (regenErr) return res.redirect('/totp/verify?error=' + encodeURIComponent('Falha de sessão'));
    req.session.passport = { user: userId };
    req.session.totp_verified = true;
    req.session.save((saveErr) => {
      if (saveErr) return res.redirect('/totp/verify?error=' + encodeURIComponent('Falha ao salvar sessão'));
      res.redirect('/');
    });
  });
});

router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  });
});

module.exports = router;
