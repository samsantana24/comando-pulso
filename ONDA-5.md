# ONDA 5 — Caixa real: recebíveis, parcelamento, pago/a pagar, export

Sistema entra em modo "fluxo de caixa profissional". Esta onda transforma /custos numa ferramenta que a Rachel pode usar pra conciliação financeira de verdade, e dá ao master controle granular sobre custos parcelados.

**Antes de começar:** confirme em uma frase que entendeu o pedido global. Depois leia o documento INTEIRO. Só depois comece a Fase A.

**Pré-requisitos:** working tree limpo, último commit `0ffc6a7` (ou um hotfix posterior se já aplicado), branch `main`. Se algo divergir, PARE e reporte.

**Regras de processo:**
- 1 commit por fase (A, B, C, D, E, F)
- PARE ao fim de cada fase pra eu validar
- Se `npm start` falhar no sandbox, **AVISE explicitamente** em vez de seguir
- Migrations 100% aditivas (`ALTER TABLE` com `PRAGMA table_info`, `CREATE TABLE IF NOT EXISTS`)
- Não destrua dados. Em qualquer dúvida, pergunte.
- Mensagens de commit em PT-BR
- Não invente. Se algo no documento estiver ambíguo, PARE e pergunte.

---

## DECISÕES DE PRODUTO (resolvidas — não revisitar)

1. **Custos pagos vs a pagar:** continua usando o status `paid` (pago) e `planned` (a pagar) que já existem em `costs.status`. Nenhuma migração de schema necessária pra essa distinção.
2. **No PEDRRA**, a distinção entre pago e a pagar **não é exibida no gráfico**. Tanto faz: o gráfico mostra "saídas previstas/reais" como uma única massa, somando paid + planned na semana correspondente à `date` do custo. **Apenas em /custos é que essa distinção aparece, e aparece em colunas lado a lado.**
3. **Custos parcelados:** ao criar, sistema cria N **custos independentes** (não tem coluna `parent_id`, não tem custo "pai"). Cada parcela tem `description` formatada como `"<descrição original> · parcela 1/4"`, etc.
4. **Edição de parcela:** independente. Cada uma é editada/excluída sozinha.
5. **Export:** XLSX e CSV. Filtros: vendas, custos, recebíveis (qualquer combinação). Range de datas com presets.
6. **Recebíveis na tabela principal de PEDRRA:** opcional, controlado por toggle em /configuracoes. Default = OFF.
7. **Marcar como pago:** abre modal pedindo data; default = hoje.
8. **Recebíveis na /custos:** seção redesenhada (UI premium), continua existindo embaixo.

---

## FASE A — Custos parcelados

### A.1 — Modal de "Custo parcelado" (novo)

Adicionar **botão novo** na toolbar de /custos: `+ Custo parcelado`. Aparece ao lado dos outros 4 botões. Permissão: usa `action.add_cost` (mesma do botão custo).

Modal `#modal-custo-parcelado` com campos:

```
Categoria          [autocomplete]
Descrição          [input texto]    ex: "Lays - mar/abr/mai/jun"
Valor TOTAL (R$)   [number]         ex: 8000
Número de parcelas [number, min 2, max 36]
Data da 1ª parcela [date]
Frequência         [select]
                   - Mensal (mesmo dia do mês)
                   - Quinzenal (a cada 14 dias)
                   - Semanal (a cada 7 dias)
                   - Custom (cada data manual)
─────────────────────────────────────────
[ Pré-visualização das parcelas ]    ← gerado por JS
  Parcela 1/4 · 07/05/2026 · R$ 2.000,00  [editar data]
  Parcela 2/4 · 07/06/2026 · R$ 2.000,00  [editar data]
  Parcela 3/4 · 07/07/2026 · R$ 2.000,00  [editar data]
  Parcela 4/4 · 07/08/2026 · R$ 2.000,00  [editar data]
─────────────────────────────────────────
Cenário (opcional) [select]
[ Cancelar ]  [ Criar 4 parcelas ]
```

**Comportamento:**

