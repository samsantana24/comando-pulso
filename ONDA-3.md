# ONDA 3 — Redesign visual completo · Identidade Pulso

Esta onda é **só de design**. Nenhuma lógica de negócio muda. Estamos elevando o Comando Pulso ao nível visual da apresentação institucional do Pulso (deck "PULSO · Aceleradora") — preto absoluto, vermelho-rosa elétrico (#FF2E5A), tipografia Inter pesada, animações suaves cubic-bezier, brackets de canto, glow radial atrás de cards, motion linguagem que comunica precisão e poder.

**Inspiração de referência:** o usuário disse explicitamente que quer "sentir que está mexendo num iPhone, num Tesla, no produto mais foda do mundo". Cada decisão de design tem que servir essa pergunta: *"isso aqui parece um Bloomberg Terminal premium ou parece dashboard de admin barato?"* Se a resposta tiver dúvida, repensa.

**Antes de tudo:** confirme em uma frase que entendeu o pedido global. Depois leia o sistema de design completo abaixo. Depois execute fase por fase, **um commit por fase**, com critérios de aceite explícitos. Pause ao fim de cada fase pra eu validar.

**Regra de ouro:** nenhuma rota, nenhum endpoint, nenhuma query, nenhuma lógica de cálculo é tocada nessa onda. Só CSS, HTML/EJS estrutural, JS de interação visual (animações), e novos assets.

---

## 1. SISTEMA DE DESIGN — Fonte da verdade

Toda a paleta, tipografia, espaçamento e movimento vêm do deck institucional do Pulso. Substituir TODAS as variáveis do `:root` em `public/css/app.css` por este conjunto:

### 1.1 Cores

```css
:root {
  /* === BASE === */
  --bg: #000000;                          /* preto absoluto */
  --bg-elevated: #0A0A0A;                 /* superfície sutil sobre preto */
  --bg-card: #0E0E0F;                     /* cards */
  --bg-card-hover: #131315;               /* hover sutil */
  --fg: #FFFFFF;                          /* texto principal */
  --fg-soft: #C5C5C5;                     /* texto secundário */
  --muted: #8A8A8A;                       /* texto auxiliar */
  --dim: #5A5A5A;                         /* desabilitado */

  /* === LINHAS === */
  --line: rgba(255, 255, 255, 0.12);      /* borda padrão */
  --line-strong: rgba(255, 255, 255, 0.22);
  --line-soft: rgba(255, 255, 255, 0.06);

  /* === ACENTOS === */
  --accent: #FF2E5A;                      /* rosa-vermelho elétrico Pulso */
  --accent-soft: rgba(255, 46, 90, 0.15); /* fill suave */
  --accent-glow: rgba(255, 46, 90, 0.35); /* glow forte */
  --accent-dim: rgba(255, 46, 90, 0.06);  /* glow ambiente */

  --gold: #FFD700;
  --gold-soft: rgba(255, 215, 0, 0.15);
  --orange: #FFA500;                      /* usado como cor de Ads */
  --orange-soft: rgba(255, 165, 0, 0.18);

  /* === SEMÂNTICOS === */
  --pos: #22C55E;                         /* saldo positivo */
  --pos-soft: rgba(34, 197, 94, 0.12);
  --neg: #FF2E5A;                         /* saldo negativo (mesma do accent — coerência) */
  --neg-soft: rgba(255, 46, 90, 0.10);
  --warn: #FFA500;
  --warn-soft: rgba(255, 165, 0, 0.12);

  /* === GRADIENTES === */
  --gradient-glow-accent: radial-gradient(ellipse 100% 70% at 80% 60%, rgba(255, 46, 90, 0.06) 0%, #000 70%);
  --gradient-card: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 100%);

  /* === TIPOGRAFIA === */
  --font-stack: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;

  --letter-tight: -0.02em;
  --letter-wide: 0.08em;
  --letter-mega: -0.04em;

  /* === ESPAÇAMENTO === */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;

  /* === RADIUS === */
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 16px;
  --radius-xl: 22px;

  /* === SHADOWS === */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.35);
  --shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 30px 60px rgba(0, 0, 0, 0.6);
  --shadow-accent-glow: 0 0 80px rgba(255, 46, 90, 0.12);
  --shadow-accent-glow-strong: 0 0 120px rgba(255, 46, 90, 0.25);

  /* === MOTION (cubic-bezier do deck) === */
  --ease-pulso: cubic-bezier(0.22, 1, 0.36, 1);
  --duration-fast: 0.18s;
  --duration: 0.32s;
  --duration-slow: 0.6s;
}
```

**IMPORTANTE — Preservar nomes de variáveis legados:** o código atual usa `--surface`, `--surface-2`, `--text`, `--border`, `--accent-strong`, `--danger`, `--ok`. Em vez de fazer find/replace em 76 arquivos, criar **alias** dentro do `:root`:

```css
:root {
  /* ... variáveis novas acima ... */

  /* === LEGACY ALIASES (compat) === */
  --surface: var(--bg-card);
  --surface-2: var(--bg-card-hover);
  --text: var(--fg);
  --border: var(--line);
  --accent-strong: var(--accent);
  --danger: var(--neg);
  --ok: var(--pos);
}
```

### 1.2 Tipografia

Carregar Inter via Google Fonts no `<head>` em `views/partials/head.ejs`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```

**Hierarquia de tipografia:**

```css
/* Display — KPIs em destaque, números grandes */
.t-display {
  font-size: clamp(40px, 5vw, 72px);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 0.95;
  font-feature-settings: 'tnum' 1, 'lnum' 1;
}

/* H1 — títulos de página */
h1, .t-h1 {
  font-size: clamp(28px, 3.2vw, 44px);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

/* H2 — seções */
h2, .t-h2 {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

/* Eyebrow — label sobre títulos (estilo deck) */
.t-eyebrow {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
}

/* Body */
body, p, .t-body {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.55;
}

/* KPI value (números) — sempre tabular */
.t-kpi {
  font-size: clamp(28px, 2.4vw, 38px);
  font-weight: 800;
  letter-spacing: -0.02em;
  font-feature-settings: 'tnum' 1, 'lnum' 1;
  font-variant-numeric: tabular-nums;
}

/* Label */
.t-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Mono — IDs, hashes, IDs de semana */
.t-mono {
  font-family: var(--font-mono);
  font-feature-settings: 'tnum' 1;
}
```

### 1.3 Componentes-base

Reescrever **completamente** as definições de:
- `.app-header`
- `.kpi-card`
- `.btn` (todas variantes)
- `.modal`
- `.scenario-picker`

Detalhes nas Fases abaixo.

---

## 2. FASES DE EXECUÇÃO

Ordem importa. Não pule fases. Commit por fase, mensagem em PT-BR no formato `design(onda-3): <descrição>`.

---

### **Fase 1 — Foundation: tokens, fontes, reset, body**

**Objetivo:** trocar a base de cor/tipografia. O sistema vai parecer feio temporariamente até as outras fases compensarem — não tem problema, é fundação.

**Arquivos:** `public/css/app.css` (reescrita parcial), `views/partials/head.ejs` (carregar Inter).

**Tarefas:**

1. **`views/partials/head.ejs`:** adicionar tags `<link>` pra Inter (preconnect + Google Fonts) ANTES do `<link>` do app.css. Garantir `<meta name="theme-color" content="#000000">`.

2. **`public/css/app.css`:** substituir o bloco `:root` inteiro pelo novo (seção 1.1 acima, com aliases legados). Atualizar `html, body` pra:

```css
html, body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-stack);
  font-size: 14px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-feature-settings: 'cv11' 1, 'ss01' 1; /* Inter: features tipográficas refinadas */
}
```

3. **Adicionar background ambiente** — um glow radial sutil de fundo na página (não perturba conteúdo, só adiciona profundidade):

```css
body {
  position: relative;
}
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 50% at 100% 0%, rgba(255, 46, 90, 0.04) 0%, transparent 60%),
    radial-gradient(ellipse 70% 50% at 0% 100%, rgba(255, 46, 90, 0.025) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}
