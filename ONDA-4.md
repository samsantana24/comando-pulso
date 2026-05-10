# ONDA 4 — Correções, controle de Rachel e upgrade visual S-tier

Esta onda fecha 3 frentes ao mesmo tempo, em fases sequenciais:

**Frente 1 (CRÍTICA):** corrigir bugs reportados na auditoria externa pós-ONDA 3.
**Frente 2 (PRODUTO):** dar ao master controle TOTAL e granular do que Rachel pode/não pode fazer, com UI clara em /configuracoes.
**Frente 3 (VISUAL):** elevar o sistema visualmente a um patamar acima — não é re-trabalho da ONDA 3, é a próxima camada.

---

## 0. ANTES DE COMEÇAR — CONFIRMAÇÕES OBRIGATÓRIAS

Confirme em uma frase que entendeu o pedido global. Depois leia o documento inteiro **antes de tocar em qualquer arquivo**.

**Regras de processo (não-negociáveis após o relatório de auditoria):**

1. **Um commit por fase.** Sem juntar. Sem juntar mesmo se parecer que vai ser rapidinho.
2. **PARE ao fim de cada fase** e me avise pra eu validar antes de seguir.
3. **TESTE LOCAL com `npm start`** ao fim de cada fase. Se o sandbox bloquear, **me avise explicitamente** em vez de seguir sem testar. Eu vou descobrir do mesmo jeito depois — melhor saber agora.
4. **Não invente features.** Se o documento não pedir, não faça. Se algo estiver ambíguo, pergunte.
5. **Migrations 100% aditivas.** `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE` com check via `PRAGMA table_info`. Nada destrutivo.
6. **Nenhum push até a Fase F concluir.** Acumula commits localmente. Eu valido todos juntos no final.

**Pré-requisitos antes de codar:**

Faça `git status` e `git log --oneline -5`. Confirme que:
- Working tree está limpo
- Último commit é `e03b128 feat: permissoes granulares Rachel + modo privado + persistencia janela`
- Branch é `main`

Se algo divergir, **PARE** e me reporte.

---

## FASE A — Correções de bugs críticos identificados na auditoria

### A.1 — Aplicar `requirePerm` em `routes/api/recurrences.js`

**Problema:** UI esconde botões de recorrência pra Rachel via `userCan`, mas a API não valida. Rachel pode chamar a rota direto via DevTools console.

**Mudança:**
- Em `routes/api/recurrences.js`, importar `requirePerm` de `lib/permissions`.
- Aplicar:
  - `POST /` → `requirePerm('action.add_recurring_cost')`
  - `PATCH /:id` → `requirePerm('action.add_recurring_cost')` (mesma chave; não vamos criar `edit_recurring_cost` agora pra não inflar catálogo)
  - `DELETE /:id` → `requirePerm('action.add_recurring_cost')`

### A.2 — Garantir `userCan` propagado em todas as views

**Problema:** quando uma view faz `<%- include('partials/header', { ... }) %>` passando objeto literal, o EJS substitui os locals do contexto. Se uma rota esquecer de propagar `res.locals.userCan`, o header cai num fallback que limita Rachel a ver só "Custos".

**Mudança em `lib/locals.js`:** garantir que `res.locals.userCan` seja **sempre** uma função, e que `res.locals.user` esteja presente, em **toda** request autenticada. Hoje isso já existe parcialmente; auditar e fortalecer.

**Mudança nos `routes/{pedrra,custos,funil,configuracoes}.js`:** quando fizerem `res.render(...)`, passar explicitamente `userCan: res.locals.userCan` no objeto de locais. Não confiar no comportamento implícito do EJS.

**Mudança nos `views/partials/header.ejs` e qualquer view com `<%- include('partials/header', { ... }) %>`:** sempre incluir `userCan: userCan` na chamada do include.

**Critério de teste manual:** depois desta fase, conferir login como master vê todas as abas, login como financeiro respeita o painel de permissões.

### A.3 — Atualizar `docs/SCHEMA.md` com a tabela `permissions`

Adicionar a definição da tabela e o seed inicial em `docs/SCHEMA.md`. Manter o estilo do resto do documento (SQL bloco + comentário curto explicando semântica).

### A.4 — Limpar imports mortos de `requireMaster`