- Quando usuário muda valor total, número de parcelas, data inicial ou frequência, o sistema **regenera** a pré-visualização instantaneamente em JS.
- Cada data na pré-visualização tem botão "editar data" — abre input date inline pra editar AQUELA parcela específica. Edição manual NÃO mexe em outras.
- Distribuição do valor: divide o total por N. Se houver resto (ex: R$ 1000 / 3 = 333.33...), atribui o "centavo de sobra" à ÚLTIMA parcela. Ex: 333.33 + 333.33 + 333.34 = 1000.00.
- Mostrar verificação: "Soma das parcelas: R$ 1000,00 ✓" (verde se bate, vermelho se não bate, mas como é gerado pelo JS, sempre vai bater).
- Validação de datas: cada data DEVE estar dentro da janela permitida (`2025-01-01` a `2030-12-31`, mesma usada nos validators).
- Botão de submit muda dinamicamente: "Criar 4 parcelas".

### A.2 — Endpoint POST `/api/costs/installments`

Novo endpoint em `routes/api/costs.js`:

```js
POST /api/costs/installments
Body:
{
  category: "Freelancer",
  description: "Lays - mar/abr/mai/jun",
  total_amount: 8000,
  installments: [
    { date: "2026-05-07", amount: 2000 },
    { date: "2026-06-07", amount: 2000 },
    { date: "2026-07-07", amount: 2000 },
    { date: "2026-08-07", amount: 2000 }
  ],
  scenario_id: null,
  status: "planned"   // sempre "planned" no momento de criação
}
```

Validações:
- `category` obrigatório, não pode ser `Tráfego Pago (Google / Meta Ads)` (reusar `rejectsAdsCategory`)
- `installments.length >= 2 && <= 36`
- Cada parcela: `amount > 0`, `date` em range válido (reusar `isDateInRange`)
- Soma das parcelas DEVE igualar `total_amount` ± R$ 0.01 (tolerância pra arredondamento)

Comportamento (em transação):

```js
const tx = db.transaction(() => {
  const created = [];
  const total = installments.length;
  for (let i = 0; i < installments.length; i++) {
    const inst = installments[i];
    const desc = description
      ? `${description} · parcela ${i + 1}/${total}`
      : `Parcela ${i + 1}/${total}`;
    const c = costs.create({
      date: inst.date,
      amount: Number(inst.amount),
      category,
      description: desc,
      status: 'planned',
      scenario_id: scenarioId,
    }, req.user.email);
    created.push(c);
  }
  audit('CREATE', 'cost_installments', null, {
    total_amount, installments_count: total, category, description,
  }, req.user.email);
  return created;
});
return res.json({ ok: true, costs: created });
```

Permissão: `requirePerm('action.add_cost')`.

### A.3 — Critério de aceite Fase A

- [ ] Botão "+ Custo parcelado" aparece na toolbar
- [ ] Modal com pré-visualização funcional (regenera ao mudar valor/datas/freq)
- [ ] Edição de data individual de cada parcela (sem afetar outras)
- [ ] Validação de soma com tolerância de centavo
- [ ] POST cria N custos em transação
- [ ] Cada custo tem `description` com `· parcela X/N`
- [ ] Audit log registra criação
- [ ] Testar local: criar Lays R$ 8k em 4x mensal → verificar 4 entradas na tabela
- [ ] Commit: `feat(onda-5-A): custos parcelados com modal e endpoint`

---

## FASE B — Tabela /custos com colunas Pago vs A pagar lado a lado

### B.1 — Novo layout da tabela principal

Hoje a tabela `weekly-grid` mostra 1 célula por semana. Mudar para **2 sub-colunas por semana**: "Pago" e "A pagar".

Estrutura nova (resumida):

```html
<table class="weekly-grid weekly-grid-split">
  <thead>
    <tr class="week-row">
      <th rowspan="2">Categoria</th>
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
    <!-- linha de vendas -->
    <!-- linha de recebíveis (NOVA) -->
    <!-- bloco de ads (paid + planned) -->
    <!-- blocos de custos por grupo (paid + planned) -->
    <!-- linha de saldo -->
  </tbody>
</table>
```

**CSS novo:** sub-colunas com cor sutil de fundo:

```css
.weekly-grid-split thead th.status-h {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.16em;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.015);
}
.weekly-grid-split thead th.paid-h { color: var(--pos); }
.weekly-grid-split thead th.planned-h { color: var(--warn); }

.weekly-grid-split td.cell-paid {
  background: rgba(34, 197, 94, 0.025);
  border-right: 1px solid rgba(255, 255, 255, 0.04);
}
.weekly-grid-split td.cell-planned {
  background: rgba(255, 165, 0, 0.025);
}
.weekly-grid-split td.cell-paid.amount,
.weekly-grid-split td.cell-planned.amount {
  font-variant-numeric: tabular-nums;
  text-align: right;
  padding: 10px 12px;
  font-size: 12px;
}
.weekly-grid-split td.cell-paid.has-value { color: var(--pos); }
.weekly-grid-split td.cell-planned.has-value { color: var(--warn); }
```

