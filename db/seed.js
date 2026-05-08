const { CATEGORIES_BY_GROUP } = require('../lib/categories');

function runSeeds(db) {
  db.exec(`
    INSERT OR IGNORE INTO users (email, role) VALUES ('sameque.santana@usepulso.org', 'master');
    INSERT OR IGNORE INTO users (email, role) VALUES ('rachel.moghrabi@usepulso.org', 'financeiro');

    INSERT OR IGNORE INTO settings (key, value) VALUES ('initial_cash_brl', '120000');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('include_initial_cash', '1');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('default_payment_tax_pct', '12');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('include_ads_in_runway', '1');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('include_receivables_in_projection', '0');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('pedrra_visible_scenario_ids', '[]');

    INSERT INTO scenarios (name, description, is_active)
    SELECT 'Base', 'Cenário inicial padrão', 1
    WHERE NOT EXISTS (SELECT 1 FROM scenarios);

    INSERT OR IGNORE INTO scenario_funnel (scenario_id)
    SELECT id FROM scenarios WHERE name = 'Base';
  `);

  const insertCat = db.prepare(`INSERT OR IGNORE INTO categories (name, group_name, display_order) VALUES (?, ?, ?)`);
  let order = 0;
  for (const [group, items] of Object.entries(CATEGORIES_BY_GROUP)) {
    for (const item of items) {
      insertCat.run(item, group, order++);
    }
  }
}

module.exports = { runSeeds };
