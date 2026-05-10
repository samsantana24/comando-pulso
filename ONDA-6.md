# ONDA 6 — Funil evolutivo + Caixa real completo

Esta onda fecha 2 grandes frentes:

**FRENTE 1 — Caixa real completo:** terminar a ONDA 5 que parou na Fase A (custos parcelados). Fazer Fases B (pago/a pagar lado a lado), C (recebíveis premium), D (UI das parcelas), E (export XLSX/CSV).

**FRENTE 2 — Funil evolutivo:** transformar o /funil de "configuração estática" em "timeline de N semanas evolutivas" que o PEDRRA consome semana a semana.

---

## 0. ANTES DE COMEÇAR — CONFIRMAÇÕES OBRIGATÓRIAS

1. Confirme em uma frase que entendeu o pedido global
2. Leia o documento INTEIRO antes de tocar em qualquer arquivo
3. **Working tree limpa.** `git status` deve mostrar nothing to commit.
4. **Último commit deve ser** `6b4311a feat(custos): modal 'Todos os custos futuros' com filtros e edicao`. Se divergir, PARE.
5. **Branch:** main

**Regras de processo (não-negociáveis após o histórico desta semana):**

- **1 commit por fase.** Sem juntar fases.
- **PAUSE ao fim de cada fase** e me avise pra eu validar antes de seguir.
- **Migrations 100% aditivas** — `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE` com check via `PRAGMA table_info`. Nunca destrutivo.
- **Não invente.** Se algo estiver ambíguo, PARE e pergunte.
- **Nada fora de escopo.** Se durante o trabalho você ver algo que poderia melhorar e não está no documento, REPORTE em vez de mexer.
- **Mensagens de commit em PT-BR.**
- **NÃO faça push** até a Fase J (final). Acumula commits localmente.
- Se sandbox bloquear `npm start`, **AVISE explicitamente**.

**Ordem de execução:**
- Frente 1 (ONDA 5 finalização): Fases B → C → D → E
- Frente 2 (Funil evolutivo): Fases F → G → H → I
- Validação final: Fase J

São **9 fases sequenciais**, ~9 commits.

---

# FRENTE 1 — Caixa real completo (Fases B–E)

## FASE B — Tabela /custos com colunas Pago vs A pagar lado a lado

### Contexto

Hoje a tabela `weekly-grid` em `/custos` mostra 1 célula por semana com soma única (paid + planned misturados). A planilha de conciliação da Rachel separa **Previsto** (A pagar) de **Realizado** (Pago) lado a lado por semana. Vamos espelhar isso.

### B.1 — Estrutura nova: 2 sub-colunas por semana

Em `views/custos.ejs`, refatorar `<table class="weekly-grid">`:

```html
<table class="weekly-grid weekly-grid-split">
  <thead>
    <tr class="week-row">
      <th rowspan="2" class="cat-col">Categoria</th>
      <% for (const w of weeks) { %>
        <th colspan="2" class="week-h <%= w.is_current ? 'current' : '' %>">
          <div class="week-label"><%= w.label %></div>
          <div class="week-id"><%= w.week_id %></div>
        </th>
      <% } %>
    </tr>
    <tr class="status-row">
      <% for (const w of weeks) { %>
        <th class="status-h paid-h">PAGO</th>
        <th class="status-h planned-h">A PAGAR</th>
      <% } %>
    </tr>
  </thead>
  <tbody>
    <!-- linhas geradas conforme B.2 -->
  </tbody>
</table>
```

### B.2 — Lógica de cálculo em `routes/custos.js`

Reescrever o bloco de agregação. Hoje gera `costsByGroup[grp][cat][weekId] = soma`. Vai gerar:

```js
// Antes:
//   costsByGroup[grp][cat][weekId] = soma
//   subtotalByGroupWeek[grp][weekId] = soma
//   adsByWeek[weekId] = soma
// Depois:
//   costsByGroupPaid[grp][cat][weekId]    = soma de status=paid
//   costsByGroupPlanned[grp][cat][weekId] = soma de status=planned
//   subtotalByGroupPaid[grp][weekId]
//   subtotalByGroupPlanned[grp][weekId]
//   adsPaidByWeek[weekId]
//   adsPlannedByWeek[weekId]
//   salesRealByWeek[weekId]
//   balanceByWeek[weekId] = { paid: ..., planned: ..., total: ... }
```

A iteração dos custos no `for (const c of nonAdsCosts)` deve splittar por `c.status === 'paid'` ou `'planned'`. Mesma coisa pra ads.

Vendas não têm distinção paid/planned (toda venda é "real"). Pra coerência visual: na linha "Vendas (real)", a sub-coluna "PAGO" mostra o valor, "A PAGAR" mostra `—`. Em `salesRealByWeek` já estão todas como real.

### B.3 — Renderização das linhas

Cada linha de custo individual (dentro de um grupo) renderiza 2 células por semana:

```ejs
<% for (const w of weeks) { %>
  <% const paidVal = (costsByGroupPaid[group] && costsByGroupPaid[group][cat] && costsByGroupPaid[group][cat][w.week_id]) || 0; %>
  <% const plannedVal = (costsByGroupPlanned[group] && costsByGroupPlanned[group][cat] && costsByGroupPlanned[group][cat][w.week_id]) || 0; %>
  <td class="num cell-paid <%= paidVal > 0 ? 'has-value' : '' %>">
    <%= paidVal > 0 ? formatBrl(paidVal) : '—' %>
  </td>
  <td class="num cell-planned <%= plannedVal > 0 ? 'has-value' : '' %>">
    <%= plannedVal > 0 ? formatBrl(plannedVal) : '—' %>
  </td>
<% } %>
```

Aplicar o mesmo padrão pra:
- Linha de subtotal por grupo
- Linha de Ads (paid e planned)
- Linha de saldo da semana

### B.4 — CSS novo

Adicionar ao final de `public/css/app.css`, em seção marcada `/* === Tabela split paid/planned === */`:

```css
.weekly-grid-split {
  font-variant-numeric: tabular-nums;
}
.weekly-grid-split thead th.status-h {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.015);
  border-bottom: 1px solid var(--line);
}
.weekly-grid-split thead th.paid-h { color: var(--pos); }
.weekly-grid-split thead th.planned-h { color: var(--warn); }
.weekly-grid-split thead th.week-h {
  border-bottom: 1px solid var(--line);
  text-align: center;
}
.weekly-grid-split td.cell-paid {
  background: rgba(34, 197, 94, 0.025);
  border-right: 1px solid rgba(255, 255, 255, 0.04);
  text-align: right;
  padding: 10px 12px;
}
.weekly-grid-split td.cell-planned {
  background: rgba(255, 165, 0, 0.025);
  text-align: right;
  padding: 10px 12px;
  border-right: 1px solid var(--line);
}
.weekly-grid-split td.cell-paid.has-value { color: var(--pos); font-weight: 600; }
.weekly-grid-split td.cell-planned.has-value { color: var(--warn); font-weight: 600; }
.weekly-grid-split tr.row-saldo td.cell-paid.has-value.pos { color: var(--pos); }
.weekly-grid-split tr.row-saldo td.cell-paid.has-value.neg { color: var(--neg); }
```

### B.5 — Botões de ação por célula

Em cada célula `.cell-planned.has-value`, adicionar botões de ação inline (ocultos, aparecem no hover da célula):

```html
<td class="num cell-planned has-value">
  <span class="cell-value"><%= formatBrl(plannedVal) %></span>
  <% if (userCan('action.edit_cost')) { %>
    <span class="cell-actions">
      <button type="button" class="cell-action-btn pay" data-action="mark-paid"
              data-week="<%= w.week_id %>" data-category="<%= cat %>" data-group="<%= group %>"
              title="Marcar como pago">✓</button>
    </span>
  <% } %>
</td>
```

**Importante:** isso é por *célula agregada* (soma de N custos individuais daquela categoria naquela semana). Marcar como pago vai abrir modal listando os N custos individuais e o user escolhe quais marcar — ou tem botão "marcar todos os X custos como pago".

CSS:

```css
.cell-actions { display: none; margin-left: 6px; }
.cell-paid:hover .cell-actions,
.cell-planned:hover .cell-actions { display: inline-flex; gap: 4px; }
.cell-action-btn {
  border: 0;
  background: transparent;
  color: var(--muted);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-pulso);
}
.cell-action-btn:hover { background: rgba(255, 255, 255, 0.08); color: var(--fg); }
.cell-action-btn.pay { color: var(--pos); }
.cell-action-btn.pay:hover { background: var(--pos-soft); }
```

### B.6 — Modal "Marcar como pago"

Novo modal `#modal-mark-paid` em `views/partials/data-entry.ejs`:

```html
<dialog id="modal-mark-paid" class="modal">
  <form id="form-mark-paid">
    <h2>Marcar como pago</h2>
    <p class="muted" id="mark-paid-summary">—</p>

    <div id="mark-paid-list" class="mark-paid-list">
      <!-- populado por JS — checkboxes com cada custo individual -->
    </div>

    <label class="form-label">Data do pagamento *
      <input type="date" name="paid_date" required />
    </label>
    <p class="muted small">A data de cada custo será atualizada para a data do pagamento.</p>

    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-close-modal>Cancelar</button>
      <button type="submit" class="btn btn-primary" id="btn-confirm-paid">Confirmar pagamento</button>
    </div>
  </form>
</dialog>
```

JS em `public/js/custos.js` (novo bloco):