### B.2 — Lógica de cálculo na route `routes/custos.js`

Reescrever a parte de agregação para gerar **dois objetos** em vez de um:

```js
// Antes:
//   costsByGroup[grp][cat][weekId] = soma única
// Depois:
//   costsByGroupPaid[grp][cat][weekId]    = soma de paid naquela semana
//   costsByGroupPlanned[grp][cat][weekId] = soma de planned naquela semana
```

Mesma coisa pra `subtotalByGroupWeek`, `adsByWeek`, `salesByWeek`. Cada um vira `*Paid` e `*Planned`.

**Atenção:** vendas não têm distinção paid/planned (toda venda é "real"). Pra coerência visual, "PAGO" = vendas reais, "A PAGAR" = vazio (—) na linha de vendas. Mas projeção de vendas (do funil) ENTRA na coluna "A PAGAR" do PEDRRA — aqui em /custos não.

**Linha de saldo da semana** ganha 2 valores também:
- "PAGO" = vendas_real - custos_paid - ads_paid
- "A PAGAR" = -custos_planned - ads_planned (negativo, é o que vai sair)

Total da semana (combinado) aparece como antes, mas somando os dois.

### B.3 — Botões de ação por linha

Ao hover em uma célula `.cell-planned` que tenha valor, aparecem botões pequenos:
- ✓ **"Marcar como pago"** → abre modal de marcar como pago (B.4)
- ✎ **Editar** → modal de edição existente
- × **Excluir** → confirmação

Ao hover em `.cell-paid`:
- ✎ **Editar**
- ↩ **Reverter para "a pagar"** → botão que muda status de volta pra `planned`
- × **Excluir**

CSS pra esconder botões e mostrar no hover:

```css
.cell-actions {
  display: none;
  gap: 4px;
  margin-top: 4px;
}
td.amount:hover .cell-actions {
  display: inline-flex;
}
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
.cell-action-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--fg);
}
.cell-action-btn.pay { color: var(--pos); }
.cell-action-btn.revert { color: var(--warn); }
.cell-action-btn.delete { color: var(--neg); }
```

### B.4 — Modal "Marcar como pago"

Novo modal `#modal-mark-paid`:

```
Marcar como pago

Custo:        Aluguel do Escritório
Valor:        R$ 4.200,00
Data prevista: 17/05/2026

Data do pagamento *
[input date — DEFAULT = hoje]

[ Cancelar ]  [ Confirmar pagamento ]
```

Comportamento:
- Default da data = `todayYmd()`
- Submit faz `PATCH /api/costs/:id` com `{ status: 'paid', date: <data informada> }`
- Importante: a `date` do custo **muda** pra data do pagamento (decisão de produto: simplifica a contabilidade — paid sempre tem `date` = data do pagamento real)
- Após sucesso: toast "Custo marcado como pago", recarrega a tabela

Permissão: `requirePerm('action.edit_cost')`.

### B.5 — Botão "reverter para a pagar"

Endpoint: reusa `PATCH /api/costs/:id` com `{ status: 'planned' }`. Não precisa de modal — confirmação inline:

```js
if (!confirm('Reverter este custo para "a pagar"? A data do custo será mantida.')) return;
```

Permissão: `requirePerm('action.edit_cost')`.

### B.6 — Critério de aceite Fase B

- [ ] Cabeçalho com 2 sub-colunas por semana (PAGO / A PAGAR)
- [ ] Células com cor de fundo sutil (verde/laranja)
- [ ] Custos `paid` aparecem só na coluna PAGO
- [ ] Custos `planned` aparecem só na coluna A PAGAR
- [ ] Hover na célula mostra botões de ação
- [ ] Modal "marcar como pago" com data default = hoje
- [ ] Botão "reverter" funcional
- [ ] Todos os subtotais por grupo refletem a separação
- [ ] Linha de saldo da semana mostra paid e planned separados
- [ ] Testar local com 88 custos do seed
- [ ] Commit: `feat(onda-5-B): tabela de custos com colunas Pago vs A pagar`

