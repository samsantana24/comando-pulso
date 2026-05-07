# SCHEMA.md — Schema SQL do Banco de Dados

Banco SQLite único: `data.db` na raiz do projeto.

## ⚠️ REGRA ABSOLUTA DE PROTEÇÃO

**NUNCA** execute em nenhum script:
- `rm -f data.db`, `rm data.db`
- `DROP TABLE`, `DELETE FROM` sem WHERE específico, `TRUNCATE`

**Toda migração é exclusivamente aditiva:**
- `CREATE TABLE IF NOT EXISTS`
- `ALTER TABLE` com checagem prévia da coluna via `PRAGMA table_info`
- `CREATE INDEX IF NOT EXISTS`

---

## Tabelas

### users — usuários autenticados via Google OAuth

```sql
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
```

**Seed inicial** (idempotente, executado uma vez no boot):
```sql
INSERT OR IGNORE INTO users (email, role) VALUES ('sameque.santana@usepulso.org', 'master');
INSERT OR IGNORE INTO users (email, role) VALUES ('rachel.moghrabi@usepulso.org', 'financeiro');
```

---

### settings — configurações globais (key-value)

```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);
```

**Seed inicial** (idempotente):
```sql
INSERT OR IGNORE INTO settings (key, value) VALUES ('initial_cash_brl', '120000');
INSERT OR IGNORE INTO settings (key, value) VALUES ('include_initial_cash', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_payment_tax_pct', '12');
```

---

### team_members — time comercial (SDRs e Closers)

```sql
CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('sdr', 'closer')),
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

### scenarios — cenários hipotéticos

```sql
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
```

**Seed inicial** (idempotente, só cria se não houver nenhum cenário):
```sql
INSERT INTO scenarios (name, description, is_active)
SELECT 'Base', 'Cenário inicial padrão', 1
WHERE NOT EXISTS (SELECT 1 FROM scenarios);
```

---

### sales — vendas reais lançadas dia a dia

```sql
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

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
```

`date` em formato YYYY-MM-DD.
`payment_method` é livre (string), mas o frontend valida contra: `pix`, `cartao_avista`, `cartao_2x`, `cartao_6x`, `cartao_12x`, `outro`.

---

### recurrence_rules — regras de recorrência para custos

```sql
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
```

`pattern_value`: dia do mês (1-31) se `monthly_day`, ou número de semanas (1-N) se `every_n_weeks`.

---

### costs — custos individuais (pagos OU planejados)

```sql
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

CREATE INDEX IF NOT EXISTS idx_costs_date ON costs(date);
CREATE INDEX IF NOT EXISTS idx_costs_scenario ON costs(scenario_id);
CREATE INDEX IF NOT EXISTS idx_costs_status ON costs(status);
```

**Semântica do `scenario_id`:**
- `NULL` = custo da REALIDADE (visível em todos os cenários)
- valor preenchido = custo HIPOTÉTICO daquele cenário específico

**Semântica do `recurrence_id`:**
- `NULL` = lançamento avulso
- valor preenchido = ocorrência gerada por uma regra de recorrência (ON DELETE SET NULL preserva a ocorrência se a regra for excluída)

---

### scenario_funnel — estado do funil por cenário

```sql
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
```

Um único registro por cenário. Quando um cenário é criado, criar registro com defaults.

---

### scenario_team_performance — performance individual por cenário

```sql
CREATE TABLE IF NOT EXISTS scenario_team_performance (
  scenario_id INTEGER NOT NULL,
  team_member_id INTEGER NOT NULL,
  capacity_per_week REAL DEFAULT 0,
  conversion_pct REAL DEFAULT 0,
  PRIMARY KEY (scenario_id, team_member_id),
  FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE,
  FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
);
```

Para SDR: `capacity_per_week` = calls que ele agenda; `conversion_pct` = show rate (%).
Para Closer: `capacity_per_week` não usado; `conversion_pct` = % conversão call→venda.

---

### audit_log — log de todas as mudanças

```sql
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

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
```

`action` em uppercase: `CREATE`, `UPDATE`, `DELETE`, `ACTIVATE`, etc.
`entity_type`: `sale`, `cost`, `scenario`, `team_member`, `setting`, `recurrence`.
`before_value` e `after_value` são JSON serializado.

---

## Pragmas obrigatórios no boot

Em `db/connection.js`, ao abrir o banco:

```js
db.pragma('journal_mode = WAL');     // melhor concorrência leitura/escrita
db.pragma('foreign_keys = ON');      // habilita FK constraints
db.pragma('synchronous = NORMAL');   // balance entre durabilidade e perf
```

---

## Ordem de execução das migrations

1. Habilitar pragmas
2. CREATE TABLE users
3. CREATE TABLE settings
4. CREATE TABLE team_members
5. CREATE TABLE scenarios
6. CREATE TABLE sales (referencia team_members)
7. CREATE TABLE recurrence_rules (referencia scenarios)
8. CREATE TABLE costs (referencia scenarios e recurrence_rules)
9. CREATE TABLE scenario_funnel (referencia scenarios)
10. CREATE TABLE scenario_team_performance (referencia scenarios e team_members)
11. CREATE TABLE audit_log
12. Todos os CREATE INDEX
13. Seeds idempotentes (settings + users + cenário Base)

---

## Backup

Script `scripts/backup.js` deve copiar `data.db` (e `data.db-shm`, `data.db-wal` se existirem) para `/var/backups/comando-pulso/YYYY-MM-DD-HHMMSS.db`. Configurar cron diário na VPS:

```cron
0 3 * * * cd /var/www/comando-pulso && /usr/bin/node scripts/backup.js >> /var/log/comando-pulso-backup.log 2>&1
```

Manter os últimos 30 backups, deletar mais antigos automaticamente.

