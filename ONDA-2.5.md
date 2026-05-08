# ONDA 2.5 — Correções pós-review

Eu (Sâmeque) revisei o código depois da ONDA 2 e identifiquei alguns ajustes pra fazer. São pontuais, não muda arquitetura. Cada item tem um critério de aceite explícito.

**Antes de começar:** confirme em uma frase que você entendeu o pedido global, depois entre em cada item na ordem.

**Regra de ouro renovada:** sistema já está em produção com dados. NUNCA destrua banco. Toda migração é aditiva. Em qualquer dúvida, PARE e me pergunte duas vezes.

**IMPORTANTE — processo:** desta vez, entregar **um commit por item** (não juntar). Pode ir corrigindo na sequência sem pausa entre eles, mas commits separados pra ficar fácil de auditar depois.

---

## ITEM 1 — Bloquear lançamento de Ads pelo modal "+ Custo" comum

### Problema
Hoje o modal "+ Custo" comum aceita qualquer categoria, inclusive "Tráfego Pago (Google / Meta Ads)". Isso permite ao usuário lançar ads sem `is_ads=1`, criando inconsistência: o mesmo conceito de gasto pode existir em dois caminhos diferentes (com flag e sem flag).

### Solução
Validação no backend (mais seguro que só no frontend).

**No `routes/api/costs.js`:**
- Definir constante no topo: `const ADS_CATEGORY = 'Tráfego Pago (Google / Meta Ads)';`
- No POST e no PATCH: se `req.body.category === ADS_CATEGORY` E `req.body.is_ads !== 1`, retornar `400` com erro:
  ```json
  { "error": "A categoria 'Tráfego Pago' só pode ser lançada via 'Investimento em Ads'. Use o botão dedicado." }
  ```
- Bonus: se outra categoria customizada do usuário tiver "ads" no nome (case insensitive), apenas logar warning, não bloquear.

**No frontend `views/custos.ejs`:**
- No `<datalist id="categorias-list">`, **filtrar fora** a entrada "Tráfego Pago (Google / Meta Ads)" — não deve aparecer como opção sugerida nos modais de custo comum nem custo recorrente.

### Critério de aceite
- [ ] POST /api/costs com `category="Tráfego Pago (Google / Meta Ads)"` retorna 400
- [ ] Modal "+ Custo" não sugere "Tráfego Pago" no datalist
- [ ] Lançar ads continua funcionando normalmente pelo botão "+ Investimento em Ads"

---

## ITEM 2 — Adicionar `requireMaster` em `/api/ads-week`

### Problema
A rota `/api/ads-week` não tem middleware `requireMaster`. Rachel (role `financeiro`) consegue lançar/editar/deletar Ads. Decisão estratégica de mídia é só do Sâmeque.

### Solução
Em `routes/api/ads-week.js`:
```js
const { requireMaster } = require('../../lib/auth');
```
Adicionar `requireMaster` em POST e DELETE. GET pode continuar livre (Rachel precisa ver o que existe pra entender a tabela de custos).

### Critério de aceite
- [ ] POST /api/ads-week feito como `financeiro` retorna 403
- [ ] DELETE /api/ads-week feito como `financeiro` retorna 403
- [ ] GET /api/ads-week continua funcionando pra ambas as roles

---

## ITEM 3 — Limpar exposição duplicada de `receivables_projected`

### Problema
Em `lib/cashflow.js` linhas 107-108, expõe ambos `sales_projected` (que já inclui receivables) e `receivables_projected` (que é parte do `sales_projected`). Hoje o frontend não duplica, mas é design frágil — um dia alguém vai somar os dois e gerar bug silencioso.

### Solução
Refatorar pra deixar SEMPRE separado e nunca pré-somado:

**Em `lib/cashflow.js`:**
- `sales_projected`: retorna **apenas** projeção do funil (sem receivables somados)
- `receivables_projected`: retorna **apenas** o total de receivables pending da semana
- O cálculo de `delta` (linha 153) muda de:
  ```js
  delta = data.sales_projected - data.costs_planned - adsContrib;
  ```
  pra:
  ```js
  const receivableContrib = settings.include_receivables_in_projection ? data.receivables_projected : 0;
  delta = data.sales_projected + receivableContrib - data.costs_planned - adsContrib;
  ```
- O cálculo de runway (linha 177) muda de:
  ```js
  const burn = (s.costs_planned + adsContrib) - s.sales_projected;
  ```
  pra:
  ```js
  const receivableContrib = data.include_receivables_in_projection ? s.receivables_projected : 0;
  const burn = (s.costs_planned + adsContrib) - s.sales_projected - receivableContrib;
  ```

**No `public/js/pedrra.js`:**
- Linha ~24 (recompute do delta): aplicar a mesma lógica nova:
  ```js
  delta = Number(w.sales_projected || 0) + (initial.includeReceivablesInProjection ? Number(w.receivables_projected || 0) : 0) - Number(w.costs_planned || 0) - Number(w.ads_planned || 0);
  ```
- Adicionar `includeReceivablesInProjection` no `window.PEDRRA_INITIAL`.
- Tabela de projeção: célula de "Vendas (real/proj)" pode mostrar a soma na exibição, mas o cálculo interno usa o split.

### Critério de aceite
- [ ] `sales_projected` retornado pelo backend NÃO inclui receivables
- [ ] `receivables_projected` é separado e somado apenas se setting `include_receivables_in_projection=1`
- [ ] Toggle "Incluir recebíveis na projeção" funciona corretamente em /configuracoes
- [ ] Quando ON, gráfico mostra projeção mais alta no futuro
- [ ] Quando OFF, gráfico mostra só projeção do funil