body > * { position: relative; z-index: 1; }
```

4. **Adicionar classes de tipografia** (`.t-display`, `.t-h1`, `.t-h2`, `.t-eyebrow`, `.t-kpi`, `.t-label`, `.t-mono`, `.t-body`) — seção 1.2.

5. **Selection style** — selecionar texto com cor da marca:

```css
::selection {
  background: var(--accent);
  color: var(--fg);
}
```

6. **Scrollbar custom** (webkit):

```css
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--line);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover { background: var(--line-strong); }
```

**Critério de aceite Fase 1:**
- [ ] Inter carregada (verificar no DevTools network)
- [ ] Fundo do site é preto puro com leve glow rosa nos cantos
- [ ] Texto é branco com hierarquia clara
- [ ] Selection tem cor de marca
- [ ] **Não quebrar nada:** todas as páginas continuam funcionando, só ficam com cara provisória
- [ ] Commit: `design(onda-3): fase 1 - foundation tokens, Inter, body com glow ambiente`

---

### **Fase 2 — Header e navegação (a primeira coisa que se vê)**

**Objetivo:** elevar o header ao nível premium. Brand mark refeita, navegação com indicador ativo elegante, scenario picker como elemento joia.

**Arquivos:** `views/partials/header.ejs`, `public/css/app.css` (seção .app-header e .scenario-picker), `public/js/header.js`.

**Tarefas:**

1. **Brand mark** — substituir o `.brand-dot` simples por uma marca tipográfica forte. Em `views/partials/header.ejs`:

```html
<div class="brand">
  <span class="brand-mark" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="24" height="24">
      <!-- pulso = onda + ponto. linha que sobe e desce com um círculo no centro -->
      <path d="M2 12 L7 12 L9 6 L12 18 L15 9 L17 12 L22 12"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round" fill="none" />
    </svg>
  </span>
  <span class="brand-text">
    <span class="brand-name">PULSO</span>
    <span class="brand-divider">·</span>
    <span class="brand-context"><%= title || 'COMANDO' %></span>
  </span>