---

## FASE C — Recebíveis premium (UI nova) e linha opcional no PEDRRA

### C.1 — Redesign da seção "Recebíveis pendentes" em /custos

Hoje é uma tabelinha pobre embaixo. Reescrever inteira.

**Nova estrutura visual:**

```
┌─────────────────────────────────────────────────────────────┐
│  RECEBÍVEIS                                  [exportar] ⤓   │
│  Próximos 60 dias                                            │
│                                                              │
│  ┌─────────────┬─────────────┬─────────────┬──────────────┐ │
│  │ ESTA SEMANA │ PRÓXIMA SEM │ EM 30 DIAS  │ TOTAL JANELA │ │
│  │  R$ 4.500   │  R$ 8.000   │  R$ 18.500  │  R$ 47.300   │ │
│  │  3 contas   │  2 contas   │  6 contas   │  12 contas   │ │
│  └─────────────┴─────────────┴─────────────┴──────────────┘ │
│                                                              │
│  [ todos ] [ vencidos ] [ esta semana ] [ próximos 7d ]    │
│                                                              │
│  ┌────────────┬─────────┬────────┬─────────────┬─────────┐  │
│  │ Vencimento │ Cliente │ Valor  │ Pagamento   │ Ações   │  │
│  ├────────────┼─────────┼────────┼─────────────┼─────────┤  │
│  │ 09/05      │ Acme    │ R$ 2k  │ Cartão 2x   │ ✓  ⌧   │  │
│  │ 12/05 ⚠    │ Beta    │ R$ 5k  │ Pix         │ ✓  ⌧   │  │
│  │ 17/05      │ Gama    │ R$ 8k  │ Cartão 6x   │ ✓  ⌧   │  │
│  └────────────┴─────────┴────────┴─────────────┴─────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Componentes:**

1. **Cabeçalho** com título e botão "exportar" (atalho pro export geral, com filtro pré-aplicado em "só recebíveis")

2. **Cards de resumo** (4 mini-KPIs):
   - Esta semana: soma + contagem
   - Próxima semana: soma + contagem
   - Em 30 dias: soma + contagem
   - Total janela: soma + contagem
   
   Cards seguem o padrão visual dos KPIs do PEDRRA (preto, brackets, hover sutil) mas **menores**, em grid `grid-template-columns: repeat(4, 1fr)`.

3. **Filtros rápidos** (chips clicáveis):
   - Todos / Vencidos / Esta semana / Próximos 7 dias / Próximos 30 dias / Próximos 60 dias
   - Filtro client-side (não precisa request); apenas oculta linhas via classe.

4. **Tabela** com colunas:
   - Vencimento (com badge "vencido" em vermelho se < hoje)
   - Cliente (preenche com `client_name`, fallback `—`)
   - Valor (tabular-nums, alinhado à direita)
   - Pagamento (`formatPaymentMethod`)
   - Ações: botão ✓ (marcar recebido) e ⌧ (cancelar/excluir)

**CSS novo (seção dedicada em app.css):**

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
}
.receivables-header .subtitle {
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
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
.recv-mini-card.is-current { border-color: var(--accent); background: var(--accent-soft); }
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
.receivables-table tbody tr {
  transition: background var(--duration-fast) var(--ease-pulso);
}
.receivables-table tbody tr:hover {
  background: rgba(255, 46, 90, 0.03);
}
.receivables-table tbody tr.overdue {
  background: rgba(255, 46, 90, 0.05);
  border-left: 3px solid var(--neg);
}
.receivables-table tbody td {
  padding: 12px;
  border-bottom: 1px solid var(--line-soft);
}
.receivables-table .num {
  text-align: right;
  font-feature-settings: 'tnum' 1;
  font-weight: 700;
}
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

### C.2 — JS de filtros e ações em `public/js/custos.js`

Adicionar ao final do arquivo:

```js
// === Receivables filtering ===
(function setupReceivablesFilters() {
  const chips = document.querySelectorAll('.filter-chip');
  const rows = document.querySelectorAll('.receivables-table tbody tr');
  if (!chips.length || !rows.length) return;

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      const filter = chip.dataset.filter;
      rows.forEach((row) => {
        row.style.display = matchesFilter(row, filter) ? '' : 'none';
      });
    });
  });

  function matchesFilter(row, filter) {
    if (filter === 'all') return true;
    const date = row.dataset.expectedDate;
    if (!date) return false;
    const today = new Date().toISOString().slice(0, 10);
    if (filter === 'overdue') return date < today;
    if (filter === 'this-week') {
      const inDays = daysBetween(today, date);
      return inDays >= 0 && inDays <= 6;
    }
    if (filter === 'next-7') {
      const inDays = daysBetween(today, date);
      return inDays >= 0 && inDays <= 7;
    }
    if (filter === 'next-30') {
      const inDays = daysBetween(today, date);
      return inDays >= 0 && inDays <= 30;
    }
    if (filter === 'next-60') {
      const inDays = daysBetween(today, date);
      return inDays >= 0 && inDays <= 60;
    }
    return true;
  }
  function daysBetween(a, b) {
    return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  }
})();
```

### C.3 — Backend: cálculos dos 4 mini-cards de resumo

Em `routes/custos.js`, adicionar:

```js
const allPending = receivables.list({ status: 'pending', from: today, to: horizon60 });

