const db = require('../db/connection');

const PERM_CATALOG = [
  { key: 'nav.pedrra', group: 'Navegação', label: 'Acessar aba PEDRRA' },
  { key: 'nav.custos', group: 'Navegação', label: 'Acessar aba Custos e Vendas' },
  { key: 'nav.funil', group: 'Navegação', label: 'Acessar aba Funil' },
  { key: 'nav.configuracoes', group: 'Navegação', label: 'Acessar aba Configurações' },

  { key: 'action.add_sale', group: 'Vendas', label: 'Adicionar venda' },
  { key: 'action.edit_sale', group: 'Vendas', label: 'Editar venda existente' },
  { key: 'action.delete_sale', group: 'Vendas', label: 'Excluir venda' },

  { key: 'action.add_cost', group: 'Custos', label: 'Adicionar custo' },
  { key: 'action.edit_cost', group: 'Custos', label: 'Editar custo existente' },
  { key: 'action.delete_cost', group: 'Custos', label: 'Excluir custo' },
  { key: 'action.add_recurring_cost', group: 'Custos', label: 'Adicionar custo recorrente' },

  { key: 'action.add_ads', group: 'Ads', label: 'Adicionar investimento em ads' },
  { key: 'action.edit_ads', group: 'Ads', label: 'Editar investimento em ads' },
  { key: 'action.delete_ads', group: 'Ads', label: 'Excluir investimento em ads' },

  { key: 'view.kpi_caixa', group: 'Visualização', label: 'Ver Caixa Hoje (KPI)' },
  { key: 'view.runway', group: 'Visualização', label: 'Ver Runway (KPI)' },
  { key: 'view.audit_log', group: 'Visualização', label: 'Ver log de auditoria' },
];

const PERM_KEYS = new Set(PERM_CATALOG.map((p) => p.key));

const stmts = {
  getOne: db.prepare(`SELECT allowed FROM permissions WHERE role = ? AND perm_key = ?`),
  getAllForRole: db.prepare(`SELECT perm_key, allowed FROM permissions WHERE role = ?`),
  upsert: db.prepare(`
    INSERT INTO permissions (role, perm_key, allowed, updated_by, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(role, perm_key) DO UPDATE SET
      allowed = excluded.allowed,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `),
};

function userCan(user, key) {
  if (!user) return false;
  if (user.role === 'master') return true;
  if (!PERM_KEYS.has(key)) return false;
  const row = stmts.getOne.get(user.role, key);
  return !!(row && row.allowed === 1);
}

function listForRole(role) {
  const map = {};
  for (const r of stmts.getAllForRole.all(role)) map[r.perm_key] = r.allowed;
  return PERM_CATALOG.map((p) => ({
    key: p.key,
    label: p.label,
    group: p.group,
    allowed: map[p.key] === 1,
  }));
}

const setMany = db.transaction((role, updates, updatedBy) => {
  for (const { key, allowed } of updates) {
    if (!PERM_KEYS.has(key)) continue;
    stmts.upsert.run(role, key, allowed ? 1 : 0, updatedBy || null);
  }
});

function requirePerm(key) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'não autenticado' });
    if (userCan(req.user, key)) return next();
    return res.status(403).json({ error: 'sem permissão para ' + key });
  };
}

module.exports = { PERM_CATALOG, PERM_KEYS, userCan, listForRole, setMany, requirePerm };