```js
// === Modal Marcar como pago ===
const markPaidDlg = document.getElementById('modal-mark-paid');
if (markPaidDlg) {
  const form = document.getElementById('form-mark-paid');
  const listEl = document.getElementById('mark-paid-list');
  const summaryEl = document.getElementById('mark-paid-summary');
  let pendingCosts = [];

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="mark-paid"]');
    if (!btn) return;
    e.preventDefault();
    const weekId = btn.dataset.week;
    const category = btn.dataset.category;
    const group = btn.dataset.group;

    // Buscar custos individuais via /api/costs com filtros
    const params = new URLSearchParams({
      from: weekStartFromId(weekId),
      to: weekEndFromId(weekId),
      status: 'planned',
    });
    const res = await fetch('/api/costs?' + params);
    if (!res.ok) { toast('Erro ao buscar custos'); return; }
    const all = await res.json();
    pendingCosts = all.filter((c) => c.category === category && Number(c.is_ads || 0) === 0);

    summaryEl.textContent = `Categoria: ${category} · Grupo: ${group} · ${pendingCosts.length} custo(s) pendente(s)`;
    listEl.innerHTML = pendingCosts.map((c, i) => `
      <label class="mark-paid-item">
        <input type="checkbox" name="cost_${c.id}" value="${c.id}" checked />
        <span class="mark-paid-item-date">${formatDateShort(c.date)}</span>
        <span class="mark-paid-item-desc">${escapeHtml(c.description || '—')}</span>
        <span class="mark-paid-item-amount">${BRL.format(Number(c.amount))}</span>
      </label>
    `).join('');

    form.elements.paid_date.value = todayYmd();
    markPaidDlg.showModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const paidDate = form.elements.paid_date.value;
    const checked = [...listEl.querySelectorAll('input[type="checkbox"]:checked')].map((cb) => Number(cb.value));
    if (checked.length === 0) { toast('Selecione ao menos 1 custo'); return; }
    if (!paidDate) { toast('Informe a data'); return; }

    const btn = document.getElementById('btn-confirm-paid');
    btn.dataset.loading = '1';
    try {
      // PATCH em paralelo
      await Promise.all(checked.map((id) =>
        fetch(`/api/costs/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'paid', date: paidDate }),
        }).then((r) => { if (!r.ok) throw new Error(`Falha em #${id}`); })
      ));
      toast(`${checked.length} custo(s) marcados como pagos ✓`, 'success');
      markPaidDlg.close();
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      toast('Erro: ' + err.message, 'error');
    } finally {
      delete btn.dataset.loading;
    }
  });
}

function weekStartFromId(weekId) {
  // weekId formato 'YYYY-Www' (ex 2026-W19)
  // converter para domingo da semana ISO
  const [y, w] = weekId.split('-W');
  const jan4 = new Date(Date.UTC(Number(y), 0, 4));
  const jan4Day = jan4.getUTCDay();
  const week1Mon = new Date(jan4.getTime() - ((jan4Day + 6) % 7) * 86400000);
  const targetMon = new Date(week1Mon.getTime() + (Number(w) - 1) * 7 * 86400000);
  // Comando Pulso usa semana sun-sat: voltar 1 dia
  const sun = new Date(targetMon.getTime() - 86400000);
  return sun.toISOString().slice(0, 10);
}
function weekEndFromId(weekId) {
  const sun = weekStartFromId(weekId);
  const sat = new Date(Date.parse(sun) + 6 * 86400000);
  return sat.toISOString().slice(0, 10);
}
function todayYmd() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
```

CSS:

```css
.mark-paid-list {
  max-height: 320px;
  overflow-y: auto;
  margin: 16px 0;
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.mark-paid-item {
  display: grid;
  grid-template-columns: auto 80px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line-soft);
  cursor: pointer;
}
.mark-paid-item:last-child { border-bottom: 0; }
.mark-paid-item:hover { background: rgba(255, 255, 255, 0.02); }
.mark-paid-item-date { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
.mark-paid-item-desc { font-size: 13px; color: var(--fg); }
.mark-paid-item-amount { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--warn); }
```

### B.7 — Botão "Reverter para a pagar"

Em células `.cell-paid.has-value`, adicionar botão de reverter:

```html
<button type="button" class="cell-action-btn revert" data-action="revert-paid"
        data-week="..." data-category="..." title="Reverter para 'a pagar'">↩</button>
```

JS análogo: confirmação via `confirm()` simples, depois `PATCH /api/costs/:id` com `{ status: 'planned' }` pra cada custo individual da célula. **Não muda a `date`** ao reverter (mantém a data atual — é decisão sua se quer voltar pra data original; recomendo manter).

### B.8 — Critério de aceite Fase B

- [ ] Cabeçalho com 2 sub-colunas por semana (PAGO / A PAGAR) com cores
- [ ] Custos `paid` aparecem APENAS na coluna PAGO (verde)
- [ ] Custos `planned` aparecem APENAS na coluna A PAGAR (laranja)
- [ ] Subtotais por grupo respeitam separação
- [ ] Linha de saldo respeita separação (paid e planned separados)
- [ ] Hover em célula mostra botões ✓ (marcar pago) ou ↩ (reverter)
- [ ] Modal "marcar como pago" lista N custos individuais com checkbox
- [ ] Default da data = hoje
- [ ] Após confirmar, todos os custos selecionados ficam paid com a data informada
- [ ] Reverter funciona com `confirm()` simples
- [ ] Permissões respeitadas (`action.edit_cost`)
- [ ] Tabela renderiza sem erro com 88 custos do seed
- [ ] Commit: `feat(onda-6-B): tabela de custos com colunas Pago vs A pagar lado a lado`

---

## FASE C — Recebíveis premium (UI nova) e linha opcional no PEDRRA

### C.1 — Cards de resumo + filtros + tabela em /custos

Substituir a seção atual de "Recebíveis pendentes" em `views/custos.ejs` por uma seção redesenhada:

```html
<% if (pendingReceivables.length > 0 || true) { %>
<section class="receivables-panel">
  <div class="receivables-header">
    <div>
      <h2>Recebíveis</h2>
      <span class="subtitle">Próximos 60 dias · clique numa linha pra ver detalhes</span>
    </div>
    <button type="button" class="btn btn-ghost btn-small" data-modal="export" data-export-default="receivables">
      <%- include('partials/icons', { name: 'download' }) %><span>Exportar</span>
    </button>
  </div>

  <div class="receivables-summary">
    <div class="recv-mini-card <%= recvSummary.thisWeek.count > 0 ? 'is-current' : '' %>">
      <div class="label">Esta semana</div>
      <div class="value"><%= formatBrl(recvSummary.thisWeek.sum) %></div>
      <div class="meta"><%= recvSummary.thisWeek.count %> conta(s)</div>
    </div>
    <div class="recv-mini-card">
      <div class="label">Próxima semana</div>
      <div class="value"><%= formatBrl(recvSummary.nextWeek.sum) %></div>
      <div class="meta"><%= recvSummary.nextWeek.count %> conta(s)</div>
    </div>
    <div class="recv-mini-card">
      <div class="label">Em 30 dias</div>
      <div class="value"><%= formatBrl(recvSummary.in30.sum) %></div>
      <div class="meta"><%= recvSummary.in30.count %> conta(s)</div>
    </div>
    <div class="recv-mini-card">
      <div class="label">Total janela</div>
      <div class="value"><%= formatBrl(recvSummary.inWindow.sum) %></div>
      <div class="meta"><%= recvSummary.inWindow.count %> conta(s)</div>
    </div>
  </div>

  <div class="receivables-filters">
    <button class="filter-chip is-active" data-filter="all">Todos</button>
    <button class="filter-chip" data-filter="overdue">Vencidos</button>
    <button class="filter-chip" data-filter="this-week">Esta semana</button>
    <button class="filter-chip" data-filter="next-7">Próximos 7d</button>
    <button class="filter-chip" data-filter="next-30">Próximos 30d</button>
    <button class="filter-chip" data-filter="next-60">Próximos 60d</button>
  </div>

  <table class="receivables-table">
    <thead>
      <tr>
        <th>Vencimento</th>
        <th>Cliente</th>
        <th class="num">Valor</th>
        <th>Pagamento</th>
        <th class="actions-h">Ações</th>
      </tr>
    </thead>
    <tbody>
      <% for (const r of pendingReceivables) { %>
        <% const isOverdue = r.expected_date < todayDate; %>
        <tr data-receivable-id="<%= r.id %>" data-expected-date="<%= r.expected_date %>" class="<%= isOverdue ? 'overdue' : '' %>">
          <td>
            <%= formatDateShort(r.expected_date) %>
            <% if (isOverdue) { %><span class="badge overdue-badge">VENCIDO</span><% } %>
          </td>
          <td><%= r.client_name || '—' %></td>
          <td class="num"><%= formatBrl(r.expected_amount) %></td>
          <td><%= r.payment_method ? formatPaymentMethod(r.payment_method) : '—' %></td>
          <td class="actions-cell">
            <% if (userCan('action.mark_received')) { %>
              <button type="button" class="cell-action-btn pay" data-action="mark-received" data-id="<%= r.id %>" title="Marcar recebido">✓</button>
            <% } %>
            <% if (userCan('action.edit_receivable')) { %>
              <button type="button" class="cell-action-btn" data-action="edit-receivable" data-id="<%= r.id %>" title="Editar">✎</button>
            <% } %>
            <% if (userCan('action.delete_receivable')) { %>
              <button type="button" class="cell-action-btn delete" data-action="delete-receivable" data-id="<%= r.id %>" title="Excluir">×</button>
            <% } %>
          </td>
        </tr>
      <% } %>
      <% if (pendingReceivables.length === 0) { %>
        <tr><td colspan="5" class="muted center" style="padding: 32px;">Nenhuma conta a receber pendente.</td></tr>
      <% } %>
    </tbody>
  </table>
</section>
<% } %>
```

### C.2 — Backend: cálculo dos 4 mini-cards

Em `routes/custos.js`, adicionar (após o cálculo de `pendingReceivables`):

```js
const allPending = receivables.list({ status: 'pending', from: today, to: horizon60 });