function sumAndCountInRange(items, fromDays, toDays) {
  const t = new Date(today);
  const start = new Date(t.getTime() + fromDays * 86400000).toISOString().slice(0, 10);
  const end = new Date(t.getTime() + toDays * 86400000).toISOString().slice(0, 10);
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
  inWindow: { sum: allPending.reduce((a, r) => a + Number(r.expected_amount || 0), 0), count: allPending.length },
};
```

E passar `recvSummary` na render.

### C.4 — Toggle "incluir recebíveis na linha do PEDRRA"

Setting já existe (`include_receivables_in_projection`). Aproveitar.

Em `views/pedrra.ejs`: adicionar uma **linha nova na tabela de projeção semanal**, mas só se `setting.include_receivables_in_projection === '1'`:

```
SEMANA          | 03-09mai | 10-16mai | 17-23mai | 24-30mai
Vendas (real)   | R$ 12k   | —        | —        | —
Vendas proj.    | —        | R$ 8k    | R$ 8k    | R$ 8k
Recebíveis ⓘ    | R$ 2k    | R$ 5k    | —        | —      ← NOVA, só se toggle ON
Custos          | R$ 5k    | R$ 30k   | R$ 12k   | R$ 4k
SALDO           | R$ 9k    | -R$ 17k  | -R$ 4k   | R$ 4k
```

**Atenção:** quando toggle estiver ON, a linha "SALDO" precisa **somar os recebíveis também**. Hoje em `lib/cashflow.js` isso já acontece se `include_receivables_in_projection` estiver `1`. Confirmar que continua coerente.

Ajustar a tabela em `views/pedrra.ejs` para renderizar a linha condicionalmente. Adicionar tooltip no header explicando "valores que ainda não caíram em conta, com data prevista".

### C.5 — Critério de aceite Fase C

- [ ] Seção `.receivables-panel` renderizada com 4 mini-cards de resumo
- [ ] Filtros chips funcionando (client-side)
- [ ] Linhas com badge "vencido" em vermelho
- [ ] Hover em linhas mostra fundo rosa sutil
- [ ] Botão de exportar (placeholder por ora — endpoint vem na Fase E)
- [ ] Linha "Recebíveis" na tabela do PEDRRA quando setting está ON
- [ ] Toggle em /configuracoes funciona normalmente
- [ ] Testar local com receivables criados via venda parcelada
- [ ] Commit: `feat(onda-5-C): recebíveis premium e linha opcional no PEDRRA`

---

## FASE D — Polimento de visualização das parcelas

### D.1 — Como parcelas aparecem na tabela /custos

**Decisão de UX:** parcelas aparecem como **linhas separadas** (uma por parcela) na tabela semanal, mas com tratamento visual que sinaliza que são parte de uma série.

Cada linha da parcela tem:

- Coluna "Categoria": ícone pequeno de séries `⛓` + descrição (`"Lays · parcela 1/4"`)
- Tooltip ao hover na descrição: "Custo parcelado · 4 parcelas · R$ 8.000,00 total"
- Cor levemente diferenciada (background sutil) pra agrupar visualmente

### D.2 — Detecção de parcela

Como decidimos não criar coluna `parent_id`, identifica-se parcela por **regex na descrição**:

```js
const PARCEL_RE = / · parcela (\d+)\/(\d+)$/;
function parseParcel(description) {
  if (!description) return null;
  const m = description.match(PARCEL_RE);
  if (!m) return null;
  return { current: Number(m[1]), total: Number(m[2]) };
}
```

Em `views/custos.ejs`, na linha do custo:

```ejs
<% const parcel = parseParcel(c.description); %>
<tr class="<%= parcel ? 'is-parcel' : '' %>">
  <td>
    <% if (parcel) { %>
      <span class="parcel-icon" title="Parcela <%= parcel.current %> de <%= parcel.total %>">⛓</span>
    <% } %>
    <%= c.description || c.category %>
    <% if (parcel) { %>
      <span class="parcel-tag">
        <%= parcel.current %>/<%= parcel.total %>
      </span>
    <% } %>
  </td>
  ...
