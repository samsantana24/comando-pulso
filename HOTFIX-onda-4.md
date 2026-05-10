# HOTFIX pós-ONDA 4 — Sistema quebrado em produção

Sistema está **fora do ar** em `/custos` (Erro 500) e com KPI principal cortado em PEDRRA.

Causa raiz identificada por auditoria externa. **Execute como hotfix urgente**: sem fases, 2 commits separados (um por bug), depois push.

**REGRA IMPORTANTE:** este documento é cirúrgico. Mude EXATAMENTE o que está descrito. Não otimize nada além do escopo. Não invente. Se não entender algo, PARE e pergunte.

---

## Bug 1 — Erro 500 em /custos (CAUSA: comentário EJS aninhado)

### Diagnóstico

`views/partials/icons.ejs` linha 2 contém um comentário EJS `<%# ... %>` que tem outras tags EJS dentro dele:

```ejs
<%# Ícones SVG inline reutilizáveis (16x16, stroke 1.5, currentColor) %>
<%# Uso: <%- include('partials/icons', { name: 'plus' }) %> %>
```

O parser do EJS não consegue achar o fechamento do segundo comentário porque tem `<%- ... %>` dentro dele, gerando o erro:

```
Could not find matching close tag for "<%#".
```

Toda view que faz `<%- include('partials/icons', ...) %>` quebra. `/custos` tem 4 ícones na toolbar (Venda, Custo, Recorrente, Ads) e mais nas linhas de ads — quebra logo no header. `/pedrra` também usa o partial, mas pode estar carregando antes do erro propagar (causando a outra anomalia visual).

### Fix

**Arquivo:** `views/partials/icons.ejs`

Substituir as 2 primeiras linhas. **REMOVER** completamente os comentários EJS dessas linhas e usar HTML comment ou nada.

**ANTES:**

```ejs
<%# Ícones SVG inline reutilizáveis (16x16, stroke 1.5, currentColor) %>
<%# Uso: <%- include('partials/icons', { name: 'plus' }) %> %>
<% const ICONS = {
```

**DEPOIS:**

```ejs
<% /* Ícones SVG inline reutilizáveis (16x16, stroke 1.5, currentColor)
      Uso: <%- include('partials/icons', { name: 'plus' }) %> */ %>
<% const ICONS = {
```

**Por que funciona:** comentário JavaScript dentro de tag `<% %>` não confunde o parser EJS. Não há tag aninhada.

### Critério de aceite Bug 1

- [ ] `views/partials/icons.ejs` linha 1 é `<% /* ... */ %>` em vez de `<%# %>`
- [ ] Subir local com `npm start` e acessar `http://localhost:3001/custos` (após login se possível, ou validar que a view renderiza)
- [ ] Se não der pra testar com login, rodar este teste de render direto:

```bash
node -e "
const ejs = require('ejs');
const path = require('path');
ejs.renderFile(
  path.join(__dirname, 'views/partials/icons.ejs'),
  { name: 'tag' },
  {},
  (err, html) => {
    if (err) { console.error('FALHOU:', err.message); process.exit(1); }
    if (!html.includes('<svg')) { console.error('SEM SVG NO OUTPUT'); process.exit(1); }
    console.log('OK render:', html.substring(0, 80));
  }
);
"
```

Esperado: `OK render: <svg viewBox="0 0 24 24" ...>`

- [ ] Commit: `hotfix(onda-4): corrige comentário EJS aninhado em partials/icons.ejs (resolve erro 500 em /custos)`

---

## Bug 2 — KPI "Caixa hoje" cortando valor "R$ 137.760,00"

### Diagnóstico

Na ONDA 4 Fase D, o `--text-3xl: 42px` foi aplicado ao card primário (Caixa hoje) com `font-size: clamp(28px, 3vw, 44px)`. Em viewports de 1280-1440px (Mac padrão), `3vw` = 38-43px. Valores como "R$ 137.760,00" (12 caracteres) não cabem na largura `minmax(220px, 1fr)` do grid de 6 cards — sobra ~200-260px por card e o ellipsis mascara o valor.

### Fix

**Arquivo:** `public/css/app.css`

Aplicar formatação compacta para valores grandes em vez de cortar.

#### 2a. Reduzir tipografia do card primário

Localizar a regra atual `.kpi-card.kpi-primary .kpi-card-value` (ou `.kpi-card-value` que está governando esse tamanho hoje) e ajustar:

**ANTES** (algo similar a):
```css
.kpi-card-value {
  font-size: clamp(28px, 3vw, 44px);
  /* ... */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

**DEPOIS:**
```css
.kpi-card-value {
  font-size: clamp(22px, 2vw, 32px);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.05;
  font-feature-settings: 'tnum' 1, 'lnum' 1;
  font-variant-numeric: tabular-nums;
  /* SEM ellipsis — valor compacto resolve sem mascarar */
  white-space: nowrap;
  overflow: visible;
  display: block;
}
.kpi-card.kpi-primary .kpi-card-value {
  font-size: clamp(26px, 2.4vw, 38px);
}
```

#### 2b. Aumentar largura mínima dos cards

Localizar `.kpi-bar` (ou `.kpi-grid` — qual existir):

**ANTES:**
```css
.kpi-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  /* ... */
}
```

**DEPOIS:**
```css
.kpi-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
  margin: 32px 0;
}
```

#### 2c. Usar formatação compacta para valores >= R$ 100k

**Arquivo:** `public/js/pedrra.js`

Localizar a função que renderiza/anima o valor do card "Caixa hoje" (provavelmente `animateCountUp` ou onde injeta `data-final-value`).

Adicionar **helper** de formatação compacta no topo do arquivo (depois da declaração de `BRL`):

```js
const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function formatBrlSmart(value) {
  // Para valores >= R$ 100.000: compacto (R$ 137,8 mil; R$ 2,4 mi)
  // Para valores < R$ 100.000: formato completo (R$ 87.450,00)
  return Math.abs(value) >= 100000
    ? BRL_COMPACT.format(value)
    : BRL.format(value);
}
```

E na função `animateCountUp`, na linha que faz `element.textContent = isCurrency ? BRL.format(...) : ...`, substituir `BRL.format` por `formatBrlSmart` **APENAS** para o card primário (que tem `data-format="brl"` e `data-compact="1"`).

Para distinguir, adicionar lógica:

```js
function animateCountUp(element, finalValue, duration = 800) {
  const start = 0;
  const startTime = performance.now();
  const isCurrency = element.dataset.format === 'brl';
  const useCompact = element.dataset.compact === '1';
  const formatter = useCompact ? formatBrlSmart : (isCurrency ? BRL.format.bind(BRL) : (v) => Math.round(v).toString());

  function frame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (finalValue - start) * eased;
    element.textContent = formatter(current);
    if (progress < 1) requestAnimationFrame(frame);
    else element.textContent = formatter(finalValue);
  }
  requestAnimationFrame(frame);
}
```

#### 2d. Marcar o card "Caixa hoje" no template para usar compacto

**Arquivo:** `views/pedrra.ejs`

Localizar o card primário (que tem classe `kpi-primary` ou texto "Caixa hoje"). No `<span class="kpi-card-value">` desse card, adicionar atributo `data-compact="1"` ao lado do `data-final-value`.

Exemplo:

**ANTES:**
```ejs
<span class="kpi-card-value money" data-format="brl" data-final-value="<%= cashToday %>"><%= formatBrl(cashToday) %></span>
```

**DEPOIS:**
```ejs
<span class="kpi-card-value money" data-format="brl" data-compact="1" data-final-value="<%= cashToday %>"><%= formatBrl(cashToday) %></span>
```

Aplicar **APENAS** no card "Caixa hoje" (kpi-primary). Os outros KPIs (Sem. atual, Sem. passada, etc.) ficam com formato completo porque são valores menores.

### Critério de aceite Bug 2

- [ ] CSS `.kpi-card-value` com `font-size: clamp(22px, 2vw, 32px)` e SEM `text-overflow: ellipsis`
- [ ] CSS `.kpi-card.kpi-primary .kpi-card-value` com tipo levemente maior `clamp(26px, 2.4vw, 38px)`
- [ ] CSS `.kpi-bar` com `minmax(260px, 1fr)`
- [ ] JS `formatBrlSmart` definido em `public/js/pedrra.js`
- [ ] JS `animateCountUp` usa formatter dinâmico baseado em `data-compact`
- [ ] EJS card "Caixa hoje" tem `data-compact="1"`
- [ ] Visualmente: card "Caixa hoje" mostra "R$ 137,8 mil" (compacto) em vez de "R$ 137,7..."
- [ ] Outros 5 KPIs continuam mostrando valores completos (Sem. passada R$ 5.100,54 etc.)
- [ ] Commit: `hotfix(onda-4): KPI 'Caixa hoje' usa formato compacto (R$ 137,8k) para evitar truncagem`

---

## Sequência de execução

1. Ler este documento inteiro
2. Confirmar entendimento em uma frase
3. Aplicar Fix Bug 1 → testar render → commitar
4. Aplicar Fix Bug 2 → conferir visualmente o CSS no navegador (se possível) → commitar
5. **NÃO FAZER PUSH AINDA**
6. Listar os 2 commits feitos com `git log --oneline -3`
7. Me reportar e aguardar OK pra push

---

## Anti-regras (não violar)

- **Não** mexa em outros arquivos além dos descritos
- **Não** "aproveite a passagem" pra mudar estrutura, refatorar, ou melhorar coisas vizinhas
- **Não** crie arquivos novos
- **Não** rode migrations
- **Não** toque em `data.db` nem `sessions.db`
- **Não** mexa em `lib/permissions.js`, `routes/*` ou qualquer rota
- Se ao abrir um arquivo notar algo estranho relacionado aos bugs descritos, **reporte** em vez de consertar — vira ONDA 5

Bora.