Em:
- `routes/funil.js`
- `routes/pedrra.js`
- `routes/api/ads-week.js`

Remover o `const { requireMaster } = require(...)` que ficou após a refatoração. Não quebra nada, é higiene.

### A.5 — Tratar toolbar vazia para Rachel

**Problema:** se Rachel tiver todas as 4 permissões de "+ adicionar" desligadas, a `<div class="toolbar-actions">` fica vazia mas visível, deixando um espaço em branco no topo.

**Mudança em `views/partials/data-entry.ejs` (ou onde a toolbar é renderizada):** envolver `.toolbar-actions` em uma checagem: se nenhum dos 4 botões será renderizado, **não renderizar a div de toolbar inteira**. Isso evita espaço em branco.

```ejs
<% const showToolbar = userCan('action.add_sale') || userCan('action.add_cost') || userCan('action.add_recurring_cost') || userCan('action.add_ads'); %>
<% if (showToolbar) { %>
  <section class="toolbar">
    <div class="toolbar-actions">
      <% if (userCan('action.add_sale')) { %><button ...>+ Venda</button><% } %>
      ...
    </div>
  </section>
<% } %>
```

### A.6 — Cobrir Chart.js no modo privado

**Problema reportado:** modo privado oculta valores em tabelas/cards (via `body.values-hidden .money`) mas o eixo Y do Chart.js continua mostrando "R$ 87k", "R$ 120k". Vazamento parcial.

**Mudança em `public/js/pedrra.js`:**
- Ouvir o evento custom `privacy:changed` (já é emitido pelo `privacy.js`).
- Quando `detail.hidden === true`, alterar callback do tick do eixo Y pra retornar `'••••'` em vez do valor formatado, e callback do tooltip pra ocultar valores também.
- Quando volta a falso, restaurar callbacks normais.

```js
document.addEventListener('privacy:changed', (e) => {
  const hidden = e.detail.hidden;
  if (!chart) return;
  // Eixo Y
  chart.options.scales.y.ticks.callback = hidden
    ? () => '••••'
    : (v) => formatBrlCompact(v);
  // Tooltip
  chart.options.plugins.tooltip.callbacks.label = hidden
    ? (ctx) => ctx.dataset.label + ': ••••'
    : originalTooltipLabel;
  chart.update();
});
```

(Salvar `originalTooltipLabel` como referência fora.)

### A.7 — Otimizar `MutationObserver` do `privacy.js`

**Problema:** observer percorre todo o DOM a cada mutação. Em escala vai engasgar.

**Mudança em `public/js/privacy.js`:**
- Trocar o `MutationObserver` que observa `document.body` com `subtree: true, childList: true` por uma estratégia **debounced**: o observer agenda re-tag depois de 200ms de quietude. Múltiplas mutações em sequência viram **uma** varredura.
- Restringir a varredura a um seletor curto: `document.querySelectorAll('.kpi-card-value, .amount, .num, [data-money], td.amount, .total, .subtotal')`. Não percorrer tree inteiro.
- Manter o auto-tag baseado em regex apenas no boot inicial (uma vez), não em cada mutação.

### Critério de aceite Fase A
- [ ] `requirePerm` aplicado em recurrences.js
- [ ] `userCan` chega em todas as views e partials testadas (login como master e como financeiro respondendo às permissões)
- [ ] `docs/SCHEMA.md` documenta tabela `permissions`
- [ ] Imports mortos removidos
- [ ] Toolbar não renderiza se vazia
- [ ] Chart.js respeita modo privado
- [ ] `privacy.js` debounce 200ms + seletor restrito
- [ ] Commit: `fix(onda-4-A): correções pós-auditoria`

---

## FASE B — Painel de gestão de permissões da Rachel (UX completa)

O painel atual em `/configuracoes` lista permissões mas é cru. Vamos refazer pra **realmente** dar controle.

### B.1 — Catálogo expandido de permissões

Adicionar permissões que faltavam, refletindo gap identificado na auditoria:

**Adicionar ao `lib/permissions.js`:**

