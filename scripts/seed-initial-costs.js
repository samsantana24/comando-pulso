const fs = require('fs');
const path = require('path');
const db = require('../db/connection');

const SEED_PATH = path.join(__dirname, '..', 'db', 'seeds', 'initial-costs.json');

function run() {
  const existing = db.prepare(`SELECT COUNT(*) AS c FROM costs WHERE from_initial_seed = 1`).get().c;
  if (existing > 0) {
    console.log(`[seed-initial-costs] já aplicado anteriormente (${existing} custo(s) com from_initial_seed=1). Abortando para evitar duplicação.`);
    process.exit(0);
  }

  if (!fs.existsSync(SEED_PATH)) {
    console.error(`[seed-initial-costs] arquivo não encontrado: ${SEED_PATH}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  } catch (err) {
    console.error(`[seed-initial-costs] erro ao parsear JSON: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.error(`[seed-initial-costs] esperado array, recebido ${typeof data}`);
    process.exit(1);
  }

  const insert = db.prepare(`
    INSERT INTO costs (date, amount, category, description, status, scenario_id, created_by, from_initial_seed)
    VALUES (?, ?, ?, ?, 'planned', NULL, 'seed-initial', 1)
  `);

  const tx = db.transaction(() => {
    let total = 0;
    let count = 0;
    for (const item of data) {
      if (!item.date || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
        console.warn(`[seed-initial-costs] item ignorado (date inválida): ${JSON.stringify(item)}`);
        continue;
      }
      const amount = Number(item.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        console.warn(`[seed-initial-costs] item ignorado (amount inválido): ${JSON.stringify(item)}`);
        continue;
      }
      if (!item.category) {
        console.warn(`[seed-initial-costs] item ignorado (category vazia): ${JSON.stringify(item)}`);
        continue;
      }
      insert.run(item.date, amount, item.category, item.description || null);
      total += amount;
      count++;
    }
    return { count, total };
  });

  const { count, total } = tx();
  console.log(`[seed-initial-costs] OK. ${count} custo(s) inserido(s). Total: R$ ${total.toFixed(2)}.`);
}

run();