function dateAddDays(ymd, days) {
  const d = new Date(ymd + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function sumAndCountInRange(items, fromDays, toDays) {
  const start = dateAddDays(today, fromDays);
  const end = dateAddDays(today, toDays);
  const filtered = items.filter((r) => r.expected_date >= start && r.expected_date <= end);
  return {
    sum: filtered.reduce((acc, r) => acc + Number(r.expected_amount || 0), 0),
    count: filtered.length,
  };
}

const recvSummary = {
  thisWeek: sumAndCountInRange(allPending, 0, 6),
  nextWeek: sumAndCountInRange(allPending, 7, 13),
  in30: sumAndCountInRange(allPending, 0, 30),
  inWindow: {
    sum: allPending.reduce((a, r) => a + Number(r.expected_amount || 0), 0),
    count: allPending.length,
  },
};
```

Passar `recvSummary` na render.

### C.3 — JS de filtros chips

Em `public/js/custos.js`, novo bloco:

```js
// === Receivables filters ===
(function setupReceivablesFilters() {
  const chips = document.querySelectorAll('.receivables-filters .filter-chip');
  const rows = document.querySelectorAll('.receivables-table tbody tr');
  if (!chips.length || !rows.length) return;

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      const filter = chip.dataset.filter;
      rows.forEach((row) => {
        if (!row.dataset.expectedDate) return;
        row.style.display = matchesFilter(row.dataset.expectedDate, filter) ? '' : 'none';
      });
    });
  });

  function matchesFilter(date, filter) {
    if (filter === 'all') return true;
    const today = new Date().toISOString().slice(0, 10);
    if (filter === 'overdue') return date < today;
    const days = Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
    if (filter === 'this-week') return days >= 0 && days <= 6;
    if (filter === 'next-7') return days >= 0 && days <= 7;
    if (filter === 'next-30') return days >= 0 && days <= 30;
    if (filter === 'next-60') return days >= 0 && days <= 60;
    return true;
  }
})();

// === Ações nas linhas ===
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = Number(btn.dataset.id);

  if (action === 'mark-received') {
    if (!confirm('Marcar esta conta como recebida hoje?')) return;
    const res = await fetch(`/api/receivables/${id}/mark-received`, { method: 'POST' });
    if (res.ok) { toast('Conta marcada como recebida ✓', 'success'); setTimeout(() => location.reload(), 600); }
    else { toast('Falha ao marcar como recebida', 'error'); }
  }
  if (action === 'delete-receivable') {
    if (!confirm('Excluir esta conta a receber? Essa ação não pode ser desfeita.')) return;
    const res = await fetch(`/api/receivables/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Conta excluída', 'success'); setTimeout(() => location.reload(), 600); }
    else { toast('Falha ao excluir', 'error'); }
  }
  // edit-receivable: abre modal — implementar reusando padrão do modal-edit-cost
});
```

### C.4 — CSS premium (seção Recebíveis)

Adicionar em `public/css/app.css`:

```css
.receivables-panel {
  margin-top: 32px;
  padding: 24px;
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  position: relative;
  overflow: hidden;
}
.receivables-panel::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 60%; height: 1px;
  background: linear-gradient(90deg, var(--accent) 0%, transparent 100%);
}
.receivables-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.receivables-header h2 {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0;
}
.receivables-header .subtitle {
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
  margin-top: 2px;
  display: block;
}

.receivables-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}
.recv-mini-card {
  position: relative;
  padding: 16px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  transition: all var(--duration-fast) var(--ease-pulso);
}
.recv-mini-card:hover {
  border-color: var(--accent);
  background: var(--bg-elevated);
  transform: translateY(-1px);
}
.recv-mini-card .label {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 8px;
}
.recv-mini-card .value {
  font-size: clamp(18px, 1.6vw, 22px);
  font-weight: 800;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  color: var(--fg);
  line-height: 1;
}
.recv-mini-card .meta {
  font-size: 10px;
  color: var(--muted);
  margin-top: 6px;
  font-weight: 500;
}
.recv-mini-card.is-current {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.recv-mini-card.is-current .value { color: var(--accent); }

.receivables-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}
.filter-chip {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
  border-radius: 100px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-pulso);
}
.filter-chip:hover { color: var(--fg); border-color: var(--line-strong); }
.filter-chip.is-active {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}

.receivables-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}
.receivables-table thead th {
  text-align: left;
  padding: 10px 12px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
}
.receivables-table thead th.num { text-align: right; }
.receivables-table thead th.actions-h { text-align: right; width: 120px; }
.receivables-table tbody tr {
  transition: background var(--duration-fast) var(--ease-pulso);
}
.receivables-table tbody tr:hover { background: rgba(255, 46, 90, 0.03); }
.receivables-table tbody tr.overdue { background: rgba(255, 46, 90, 0.05); border-left: 3px solid var(--neg); }
.receivables-table tbody td {
  padding: 12px;
  border-bottom: 1px solid var(--line-soft);
}
.receivables-table .num { text-align: right; font-feature-settings: 'tnum' 1; font-weight: 600; }
.receivables-table .actions-cell { text-align: right; }
.receivables-table .badge.overdue-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 6px;
  background: var(--neg-soft);
  color: var(--neg);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 4px;
}
```

### C.5 — Linha "Recebíveis" no PEDRRA (toggle controlado)

Em `views/pedrra.ejs`, adicionar **linha condicional na tabela de projeção**:

```ejs
<% if (initial.includeReceivablesInProjection && receivablesByWeek) { %>
  <tr class="row-receivables">
    <td>
      <span class="row-label">
        Recebíveis
        <span class="row-tag" title="Valores que ainda não caíram em conta. Configure em /configuracoes.">ⓘ</span>
      </span>
    </td>
    <% for (const w of cashflow.series) { %>
      <td class="num">
        <%= w.receivables_projected > 0 ? formatBrl(w.receivables_projected) : '—' %>
      </td>
    <% } %>
  </tr>
<% } %>
```

A lógica de soma já existe em `lib/cashflow.js` quando setting `include_receivables_in_projection === '1'`. Apenas adicionar a linha visual.

CSS:

```css
.weekly-grid tr.row-receivables td {
  background: rgba(255, 215, 0, 0.025);
  color: var(--gold);
  font-weight: 600;
}
.row-tag {
  display: inline-block;
  margin-left: 6px;
  width: 14px; height: 14px;
  border: 1px solid var(--muted);
  border-radius: 50%;
  font-size: 9px;
  font-weight: 700;
  text-align: center;
  line-height: 12px;
  color: var(--muted);
  cursor: help;
}
```

### C.6 — Critério de aceite Fase C

- [ ] Seção `.receivables-panel` renderiza com 4 mini-cards
- [ ] Filtros chips funcionando (client-side, sem reload)
- [ ] Linhas com badge "vencido" em vermelho
- [ ] Hover em linha rosa sutil
- [ ] Botões de ação (✓ marcar recebido / ✎ editar / × excluir) respeitando permissões
- [ ] Linha "Recebíveis" no PEDRRA aparece quando setting ON
- [ ] Setting toggle em /configuracoes funciona como esperado
- [ ] Commit: `feat(onda-6-C): recebíveis premium e linha opcional no PEDRRA`

---

## FASE D — Polimento de visualização das parcelas

### D.1 — Helper `parseParcel` em `lib/format.js`

Adicionar:

```js
const PARCEL_RE = / · parcela (\d+)\/(\d+)$/;

function parseParcel(description) {
  if (!description) return null;
  const m = String(description).match(PARCEL_RE);
  if (!m) return null;
  return { current: Number(m[1]), total: Number(m[2]) };
}

module.exports = { ..., parseParcel };
```

Disponibilizar via `res.locals` em `lib/locals.js`:

```js
res.locals.parseParcel = parseParcel;
```

### D.2 — Renderização visual nas linhas de custo individual

Em `views/custos.ejs`, na renderização das linhas (incluindo a tabela weekly-grid e a tabela "custos recentes"), envolver o nome com lógica:

```ejs
<% const parcel = parseParcel(c.description); %>
<tr class="<%= parcel ? 'is-parcel' : '' %>">
  <td>
    <% if (parcel) { %>
      <span class="parcel-icon" title="Parcela <%= parcel.current %> de <%= parcel.total %>">⛓</span>
    <% } %>
    <span class="row-desc"><%= c.description || c.category %></span>
    <% if (parcel) { %>
      <span class="parcel-tag"><%= parcel.current %>/<%= parcel.total %></span>
    <% } %>
  </td>
  <!-- demais células -->
</tr>
```

### D.3 — CSS

```css
tr.is-parcel td {
  background: rgba(255, 215, 0, 0.025);
}
tr.is-parcel td:first-child {
  border-left: 2px solid rgba(255, 215, 0, 0.3);
}
.parcel-icon {
  display: inline-block;
  margin-right: 6px;
  color: var(--gold);
  font-size: 10px;
  opacity: 0.6;
}
.parcel-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 6px;
  background: var(--gold-soft);
  color: var(--gold);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.06em;
  border-radius: 100px;
  vertical-align: middle;
}
```

### D.4 — Aplicar também no modal "Todos os custos futuros"

O modal `modal-todos-futuros` (commit 6b4311a) já existe. **Apenas adicionar** o tratamento de parcela na renderização do tbody. Não alterar a lógica do filtro.

No `public/js/custos.js`, na função `render()` desse modal, modificar a string que monta `<tr>`:

```js
const parcelInfo = parseParcelClient(c.description);
const parcelHtml = parcelInfo
  ? `<span class="parcel-icon" title="Parcela ${parcelInfo.current}/${parcelInfo.total}">⛓</span>`
  : '';
const parcelTag = parcelInfo ? `<span class="parcel-tag">${parcelInfo.current}/${parcelInfo.total}</span>` : '';

// ... ao montar a linha:
'<tr class="' + (parcelInfo ? 'is-parcel' : '') + '">' +
'<td>' + parcelHtml + escapeHtml(c.description || c.category) + parcelTag + '</td>' +
// ...
```

E adicionar helper client:

```js
function parseParcelClient(description) {
  if (!description) return null;
  const m = String(description).match(/ · parcela (\d+)\/(\d+)$/);
  if (!m) return null;
  return { current: Number(m[1]), total: Number(m[2]) };
}
```

### D.5 — Critério de aceite Fase D

- [ ] Custos parcelados aparecem com ícone ⛓ + tag "1/4", "2/4", etc.
- [ ] Linha tem fundo dourado sutil
- [ ] Aplicado tanto na tabela weekly quanto no modal "Todos os custos futuros"
- [ ] Helper exportado em `lib/format.js`
- [ ] Commit: `feat(onda-6-D): visualização premium de parcelas com badge ⛓`

---

## FASE E — Export de dados (XLSX e CSV)

### E.1 — Permissão e dependência

Verificar se permissão `action.export_data` já existe em `lib/permissions.js`. **Se não existir**, adicionar:

```js
{ key: 'action.export_data', group: 'Visualização', label: 'Exportar dados (CSV/XLSX)' },
```

E em `DEFAULTS_FINANCEIRO`:
```js
'action.export_data': 1,
```

Adicionar dependência ao `package.json`:
```json
"exceljs": "^4.4.0"
```

Rodar `npm install` durante o desenvolvimento (mas isso fica pra Claude executar localmente; em produção, o `npm install --omit=dev` no deploy puxa).

### E.2 — Endpoint POST `/api/export`

Novo arquivo `routes/api/export.js`:

```js
const router = require('express').Router();
const ExcelJS = require('exceljs');
const sales = require('../../db/queries/sales');
const costs = require('../../db/queries/costs');
const receivables = require('../../db/queries/receivables');
const { requirePerm } = require('../../lib/permissions');
const { isDateInRange } = require('../../lib/validators');
const { formatPaymentMethod } = require('../../lib/format');
const { logError } = require('../../lib/log');

router.post('/', requirePerm('action.export_data'), async (req, res) => {
  try {
    const b = req.body || {};
    const { format, from, to, include = {}, scenario_id = null } = b;

    if (!['xlsx', 'csv'].includes(format)) return res.status(400).json({ error: 'format inválido' });
    if (!isDateInRange(from)) return res.status(400).json({ error: 'from inválido' });
    if (!isDateInRange(to)) return res.status(400).json({ error: 'to inválido' });
    if (from > to) return res.status(400).json({ error: 'from deve ser <= to' });

    const wantSales = include.sales !== false;
    const wantCosts = include.costs !== false;
    const wantAds = include.ads !== false;
    const wantReceivables = include.receivables !== false;
    if (!wantSales && !wantCosts && !wantAds && !wantReceivables) {
      return res.status(400).json({ error: 'selecione ao menos um tipo' });
    }

    const fname = `comando-pulso-${from}-a-${to}`;

    if (format === 'csv') {
      const rows = collectAllAsRows({ from, to, include, scenarioId: scenario_id });
      const csv = toCsv(rows);
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fname}.csv"`,
      });
      return res.send('\ufeff' + csv);
    }

    // XLSX
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Comando Pulso';
    wb.created = new Date();

    if (wantSales) addSalesSheet(wb, { from, to });
    if (wantCosts) addCostsSheet(wb, { from, to, scenarioId: scenario_id, isAds: false });
    if (wantAds) addCostsSheet(wb, { from, to, scenarioId: scenario_id, isAds: true });
    if (wantReceivables) addReceivablesSheet(wb, { from, to });
    addSummarySheet(wb, { from, to, include, scenarioId: scenario_id });

    const buf = await wb.xlsx.writeBuffer();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fname}.xlsx"`,
    });
    return res.send(Buffer.from(buf));
  } catch (err) {
    logError(req, err);
    return res.status(500).json({ error: 'falha ao gerar export' });
  }
});