```js
{ key: 'action.edit_recurring_cost', group: 'Custos', label: 'Editar custo recorrente' },
{ key: 'action.delete_recurring_cost', group: 'Custos', label: 'Excluir custo recorrente' },

{ key: 'action.add_receivable', group: 'Recebíveis', label: 'Adicionar conta a receber' },
{ key: 'action.edit_receivable', group: 'Recebíveis', label: 'Editar conta a receber' },
{ key: 'action.mark_received', group: 'Recebíveis', label: 'Marcar conta como recebida' },
{ key: 'action.delete_receivable', group: 'Recebíveis', label: 'Excluir conta a receber' },

{ key: 'view.scenarios_list', group: 'Visualização', label: 'Ver lista de cenários' },
{ key: 'view.audit_log', group: 'Visualização', label: 'Ver log de auditoria' }, // já existia
{ key: 'view.team', group: 'Visualização', label: 'Ver time comercial' },
```

**Aplicar `requirePerm` correspondente em:**
- `routes/api/recurrences.js` (PATCH/DELETE → `action.edit_recurring_cost`/`action.delete_recurring_cost`)
- `routes/api/receivables.js` (POST/PATCH/POST mark-received/DELETE)

**Seed defaults para Rachel** (idempotente via `INSERT OR IGNORE`):
- `action.edit_recurring_cost` = 1
- `action.delete_recurring_cost` = 0
- `action.add_receivable` = 1
- `action.edit_receivable` = 1
- `action.mark_received` = 1
- `action.delete_receivable` = 0
- `view.scenarios_list` = 0
- `view.team` = 1

### B.2 — UI nova de permissões em /configuracoes

**Substituir a seção atual de permissões por uma UI mais usável:**

```html
<section class="settings-card permissions-panel">
  <div class="permissions-header">
    <h2>Permissões da equipe</h2>
    <p class="muted">Configure exatamente o que cada role pode fazer no sistema.</p>
  </div>

  <div class="permissions-role-tabs">
    <button class="role-tab is-active" data-role="financeiro">
      <span class="role-tab-icon">FN</span>
      <span class="role-tab-label">
        <span class="role-tab-name">Financeiro</span>
        <span class="role-tab-sub">ex: Rachel Moghrabi</span>
      </span>
    </button>
    <!-- futuro: outros roles aqui -->
  </div>

  <div class="permissions-actions-bar">
    <div class="permissions-summary" id="permissions-summary">
      <strong id="perm-count-on">0</strong> de <strong id="perm-count-total">0</strong> permissões ativas
    </div>
    <div class="permissions-quick-actions">
      <button type="button" class="btn btn-ghost btn-small" data-preset="default">Padrão sistema</button>
      <button type="button" class="btn btn-ghost btn-small" data-preset="all-on">Liberar tudo</button>
      <button type="button" class="btn btn-ghost btn-small" data-preset="all-off">Bloquear tudo</button>
    </div>
  </div>

  <div class="permissions-groups" id="permissions-groups">
    <!-- preenchido por JS -->
  </div>

  <div class="permissions-footer">
    <button type="button" class="btn btn-primary" id="btn-save-perms">Salvar alterações</button>
    <span class="permissions-status" id="permissions-status"></span>
  </div>
</section>
```

**JS em `public/js/configuracoes.js`:**

- Carrega `GET /api/permissions?role=financeiro` no boot
- Renderiza grupos com toggle switches (não checkboxes brutos)
- Cada grupo tem ícone discreto (Navegação ⊞, Vendas ●, Custos ▣, Ads ★, Recebíveis ◆, Visualização ◉)
- Toggle de grupo "Selecionar todos do grupo"
- Pesquisa rápida no topo (filtro client-side)
- Botão "Salvar" mostra spinner e "salvo às HH:MM"
- Botões de preset:
  - **Padrão sistema:** aplica os defaults do seed (volta a Rachel ao estado padrão)
  - **Liberar tudo:** marca todas as permissões
  - **Bloquear tudo:** desmarca tudo (Rachel fica trancada — útil pra contas temporariamente suspensas)
- Confirmação dupla pro botão "Liberar tudo" e "Bloquear tudo" via `confirm()`

**CSS novo em `public/css/app.css`** (seção "Permissões avançadas"):