</div>
```

CSS:

```css
.app-header {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 18px 32px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid var(--line);
  position: sticky;
  top: 0;
  z-index: 100;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.brand-mark {
  color: var(--accent);
  display: inline-flex;
  filter: drop-shadow(0 0 8px var(--accent-glow));
}
.brand-text {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  letter-spacing: 0.06em;
  font-size: 13px;
}
.brand-name { color: var(--fg); }
.brand-divider { color: var(--dim); font-weight: 400; }
.brand-context { color: var(--muted); font-weight: 600; }
```

2. **Navegação** — links com indicador animado embaixo:

```css
.app-nav {
  display: flex;
  gap: 4px;
  flex: 1;
}
.app-nav a {
  position: relative;
  color: var(--muted);
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.04em;
  padding: 8px 14px;
  border-radius: var(--radius);
  transition: color var(--duration-fast) var(--ease-pulso);
}
.app-nav a:hover {
  color: var(--fg);
  text-decoration: none;
}
.app-nav a.active {
  color: var(--fg);
}
.app-nav a.active::after {
  content: '';
  position: absolute;
  bottom: -19px;
  left: 14px;
  right: 14px;
  height: 2px;
  background: var(--accent);
  box-shadow: 0 0 12px var(--accent-glow);
}
```

No `routes/*` (todos os 5 que renderizam view: pedrra, custos, funil, configuracoes), passar `currentPath: req.path` pra view, e no header marcar `<a class="<%= currentPath === '/pedrra' ? 'active' : '' %>" ...>`.

3. **Scenario picker** — botão arredondado com dot colorido, dropdown elegante:

```css
.scenario-picker { position: relative; }
.scenario-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--line);
  border-radius: 100px;  /* pill */
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--fg);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-pulso);
}
.scenario-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--line-strong);
}
.scenario-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 8px currentColor;
}
.scenario-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 320px;
  background: rgba(14, 14, 15, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 6px;
  z-index: 200;
  animation: menuIn var(--duration) var(--ease-pulso);
}
@keyframes menuIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}
.scenario-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius);
  cursor: pointer;
}
.scenario-item:hover { background: rgba(255, 255, 255, 0.04); }
.scenario-item.active { background: var(--accent-soft); }
```

4. **User menu** — avatar circular com inicial:

```css
.user-menu {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent-soft);
  border: 1px solid var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  color: var(--accent);
}
.user-email {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}
```

No EJS:
```html
<div class="user-avatar"><%= user.email.charAt(0).toUpperCase() %></div>
<span class="user-email"><%= user.email %></span>
```

**Critério de aceite Fase 2:**
- [ ] Header tem efeito glassmorphism sticky no topo
- [ ] Brand mostra logo SVG da onda do pulso com glow
- [ ] Link da aba ativa tem barra rosa embaixo com glow
- [ ] Scenario picker é um pill arredondado, dropdown abre com animação
- [ ] Avatar circular com inicial
- [ ] Commit: `design(onda-3): fase 2 - header glass + brand mark + nav ativa`

---

### **Fase 3 — KPI Bar e cards (alma do PEDRRA)**

**Objetivo:** transformar os 6 cards de KPI em peças hero, dignas de Bloomberg Terminal.

**Arquivos:** `public/css/app.css` (seção .kpi-bar, .kpi-card), `views/pedrra.ejs` (estrutura), `public/js/pedrra.js` (animação de entrada e count-up).

**Tarefas:**

1. **Estrutura visual do card de KPI:**

```css
.kpi-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin: 32px 0;
}

.kpi-card {
  position: relative;
  padding: 24px 22px;
  background: var(--bg-card);
  background-image: var(--gradient-card);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--duration) var(--ease-pulso);
}

/* Brackets de canto (assinatura do deck) */
.kpi-card::before, .kpi-card::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  transition: border-color var(--duration) var(--ease-pulso);
  pointer-events: none;
}
.kpi-card::before {
  top: 8px; left: 8px;
  border-right: 0; border-bottom: 0;
}
.kpi-card::after {
  bottom: 8px; right: 8px;
  border-left: 0; border-top: 0;
}

.kpi-card:hover {
  border-color: var(--line-strong);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}
.kpi-card:hover::before, .kpi-card:hover::after {
  border-color: var(--accent);
}

/* Glow radial sutil no canto direito */
.kpi-card::after {
  /* OBS: substitui o pseudo-element acima — escolher um dos dois */
}

.kpi-card-label {
  display: block;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 12px;
}
.kpi-card-value {
  display: block;
  font-size: clamp(26px, 2.4vw, 36px);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fg);
  font-feature-settings: 'tnum' 1, 'lnum' 1;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.kpi-card-value.pos { color: var(--pos); }
.kpi-card-value.neg { color: var(--neg); }
.kpi-card-value.ads-color { color: var(--orange); }
.kpi-card-foot {
  display: block;
  font-size: 11px;
  color: var(--muted);
  margin-top: 8px;
  font-weight: 500;
}

/* Card principal (Caixa hoje) — destaque */
.kpi-card.kpi-primary {
  background:
    radial-gradient(ellipse 100% 70% at 80% 20%, var(--accent-dim) 0%, transparent 60%),
    var(--bg-card);
  border-color: var(--line-strong);
}
.kpi-card.kpi-primary .kpi-card-value {
  background: linear-gradient(180deg, #fff 0%, #c5c5c5 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

2. **Marcar o card "Caixa hoje" como `kpi-primary`** em `views/pedrra.ejs` (adicionar classe).

3. **Animação de entrada** — quando a página carrega, KPIs surgem em cascata.

```css
.kpi-card {
  opacity: 0;
  animation: kpiIn var(--duration-slow) var(--ease-pulso) forwards;
}
.kpi-card:nth-child(1) { animation-delay: 0.05s; }
.kpi-card:nth-child(2) { animation-delay: 0.10s; }
.kpi-card:nth-child(3) { animation-delay: 0.15s; }
.kpi-card:nth-child(4) { animation-delay: 0.20s; }
.kpi-card:nth-child(5) { animation-delay: 0.25s; }
.kpi-card:nth-child(6) { animation-delay: 0.30s; }
@keyframes kpiIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

4. **Count-up nos KPIs numéricos** — em `public/js/pedrra.js`, adicionar função que ao carregar a página anima de 0 ao valor final em 800ms. Mas só na primeira render — não em recompute reativo (senão fica chato).

```js
function animateCountUp(element, finalValue, duration = 800) {
  const start = 0;
  const startTime = performance.now();
  const isCurrency = element.dataset.format === 'brl';

  function frame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // easeOutCubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (finalValue - start) * eased;
    element.textContent = isCurrency
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(current)
      : Math.round(current).toString();
    if (progress < 1) requestAnimationFrame(frame);
    else element.textContent = isCurrency
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalValue)
      : Math.round(finalValue).toString();
  }
  requestAnimationFrame(frame);
}

