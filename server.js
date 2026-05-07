require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('passport');

const db = require('./db/connection');
const { configurePassport } = require('./lib/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));

app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.db', dir: __dirname, table: 'sessions' }),
    secret: process.env.SESSION_SECRET || 'dev_only_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7,
      sameSite: 'lax',
    },
  })
);

configurePassport();
app.use(passport.initialize());
app.use(passport.session());

const { injectScenarios } = require('./lib/locals');
app.use(injectScenarios);

app.use(require('./routes/auth'));
app.use('/api', require('./routes/api'));
app.use('/', require('./routes/index'));
app.use('/pedrra', require('./routes/pedrra'));
app.use('/custos', require('./routes/custos'));
app.use('/funil', require('./routes/funil'));
app.use('/configuracoes', require('./routes/configuracoes'));

app.use((req, res) => {
  res.status(404).render('error', { code: 404, message: 'Página não encontrada' });
});

app.use((err, req, res, next) => {
  console.error('[comando-pulso] erro:', err.stack || err.message);
  if (req.path && req.path.startsWith('/api/')) {
    return res.status(500).json({ error: err.message || 'erro interno' });
  }
  res.status(500).render('error', { code: 500, message: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`[comando-pulso] servidor ouvindo em http://localhost:${PORT}`);
  console.log(`[comando-pulso] banco: ${db.name}`);
});
