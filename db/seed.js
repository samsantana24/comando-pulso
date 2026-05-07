function runSeeds(db) {
  db.exec(`
    INSERT OR IGNORE INTO users (email, role) VALUES ('sameque.santana@usepulso.org', 'master');
    INSERT OR IGNORE INTO users (email, role) VALUES ('rachel.moghrabi@usepulso.org', 'financeiro');

    INSERT OR IGNORE INTO settings (key, value) VALUES ('initial_cash_brl', '120000');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('include_initial_cash', '1');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('default_payment_tax_pct', '12');

    INSERT INTO scenarios (name, description, is_active)
    SELECT 'Base', 'Cenário inicial padrão', 1
    WHERE NOT EXISTS (SELECT 1 FROM scenarios);

    INSERT OR IGNORE INTO scenario_funnel (scenario_id)
    SELECT id FROM scenarios WHERE name = 'Base';
  `);
}

module.exports = { runSeeds };