// ============= helpers ================
function collectAllAsRows({ from, to, include, scenarioId }) {
  const rows = [];
  if (include.sales !== false) {
    for (const s of sales.list({ from, to })) {
      rows.push({
        type: 'sale', date: s.date, category: '',
        description: s.notes || '',
        gross_amount: Number(s.gross_amount || 0),
        net_amount: Number(s.net_amount || 0),
        amount: '',
        status: 'real',
        payment_method: formatPaymentMethod(s.payment_method) || '',
        client_name: s.client_name || '',
        scenario: '',
      });
    }
  }
  if (include.costs !== false) {
    for (const c of costs.list({ from, to, scenarioId, ads: 'exclude' })) {
      rows.push({
        type: 'cost', date: c.date, category: c.category || '',
        description: c.description || '',
        gross_amount: '', net_amount: '',
        amount: Number(c.amount || 0),
        status: c.status,
        payment_method: '', client_name: '', scenario: c.scenario_id || 'global',
      });
    }
  }
  if (include.ads !== false) {
    for (const c of costs.list({ from, to, scenarioId, ads: 'only' })) {
      rows.push({
        type: 'ads', date: c.date, category: c.category || 'Ads',
        description: c.description || '',
        gross_amount: '', net_amount: '',
        amount: Number(c.amount || 0),
        status: c.status,
        payment_method: '', client_name: '', scenario: c.scenario_id || 'global',
      });
    }
  }
  if (include.receivables !== false) {
    for (const r of receivables.list({ from, to })) {
      rows.push({
        type: 'receivable', date: r.expected_date, category: '',
        description: '',
        gross_amount: '', net_amount: '',
        amount: Number(r.expected_amount || 0),
        status: r.status,
        payment_method: formatPaymentMethod(r.payment_method) || '',
        client_name: r.client_name || '',
        scenario: '',
      });
    }
  }
  return rows;
}

function toCsv(rows) {
  const headers = ['type','date','category','description','gross_amount','net_amount','amount','status','payment_method','client_name','scenario'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(','));
  }
  return lines.join('\n');
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function applyHeaderStyle(sheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF2E5A' } };
  header.alignment = { vertical: 'middle', horizontal: 'left' };
  header.height = 22;
}

function addSalesSheet(wb, { from, to }) {
  const sheet = wb.addWorksheet('Vendas');
  sheet.columns = [
    { header: 'Data', key: 'date', width: 12 },
    { header: 'Bruto', key: 'gross', width: 14, style: { numFmt: '"R$" #,##0.00' } },
    { header: 'Líquido', key: 'net', width: 14, style: { numFmt: '"R$" #,##0.00' } },
    { header: 'Pagamento', key: 'pmt', width: 18 },
    { header: 'Cliente', key: 'client', width: 24 },
    { header: 'Observações', key: 'notes', width: 30 },
  ];
  for (const s of sales.list({ from, to })) {
    sheet.addRow({
      date: s.date,
      gross: Number(s.gross_amount),
      net: Number(s.net_amount),
      pmt: formatPaymentMethod(s.payment_method) || '',
      client: s.client_name || '',
      notes: s.notes || '',
    });
  }
  applyHeaderStyle(sheet);
}

function addCostsSheet(wb, { from, to, scenarioId, isAds }) {
  const sheet = wb.addWorksheet(isAds ? 'Investimento em Ads' : 'Custos');
  sheet.columns = [
    { header: 'Data', key: 'date', width: 12 },
    { header: 'Categoria', key: 'cat', width: 28 },
    { header: 'Descrição', key: 'desc', width: 36 },
    { header: 'Valor', key: 'amount', width: 14, style: { numFmt: '"R$" #,##0.00' } },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Cenário', key: 'scenario', width: 12 },
  ];
  const list = costs.list({ from, to, scenarioId, ads: isAds ? 'only' : 'exclude' });
  for (const c of list) {
    sheet.addRow({
      date: c.date,
      cat: c.category || '',
      desc: c.description || '',
      amount: Number(c.amount),
      status: c.status,
      scenario: c.scenario_id || 'global',
    });
  }
  applyHeaderStyle(sheet);
}

function addReceivablesSheet(wb, { from, to }) {
  const sheet = wb.addWorksheet('Recebíveis');
  sheet.columns = [
    { header: 'Vencimento', key: 'date', width: 14 },
    { header: 'Cliente', key: 'client', width: 24 },
    { header: 'Valor previsto', key: 'expected', width: 16, style: { numFmt: '"R$" #,##0.00' } },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Pagamento', key: 'pmt', width: 18 },
    { header: 'Recebido em', key: 'received', width: 14 },
    { header: 'Valor recebido', key: 'recvAmt', width: 16, style: { numFmt: '"R$" #,##0.00' } },
  ];
  const list = receivables.list({ from, to });
  for (const r of list) {
    sheet.addRow({
      date: r.expected_date,
      client: r.client_name || '',
      expected: Number(r.expected_amount),
      status: r.status,
      pmt: formatPaymentMethod(r.payment_method) || '',
      received: r.received_date || '',
      recvAmt: r.received_amount ? Number(r.received_amount) : '',
    });
  }
  applyHeaderStyle(sheet);
}

function addSummarySheet(wb, { from, to, include, scenarioId }) {
  const sheet = wb.addWorksheet('Resumo');
  sheet.columns = [
    { header: 'Tipo', key: 'type', width: 18 },
    { header: 'Quantidade', key: 'count', width: 12 },
    { header: 'Total', key: 'total', width: 16, style: { numFmt: '"R$" #,##0.00' } },
  ];
  if (include.sales !== false) {
    const list = sales.list({ from, to });
    sheet.addRow({ type: 'Vendas (líquido)', count: list.length, total: list.reduce((a, s) => a + Number(s.net_amount || 0), 0) });
  }
  if (include.costs !== false) {
    const list = costs.list({ from, to, scenarioId, ads: 'exclude' });
    sheet.addRow({ type: 'Custos', count: list.length, total: list.reduce((a, c) => a + Number(c.amount || 0), 0) });
  }
  if (include.ads !== false) {
    const list = costs.list({ from, to, scenarioId, ads: 'only' });
    sheet.addRow({ type: 'Investimento em Ads', count: list.length, total: list.reduce((a, c) => a + Number(c.amount || 0), 0) });
  }
  if (include.receivables !== false) {
    const list = receivables.list({ from, to });
    sheet.addRow({ type: 'Recebíveis', count: list.length, total: list.reduce((a, r) => a + Number(r.expected_amount || 0), 0) });
  }
  applyHeaderStyle(sheet);
}

module.exports = router;
```

Registrar em `routes/api/index.js`:

```js
router.use('/export', require('./export'));
```

### E.3 — Modal de export em /custos e /pedrra

Novo modal `#modal-export` em `views/partials/data-entry.ejs`:

```html
<dialog id="modal-export" class="modal modal-wide">
  <form id="form-export">
    <h2>Exportar dados</h2>

    <div class="export-section">
      <div class="export-section-title">Formato</div>
      <div class="export-format-toggle">
        <label class="format-pill">
          <input type="radio" name="format" value="xlsx" checked />
          <span>XLSX (Excel)</span>
        </label>
        <label class="format-pill">
          <input type="radio" name="format" value="csv" />
          <span>CSV</span>
        </label>
      </div>
    </div>

    <div class="export-section">
      <div class="export-section-title">Período</div>
      <div class="export-presets">
        <button type="button" class="filter-chip" data-preset="this-week">Esta semana</button>
        <button type="button" class="filter-chip" data-preset="this-month">Este mês</button>
        <button type="button" class="filter-chip" data-preset="last-30">Últimos 30 dias</button>
        <button type="button" class="filter-chip" data-preset="quarter">Trimestre</button>
        <button type="button" class="filter-chip is-active" data-preset="year">Este ano</button>
        <button type="button" class="filter-chip" data-preset="custom">Personalizado</button>
      </div>
      <div class="export-date-range">
        <label class="form-label">De
          <input type="date" name="from" required />
        </label>
        <label class="form-label">Até
          <input type="date" name="to" required />
        </label>
      </div>
    </div>

    <div class="export-section">
      <div class="export-section-title">Incluir</div>
      <div class="export-checks">
        <label><input type="checkbox" name="include_sales" checked /> Vendas</label>
        <label><input type="checkbox" name="include_costs" checked /> Custos</label>
        <label><input type="checkbox" name="include_ads" checked /> Ads</label>
        <label><input type="checkbox" name="include_receivables" checked /> Recebíveis</label>
      </div>
    </div>

    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-close-modal>Cancelar</button>
      <button type="submit" class="btn btn-primary" id="btn-export-submit">Baixar arquivo</button>
    </div>
  </form>
</dialog>
```

Adicionar botão "Exportar" na toolbar de /custos e /pedrra (próximo aos outros botões de ação).

### E.4 — JS do modal

Em `public/js/data-entry.js` (ou novo `public/js/export.js`):

```js
(function () {
  const dlg = document.getElementById('modal-export');
  if (!dlg) return;
  const form = document.getElementById('form-export');
  const fromInput = form.elements.from;
  const toInput = form.elements.to;
  const presets = document.querySelectorAll('[data-preset]');

  function setRange(fromYmd, toYmd) {
    fromInput.value = fromYmd;
    toInput.value = toYmd;
  }

  function todayYmd() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function applyPreset(name) {
    const t = new Date();
    const today = todayYmd();
    if (name === 'this-week') {
      const day = t.getDay();
      const sun = new Date(t.getTime() - day * 86400000);
      const sat = new Date(sun.getTime() + 6 * 86400000);
      setRange(sun.toISOString().slice(0, 10), sat.toISOString().slice(0, 10));
    } else if (name === 'this-month') {
      const first = new Date(t.getFullYear(), t.getMonth(), 1);
      setRange(first.toISOString().slice(0, 10), today);
    } else if (name === 'last-30') {
      const start = new Date(t.getTime() - 30 * 86400000);
      setRange(start.toISOString().slice(0, 10), today);
    } else if (name === 'quarter') {
      const m = t.getMonth();
      const startQ = new Date(t.getFullYear(), Math.floor(m / 3) * 3, 1);
      setRange(startQ.toISOString().slice(0, 10), today);
    } else if (name === 'year') {
      setRange(t.getFullYear() + '-01-01', t.getFullYear() + '-12-31');
    }
    // 'custom' deixa como está
  }

  presets.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      presets.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      applyPreset(btn.dataset.preset);
    });
  });

  // Init com 'year'
  applyPreset('year');

  // Abrir o modal
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-modal="export"]');
    if (trigger) {
      const dft = trigger.dataset.exportDefault;
      if (dft === 'receivables') {
        form.elements.include_sales.checked = false;
        form.elements.include_costs.checked = false;
        form.elements.include_ads.checked = false;
        form.elements.include_receivables.checked = true;
      }
      dlg.showModal();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('btn-export-submit');
    submitBtn.dataset.loading = '1';
    try {
      const body = {
        format: form.elements.format.value,
        from: form.elements.from.value,
        to: form.elements.to.value,
        include: {
          sales: form.elements.include_sales.checked,
          costs: form.elements.include_costs.checked,
          ads: form.elements.include_ads.checked,
          receivables: form.elements.include_receivables.checked,
        },
      };
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Falha no export');
      }
      // Download
      const blob = await res.blob();
      const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'export';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Exportação concluída ✓', 'success');
      dlg.close();
    } catch (err) {
      toast('Falha no export: ' + err.message, 'error');
    } finally {
      delete submitBtn.dataset.loading;
    }
  });
})();
```

### E.5 — CSS do modal export

```css
.modal-wide {
  max-width: 720px;
}
.export-section {
  margin-bottom: 24px;
}
.export-section-title {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 10px;
}
.export-format-toggle {
  display: flex;
  gap: 8px;
}
.format-pill {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: all var(--duration-fast) var(--ease-pulso);
}
.format-pill input { display: none; }
.format-pill:hover { border-color: var(--line-strong); background: rgba(255, 255, 255, 0.05); }
.format-pill input:checked + span,
.format-pill:has(input:checked) {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.export-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.export-date-range {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.export-checks {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.export-checks label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-pulso);
}
.export-checks label:hover { border-color: var(--line-strong); }
.export-checks input { accent-color: var(--accent); }
```

### E.6 — Critério de aceite Fase E

- [ ] `exceljs` adicionado ao package.json e instalado
- [ ] Permissão `action.export_data` no catálogo (ou já existente)
- [ ] Endpoint `POST /api/export` registrado e funcional
- [ ] Modal de export com presets de período + checkboxes
- [ ] CSV gera arquivo com BOM (Excel-friendly)
- [ ] XLSX gera com 4 abas + Resumo
- [ ] Download inicia automaticamente após gerar
- [ ] Permissões respeitadas
- [ ] Botão "Exportar" em /custos e /pedrra
- [ ] Testar local: gerar XLSX e abrir no LibreOffice/Excel
- [ ] Commit: `feat(onda-6-E): export XLSX e CSV com filtros e presets`

---

# FRENTE 2 — Funil evolutivo (Fases F–I)

## DECISÕES DE PRODUTO (já travadas — não revisitar)

1. **Granularidade:** semana a semana, manual (cada semana editada individualmente)
2. **Horizonte:** variável — usuário escolhe ao ativar (4, 8, 12 ou 24 semanas)
3. **Integração com PEDRRA:** PEDRRA puxa a projeção da semana correspondente do funil evolutivo (alinhamento por `week_id` ISO)
4. **Cenários antigos:** opt-in via toggle. Sem toggle, comportamento atual (estático). Com toggle, vira evolutivo.
5. **Curva sugerida:** botão "aplicar curva" preenche semanas 2..N com taxa de crescimento e platô em semana N
6. **Tipo de platô:** "cresce até semana N, depois mantém estável". Só semana — não tem teto de valor.
7. **Capacidade do time:** NÃO segue curva. Editável por semana, com lógica de "entrar/sair" pessoa a partir de uma semana específica.

## FASE F — Schema + queries do funil evolutivo

### F.1 — Migrations

Em `db/migrations.js`, adicionar (aditivo, idempotente):

```sql
-- Toggle por cenário: este cenário usa funil evolutivo?
ALTER TABLE scenarios ADD COLUMN evolutive_funnel_enabled INTEGER DEFAULT 0;
ALTER TABLE scenarios ADD COLUMN evolutive_funnel_weeks INTEGER DEFAULT 12;

-- Funil evolutivo: 1 linha por semana por cenário
CREATE TABLE IF NOT EXISTS scenario_funnel_weekly (
  scenario_id INTEGER NOT NULL,
  week_index INTEGER NOT NULL,           -- 1..N (N = evolutive_funnel_weeks)
  ads_per_week REAL DEFAULT 0,
  cpl REAL DEFAULT 0,
  rebarba_sb_per_week INTEGER DEFAULT 0,
  show_rate_pct REAL DEFAULT 70,
  call_to_sale_pct REAL DEFAULT 25,
  forecast_bonus_pct REAL DEFAULT 5,    -- replicado pra simplicidade
  ticket_avg REAL DEFAULT 10000,
  payment_tax_pct REAL DEFAULT 12,
  PRIMARY KEY (scenario_id, week_index),
  FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
);

-- Capacidade do time semana a semana
CREATE TABLE IF NOT EXISTS scenario_team_weekly (
  scenario_id INTEGER NOT NULL,
  team_member_id INTEGER NOT NULL,
  week_index INTEGER NOT NULL,
  capacity_per_week REAL DEFAULT 0,
  conversion_pct REAL DEFAULT 0,
  active INTEGER DEFAULT 1,             -- 0 = pessoa não ativa nessa semana (capacity ignored)
  PRIMARY KEY (scenario_id, team_member_id, week_index),
  FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE,
  FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_funnel_weekly_scenario ON scenario_funnel_weekly(scenario_id);
CREATE INDEX IF NOT EXISTS idx_team_weekly_scenario ON scenario_team_weekly(scenario_id);
```

**IMPORTANTE:** O `ALTER TABLE ADD COLUMN` precisa ser feito com check via `PRAGMA table_info('scenarios')` antes (idempotência):

```js
function addColumnIfMissing(table, columnDefSql, columnName) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = cols.some((c) => c.name === columnName);
  if (!exists) db.prepare(`ALTER TABLE ${table} ADD COLUMN ${columnDefSql}`).run();
}

addColumnIfMissing('scenarios', 'evolutive_funnel_enabled INTEGER DEFAULT 0', 'evolutive_funnel_enabled');
addColumnIfMissing('scenarios', 'evolutive_funnel_weeks INTEGER DEFAULT 12', 'evolutive_funnel_weeks');
```

### F.2 — Queries em `db/queries/funnel.js` (estender)

Adicionar:

```js
// === Evolutive funnel ===
const stmtsEvo = {
  getWeekly: db.prepare(`SELECT * FROM scenario_funnel_weekly WHERE scenario_id = ? ORDER BY week_index ASC`),
  getWeeklyByIndex: db.prepare(`SELECT * FROM scenario_funnel_weekly WHERE scenario_id = ? AND week_index = ?`),
  upsertWeekly: db.prepare(`
    INSERT INTO scenario_funnel_weekly (scenario_id, week_index, ads_per_week, cpl, rebarba_sb_per_week, show_rate_pct, call_to_sale_pct, forecast_bonus_pct, ticket_avg, payment_tax_pct)
    VALUES (@scenario_id, @week_index, @ads_per_week, @cpl, @rebarba_sb_per_week, @show_rate_pct, @call_to_sale_pct, @forecast_bonus_pct, @ticket_avg, @payment_tax_pct)
    ON CONFLICT(scenario_id, week_index) DO UPDATE SET
      ads_per_week = excluded.ads_per_week,
      cpl = excluded.cpl,
      rebarba_sb_per_week = excluded.rebarba_sb_per_week,
      show_rate_pct = excluded.show_rate_pct,
      call_to_sale_pct = excluded.call_to_sale_pct,
      forecast_bonus_pct = excluded.forecast_bonus_pct,
      ticket_avg = excluded.ticket_avg,
      payment_tax_pct = excluded.payment_tax_pct
  `),
  deleteWeeklyAfter: db.prepare(`DELETE FROM scenario_funnel_weekly WHERE scenario_id = ? AND week_index > ?`),
  getTeamWeekly: db.prepare(`SELECT * FROM scenario_team_weekly WHERE scenario_id = ? ORDER BY week_index, team_member_id`),
  upsertTeamWeekly: db.prepare(`
    INSERT INTO scenario_team_weekly (scenario_id, team_member_id, week_index, capacity_per_week, conversion_pct, active)
    VALUES (@scenario_id, @team_member_id, @week_index, @capacity_per_week, @conversion_pct, @active)
    ON CONFLICT(scenario_id, team_member_id, week_index) DO UPDATE SET
      capacity_per_week = excluded.capacity_per_week,
      conversion_pct = excluded.conversion_pct,
      active = excluded.active
  `),
};

function getWeeklyForScenario(scenarioId) {
  return stmtsEvo.getWeekly.all(scenarioId);
}

function upsertWeekly(rows) {
  // rows: array de objetos completos
  const tx = db.transaction((arr) => arr.forEach((r) => stmtsEvo.upsertWeekly.run(r)));
  tx(rows);
}

function trimWeeksTo(scenarioId, n) {
  stmtsEvo.deleteWeeklyAfter.run(scenarioId, n);
}

function getTeamWeeklyForScenario(scenarioId) {
  return stmtsEvo.getTeamWeekly.all(scenarioId);
}

function upsertTeamWeekly(rows) {
  const tx = db.transaction((arr) => arr.forEach((r) => stmtsEvo.upsertTeamWeekly.run(r)));
  tx(rows);
}

module.exports = { ..., getWeeklyForScenario, upsertWeekly, trimWeeksTo, getTeamWeeklyForScenario, upsertTeamWeekly };
```

### F.3 — Critério de aceite Fase F

- [ ] Migration aditiva (não destrói dados existentes)
- [ ] Tabelas `scenario_funnel_weekly` e `scenario_team_weekly` criadas
- [ ] Colunas `evolutive_funnel_enabled` e `evolutive_funnel_weeks` em `scenarios`
- [ ] Queries de upsert em transação
- [ ] Servidor sobe local sem erro
- [ ] Cenários existentes mantêm `evolutive_funnel_enabled = 0` (não muda comportamento)
- [ ] Commit: `feat(onda-6-F): schema do funil evolutivo (tabelas semana a semana)`

---

## FASE G — Endpoints API do funil evolutivo

### G.1 — Rotas novas em `routes/api/funnel.js`

```js
// GET /api/funnel/evolutive/:scenarioId → retorna timeline completa
// PUT /api/funnel/evolutive/:scenarioId → upsert timeline inteira (substitui)
// POST /api/funnel/evolutive/:scenarioId/enable → ativa modo evolutivo (cria N semanas com defaults)
// POST /api/funnel/evolutive/:scenarioId/disable → desativa modo evolutivo (preserva tabela, só vira flag off)
// POST /api/funnel/evolutive/:scenarioId/apply-curve → aplica curva sugerida com platô

router.get('/evolutive/:scenarioId', requireMaster, (req, res) => {
  const sid = Number(req.params.scenarioId);
  const scenario = scenarios.getById(sid);
  if (!scenario) return res.status(404).json({ error: 'cenário não encontrado' });
  res.json({
    enabled: !!scenario.evolutive_funnel_enabled,
    weeks_count: scenario.evolutive_funnel_weeks,
    funnel_weekly: funnel.getWeeklyForScenario(sid),
    team_weekly: funnel.getTeamWeeklyForScenario(sid),
  });
});

router.put('/evolutive/:scenarioId', requireMaster, (req, res) => {
  const sid = Number(req.params.scenarioId);
  const b = req.body || {};
  const weeks = Array.isArray(b.funnel_weekly) ? b.funnel_weekly : [];
  const team = Array.isArray(b.team_weekly) ? b.team_weekly : [];
  // validar cada linha
  for (const w of weeks) {
    if (!Number.isInteger(w.week_index) || w.week_index < 1) {
      return res.status(400).json({ error: 'week_index inválido' });
    }
    // validações de range
    if (w.ads_per_week < 0 || w.cpl < 0 || w.show_rate_pct < 0 || w.show_rate_pct > 100) {
      return res.status(400).json({ error: `valores inválidos na semana ${w.week_index}` });
    }
  }
  funnel.upsertWeekly(weeks.map((w) => ({ scenario_id: sid, ...w })));
  funnel.upsertTeamWeekly(team.map((t) => ({ scenario_id: sid, ...t })));
  res.json({ ok: true });
});

router.post('/evolutive/:scenarioId/enable', requireMaster, (req, res) => {
  const sid = Number(req.params.scenarioId);
  const weeks = Number(req.body.weeks) || 12;
  if (![4, 8, 12, 24].includes(weeks)) return res.status(400).json({ error: 'weeks deve ser 4, 8, 12 ou 24' });

  // Carregar funil estático atual como ponto de partida
  const baseFunnel = funnel.getByScenario(sid) || {
    ads_per_week: 0, cpl: 0, rebarba_sb_per_week: 0,
    show_rate_pct: 70, call_to_sale_pct: 25, forecast_bonus_pct: 5,
    ticket_avg: 10000, payment_tax_pct: 12,
  };

  // Criar N semanas todas iguais ao base (usuário ajusta depois)
  const rows = [];
  for (let i = 1; i <= weeks; i++) {
    rows.push({
      scenario_id: sid, week_index: i,
      ads_per_week: baseFunnel.ads_per_week,
      cpl: baseFunnel.cpl,
      rebarba_sb_per_week: baseFunnel.rebarba_sb_per_week,
      show_rate_pct: baseFunnel.show_rate_pct,
      call_to_sale_pct: baseFunnel.call_to_sale_pct,
      forecast_bonus_pct: baseFunnel.forecast_bonus_pct,
      ticket_avg: baseFunnel.ticket_avg,
      payment_tax_pct: baseFunnel.payment_tax_pct,
    });
  }
  funnel.upsertWeekly(rows);

  // Ativar flag e setar weeks
  db.prepare('UPDATE scenarios SET evolutive_funnel_enabled = 1, evolutive_funnel_weeks = ? WHERE id = ?').run(weeks, sid);
  audit('UPDATE', 'scenarios', sid, { evolutive_funnel_enabled: 1, evolutive_funnel_weeks: weeks }, req.user.email);
  res.json({ ok: true });
});

router.post('/evolutive/:scenarioId/disable', requireMaster, (req, res) => {
  const sid = Number(req.params.scenarioId);
  db.prepare('UPDATE scenarios SET evolutive_funnel_enabled = 0 WHERE id = ?').run(sid);
  audit('UPDATE', 'scenarios', sid, { evolutive_funnel_enabled: 0 }, req.user.email);
  res.json({ ok: true });
});

router.post('/evolutive/:scenarioId/apply-curve', requireMaster, (req, res) => {
  const sid = Number(req.params.scenarioId);
  const b = req.body || {};
  // Curva: { plateau_week, growth: { ads_pct: 10, cpl_pct: -2, show_rate_pp: 0.5, conv_pp: 0.5 } }
  const plateauWeek = Number(b.plateau_week) || 0;
  const growth = b.growth || {};
  const adsPct = Number(growth.ads_pct) || 0;
  const cplPct = Number(growth.cpl_pct) || 0;
  const showPp = Number(growth.show_rate_pp) || 0;
  const convPp = Number(growth.conv_pp) || 0;

  const all = funnel.getWeeklyForScenario(sid);
  if (all.length === 0) return res.status(400).json({ error: 'cenário não tem timeline; ative o modo evolutivo primeiro' });

  const w1 = all[0];
  const updated = [w1];

  for (let i = 2; i <= all.length; i++) {
    const prev = updated[i - 2];
    const stayConstant = plateauWeek > 0 && i > plateauWeek;
    const ads = stayConstant ? prev.ads_per_week : prev.ads_per_week * (1 + adsPct / 100);
    const cpl = stayConstant ? prev.cpl : Math.max(0, prev.cpl * (1 + cplPct / 100));
    const showRate = stayConstant ? prev.show_rate_pct : Math.min(100, prev.show_rate_pct + showPp);
    const conv = stayConstant ? prev.call_to_sale_pct : Math.min(100, prev.call_to_sale_pct + convPp);
    updated.push({
      ...prev,
      week_index: i,
      ads_per_week: Math.round(ads),
      cpl: Math.round(cpl * 100) / 100,
      show_rate_pct: Math.round(showRate * 10) / 10,
      call_to_sale_pct: Math.round(conv * 10) / 10,
    });
  }

  funnel.upsertWeekly(updated.map((w) => ({ scenario_id: sid, ...w })));
  audit('UPDATE', 'scenario_funnel_weekly', sid, { applied_curve: true, plateau_week: plateauWeek, growth }, req.user.email);
  res.json({ ok: true, weeks: updated });
});
```