// Aplicar em cada .kpi-card-value que tiver data-final-value:
document.querySelectorAll('.kpi-card-value[data-final-value]').forEach((el) => {
  const v = Number(el.dataset.finalValue) || 0;
  animateCountUp(el, v);
});
```

No EJS, adicionar `data-final-value="<%= cashToday %>"` (e similares) nas células numéricas — o ponto inicial é 0, o JS anima até o valor real.

**Critério de aceite Fase 3:**
- [ ] 6 KPIs em grid responsivo
- [ ] Card "Caixa hoje" tem destaque (gradient sutil + número com gradient white→gray)
- [ ] Brackets de canto aparecem em todos os cards
- [ ] Hover eleva o card e muda brackets pra rosa
- [ ] Cascata de entrada visível (cards aparecem sequencialmente)
- [ ] Números fazem count-up animado ao carregar
- [ ] Commit: `design(onda-3): fase 3 - KPI bar com brackets, gradient e count-up`

---

### **Fase 4 — Botões e inputs (linguagem de toque)**

**Objetivo:** todo botão, todo input, todo elemento clicável tem que comunicar precisão. Sem ruído visual, com feedback tátil de premium.

**Arquivos:** `public/css/app.css` (seções `.btn`, `input`, `select`, `textarea`).

```css
/* === BOTÕES === */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 18px;
  font-family: var(--font-stack);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  border-radius: var(--radius);
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-pulso),
    border-color var(--duration-fast) var(--ease-pulso),
    transform var(--duration-fast) var(--ease-pulso),
    box-shadow var(--duration-fast) var(--ease-pulso);
  user-select: none;
  white-space: nowrap;
}
.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

/* Primary — vermelho elétrico */
.btn-primary {
  background: var(--accent);
  color: var(--fg);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.1) inset,
    0 8px 24px var(--accent-glow);
}
.btn-primary:hover {
  background: #ff4570;
  transform: translateY(-1px);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.15) inset,
    0 12px 32px var(--accent-glow);
}
.btn-primary:active {
  transform: translateY(0);
}

/* Ghost — borda sutil */
.btn-ghost {
  background: transparent;
  color: var(--fg);
  border-color: var(--line);
}
.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--line-strong);
}

/* Warn — laranja (usado pelo botão de Ads) */
.btn-warn {
  background: var(--orange-soft);
  color: var(--orange);
  border-color: rgba(255, 165, 0, 0.4);
}
.btn-warn:hover {
  background: rgba(255, 165, 0, 0.28);
  border-color: var(--orange);
}

/* Small */
.btn-small { padding: 7px 12px; font-size: 12px; }