---

## ITEM 4 — Considerar custos `paid` no futuro no cálculo de burn

### Problema
Em `lib/cashflow.js`, `getRunway` só conta `costs_planned`. Se o Sâmeque marca um custo como `paid` antecipadamente (ex: pagou aluguel hoje pra cair na conta dia 20), esse custo não entra no burn futuro. Resultado: runway parece maior do que é.

### Solução
Em `lib/cashflow.js`, no `getRunway`:
```js
const burn = (s.costs_planned + s.costs_paid + adsContrib_planned + adsContrib_paid) - s.sales_projected - receivableContrib;
```

Onde `s.costs_paid` é o que está em `paid` mas com data futura (já está separado em `getWeeklyCashflow`).

E aplicar `include_ads_in_runway` consistentemente: se setting é `1`, soma `ads_planned + ads_paid`. Se `0`, ignora ambos.

### Critério de aceite
- [ ] Runway considera custos `paid` com data futura
- [ ] Se eu marcar aluguel R$ 4k como `paid` na semana que vem, runway diminui de acordo
- [ ] Toggle de Ads continua funcionando consistente entre `paid` e `planned`

---

## ITEM 5 — Index `from_initial_seed` para idempotência rápida

### Problema
O seed inicial faz `SELECT COUNT(*) FROM costs WHERE from_initial_seed = 1`. Sem índice nessa coluna, scan completo da tabela. Não é problema agora (poucos custos), mas degrada com o tempo.

### Solução
Em `db/migrations.js`, adicionar:
```sql
CREATE INDEX IF NOT EXISTS idx_costs_from_seed ON costs(from_initial_seed);
```

### Critério de aceite
- [ ] Índice criado na próxima inicialização do servidor (migração aditiva, idempotente)

---

## ITEM 6 — Validar valores líquidos negativos e datas malucas

### Problema
Os endpoints `/api/sales` e `/api/costs` aceitam valores negativos e datas tipo `"9999-12-31"` ou `"1900-01-01"`. Não é falha de segurança, mas é fonte de bug visual no gráfico.

### Solução
Validações simples nos POSTs/PATCHes de `sales`, `costs`, `receivables`:
- `gross_amount` e `net_amount` >= 0 (já estão validados em alguns lugares; padronizar)
- `amount` (custos) > 0
- `date` deve ser entre `2025-01-01` e `2030-12-31` (janela razoável; nada antes/depois)
- `expected_date` (recebíveis): mesma janela
- Se inválido, retornar 400 com mensagem clara

### Critério de aceite
- [ ] POST /api/sales com `net_amount: -100` retorna 400
- [ ] POST /api/costs com `date: "1900-01-01"` retorna 400
- [ ] POST /api/receivables com `expected_date: "9999-12-31"` retorna 400

---

## ITEM 7 — Logs de erro estruturados (opcional, não bloqueia)

### Problema
Em produção (NODE_ENV=production), `console.error` em rotas de API loga texto solto. Difícil debugar depois.

### Solução
Em todas as rotas de API que tem `console.error`, padronizar pra:
```js
console.error(JSON.stringify({
  level: 'error',
  ts: new Date().toISOString(),
  route: req.path,
  method: req.method,
  user: req.user?.email,
  msg: err.message,
  stack: err.stack,
}));
```

NUNCA logar `req.body` (pode ter dados sensíveis).

### Critério de aceite
- [ ] Logs de erro em formato JSON em produção
- [ ] `pm2 logs comando-pulso --lines 100` mostra erros parseáveis

---

## ITEM 8 — Documentação curta dos novos endpoints

### Problema
A ONDA 2 adicionou `/api/categories`, `/api/ads-week`, `/api/receivables`. Esses não estão em `docs/SPEC.md`.

### Solução
Atualizar `docs/SPEC.md` seção "API JSON" com os novos endpoints e seus contratos de request/response.

### Critério de aceite
- [ ] `docs/SPEC.md` lista os novos endpoints com método, query params, body shape e response shape
- [ ] Categories CRUD documentado
- [ ] Ads-week (POST com divisão por 7) documentado
- [ ] Receivables (incluindo `sale-with-installments` e `mark-received`) documentado

---

## ORDEM DE EXECUÇÃO

Pode rodar tudo em sequência, mas **um commit por item** com mensagem descritiva em PT-BR:

1. **Item 5** (índice — rápido, isolado)
2. **Item 1** (bloquear ads via custo comum)
3. **Item 2** (requireMaster em ads-week)
4. **Item 6** (validações de valores e datas)
5. **Item 3** (refatorar receivables_projected — mais delicado, mexer com cuidado)
6. **Item 4** (custos paid no futuro)
7. **Item 7** (logs estruturados)
8. **Item 8** (atualizar SPEC.md)

Ao final de cada item:
- Testar local com `npm start` (verificar que servidor sobe sem erro)
- Commit com mensagem `fix(onda-2.5): <descrição em PT-BR>`
- NÃO fazer push ainda — segura tudo pra eu validar

Ao final de TODOS os itens:
- `git push` único com todos os commits
- Me avise no chat com a lista dos commits feitos
- Espere eu confirmar antes de me dar o comando da VPS pra deploy

---

## REGRAS REFORÇADAS

- Toda mudança de schema é aditiva (`ALTER TABLE` com check via `PRAGMA table_info`, `CREATE INDEX IF NOT EXISTS`)
- Nada de console.log de debug deixado no código final
- Mensagens de commit em PT-BR claras
- Em qualquer dúvida sobre comportamento esperado, **PARE e me pergunte**

Bora.

