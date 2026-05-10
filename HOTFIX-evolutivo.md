# HOTFIX — Modo evolutivo do funil não ativa

Sistema está em produção (commit `0df1261`). Ao clicar em "Ativar modo evolutivo" em `/funil`, **nada acontece** — não há request, não há erro, simplesmente nada.

**Causa raiz identificada externamente** (auditoria do Claude.ai cruzando código + comportamento):

## Diagnóstico técnico

1. Em `views/funil.ejs` (linhas 322-332), o `<script src="/js/funil-evolutivo.js">` só é incluído quando `evolutiveEnabled === true`. Quando OFF, **só** carrega `funil.js` (estático). Resultado: o JS que escuta cliques no botão "Ativar modo evolutivo" não chega ao browser.
2. Em `public/js/funil-evolutivo.js` (linhas 2-3), há `const init = window.FUNNEL_EVOLUTIVE_INIT || null; if (!init) return;` no topo do IIFE. Mesmo se o script fosse carregado, ele sairia antes de registrar o listener do botão "Ativar".

Ou seja, dois bugs reforçam um ao outro: o JS não chega e, mesmo se chegasse, sairia antes de registrar.

---

## Fix em 2 mudanças cirúrgicas

**REGRAS:**
- Mude **EXATAMENTE** o que está abaixo. Não otimize nada além disso.
- Não mexa em outros arquivos.
- Não rode migration, não toque em data.db.
- 1 commit único.
- Teste local com `npm start` antes de fazer push.

### Mudança 1 — `views/funil.ejs`

Localizar o bloco no fim da view (linhas ~322-332):

```ejs
<% if (!evolutiveEnabled) { %>
<script src="/js/funil.js?v=<%= assetVersion %>"></script>
<% } else { %>
<script>window.FUNNEL_EVOLUTIVE_INIT = <%- JSON.stringify({
  scenarioId: activeScenario.id,
  weeksCount: evolutiveWeeks,
  funnelWeekly,
  teamWeekly,
  team: allTeam.map((m) => ({ id: m.id, name: m.name, role: m.role })),
}) %>;</script>
<script src="/js/funil-evolutivo.js?v=<%= assetVersion %>"></script>
<% } %>
```

Substituir por:

```ejs
<script>window.FUNNEL_BOOTSTRAP = <%- JSON.stringify({
  scenarioId: activeScenario.id,
  evolutiveEnabled: !!evolutiveEnabled,
  weeksCount: evolutiveWeeks,
}) %>;</script>
<% if (!evolutiveEnabled) { %>
<script src="/js/funil.js?v=<%= assetVersion %>"></script>
<% } else { %>
<script>window.FUNNEL_EVOLUTIVE_INIT = <%- JSON.stringify({
  scenarioId: activeScenario.id,
  weeksCount: evolutiveWeeks,
  funnelWeekly,
  teamWeekly,
  team: allTeam.map((m) => ({ id: m.id, name: m.name, role: m.role })),
}) %>;</script>
<% } %>
<script src="/js/funil-evolutivo.js?v=<%= assetVersion %>"></script>
```

**O que muda:**
- `funil-evolutivo.js` agora é carregado **SEMPRE**, independente do modo
- Adicionei `window.FUNNEL_BOOTSTRAP` com `scenarioId` e flag `evolutiveEnabled` que o JS pode ler antes de qualquer coisa
- O bloco de `FUNNEL_EVOLUTIVE_INIT` continua só quando ON (o JS de timeline só roda quando ON)

### Mudança 2 — `public/js/funil-evolutivo.js`

Localizar as primeiras 3 linhas:

```js
(function () {
  const init = window.FUNNEL_EVOLUTIVE_INIT || null;
  if (!init) return;
```

Substituir por:

```js
(function () {
  const bootstrap = window.FUNNEL_BOOTSTRAP || null;
  const init = window.FUNNEL_EVOLUTIVE_INIT || null;

  // === Listeners que rodam INDEPENDENTE do modo (botão Ativar/Desativar) ===
  setupEnableDisableButtons();

  // Se não estamos em modo evolutivo, não há timeline pra inicializar — sai aqui.
  if (!init) return;
```

E adicionar a função `setupEnableDisableButtons` no final do IIFE, **ANTES** do `})();` final. Procure a chave de fechamento `})();` no final do arquivo e insira esta função imediatamente antes:

```js
  // ========== Setup dos botões Ativar/Desativar (sempre roda) ==========
  function setupEnableDisableButtons() {
    const enableBtn = document.getElementById('btn-enable-evolutive');
    if (enableBtn) {
      enableBtn.addEventListener('click', async () => {
        const sel = document.getElementById('weeks-count');
        const weeks = sel ? Number(sel.value) || 12 : 12;
        const scenarioId = enableBtn.dataset.scenarioId || (bootstrap && bootstrap.scenarioId);
        if (!scenarioId) {
          if (window.toast) window.toast('Erro: cenário não identificado'); else alert('Erro: cenário não identificado');
          return;
        }
        enableBtn.disabled = true;
        try {
          const res = await fetch('/api/funnel/evolutive/' + scenarioId + '/enable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weeks }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = 'Erro: ' + (err.error || ('HTTP ' + res.status));
            if (window.toast) window.toast(msg); else alert(msg);
            return;
          }
          if (window.toast) window.toast('Modo evolutivo ativado · ' + weeks + ' semanas ✓');
          setTimeout(() => location.reload(), 400);
        } catch (err) {
          const msg = 'Erro: ' + err.message;
          if (window.toast) window.toast(msg); else alert(msg);
        } finally {
          enableBtn.disabled = false;
        }
      });
    }

    const disableBtn = document.getElementById('btn-disable-evolutive');
    if (disableBtn) {
      disableBtn.addEventListener('click', async () => {
        const scenarioId = disableBtn.dataset.scenarioId || (bootstrap && bootstrap.scenarioId);
        if (!scenarioId) return;
        if (!confirm('Voltar ao modo estático? A timeline configurada é preservada e volta a aparecer se você reativar.')) return;
        try {
          const res = await fetch('/api/funnel/evolutive/' + scenarioId + '/disable', { method: 'POST' });
          if (!res.ok) {
            if (window.toast) window.toast('Erro ao voltar ao modo estático'); else alert('Erro ao voltar ao modo estático');
            return;
          }
          if (window.toast) window.toast('Voltou ao modo estático');
          setTimeout(() => location.reload(), 400);
        } catch (err) {
          const msg = 'Erro: ' + err.message;
          if (window.toast) window.toast(msg); else alert(msg);
        }
      });
    }
  }
```

**ATENÇÃO IMPORTANTE:** o arquivo atual já tem um bloco que registra `enableBtn` e `disableBtn` em torno das linhas 185-220, **DENTRO** da seção que só roda quando `init` existe. Esses dois blocos antigos precisam ser **REMOVIDOS** (foram movidos pra função `setupEnableDisableButtons` acima) pra evitar duplicação de listeners.

Procure por:
```js
  // === Enable / Disable / Apply curve ===
  const enableBtn = document.getElementById('btn-enable-evolutive');
  if (enableBtn) {
    enableBtn.addEventListener('click', async () => {
      ...
    });
  }

  const disableBtn = document.getElementById('btn-disable-evolutive');
  if (disableBtn) {
    disableBtn.addEventListener('click', async () => {
      ...
    });
  }
```

E **REMOVA esses dois blocos completos**. Mantenha apenas o bloco de `applyCurveBtn` e o `curveDlg` que vem em seguida (esses dependem da timeline existir, ficam onde estão).

## Critério de aceite

- [ ] `views/funil.ejs` carrega `funil-evolutivo.js` independente do modo
- [ ] `public/js/funil-evolutivo.js` tem `setupEnableDisableButtons()` no topo, antes do `if (!init) return`
- [ ] Os dois blocos antigos `enableBtn` e `disableBtn` foram removidos da parte de baixo
- [ ] Apenas o bloco `applyCurveBtn` continua na parte de baixo (depende de timeline)
- [ ] Servidor sobe local sem erro
- [ ] No browser local: clicar em "Ativar modo evolutivo" faz request POST e recarrega a página
- [ ] Após ativar: aparece a tabela timeline
- [ ] Clicar em "Voltar ao modo estático" funciona e volta ao funil estático
- [ ] Commit: `hotfix(onda-6): corrige modo evolutivo - botoes Ativar/Desativar nao funcionavam`

## Sequência

1. Confirme em uma frase que entendeu o pedido
2. Aplique Mudança 1 em `views/funil.ejs`
3. Aplique Mudança 2 em `public/js/funil-evolutivo.js`
4. Teste local com `npm start` se possível (sandbox bloqueado: avise)
5. Commit único com mensagem do critério de aceite acima
6. **NÃO faça push** ainda. Liste o commit feito e me reporte.

Bora.