Permissão: `requireMaster` em todas (configuração estratégica é só do master).

### G.2 — Critério de aceite Fase G

- [ ] GET retorna timeline + flag enabled
- [ ] PUT salva timeline em transação
- [ ] Enable cria N semanas idênticas ao funil base atual
- [ ] Disable só seta flag (preserva dados)
- [ ] Apply-curve aplica taxa de crescimento com platô a partir da semana N
- [ ] Validações de range (% entre 0-100, valores >= 0)
- [ ] Audit log registra ações
- [ ] Commit: `feat(onda-6-G): endpoints do funil evolutivo (CRUD, enable, curva)`

---

## FASE H — UI do funil evolutivo em /funil

### H.1 — Toggle de ativação

No topo de `/funil`, ABAIXO do banner "LABORATÓRIO" e ANTES dos andares SDR/Closer, adicionar bloco de modo:

```html
<section class="funnel-mode-bar">
  <div class="funnel-mode-info">
    <span class="t-eyebrow">MODO</span>
    <h3 id="mode-title"><%= activeScenario.evolutive_funnel_enabled ? 'Evolutivo (timeline)' : 'Estático' %></h3>
    <p class="muted small">
      <% if (activeScenario.evolutive_funnel_enabled) { %>
        Funil tem <%= activeScenario.evolutive_funnel_weeks %> semanas configuradas. PEDRRA usa essa projeção semana a semana.
      <% } else { %>
        Funil tem 1 configuração que vale pra todas as semanas. PEDRRA usa multiplicação por 4.
      <% } %>
    </p>
  </div>
  <div class="funnel-mode-actions">
    <% if (!activeScenario.evolutive_funnel_enabled) { %>
      <select id="weeks-count">
        <option value="4">4 semanas</option>
        <option value="8">8 semanas</option>
        <option value="12" selected>12 semanas</option>
        <option value="24">24 semanas</option>
      </select>
      <button type="button" class="btn btn-primary" id="btn-enable-evolutive">Ativar modo evolutivo</button>
    <% } else { %>
      <button type="button" class="btn btn-ghost btn-small" id="btn-apply-curve">Aplicar curva sugerida</button>
      <button type="button" class="btn btn-ghost btn-small" id="btn-disable-evolutive">Voltar ao modo estático</button>
    <% } %>
  </div>
</section>
```

### H.2 — Tabela timeline (quando evolutivo está ON)

Quando `activeScenario.evolutive_funnel_enabled === 1`, ESCONDER as seções estáticas atuais (`.funnel-floor.sdr-floor` e `.funnel-floor.closer-floor`) e mostrar nova seção:

```html
<section class="funnel-timeline" id="funnel-timeline" data-scenario-id="<%= activeScenario.id %>">
  <div class="timeline-header">
    <h2>Timeline · <%= activeScenario.evolutive_funnel_weeks %> semanas</h2>
    <div class="timeline-actions">
      <span id="save-status" data-state="idle">salvo</span>
      <button type="button" class="btn btn-primary btn-small" id="btn-save-timeline">Salvar timeline</button>
    </div>
  </div>

  <!-- Tabela: parâmetros como linhas, semanas como colunas -->
  <div class="timeline-scroll">
    <table class="timeline-table">
      <thead>
        <tr>
          <th class="param-col">Parâmetro</th>
          <% for (let i = 1; i <= activeScenario.evolutive_funnel_weeks; i++) { %>
            <th class="week-col">Sem <%= i %></th>
          <% } %>
        </tr>
      </thead>
      <tbody>
        <!-- Cada linha é um parâmetro (ads, cpl, show rate, conv, ticket, taxa pgto) -->
        <tr data-param="ads_per_week">
          <td class="param-name">Ads/sem (R$)</td>
          <% for (let i = 1; i <= activeScenario.evolutive_funnel_weeks; i++) { %>
            <td class="week-cell"><input type="number" min="0" step="100" data-week="<%= i %>" data-param="ads_per_week" /></td>
          <% } %>
        </tr>
        <tr data-param="cpl">
          <td class="param-name">CPL (R$)</td>
          <% for (let i = 1; i <= activeScenario.evolutive_funnel_weeks; i++) { %>
            <td class="week-cell"><input type="number" min="0" step="1" data-week="<%= i %>" data-param="cpl" /></td>
          <% } %>
        </tr>
        <tr data-param="rebarba_sb_per_week">
          <td class="param-name">Rebarba SB/sem</td>
          <% for (let i = 1; i <= activeScenario.evolutive_funnel_weeks; i++) { %>
            <td class="week-cell"><input type="number" min="0" step="1" data-week="<%= i %>" data-param="rebarba_sb_per_week" /></td>
          <% } %>
        </tr>
        <tr data-param="show_rate_pct">
          <td class="param-name">Show rate (%)</td>
          <% for (let i = 1; i <= activeScenario.evolutive_funnel_weeks; i++) { %>
            <td class="week-cell"><input type="number" min="0" max="100" step="0.5" data-week="<%= i %>" data-param="show_rate_pct" /></td>
          <% } %>
        </tr>
        <tr data-param="call_to_sale_pct">
          <td class="param-name">Conv. call (%)</td>
          <% for (let i = 1; i <= activeScenario.evolutive_funnel_weeks; i++) { %>
            <td class="week-cell"><input type="number" min="0" max="100" step="0.5" data-week="<%= i %>" data-param="call_to_sale_pct" /></td>
          <% } %>
        </tr>
        <tr data-param="ticket_avg">
          <td class="param-name">Ticket médio (R$)</td>
          <% for (let i = 1; i <= activeScenario.evolutive_funnel_weeks; i++) { %>
            <td class="week-cell"><input type="number" min="0" step="100" data-week="<%= i %>" data-param="ticket_avg" /></td>
          <% } %>
        </tr>
        <!-- Resultado projetado por semana (calculado client-side, somente leitura) -->
        <tr class="result-row" data-result="receita_liquida">
          <td class="param-name strong">Receita projetada líquida</td>
          <% for (let i = 1; i <= activeScenario.evolutive_funnel_weeks; i++) { %>
            <td class="week-cell-result" data-week="<%= i %>">—</td>
          <% } %>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Time semana a semana -->
  <div class="timeline-team">
    <h3>Time</h3>
    <p class="muted small">Capacidade de cada SDR/Closer semana a semana. Marcar inativo significa que a pessoa não está no time naquela semana (ex: ainda não contratado, saída).</p>

    <table class="team-timeline-table">
      <thead>
        <tr>
          <th>Pessoa</th>
          <th>Função</th>
          <% for (let i = 1; i <= activeScenario.evolutive_funnel_weeks; i++) { %>
            <th class="week-col">S<%= i %></th>
          <% } %>
        </tr>
      </thead>
      <tbody id="team-timeline-tbody">
        <!-- linhas geradas via JS após carregar dados -->
      </tbody>
    </table>
  </div>
</section>
```

### H.3 — JS dedicado em `public/js/funil-evolutivo.js`

Novo arquivo com lógica:

- Ao carregar a página com modo evolutivo ON, fazer GET `/api/funnel/evolutive/:scenarioId`
- Preencher inputs com valores existentes
- Onchange em qualquer input, recalcular **resultado projetado da semana** (linha "receita líquida")
- Botão "Salvar timeline" coleta TODOS os valores e faz PUT em uma chamada
- Auto-save com debounce de 1.5s (status: pending → saving → saved/error)

Cálculo de receita líquida POR SEMANA (replica lógica do `lib/funnel.js` por semana):

```js
function computeWeekProjection(week, teamForWeek) {
  // Leads = ads / cpl
  const leads = week.cpl > 0 ? week.ads_per_week / week.cpl : 0;
  
  // SDR ativos nesta semana
  const activeSdrs = teamForWeek.filter((t) => t.role === 'sdr' && t.active);
  const totalSdrCapacity = activeSdrs.reduce((acc, t) => acc + Number(t.capacity_per_week || 0), 0);
  const avgShowRate = activeSdrs.length > 0
    ? activeSdrs.reduce((acc, t) => acc + Number(t.conversion_pct || 0), 0) / activeSdrs.length
    : week.show_rate_pct;

  const totalLeads = leads + Number(week.rebarba_sb_per_week || 0);
  const callsAgendadas = Math.min(totalLeads, totalSdrCapacity);
  const callsRealizadas = callsAgendadas * (avgShowRate / 100);

  // Closers — vendas em call (média ponderada, ou só pega o conv médio)
  const activeClosers = teamForWeek.filter((t) => t.role === 'closer' && t.active);
  const avgConv = activeClosers.length > 0
    ? activeClosers.reduce((acc, t) => acc + Number(t.conversion_pct || 0), 0) / activeClosers.length
    : week.call_to_sale_pct;

  const vendasCall = callsRealizadas * (avgConv / 100);
  const vendasForecast = vendasCall * (week.forecast_bonus_pct / 100);
  const vendasTotal = vendasCall + vendasForecast;

  const receitaBruta = vendasTotal * week.ticket_avg;
  const receitaLiquida = receitaBruta * (1 - week.payment_tax_pct / 100);

  return { receitaBruta, receitaLiquida, vendasTotal, callsAgendadas, callsRealizadas };
}
```

Render da linha de resultado: `formatBrl(receitaLiquida)` em cada célula.

### H.4 — CSS

