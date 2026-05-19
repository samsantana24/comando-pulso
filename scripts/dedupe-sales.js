// Script de dedup de vendas duplicadas (legado do bug do form-venda
// com double-bind). Detecta vendas com mesmo (date, client_name,
// gross_amount, net_amount, payment_method, closer_id) e remove as
// duplicatas AVULSAS (sem recebíveis vinculados), preservando:
//   1) primeiro a venda que TEM recebíveis (origem de venda parcelada),
//   2) se nenhuma do grupo tem recebíveis, a de menor id (mais antiga).
//
// Uso:
//   node scripts/dedupe-sales.js              # dry-run (só mostra)
//   node scripts/dedupe-sales.js --apply      # executa
//
// Faz audit_log de cada deleção. Toda DELETE com WHERE id IN (...)
// explícito — respeita a regra de nunca apagar sem WHERE específico.

const path = require('path');
const db = require(path.join(__dirname, '..', 'db', 'connection'));

const APPLY = process.argv.includes('--apply');

function fmtBrl(n) {
  return Number(n || 0).toFixed(2);
}

function findGroups() {
  const all = db.prepare(`
    SELECT s.id, s.date, s.client_name, s.gross_amount, s.net_amount,
           s.payment_method, s.closer_id, s.notes, s.created_at,
           (SELECT COUNT(*) FROM receivables WHERE sale_id = s.id) AS recv_count
    FROM sales s
    ORDER BY s.date DESC, s.id ASC
  `).all();

  const groups = new Map();
  for (const s of all) {
    const key = JSON.stringify([
      s.date,
      (s.client_name || '').trim().toLowerCase(),
      Number(s.gross_amount).toFixed(2),
      Number(s.net_amount).toFixed(2),
      s.payment_method || '',
      s.closer_id || 0,
    ]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const dups = [];
  for (const [, list] of groups) {
    if (list.length > 1) dups.push(list);
  }
  return dups;
}

function pickKeeper(group) {
  const withRecv = group.filter((s) => s.recv_count > 0);
  if (withRecv.length > 0) {
    withRecv.sort((a, b) => a.id - b.id);
    return withRecv[0];
  }
  const sorted = [...group].sort((a, b) => a.id - b.id);
  return sorted[0];
}

function main() {
  const dups = findGroups();
  if (dups.length === 0) {
    console.log('Nenhum grupo de vendas duplicadas encontrado. Nada a fazer.');
    process.exit(0);
  }

  let totalToRemove = 0;
  const removalIds = [];
  console.log('\n=== Grupos de vendas duplicadas ===\n');
  for (const group of dups) {
    const keeper = pickKeeper(group);
    const toRemove = group.filter((s) => s.id !== keeper.id);
    console.log(`Grupo (${group.length} vendas) — ${group[0].date} · ${group[0].client_name || '(sem cliente)'} · líq R$ ${fmtBrl(group[0].net_amount)}`);
    console.log(`  ✓ MANTÉM  #${keeper.id}  (recv_count=${keeper.recv_count}, created_at=${keeper.created_at})`);
    for (const s of toRemove) {
      console.log(`  ✗ REMOVE  #${s.id}  (recv_count=${s.recv_count}, created_at=${s.created_at})`);
      removalIds.push(s.id);
      totalToRemove++;
    }
    console.log('');
  }
  console.log(`Total a remover: ${totalToRemove} venda(s) em ${dups.length} grupo(s).`);

  if (!APPLY) {
    console.log('\nDRY-RUN. Rode novamente com --apply pra executar.');
    process.exit(0);
  }

  console.log('\n=== APLICANDO ===\n');
  const tx = db.transaction(() => {
    const insertAudit = db.prepare(`
      INSERT INTO audit_log (user_email, action, entity_type, entity_id, before_value, after_value)
      VALUES ('system:dedupe-sales', 'DELETE', 'sale', ?, ?, NULL)
    `);
    const getSale = db.prepare(`SELECT * FROM sales WHERE id = ?`);
    const deleteOne = db.prepare(`DELETE FROM sales WHERE id = ?`);
    let removed = 0;
    for (const id of removalIds) {
      const before = getSale.get(id);
      if (!before) continue;
      insertAudit.run(id, JSON.stringify(before));
      deleteOne.run(id);
      removed++;
    }
    return removed;
  });
  const removed = tx();
  console.log(`Removidas ${removed} venda(s).`);
}

main();