/* Link */
.btn-link {
  background: transparent;
  border: 0;
  padding: 4px 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.btn-link:hover { text-decoration: underline; }
.btn-link.danger { color: var(--neg); }

/* === INPUTS === */
input[type="text"],
input[type="email"],
input[type="number"],
input[type="date"],
input[type="password"],
select,
textarea {
  width: 100%;
  padding: 11px 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  color: var(--fg);
  font-family: var(--font-stack);
  font-size: 14px;
  font-weight: 500;
  transition:
    background var(--duration-fast) var(--ease-pulso),
    border-color var(--duration-fast) var(--ease-pulso),
    box-shadow var(--duration-fast) var(--ease-pulso);
  font-variant-numeric: tabular-nums;
}
input:hover,
select:hover,
textarea:hover {
  border-color: var(--line-strong);
}
input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: var(--accent);
  background: rgba(255, 255, 255, 0.04);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
input::placeholder { color: var(--dim); }

/* Select com chevron custom */
select {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M3 4.5l3 3 3-3' stroke='%238A8A8A' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

/* Form labels */
.form-label {
  display: block;
  margin-bottom: 14px;
}
.form-label > span:first-child,
.form-label.label-text {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 6px;
}
.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}
```

**Critério de aceite Fase 4:**
- [ ] Botão primário vermelho elétrico com glow
- [ ] Botão ghost com hover subtle
- [ ] Botão de Ads (warn) laranja
- [ ] Inputs com focus ring rosa de 3px
- [ ] Selects com chevron customizado
- [ ] Labels uppercase espaçadas
- [ ] Commit: `design(onda-3): fase 4 - botões com glow e inputs com focus ring`

---

### **Fase 5 — Modais (cinema)**

**Objetivo:** modais que parecem teleporte, não janelinha de admin.

**Arquivos:** `public/css/app.css` (seção `dialog.modal`).

```css
dialog.modal {
  /* reset do dialog nativo */
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--fg);
  max-width: 560px;
  width: calc(100% - 48px);
  max-height: calc(100vh - 80px);
}
dialog.modal::backdrop {
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  animation: backdropIn var(--duration) var(--ease-pulso);
}
dialog.modal[open] {
  animation: modalIn var(--duration) var(--ease-pulso);
}
@keyframes backdropIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes modalIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
    filter: blur(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

dialog.modal form {
  background: var(--bg-card);
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  padding: 32px;
  box-shadow: var(--shadow-lg), var(--shadow-accent-glow);
  position: relative;
  overflow: hidden;
}

/* Brackets nos cantos do modal (assinatura) */
dialog.modal form::before,
dialog.modal form::after {
  content: '';
  position: absolute;
  width: 18px; height: 18px;
  border: 1px solid var(--accent);
  pointer-events: none;
}
dialog.modal form::before {
  top: 12px; left: 12px;
  border-right: 0; border-bottom: 0;
}
dialog.modal form::after {
  top: 12px; right: 12px;
  border-left: 0; border-bottom: 0;
}

dialog.modal h2 {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.01em;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}
```

**Critério de aceite Fase 5:**
- [ ] Modal abre com blur de fundo
- [ ] Animação de entrada com blur+scale+translate
- [ ] Brackets vermelhos no canto superior do modal
- [ ] Header com border-bottom
- [ ] Actions com border-top
- [ ] Commit: `design(onda-3): fase 5 - modais cinema com blur e brackets`

---

### **Fase 6 — Tabelas e listas (densidade Bloomberg)**

**Objetivo:** tabela de custos e projeção do PEDRRA precisam parecer terminal financeiro de bilhões. Densidade alta, tabular nums, hover claro.

```css
table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

thead th {
  text-align: left;
  padding: 14px 16px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
thead th.num { text-align: right; }

tbody td {
  padding: 13px 16px;
  border-bottom: 1px solid var(--line-soft);
  color: var(--fg-soft);
  vertical-align: middle;
}
tbody td.num {
  text-align: right;
  font-feature-settings: 'tnum' 1;
  font-variant-numeric: tabular-nums;
}
tbody td.amount {
  text-align: right;
  font-weight: 600;
  color: var(--fg);
}
tbody td.amount.pos { color: var(--pos); }
tbody td.amount.neg { color: var(--neg); }
tbody td.amount.cost { color: var(--fg-soft); }
tbody tr {
  transition: background var(--duration-fast) var(--ease-pulso);
}
tbody tr:hover {
  background: rgba(255, 46, 90, 0.04);
}

/* Linhas de seção (cabeçalho de grupo na tabela de custos) */
tr.row-section td {
  background:
    linear-gradient(90deg, var(--accent-soft) 0%, transparent 50%);
  border-top: 1px solid var(--accent);
  border-bottom: 1px solid var(--line);
  padding: 14px 16px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
}

/* Subtotal por grupo */
tr.row-subtotal td {
  background: rgba(255, 255, 255, 0.02);
  font-weight: 700;
  color: var(--fg);
  border-top: 1px solid var(--line);
}

/* Saldo da semana — destaque */
tr.row-saldo td {
  background: rgba(255, 255, 255, 0.04);
  font-weight: 800;
  font-size: 14px;
  color: var(--fg);
  border-top: 2px solid var(--accent);
  border-bottom: 0;
}

/* Investimento em ads — destaque laranja */
tr.row-section.ads-section td {
  background:
    linear-gradient(90deg, var(--orange-soft) 0%, transparent 50%);
  border-top: 1px solid var(--orange);
  color: var(--orange);
}
tr.row-ads td {
  color: var(--orange);
}

/* Header da semana atual */
th.week-h.current {
  color: var(--accent);
  position: relative;
}
th.week-h.current::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0; right: 0;
  height: 2px;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent-glow);
}
th.week-h .week-id {
  font-size: 9px;
  color: var(--dim);
  font-weight: 600;
}
```

**Critério de aceite Fase 6:**
- [ ] Tabela tem espaçamento generoso e tabular-nums
- [ ] Linha de cabeçalho de grupo tem gradient rosa + tipografia uppercase
- [ ] Linha de Ads é laranja
- [ ] Hover de linha sutil rosa
- [ ] Coluna da semana atual tem barra rosa indicando hoje
- [ ] Linha "Saldo da semana" destaca com border top vermelha
- [ ] Commit: `design(onda-3): fase 6 - tabelas Bloomberg com seções coloridas`

---

### **Fase 7 — Gráfico Chart.js no estilo Pulso**

**Objetivo:** o gráfico hero do PEDRRA precisa ser premium. Cores da marca, glow, tipografia tabular, tooltip elegante.

**Arquivos:** `public/js/pedrra.js` (configuração do Chart.js).

Reescrever o objeto `options` do Chart.js com estes valores (manter toda a lógica de dados existente, só trocar visual):

```js
const CHART_COLORS = {
  cash:        '#FF2E5A',  // accent
  cashFill:    'rgba(255, 46, 90, 0.08)',
  costs:       'rgba(255, 46, 90, 0.40)',
  costsBorder: 'rgba(255, 46, 90, 0.65)',
  ads:         'rgba(255, 165, 0, 0.45)',
  adsBorder:   'rgba(255, 165, 0, 0.75)',
  grid:        'rgba(255, 255, 255, 0.04)',
  axis:        '#5A5A5A',
  axisLabel:   '#8A8A8A',
};

// Dataset de "Caixa real" (linha sólida):
{
  label: 'Caixa',
  type: 'line',
  data: realCash,
  borderColor: CHART_COLORS.cash,
  backgroundColor: CHART_COLORS.cashFill,
  borderWidth: 2.5,
  tension: 0.35,
  spanGaps: true,
  pointRadius: 0,
  pointHoverRadius: 6,
  pointHoverBackgroundColor: CHART_COLORS.cash,
  pointHoverBorderColor: '#fff',
  pointHoverBorderWidth: 2,
  fill: 'origin',
  yAxisID: 'y',
  order: 1,
}

// Dataset de "Caixa projetado" (linha pontilhada):
{
  label: 'Caixa proj.',
  type: 'line',
  data: projCash,
  borderColor: CHART_COLORS.cash,
  borderDash: [6, 5],
  backgroundColor: 'transparent',
  borderWidth: 2,
  tension: 0.35,
  spanGaps: true,
  pointRadius: 0,
  pointHoverRadius: 6,
  yAxisID: 'y',
  order: 2,
}

// Dataset de Custos (barras vermelhas translúcidas):
{
  label: 'Custos',
  type: 'bar',
  data: costsBars,
  backgroundColor: CHART_COLORS.costs,
  borderColor: CHART_COLORS.costsBorder,
  borderWidth: 1,
  borderRadius: 4,
  yAxisID: 'y1',
  order: 3,
}

// Dataset de Ads (barras laranjas):
{
  label: 'Ads',
  type: 'bar',
  data: adsBars,
  backgroundColor: CHART_COLORS.ads,
  borderColor: CHART_COLORS.adsBorder,
  borderWidth: 1,
  borderRadius: 4,
  yAxisID: 'y1',
  order: 4,
}