```css
.permissions-panel { /* override do .settings-card pra ser mais largo */ }

.permissions-role-tabs {
  display: flex;
  gap: 8px;
  margin: 24px 0;
  border-bottom: 1px solid var(--line);
  padding-bottom: 0;
}
.role-tab {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-pulso);
}
.role-tab:hover { color: var(--fg-soft); }
.role-tab.is-active {
  color: var(--fg);
  border-bottom-color: var(--accent);
}
.role-tab-icon {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: var(--accent-soft);
  border: 1px solid var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--accent);
}
.role-tab.is-active .role-tab-icon { background: var(--accent); color: #000; }
.role-tab-label { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.role-tab-name { font-size: 14px; font-weight: 700; letter-spacing: -0.01em; }
.role-tab-sub { font-size: 11px; color: var(--muted); font-weight: 500; }

.permissions-actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin: 16px 0 24px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.permissions-summary { color: var(--muted); font-size: 13px; }
.permissions-summary strong { color: var(--fg); font-weight: 800; }
.permissions-quick-actions { display: inline-flex; gap: 6px; }

.permissions-groups { display: flex; flex-direction: column; gap: 14px; }

.perm-group {
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.perm-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  user-select: none;
}
.perm-group-head h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg);
  margin: 0;
}
.perm-group-icon {
  width: 24px; height: 24px;
  border-radius: 6px;
  background: var(--accent-soft);
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}
.perm-group-meta { display: inline-flex; align-items: center; gap: 12px; color: var(--muted); font-size: 12px; }
.perm-group-meta strong { color: var(--accent); font-weight: 800; }

.perm-group-body { padding: 8px; }

.perm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-radius: var(--radius);
  transition: background var(--duration-fast) var(--ease-pulso);
}
.perm-row:hover { background: rgba(255, 255, 255, 0.025); }
.perm-row-label {
  flex: 1;
  font-size: 13px;
  color: var(--fg);
  font-weight: 500;
}
.perm-row-key {
  display: block;
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--dim);
  letter-spacing: 0;
}

/* === Toggle switch === */
.toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--line-strong);
  border-radius: 22px;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-pulso);
}
.toggle-slider::before {
  content: '';
  position: absolute;
  height: 16px; width: 16px;
  left: 3px; top: 3px;
  background: var(--fg);
  border-radius: 50%;
  transition: transform var(--duration-fast) var(--ease-pulso);
}
.toggle input:checked + .toggle-slider { background: var(--accent); box-shadow: 0 0 12px var(--accent-glow); }
.toggle input:checked + .toggle-slider::before { transform: translateX(18px); }
.toggle input:focus-visible + .toggle-slider { outline: 2px solid var(--accent); outline-offset: 2px; }

.permissions-footer {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}
.permissions-status { font-size: 12px; color: var(--muted); }
.permissions-status.is-saving { color: var(--warn); }
.permissions-status.is-saved { color: var(--pos); }
.permissions-status.is-error { color: var(--neg); }
```

### B.3 — Endpoint POST `/api/permissions/preset`

Adicionar:
```
POST /api/permissions/preset
body: { role: 'financeiro', preset: 'default' | 'all-on' | 'all-off' }
```

- `default`: aplica defaults atuais do `migrations.js` seed
- `all-on`: marca tudo como `allowed = 1`
- `all-off`: marca tudo como `allowed = 0` (mas força `nav.custos = 1` pra Rachel não ficar 100% trancada — explica isso na resposta)

Protegido por `requireMaster`. Auditoria via `audit('UPDATE', 'permissions', ...)`.

### Critério de aceite Fase B
- [ ] Permissões novas no catálogo (recurring, receivables, view.team, view.scenarios_list)
- [ ] `requirePerm` aplicado nas rotas correspondentes
- [ ] UI nova com tabs por role, toggles, presets
- [ ] Seed idempotente para defaults novos
- [ ] Endpoint preset
- [ ] Login como Rachel respeita 100% das permissões
- [ ] Login como master vê o painel completo e consegue alternar
- [ ] Commit: `feat(onda-4-B): permissões expandidas + UI completa de gestão`

---

## FASE C — Edição completa de Ads (gap reportado na auditoria)

Você prometeu "edição completa de ads" mas só aplicou permissões nos endpoints existentes. Falta UX de edição.

### C.1 — Coluna de ações na tabela de Custos para a linha de Ads

Hoje a tabela em `/custos` mostra a linha "Investimento em Ads" com totais semanais, mas sem ações. Adicionar:

- **Botão "editar" pequeno** ao lado do total da semana, em cada célula de Ads que tenha valor
- **Botão "remover"** ao lado, com confirmação dupla

### C.2 — Modal de editar Ads de uma semana específica

Quando clicar em "editar" numa célula de ads:
- Abrir modal `#modal-edit-ads-week`
- Pré-preencher: `week_start_date` (domingo da semana) e `total_amount` (soma dos 7 dias)
- Permitir alterar valor
- Submit faz `POST /api/ads-week` (que já é upsert — reaproveita lógica)

### C.3 — Botão "remover" Ads daquela semana

- Confirmação: "Remover R$ X.XXX em Ads da semana W19? Esta ação apaga os 7 lançamentos diários."
- Faz `DELETE /api/ads-week?week_start_date=YYYY-MM-DD&scenario_id=null`

### C.4 — Histórico de Ads na aba /custos

Abaixo da tabela principal, nova seção:

```
INVESTIMENTO EM ADS — HISTÓRICO
─────────────────────────────────
Semana          Total       Diário    Ações
W19 · 03–09mai  R$ 7.000    R$ 1.000  [editar] [remover]
W20 · 10–16mai  R$ 8.500    R$ 1.214  [editar] [remover]
...
```

Endpoint para alimentar: `GET /api/ads-week` já existe e retorna agrupado por semana. Renderizar essa lista em ordem reversa (mais recente primeiro).

### Critério de aceite Fase C
- [ ] Botões editar/remover na linha de ads da tabela de custos
- [ ] Modal de editar ads funcionando
- [ ] Confirmação de remoção
- [ ] Seção "histórico de ads" abaixo da tabela
- [ ] Permissões respeitadas (`action.edit_ads`, `action.delete_ads`)
- [ ] Commit: `feat(onda-4-C): edição completa de Ads com histórico`

---

## FASE D — Upgrade visual S-tier (alma do sistema)

A ONDA 3 estabeleceu base visual sólida (Inter, preto, rosa, brackets). Agora vamos elevar o **detalhamento e a profundidade** que diferenciam um app premium de um app "bem feito".

### Princípios desta fase

1. **Profundidade real.** Layers de elevação visíveis. Bordas tornam-se gradientes sutis. Cards ganham vida com efeitos de hover refinados.
2. **Movimento mais rico.** Não só fade-in. Parallax sutil, easing escalonado, micro-bouncing.
3. **Tipografia heroica nos números.** Os números do KPI viram protagonistas absolutos.
4. **Iconografia.** Substituir emojis por ícones SVG inline em pontos chave.
5. **Sound design visual.** Loading states com personalidade. Transitions mais cinematográficos.

### D.1 — Sistema de elevação refinado

Adicionar tokens novos no `:root`:

```css
:root {
  /* Elevação: 6 níveis */
  --elev-0: #000000;
  --elev-1: #08080A;
  --elev-2: #0E0E11;
  --elev-3: #15151A;
  --elev-4: #1C1C22;
  --elev-5: #25252D;

  /* Bordas em gradiente (técnica avançada) */
  --border-grad: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 50%, rgba(255,46,90,0.08) 100%);
  --border-grad-accent: linear-gradient(135deg, rgba(255,46,90,0.4) 0%, rgba(255,46,90,0.1) 50%, rgba(255,255,255,0.08) 100%);

  /* Glows por contexto */
  --glow-card-hover: 0 20px 60px -10px rgba(255, 46, 90, 0.15);
  --glow-button-pressed: 0 0 0 4px rgba(255, 46, 90, 0.18);
  --glow-input-focus: 0 0 0 3px rgba(255, 46, 90, 0.2), 0 0 24px rgba(255, 46, 90, 0.1);

  /* Espaçamento responsivo */
  --gutter: clamp(16px, 2.4vw, 32px);
}
```

### D.2 — KPI Cards reformulados

**Mudança visual completa.** Hoje são funcionais mas planos. Vamos:

- Aumentar tipografia dos valores: `clamp(28px, 3vw, 44px)` no card primário, `clamp(22px, 2.2vw, 32px)` nos demais
- Card primário (Caixa Hoje) recebe **borda gradiente animada** (técnica de pseudo-elementos):