```css
.funnel-mode-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 20px 24px;
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  margin-bottom: 24px;
}
.funnel-mode-info h3 { font-size: 18px; font-weight: 800; margin: 4px 0 6px; }
.funnel-mode-actions { display: inline-flex; gap: 10px; align-items: center; }

.funnel-timeline {
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: 24px;
  margin-bottom: 24px;
}
.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.timeline-actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.timeline-scroll {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.timeline-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.timeline-table thead th {
  position: sticky;
  top: 0;
  background: var(--bg-elevated);
  padding: 10px 12px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
  z-index: 2;
}
.timeline-table thead th.param-col {
  position: sticky;
  left: 0;
  z-index: 3;
  text-align: left;
  min-width: 200px;
}
.timeline-table tbody td.param-name {
  position: sticky;
  left: 0;
  background: var(--bg-card);
  font-weight: 600;
  color: var(--fg);
  padding: 10px 12px;
  border-right: 1px solid var(--line);
  min-width: 200px;
  z-index: 1;
}
.timeline-table .week-cell {
  padding: 4px 6px;
  border-bottom: 1px solid var(--line-soft);
  border-right: 1px solid var(--line-soft);
}
.timeline-table .week-cell input {
  width: 80px;
  padding: 6px 8px;
  font-size: 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  text-align: right;
  color: var(--fg);
  font-variant-numeric: tabular-nums;
}
.timeline-table .week-cell input:hover { border-color: var(--line-strong); background: rgba(255, 255, 255, 0.02); }
.timeline-table .week-cell input:focus {
  outline: none;
  border-color: var(--accent);
  background: rgba(255, 46, 90, 0.05);
  box-shadow: 0 0 0 2px var(--accent-soft);
}
.timeline-table tr.result-row td.param-name { color: var(--accent); }
.timeline-table tr.result-row .week-cell-result {
  padding: 12px;
  text-align: right;
  font-weight: 700;
  color: var(--accent);
  background: rgba(255, 46, 90, 0.04);
  border-bottom: 1px solid var(--line-soft);
  border-right: 1px solid var(--line-soft);
}

.timeline-team {
  margin-top: 32px;
}
.timeline-team h3 {
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 8px;
}

.team-timeline-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
}
.team-timeline-table th, .team-timeline-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--line-soft);
}
.team-timeline-table .person-name { font-weight: 600; }
.team-timeline-table input.week-cap {
  width: 60px;
  padding: 4px 6px;
  font-size: 11px;
  text-align: right;
}
.team-timeline-table .inactive { opacity: 0.3; background: rgba(255, 255, 255, 0.01); }
.team-timeline-table .toggle-active {
  cursor: pointer;
  font-size: 14px;
  color: var(--muted);
}
.team-timeline-table .toggle-active.is-active { color: var(--pos); }
```

### H.5 — Modal "Aplicar curva sugerida"

Quando clicar em "btn-apply-curve":

```html
<dialog id="modal-apply-curve" class="modal">
  <form id="form-apply-curve">
    <h2>Aplicar curva de crescimento</h2>
    <p class="muted">A partir da semana 1 (que já está configurada), aplica a taxa de crescimento até atingir o platô.</p>

    <div class="form-row">
      <label class="form-label">Crescimento ads/semana
        <input type="number" name="ads_pct" value="10" step="1" /> %
      </label>
      <label class="form-label">Variação CPL/semana
        <input type="number" name="cpl_pct" value="-2" step="0.5" /> %
      </label>
      <label class="form-label">Show rate +/semana
        <input type="number" name="show_rate_pp" value="0.5" step="0.5" /> p.p.
      </label>
      <label class="form-label">Conv. call +/semana
        <input type="number" name="conv_pp" value="0.5" step="0.5" /> p.p.
      </label>
    </div>

    <label class="form-label">Platô a partir da semana
      <input type="number" name="plateau_week" value="8" min="2" max="<%= activeScenario.evolutive_funnel_weeks %>" />
    </label>
    <p class="muted small">Da semana 1 até esta semana, aplica crescimento. Depois disso, mantém estável.</p>

    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-close-modal>Cancelar</button>
      <button type="submit" class="btn btn-primary">Aplicar curva</button>
    </div>
  </form>
</dialog>
```

JS: `fetch POST` para `/api/funnel/evolutive/:sid/apply-curve` com os parâmetros, depois recarrega a tabela.

### H.6 — Critério de aceite Fase H

- [ ] Toggle de modo (estático/evolutivo) no topo
- [ ] Ao ativar modo evolutivo, escolhe N semanas (4/8/12/24)
- [ ] Tabela timeline com semanas como colunas e parâmetros como linhas
- [ ] Sticky header e sticky coluna "Parâmetro"
- [ ] Linha "Receita projetada líquida" recalcula em tempo real
- [ ] Time semana a semana: capacity editável, toggle ativo/inativo
- [ ] Modal "Aplicar curva sugerida" com inputs de % de crescimento e platô
- [ ] Botão "Voltar ao estático" preserva dados do timeline
- [ ] Auto-save com status visual (idle, pending, saving, saved, error)
- [ ] Commit: `feat(onda-6-H): UI do funil evolutivo (timeline + curva sugerida)`

---

## FASE I — Integração com PEDRRA (consumir projeção semana a semana)

### I.1 — Modificar `lib/cashflow.js`

Em `getProjectedWeeklyNet(scenarioId)`:

```js
function getProjectedWeeklyNet(scenarioId) {
  const scenario = scenarios.getById(scenarioId);
  if (!scenario) return 0;

  if (scenario.evolutive_funnel_enabled) {
    // No modo evolutivo, retorna função que pega projeção da semana
    // Mas como essa função é chamada pra UMA semana, vamos refatorar mais abaixo.
    return null; // sinal para "use timeline"
  }

  // Modo estático: comportamento atual
  return computeStaticProjection(scenarioId);
}

function getProjectedNetForWeek(scenarioId, weekIndex) {
  // weekIndex = 1..N relativo à semana ATUAL do PEDRRA (1 = semana atual, 2 = próxima, etc.)
  const scenario = scenarios.getById(scenarioId);
  if (!scenario) return 0;
  if (!scenario.evolutive_funnel_enabled) return computeStaticProjection(scenarioId);

  const weekly = funnel.getWeeklyForScenario(scenarioId);
  const teamWeekly = funnel.getTeamWeeklyForScenario(scenarioId);
  const w = weekly.find((x) => x.week_index === weekIndex);
  if (!w) return 0;
  const teamForWeek = teamWeekly.filter((t) => t.week_index === weekIndex && t.active === 1);
  return computeProjectionFromWeek(w, teamForWeek);
}

function computeProjectionFromWeek(w, teamForWeek) {
  const sdrs = teamForWeek.filter((t) => /* role check via team_members */);
  // Replicar cálculo do JS do funil-evolutivo, mas server-side
  // ... (reusar lógica do lib/funnel.js)
}
```

### I.2 — Em `getWeeklyCashflow`, mapear semanas do cashflow para weekIndex do funil

```js
// Na construção do byWeek
let evoWeekIndex = 0;
for (const w of weeks) {
  if (w.is_future) evoWeekIndex++;
  const projectedForThisWeek = w.is_future
    ? getProjectedNetForWeek(scenarioId, evoWeekIndex)
    : 0;
  byWeek.set(w.week_id, {
    ...w,
    sales_projected: projectedForThisWeek,
    receivables_projected: w.is_future ? (pendingReceivablesByWeek[w.week_id] || 0) : 0,
    // ...
  });
}
```

**IMPORTANTE:** isso significa que se PEDRRA mostra 2 semanas futuras, ele puxa sem 1 e 2 do timeline. Se mostra 4, puxa 1-4. Se timeline tem 12 semanas mas PEDRRA mostra só 2, as 10 restantes do timeline ficam invisíveis (não tem onde mostrar — é projeção do funil). Isso é OK.

### I.3 — Critério de aceite Fase I

- [ ] PEDRRA com cenário em modo evolutivo puxa projeção semana a semana
- [ ] PEDRRA com cenário em modo estático mantém comportamento atual
- [ ] Tabela e gráfico do PEDRRA refletem projeção variável quando evolutivo
- [ ] Testar local: ativar evolutivo num cenário, ver que projeção PEDRRA muda
- [ ] Commit: `feat(onda-6-I): PEDRRA consome projeção do funil evolutivo semana a semana`

---

## FASE J — Validação final + push

### J.1 — Validar local

```bash
npm start
# acessar /custos, /pedrra, /funil
# testar: cada feature implementada
```

Checklist visual:
- [ ] /custos: tabela com colunas Pago/A pagar
- [ ] /custos: marcar como pago funciona com modal
- [ ] /custos: seção Recebíveis premium com 4 mini-cards e filtros
- [ ] /custos: parcelas com badge ⛓ X/N
- [ ] Botão "Exportar" abre modal
- [ ] Export XLSX baixa arquivo válido
- [ ] /funil: toggle estático/evolutivo
- [ ] /funil evolutivo: edita semana a semana, salva
- [ ] /funil: aplicar curva preenche timeline
- [ ] PEDRRA em cenário evolutivo: projeção variável

### J.2 — Listar commits

```bash
git log --oneline 6b4311a..HEAD
```

Deve mostrar 9 commits (B, C, D, E, F, G, H, I, e quaisquer correções pontuais).

### J.3 — Reportar antes do push

```
ONDA 6 concluída. Commits acumulados:
- <hash> feat(onda-6-B): tabela de custos com colunas Pago vs A pagar lado a lado
- <hash> feat(onda-6-C): recebíveis premium e linha opcional no PEDRRA
- <hash> feat(onda-6-D): visualização premium de parcelas com badge ⛓
- <hash> feat(onda-6-E): export XLSX e CSV com filtros e presets
- <hash> feat(onda-6-F): schema do funil evolutivo
- <hash> feat(onda-6-G): endpoints do funil evolutivo
- <hash> feat(onda-6-H): UI do funil evolutivo
- <hash> feat(onda-6-I): PEDRRA consome funil evolutivo

Migrations adicionadas:
- ALTER TABLE scenarios ADD evolutive_funnel_enabled, evolutive_funnel_weeks
- CREATE TABLE scenario_funnel_weekly
- CREATE TABLE scenario_team_weekly

Dependências novas: exceljs

Permissões novas: action.export_data (default 1 pra Rachel)

Aguardando OK pra git push.
```

**NÃO faça push até autorização.**

### J.4 — Critério de aceite Fase J

- [ ] Servidor sobe local sem erro
- [ ] Todas as 8 fases anteriores validadas visualmente
- [ ] Relatório enviado
- [ ] Aguardando autorização

---

## REGRAS REFORÇADAS

- 1 commit por fase
- PAUSE entre fases
- Migrations aditivas (PRAGMA check)
- Pergunte se ambíguo
- PT-BR
- Não invente

Bora.