</tr>
```

CSS:

```css
tr.is-parcel td {
  background: rgba(255, 215, 0, 0.025);
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
}
```

**Helper `parseParcel`** deve estar em `lib/format.js` exportado, e disponível na view via `res.locals` (lib/locals.js).

### D.3 — Critério de aceite Fase D

- [ ] Custos parcelados criados na Fase A aparecem na tabela com ícone e tag "1/4", "2/4" etc.
- [ ] Cada linha tem fundo dourado sutil
- [ ] Hover na linha mostra tooltip
- [ ] Helper `parseParcel` em `lib/format.js`
- [ ] Commit: `feat(onda-5-D): visualização premium de custos parcelados`

---

## FASE E — Export de dados (XLSX e CSV)

### E.1 — Permissão nova

Adicionar ao `lib/permissions.js`:

```js
{ key: 'action.export_data', group: 'Visualização', label: 'Exportar dados (CSV/XLSX)' },
```

Seed para Rachel: `1` (ela é o caso de uso principal).

### E.2 — Endpoint POST `/api/export`

Novo arquivo `routes/api/export.js`:

```js
POST /api/export
Body:
{
  format: 'xlsx' | 'csv',
  from: '2026-01-01',
  to: '2026-12-31',
  include: {
    sales: true,
    costs: true,
    receivables: true,
    ads: true
  },
  scenario_id: null  // null = todos cenários
}
```

Comportamento:

- Valida `from`/`to` em range permitido
- Valida `include` tem pelo menos 1 true
- Para CSV: gera **um arquivo único** com colunas:
  ```
  type,date,category,description,gross_amount,net_amount,amount,status,payment_method,client_name,scenario,parcel_info
  ```
  Cada linha é um registro. `type` ∈ {`sale`, `cost`, `ads`, `receivable`}.
  
- Para XLSX: gera **múltiplas abas** (uma por categoria solicitada):
  - Aba "Vendas"
  - Aba "Custos"
  - Aba "Investimento em Ads"
  - Aba "Recebíveis"
  - Aba "Resumo" com totais agregados por categoria/mês

**Lib pra XLSX:** usar `exceljs` (mais flexível que `xlsx`). Adicionar a dependência ao `package.json`.

Permissão: `requirePerm('action.export_data')`.

### E.3 — UI de export em /custos e /pedrra

Novo botão "Exportar" no canto superior direito de /custos e /pedrra. Ao clicar, abre modal:

```
EXPORTAR DADOS

Formato
[ XLSX (Excel) ]  [ CSV ]      ← dois botões pill, um selecionado

Período
[ Esta semana ] [ Este mês ] [ Últimos 30 dias ] [ Trimestre ] [ Ano todo ] [ Personalizado ]

[ De: 01/05/2026 ]  [ Até: 31/05/2026 ]