```css
.kpi-card.kpi-primary {
  background: var(--elev-2);
  position: relative;
  isolation: isolate;
}
.kpi-card.kpi-primary::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: var(--border-grad-accent);
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: -1;
  opacity: 0;
  transition: opacity var(--duration) var(--ease-pulso);
}
.kpi-card.kpi-primary:hover::before { opacity: 1; }
```

- **Mini-sparkline embutida** no rodapé do card primário: usar Chart.js mini renderizado em canvas pequeno (sem eixos, sem grid, só a linha) mostrando os últimos 8 dias de caixa. Dá vida e contexto instantâneo.
- Hover do card eleva o número com translação Y de 2px (eased)
- Brackets dos cantos tornam-se mais finos (1px → linha estilizada) e ganham animação na entrada

### D.3 — Tabela com profundidade

Hoje as tabelas são clean mas planas. Adicionar:

- **Sticky header** ao rolar (já feito? confirmar e refinar visual)
- **Linha de hover destaca a coluna toda** (truque CSS com `tr:hover ~ tr`) — efeito Excel-like
- **Bordas verticais** sutilíssimas entre colunas (apenas nas células .num): `border-right: 1px solid rgba(255,255,255,0.04)`
- Ao **clicar numa linha**, ela "expande" mostrando detalhes inline (ex: data exata, criado por, descrição expandida) com animação de slide
- Linha do **subtotal por grupo** ganha barra lateral colorida fina (3px) na esquerda

### D.4 — Botões com personalidade

Botão primário hoje é um retângulo rosa. Vamos adicionar:

- **Ripple effect** ao clicar (CSS puro, sem JS)
- **Brilho que percorre** ao hover (linear gradient animado da esquerda pra direita)
- **Indicador de "pressionado"** sutil no `:active`

```css
.btn-primary {
  position: relative;
  overflow: hidden;
}
.btn-primary::after {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
  transition: left 0.6s var(--ease-pulso);
  pointer-events: none;
}
.btn-primary:hover::after { left: 100%; }
```

### D.5 — Header com indicador de cenário visual mais forte

O dropdown de cenário ativo hoje é um pill simples. Aprimorar:

- Mostrar **ícone colorido** (círculo da cor do cenário) à esquerda
- Quando aberto, **mostrar mini-preview** do KPI principal de cada cenário ao hover (ex: "Caixa projetado em 4 semanas: R$ XX")
- Animação de entrada do dropdown mais suave (já tem, mas suavizar timing)

### D.6 — Página `/configuracoes` redesenhada

Hoje as seções são todas iguais. Diferenciar visualmente:

- **Seção "Saldo e cálculos"** ganha card com borda gradiente accent (mais importante)
- **Seção "Categorias"** ganha grid de cards por grupo (mais visual que lista)
- **Seção "Time"** ganha avatares circulares com inicial colorida
- **Seção "Audit log"** ganha cores por tipo de ação (CREATE = verde sutil, UPDATE = âmbar, DELETE = vermelho)

### D.7 — Loading skeletons

Ao carregar o `/pedrra` pela primeira vez, antes do JS renderizar, mostrar **skeletons** dos KPIs (placeholders com shimmer):