// Options:
options: {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  scales: {
    x: {
      grid: { display: false, color: CHART_COLORS.grid },
      ticks: {
        color: CHART_COLORS.axisLabel,
        font: { family: 'Inter', size: 11, weight: 600 },
      },
      border: { color: CHART_COLORS.grid },
    },
    y: {
      grid: {
        color: CHART_COLORS.grid,
        drawBorder: false,
        drawTicks: false,
      },
      ticks: {
        color: CHART_COLORS.axisLabel,
        font: { family: 'Inter', size: 11, weight: 500 },
        callback: (v) => formatBrlCompact(v),
        padding: 8,
      },
      border: { display: false },
    },
    y1: {
      position: 'right',
      display: false, // ou true se quiser ver escala secundária
      grid: { display: false },
      beginAtZero: true,
    },
  },
  plugins: {
    legend: {
      display: true,
      position: 'top',
      align: 'end',
      labels: {
        color: '#C5C5C5',
        font: { family: 'Inter', size: 12, weight: 600 },
        usePointStyle: true,
        padding: 16,
        boxWidth: 8,
        boxHeight: 8,
      },
    },
    tooltip: {
      enabled: true,
      backgroundColor: 'rgba(14, 14, 15, 0.95)',
      titleColor: '#fff',
      titleFont: { family: 'Inter', size: 12, weight: 800, letterSpacing: 0.5 },
      bodyColor: '#C5C5C5',
      bodyFont: { family: 'Inter', size: 12, weight: 500 },
      footerColor: '#8A8A8A',
      footerFont: { family: 'Inter', size: 11, weight: 500 },
      padding: 14,
      cornerRadius: 10,
      borderColor: 'rgba(255, 46, 90, 0.4)',
      borderWidth: 1,
      displayColors: true,
      boxWidth: 8,
      boxHeight: 8,
      boxPadding: 6,
      caretSize: 6,
      // manter os callbacks de tooltip existentes (top_costs)
    },
  },
}

// Helper:
function formatBrlCompact(v) {
  if (Math.abs(v) >= 1000000) return 'R$ ' + (v / 1000000).toFixed(1) + 'M';
  if (Math.abs(v) >= 1000) return 'R$ ' + (v / 1000).toFixed(0) + 'k';
  return 'R$ ' + Math.round(v);
}
```

**Marker de "hoje":** manter o plugin `todayMarkerPlugin` que já existe, só atualizar a cor pra `#FF2E5A` e aumentar glow:
```js
c.strokeStyle = 'rgba(255, 46, 90, 0.8)';
c.shadowColor = 'rgba(255, 46, 90, 0.6)';
c.shadowBlur = 8;
```

**Critério de aceite Fase 7:**
- [ ] Linha de caixa rosa elétrico com fill suave
- [ ] Linha futura pontilhada na mesma cor
- [ ] Barras de custo rosa translúcidas
- [ ] Barras de Ads laranjas
- [ ] Tooltip com fundo escuro semitransparente, border rosa, tipografia Inter
- [ ] Marker "hoje" com glow rosa
- [ ] Eixo Y formata valores como R$ 87k / R$ 1.2M
- [ ] Commit: `design(onda-3): fase 7 - gráfico Chart.js identidade Pulso`

---

### **Fase 8 — Login e telas de auth (primeira impressão)**

**Objetivo:** quando alguém abre `comando.usepulso.org` pela primeira vez, tem que sentir "uau". Tela de login deve ser cinema.

**Arquivos:** `views/login.ejs`, `views/totp-setup.ejs`, `views/totp-verify.ejs`, `public/css/app.css`.

Reescrever a tela de login pra:

```html
<main class="auth-screen">
  <div class="auth-bg" aria-hidden="true"></div>
  <div class="auth-card">
    <div class="auth-bracket auth-bracket-tl"></div>
    <div class="auth-bracket auth-bracket-tr"></div>
    <div class="auth-bracket auth-bracket-bl"></div>
    <div class="auth-bracket auth-bracket-br"></div>

    <div class="auth-brand">
      <span class="brand-mark"><svg>...mesma do header...</svg></span>
      <h1 class="auth-brand-name">PULSO</h1>
      <span class="auth-brand-sub">COMANDO</span>
    </div>

    <p class="auth-eyebrow">acesso restrito</p>
    <h2 class="auth-title">Centro de comando<br/>do <span class="text-accent">caixa</span></h2>

    <form action="/auth/google" method="GET" class="auth-form">
      <button type="submit" class="btn btn-primary btn-google">
        <svg width="18" height="18" viewBox="0 0 18 18">...logo Google...</svg>
        <span>Entrar com Google</span>
      </button>
    </form>

    <p class="auth-foot">
      Acesso autorizado apenas para contas <code>@usepulso.org</code>
    </p>
  </div>
</main>
```

CSS:

```css
.auth-screen {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
  position: relative;
  overflow: hidden;
}

.auth-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 50% at 50% 30%, rgba(255, 46, 90, 0.15) 0%, transparent 60%),
    radial-gradient(ellipse 80% 60% at 50% 100%, rgba(255, 46, 90, 0.06) 0%, transparent 70%);
  pointer-events: none;
  animation: bgPulse 8s ease-in-out infinite;
}
@keyframes bgPulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

.auth-card {
  position: relative;
  width: 100%;
  max-width: 480px;
  padding: 56px 48px;
  background: var(--bg-card);
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, transparent 100%);
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg), 0 0 120px rgba(255, 46, 90, 0.1);
  text-align: center;
}

.auth-bracket {
  position: absolute;
  width: 22px; height: 22px;
  border: 1px solid var(--accent);
}
.auth-bracket-tl { top: 14px; left: 14px; border-right: 0; border-bottom: 0; }
.auth-bracket-tr { top: 14px; right: 14px; border-left: 0; border-bottom: 0; }
.auth-bracket-bl { bottom: 14px; left: 14px; border-right: 0; border-top: 0; }
.auth-bracket-br { bottom: 14px; right: 14px; border-left: 0; border-top: 0; }

.auth-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-bottom: 32px;
}
.auth-brand .brand-mark {
  color: var(--accent);
  filter: drop-shadow(0 0 16px var(--accent-glow));
  margin-bottom: 8px;
}
.auth-brand-name {
  font-size: 32px;
  font-weight: 900;
  letter-spacing: 0.18em;
  color: var(--fg);
}
.auth-brand-sub {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.32em;
  color: var(--muted);
}

.auth-eyebrow {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 12px;
}
.auth-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin-bottom: 32px;
}
.auth-title .text-accent { color: var(--accent); }

.btn-google {
  width: 100%;
  justify-content: center;
  padding: 14px 24px;
  font-size: 14px;
}

.auth-foot {
  margin-top: 24px;
  font-size: 12px;
  color: var(--muted);
}
.auth-foot code {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--line);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--accent);
}
```

Aplicar princípios similares (brackets + fundo glow + brand) em `totp-setup.ejs` e `totp-verify.ejs`.

**Critério de aceite Fase 8:**
- [ ] Tela de login tem fundo com pulse de glow rosa
- [ ] Card central com brackets vermelhos nos 4 cantos
- [ ] Brand "PULSO" em destaque
- [ ] Botão de Google é um bloco rosa com glow
- [ ] Telas de TOTP seguem mesma linha visual
- [ ] Commit: `design(onda-3): fase 8 - login e auth screens cinema`

---

### **Fase 9 — Funil "laboratório" (mood diferente)**

**Objetivo:** o funil é laboratório de simulação. Visualmente diferente — mais "blueprint", mais "máquina rodando", deixa claro que é simulação.

**Arquivos:** `views/funil.ejs` (estrutura do banner), `public/css/app.css` (seção `.funil`).

```css
.lab-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background:
    linear-gradient(90deg, rgba(255, 215, 0, 0.10) 0%, transparent 50%),
    var(--bg-card);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-left: 3px solid var(--gold);
  border-radius: var(--radius);
  margin-bottom: 32px;
}
.lab-tag {
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.2em;
  color: var(--gold);
  background: var(--gold-soft);
  padding: 4px 10px;
  border-radius: 4px;
}

.funnel-floor {
  position: relative;
  margin: 24px 0;
  padding: 28px;
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  /* Padrão sutil de blueprint */
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
  background-size: 24px 24px;
}

.funnel-floor.sdr-floor::before {
  content: 'SDR';
  position: absolute;
  top: -8px;
  left: 16px;
  background: var(--bg);
  padding: 0 12px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.16em;
  color: var(--accent);
}
.funnel-floor.closer-floor::before {
  content: 'CLOSER';
  position: absolute;
  top: -8px;
  left: 16px;
  background: var(--bg);
  padding: 0 12px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.16em;
  color: var(--accent);
}

.funnel-arrow {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
  padding: 20px 0;
  position: relative;
}
.funnel-arrow::before, .funnel-arrow::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 40%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent) 50%, transparent);
}
.funnel-arrow::before { left: 0; }
.funnel-arrow::after { right: 0; }

.kpi-inline {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.kpi-inline .kpi-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
.kpi-inline .kpi-value {
  font-size: 22px;
  font-weight: 800;
  color: var(--fg);
  font-feature-settings: 'tnum' 1;
}
.kpi-inline .kpi-value.strong { color: var(--accent); }

#save-status[data-state="pending"] { color: var(--warn); }
#save-status[data-state="saving"] { color: var(--muted); }
#save-status[data-state="saved"] { color: var(--pos); }
#save-status[data-state="error"] { color: var(--neg); }
```

**Critério de aceite Fase 9:**
- [ ] Banner LABORATÓRIO destaque dourado
- [ ] Andares SDR e Closer com label flutuante no canto superior
- [ ] Padrão sutil de blueprint no fundo
- [ ] Seta "↓ entrega calls realizadas" com linhas degradê
- [ ] KPIs inline com cor rosa quando relevante
- [ ] Status de save colorido (laranja → cinza → verde → vermelho)
- [ ] Commit: `design(onda-3): fase 9 - funil estilo laboratório blueprint`

---

### **Fase 10 — Polimento, micro-interações, easter eggs**

**Objetivo:** detalhes que fazem parecer Tesla.

**Tarefas:**

1. **Toast notifications** (substituir `alert()` por toast bonito) — adicionar `public/js/toast.js`:

```js
window.toast = function (msg, type = 'info', durationMs = 3500) {
  const root = document.getElementById('toast-root') || (() => {
    const r = document.createElement('div');
    r.id = 'toast-root';
    r.className = 'toast-root';
    document.body.appendChild(r);
    return r;
  })();
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML = '<span class="toast-msg"></span><button class="toast-close" aria-label="fechar">×</button>';
  el.querySelector('.toast-msg').textContent = msg;
  el.querySelector('.toast-close').onclick = () => el.remove();
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast-in'));
  setTimeout(() => {
    el.classList.add('toast-out');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, durationMs);
};
```