O que incluir?
☑ Vendas
☑ Custos
☑ Investimento em Ads
☑ Recebíveis
─────────────
[ Cancelar ]    [ Baixar arquivo ]
```

Presets de período (ao clicar, preenche os 2 inputs `de`/`até`):
- **Esta semana:** domingo até sábado da semana atual
- **Este mês:** dia 1 do mês atual até hoje
- **Últimos 30 dias:** hoje - 30 até hoje
- **Trimestre:** primeiro dia do trimestre atual até hoje
- **Ano todo:** 1 de janeiro do ano atual até 31 de dezembro do ano atual
- **Personalizado:** mantém os campos editáveis

Ao clicar "Baixar":
- Mostra spinner no botão
- Faz POST `/api/export` 
- Recebe arquivo (Content-Disposition: attachment)
- Browser baixa automaticamente
- Toast "Exportação concluída ✓"

### E.4 — Implementação técnica do export

**Para CSV:**

```js
const items = [];
if (include.sales) {
  for (const s of sales.list({ from, to })) {
    items.push({
      type: 'sale',
      date: s.date,
      category: '—',
      description: s.notes || '',
      gross_amount: s.gross_amount,
      net_amount: s.net_amount,
      amount: '',
      status: 'real',
      payment_method: s.payment_method || '',
      client_name: s.client_name || '',
      scenario: '',
      parcel_info: '',
    });
  }
}
// análogo pra costs (com is_ads filter), ads, receivables...

// Gerar CSV com bibioteca csv-stringify ou Manual:
const headers = ['type','date','category','description','gross_amount','net_amount','amount','status','payment_method','client_name','scenario','parcel_info'];
const csv = [
  headers.join(','),
  ...items.map((it) => headers.map((h) => csvEscape(it[h])).join(',')),
].join('\n');
// BOM pra Excel-friendly:
const csvWithBom = '\ufeff' + csv;
res.set({
  'Content-Type': 'text/csv; charset=utf-8',
  'Content-Disposition': `attachment; filename="comando-pulso-export-${today}.csv"`,
});
res.send(csvWithBom);
```

`csvEscape` lida com vírgulas e quebras de linha (envolve em aspas duplas se necessário, escapa aspas internas).

**Para XLSX:**

```js
const ExcelJS = require('exceljs');
const workbook = new ExcelJS.Workbook();
workbook.creator = 'Comando Pulso';
workbook.created = new Date();

if (include.sales) {
  const sheet = workbook.addWorksheet('Vendas');
  sheet.columns = [
    { header: 'Data', key: 'date', width: 12 },
    { header: 'Bruto', key: 'gross_amount', width: 14, style: { numFmt: '"R$" #,##0.00' } },
    { header: 'Líquido', key: 'net_amount', width: 14, style: { numFmt: '"R$" #,##0.00' } },
    { header: 'Pagamento', key: 'payment_method', width: 16 },
    { header: 'Cliente', key: 'client_name', width: 24 },
    { header: 'Observações', key: 'notes', width: 30 },
  ];
  for (const s of sales.list({ from, to })) {
    sheet.addRow({
      date: s.date,
      gross_amount: Number(s.gross_amount),
      net_amount: Number(s.net_amount),
      payment_method: formatPaymentMethod(s.payment_method),
      client_name: s.client_name,
      notes: s.notes,
    });
  }
  // Estilos do header
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E5A' } };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
}

// Análogo pra costs, ads, receivables, e aba "Resumo" com agregações.

const buffer = await workbook.xlsx.writeBuffer();
res.set({
  'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'Content-Disposition': `attachment; filename="comando-pulso-${today}.xlsx"`,
});
res.send(Buffer.from(buffer));
```

### E.5 — Critério de aceite Fase E

- [ ] `exceljs` adicionado ao package.json
- [ ] Permissão `action.export_data` criada e seedada
- [ ] Endpoint `POST /api/export` funcionando
- [ ] Modal de export com presets e date range
- [ ] CSV gera arquivo com BOM (Excel-friendly)
- [ ] XLSX gera arquivo com 4 abas (Vendas, Custos, Ads, Recebíveis) + Resumo
- [ ] Botão de export em /custos e /pedrra
- [ ] Spinner durante geração
- [ ] Toast ao finalizar
- [ ] Rachel (com permissão) consegue exportar
- [ ] Testar local: gerar XLSX e abrir no LibreOffice/Excel
- [ ] Commit: `feat(onda-5-E): export de dados em XLSX e CSV com filtros`

---

## FASE F — Validação final + push

1. Rodar `npm start` e validar /custos sem erro
2. Listar 5 commits acumulados (A-E)
3. Reportar: arquivos novos, arquivos modificados, migrations, dependências novas
4. **NÃO faça push até eu autorizar**

---

## REGRAS REFORÇADAS

- 1 commit por fase
- Pause entre fases pra eu validar
- Migrations aditivas, nunca destrutivas
- Sandbox bloqueando: AVISE em vez de seguir
- PT-BR nos commits
- Pergunta se ambíguo

Bora.