```css
.kpi-skeleton {
  background: linear-gradient(90deg, var(--elev-1) 25%, var(--elev-2) 50%, var(--elev-1) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s infinite;
  border-radius: var(--radius-lg);
  height: 120px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

E swap pra cards reais quando o JS terminar de processar.

### D.8 — Iconografia SVG inline

Substituir emojis e textos como "+ Venda" por **ícone + label**:

- "+ Venda" → ícone de tag ↘ + "Venda"
- "+ Custo" → ícone de menos circulado + "Custo"
- "+ Investimento em Ads" → ícone de zap + "Ads"
- "Editar" → ícone de pencil + texto
- "Excluir" → ícone de trash + texto

Criar arquivo `views/partials/icons.ejs` com SVGs reutilizáveis. Padrão: 16x16px, `stroke: currentColor`, `fill: none`, `stroke-width: 1.5`.

### D.9 — Tipografia escalada e ritmo vertical

Definir escala tipográfica modular (1.250 — Major Third):

```css
:root {
  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 14px;
  --text-md: 17px;
  --text-lg: 21px;
  --text-xl: 27px;
  --text-2xl: 33px;
  --text-3xl: 42px;
  --text-4xl: 52px;
  --text-5xl: 65px;

  --leading-tight: 1.1;
  --leading-normal: 1.55;
  --leading-loose: 1.8;
}
```

Aplicar consistentemente em headings e textos. Ritmo vertical baseado em múltiplos de 8px.

### D.10 — Easter egg refinado

Quando o cursor passa sobre o brand mark ("PULSO"), em vez de pulse simples, fazer:
- Linha SVG do brand mark **redesenhar** (animação de path stroke de 0% a 100%)
- Glow rosa intensifica
- Texto "PULSO" tem letter-spacing aumentado momentaneamente (+0.04em)

### Critério de aceite Fase D
- [ ] Sistema de elevação `--elev-0` a `--elev-5` aplicado consistentemente
- [ ] KPI primário com borda gradiente animada + sparkline
- [ ] Tabelas com hover de coluna, expansão ao clicar, barras laterais nos subtotais
- [ ] Botão primário com brilho percorrendo
- [ ] Dropdown de cenário com cor + preview
- [ ] /configuracoes com seções diferenciadas visualmente
- [ ] Skeletons de loading
- [ ] Ícones SVG inline em ações principais
- [ ] Escala tipográfica `--text-xs` a `--text-5xl`
- [ ] Brand mark com animação de path
- [ ] Commit: `design(onda-4-D): upgrade visual S-tier — profundidade e alma`

---

## FASE E — Segurança (regenerate session)

### E.1 — `req.session.regenerate()` após login bem-sucedido

**Problema:** OWASP recomenda regenerar session ID em toda mudança de privilégio. Evita Session Fixation.

**Mudança em `routes/auth.js`:**

```js
req.logIn(user, (loginErr) => {
  if (loginErr) return res.redirect('/login?error=...');
  req.session.regenerate((regenErr) => {
    if (regenErr) return res.redirect('/login?error=Falha%20de%20sessão');
    req.session.passport = { user: user.id };
    req.session.save((saveErr) => {
      if (saveErr) return res.redirect('/login?error=Falha%20ao%20salvar%20sessão');
      if (user.totp_enabled) return res.redirect('/totp/verify');
      return res.redirect('/totp/setup');
    });
  });
});
```

E no `POST /totp/verify`, fazer regenerate antes de marcar `totp_verified = true`.

### Critério de aceite Fase E
- [ ] Login regenera session ID
- [ ] TOTP verify regenera session ID
- [ ] Login funciona normalmente (testar local!)
- [ ] Commit: `security(onda-4-E): regenerate session após login e TOTP`

---

## FASE F — Validação final + push

### F.1 — Rodar npm start e validar

Subir o servidor local. Acessar:
- `/login` — renderiza sem erro
- Tentar login (mock se necessário sem Google) ou validar via curl

Se sandbox bloquear, **AVISE EXPLICITAMENTE** em vez de seguir.

### F.2 — Listar todos os commits acumulados

```
git log --oneline e03b128..HEAD
```

Deve mostrar 5 commits (A, B, C, D, E).

### F.3 — Reportar tudo ao usuário

Antes do push, gerar um relatório curto (no chat, não em arquivo):

```
ONDA 4 concluída. Commits acumulados:
- <hash> fix(onda-4-A): correções pós-auditoria
- <hash> feat(onda-4-B): permissões expandidas + UI completa de gestão
- <hash> feat(onda-4-C): edição completa de Ads com histórico
- <hash> design(onda-4-D): upgrade visual S-tier
- <hash> security(onda-4-E): regenerate session após login

Arquivos novos: <lista>
Arquivos modificados: <lista>
Migrations novas: <descrever>

Aguardando OK para git push.
```

**NÃO faça push até eu autorizar.**

### Critério de aceite Fase F
- [ ] Servidor sobe local sem erro
- [ ] 5 commits acumulados, separados, com mensagem em PT-BR
- [ ] Relatório enviado
- [ ] Aguardando autorização

---

## REGRAS REFORÇADAS (do início, repetidas porque importam)

- 1 commit por fase
- PARE entre fases pra eu validar
- Migrations aditivas
- Não invente
- Não destrua dados
- Reporte se sandbox bloqueou teste
- PT-BR nos commits
- Pergunte se ambíguo

Bora.

