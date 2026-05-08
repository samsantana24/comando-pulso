function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      google_id TEXT UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('master', 'financeiro')),
      totp_secret TEXT,
      totp_enabled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('sdr', 'closer')),
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 0,
      color TEXT DEFAULT '#2DD4BF',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      gross_amount REAL NOT NULL,
      net_amount REAL NOT NULL,
      client_name TEXT,
      closer_id INTEGER,
      payment_method TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      FOREIGN KEY (closer_id) REFERENCES team_members(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS recurrence_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL CHECK(pattern IN ('monthly_day', 'every_n_weeks')),
      pattern_value INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      base_amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      scenario_id INTEGER,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK(status IN ('paid', 'planned')) DEFAULT 'planned',
      recurrence_id INTEGER,
      scenario_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE,
      FOREIGN KEY (recurrence_id) REFERENCES recurrence_rules(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS scenario_funnel (
      scenario_id INTEGER PRIMARY KEY,
      ads_per_week REAL DEFAULT 0,
      cpl REAL DEFAULT 0,
      rebarba_sb_per_week INTEGER DEFAULT 0,
      show_rate_pct REAL DEFAULT 70,
      call_to_sale_pct REAL DEFAULT 25,
      forecast_bonus_pct REAL DEFAULT 5,
      ticket_avg REAL DEFAULT 10000,
      payment_tax_pct REAL DEFAULT 12,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scenario_team_performance (
      scenario_id INTEGER NOT NULL,
      team_member_id INTEGER NOT NULL,
      capacity_per_week REAL DEFAULT 0,
      conversion_pct REAL DEFAULT 0,
      PRIMARY KEY (scenario_id, team_member_id),
      FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE,
      FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      before_value TEXT,
      after_value TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      group_name TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS receivables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      expected_date TEXT NOT NULL,
      expected_amount REAL NOT NULL,
      payment_method TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'received', 'cancelled')) DEFAULT 'pending',
      client_name TEXT,
      notes TEXT,
      received_date TEXT,
      received_sale_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
      FOREIGN KEY (received_sale_id) REFERENCES sales(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
    CREATE INDEX IF NOT EXISTS idx_costs_date ON costs(date);
    CREATE INDEX IF NOT EXISTS idx_costs_scenario ON costs(scenario_id);
    CREATE INDEX IF NOT EXISTS idx_costs_status ON costs(status);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_categories_group ON categories(group_name);
    CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active);
    CREATE INDEX IF NOT EXISTS idx_receivables_expected_date ON receivables(expected_date);
    CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);
  `);

  addColumnIfMissing(db, 'costs', 'is_ads', 'INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'costs', 'from_initial_seed', 'INTEGER DEFAULT 0');
  db.exec(`CREATE INDEX IF NOT EXISTS idx_costs_is_ads ON costs(is_ads);`);
}

function addColumnIfMissing(db, table, columnName, columnDef) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = cols.some((c) => c.name === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnName} ${columnDef}`);
  }
}

module.exports = { runMigrations };