CSS:
```css
.toast-root {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 280px;
  max-width: 420px;
  padding: 14px 16px;
  background: rgba(14, 14, 15, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid var(--line);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius);
  color: var(--fg);
  font-size: 13px;
  font-weight: 500;
  box-shadow: var(--shadow);
  opacity: 0;
  transform: translateX(20px);
  transition: opacity var(--duration) var(--ease-pulso), transform var(--duration) var(--ease-pulso);
}
.toast.toast-in { opacity: 1; transform: translateX(0); }
.toast.toast-out { opacity: 0; transform: translateX(20px); }
.toast-success { border-left-color: var(--pos); }
.toast-error { border-left-color: var(--neg); }
.toast-warn { border-left-color: var(--warn); }
.toast-close {
  background: transparent;
  border: 0;
  color: var(--muted);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  margin-left: auto;
}
.toast-close:hover { color: var(--fg); }
```

Carregar `<script src="/js/toast.js"></script>` em `views/partials/footer.ejs`.

Substituir todos os `alert(...)` em `public/js/*.js` por `toast(...)`. Procurar `alert(` em `public/js/`. **Não** mexer em `confirm()` (mantém nativo, é ação destrutiva).

2. **Loading states** — quando uma fetch está em curso, botão fica com spinner:

```css
.btn[data-loading] {
  position: relative;
  color: transparent !important;
  pointer-events: none;
}
.btn[data-loading]::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  width: 14px; height: 14px;
  margin: -7px 0 0 -7px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  color: var(--fg);
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

Aplicar `btn.dataset.loading = '1'` antes de fetch e remover depois, em pontos críticos (save funil, save venda, save custo).

3. **Easter egg — cursor do Pulso** (opcional mas legal): cursor padrão tem cor accent quando hover em interativos:

```css
button, a, [role="button"], .scenario-item, [data-modal] {
  cursor: pointer;
}
```

E um pequeno efeito de "pulse" no cursor sobre o brand:

```css
.brand:hover .brand-mark {
  animation: brandPulse 1.2s var(--ease-pulso) infinite;
}
@keyframes brandPulse {
  0%, 100% { filter: drop-shadow(0 0 8px var(--accent-glow)); }
  50% { filter: drop-shadow(0 0 20px var(--accent-glow-strong)); transform: scale(1.05); }
}
```

4. **Empty states** elegantes — quando uma tabela está vazia, mostrar:

```html
<div class="empty-state">
  <span class="empty-state-icon">○</span>
  <h3>Sem lançamentos nesta janela</h3>
  <p>Comece adicionando uma venda ou um custo.</p>
</div>
```

```css
.empty-state {
  text-align: center;
  padding: 64px 24px;
  color: var(--muted);
}
.empty-state-icon {
  font-size: 48px;
  color: var(--dim);
  display: block;
  margin-bottom: 16px;
}
.empty-state h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--fg);
  margin-bottom: 8px;
}
.empty-state p {
  font-size: 13px;
  color: var(--muted);
}
```

5. **Favicon** novo — substituir o favicon atual por um SVG do dot pulso em rosa. Em `public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#000"/>
  <path d="M4 16 L10 16 L13 8 L16 24 L19 12 L22 16 L28 16"
        stroke="#FF2E5A" stroke-width="2.5" stroke-linecap="round"
        stroke-linejoin="round" fill="none"/>
</svg>
```

E no head:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="theme-color" content="#000000" />
```

**Critério de aceite Fase 10:**
- [ ] `alert()` substituído por toast em todos os JS
- [ ] Botões de save mostram spinner durante fetch
- [ ] Cursor sobre brand faz pulso animado
- [ ] Tabelas vazias mostram empty state elegante
- [ ] Favicon novo no browser
- [ ] Commit: `design(onda-3): fase 10 - polish, toast, loading, empty states`

---

## 3. PRINCÍPIOS DE DESIGN INVIOLÁVEIS

Em qualquer dúvida, voltar a estes:

1. **Preto absoluto.** Nada de cinza-azulado. Bg é #000.
2. **Rosa elétrico (#FF2E5A) é sagrado.** Usar com parcimônia para criar contraste — quando aparece, manda recado.
3. **Tipografia tabular sempre em números.** `font-feature-settings: 'tnum' 1` em todo lugar que mostre dinheiro/quantidade.
4. **Brackets de canto** são a assinatura visual. Aparecem em: cards de KPI, modais, auth card. Não em todos os elementos — escolher onde.
5. **Movimento com `cubic-bezier(0.22, 1, 0.36, 1)`** sempre. Nunca `ease`, nunca `linear` (exceto spinner).
6. **Densidade > whitespace excessivo.** Bloomberg Terminal, não landing page de SaaS.
7. **Glassmorphism só onde faz sentido:** header sticky, modais, dropdowns. Não em cards normais.
8. **Tipografia uppercase 0.08em–0.18em letter-spacing** em labels e eyebrows.
9. **Glow de accent é raro.** Só em: brand mark, focus ring, marker do gráfico, hover de botão primário.
10. **Animações entram em < 0.5s.** Tesla não te faz esperar.

---

## 4. REGRAS DE EXECUÇÃO

- **Um commit por fase**, prefixo `design(onda-3): fase X - <descrição>`
- **Pause ao fim de cada fase** e me avise pra eu validar antes de seguir
- **Nenhuma lógica de negócio é alterada.** Se descobrir bug funcional durante o redesign, REPORTE em vez de consertar — vira ONDA seguinte.
- **Se um elemento não estiver coberto explicitamente nas fases**, aplique os princípios da seção 3.
- **NÃO faça push até concluir todas as 10 fases.** Acumular commits localmente.
- Ao terminar tudo, me avise com a lista dos 10 commits.

---

## 5. ANTES DE COMEÇAR

Confirme:

1. Você entendeu que o objetivo é elevar o sistema visualmente ao nível da apresentação institucional Pulso (preto absoluto, rosa elétrico, Inter, brackets, motion suave)
2. Nenhuma lógica é alterada
3. 10 fases sequenciais, commit por fase
4. Princípios de design da seção 3

Se confirmou, comece pela **Fase 1 — Foundation**. Bora.

