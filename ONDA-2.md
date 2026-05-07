# ONDA 2 — Bugs, features novas e seed inicial

Estou de volta com mudanças. Já validei o código que você construiu na ONDA 1 — ficou bem feito. Agora temos bugs reais a corrigir, features novas a implementar e dados iniciais a importar.

**Antes de começar:** confirme em uma frase que você entendeu o pedido global, depois entre em cada item na ordem. Cada item tem critérios de aceite explícitos. **Pause ao fim de cada Fase** e me avise antes de seguir.

**Regra de ouro renovada:** este projeto pode ter dados de teste em produção. NUNCA destrua banco. Toda migração é aditiva (`ALTER TABLE` com check de coluna via `PRAGMA table_info`, `CREATE TABLE IF NOT EXISTS`). Se alguma coisa parecer destrutiva, PARE e me pergunte duas vezes.

**Ciclo de deploy:** o de sempre — testar local, push pro GitHub, gerar comando único pra eu colar no terminal Hostinger. NÃO rode comandos na VPS automaticamente.

---

## ITEM 1 — Bug: Funil perde estado ao trocar de aba ou ao adicionar SDR/Closer

### Diagnóstico
Em `public/js/funil.js`, ao adicionar SDR/Closer via modal, faz `window.location.reload()`. Se eu já tinha editado inputs (ads, CPL, capacidade, etc.) sem clicar "Salvar funil", esses valores são perdidos no reload. Da mesma forma, trocar de aba sem salvar perde tudo.

### Comportamento desejado
- Ao adicionar SDR/Closer pelo modal, **NÃO recarregar a página**:
  1. POST `/api/team` para criar
  2. Receber ID na resposta
  3. Adicionar `<tr>` à tabela apropriada com mesmos data-attributes
  4. Focar nos inputs da nova linha
  5. Recomputar totais
- Ao remover SDR/Closer, fazer DELETE `/api/team/:id` e remover `<tr>` do DOM, sem reload.
- Ao **trocar inputs** do funil (ads, CPL, taxas, capacidade, conv%), **auto-salvar via debounce de 800ms**. Cada alteração agenda salvamento. Se nova alteração chega antes do timer, reseta. Quando expira, manda PUT `/api/funnel`.
- Botão "Salvar funil neste cenário" continua existindo (force flush imediato), mas vira opcional.
- Indicador visual sutil ao lado do botão: "salvo às HH:MM" ou "salvando..." durante o save.

### Critério de aceite
- [ ] Edito inputs, troco de aba, volto: valores estão lá
- [ ] Edito ads = 5000, sem clicar "salvar", abro `/configuracoes` em nova aba do navegador, volto: valor está lá
- [ ] Adiciono novo SDR sem perder edições anteriores
- [ ] Removo SDR sem reload da página
- [ ] Indicador "salvo às HH:MM" funciona

---

## ITEM 2 — Categorias dinâmicas (CRUD pelo usuário)

### Schema novo (migração aditiva)

```sql
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  group_name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_categories_group ON categories(group_name);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active);
```

### Seed inicial (idempotente, INSERT OR IGNORE por nome)

**Grupo "Salários":** Cindy Steffany Donini · Erick Salgado · Juliana Costa Silva · Matheus Machado · Pedro Paulo Morais da Silva · Polyana Luvizotto · Rachel Moghrabi · Sâmeque Santana · Thalia Lourenço Batista · Yuri Rafael · Closer 1 (entra na folha em julho) · Closer 2 (entra na folha em julho) · SDR 1 · SDR 2 · SDR 3 · Virginia · Victor

**Grupo "Freelancer":** Lays

**Grupo "Comissões":** Estimativa Comissões

**Grupo "Facilities":** Aluguel do Escritório · Condomínio / IPTU · Energia Elétrica · Água e Saneamento · Internet / Telefonia · Limpeza e Conservação · Segurança / Portaria · Manutenção Predial · Materiais de Escritório · Suprimentos de Copa e Cozinha · Equipamentos (Compra / Leasing) · Outros — Facilities

**Grupo "TI e Assinaturas":** Google Workspace (BTG) · Ferramentas Diversas (BTG) · Microsoft 365 · Claude / Anthropic API · Zoom / Meet Pro · Slack · Notion / ClickUp · CRM (RVOPS) · Cloud (AWS / Azure / GCP) · Antivírus / Segurança · Outros — TI e Assinaturas

**Grupo "Outros Custos":** Marketing e Publicidade · Tráfego Pago (Google / Meta Ads) · Honorários Contábeis / Jurídicos · Impostos e Taxas · Seguros · Viagens e Deslocamentos · Transporte / Uber / Taxi · Treinamento e Capacitação · Outros Custos Operacionais · Cartão Credito BTG

### API
- `GET /api/categories` — lista todas, agrupadas
- `POST /api/categories` — cria nova `{ name, group_name }`
- `PATCH /api/categories/:id` — renomear ou trocar de grupo. Ao renomear, atualiza automaticamente todos os custos que usam essa categoria via `UPDATE costs SET category=? WHERE category=?`, **dentro de uma transação**.
- `DELETE /api/categories/:id` — se houver custos associados, retornar 400 com lista de quantos custos existem; o frontend pergunta "mover para qual categoria?" e re-tenta com `?move_to=outraCategoria`.

### Frontend
- Página `/configuracoes` ganha seção **"Categorias"**:
  - Lista agrupada (cada grupo é card colapsável)
  - Botão "+ nova categoria" (modal: nome + grupo via select)
  - Cada item: editar (modal), deletar
  - Reordenar (opcional, deixe pra depois — não bloqueia)
- Modais de criar venda/custo passam a buscar categorias de `/api/categories` em vez do `lib/categories.js` hardcoded

### Migração
O `lib/categories.js` continua como fallback se a tabela `categories` estiver vazia, mas o sistema deve preferir a tabela.

### Critério de aceite
- [ ] Tabela `categories` populada após boot
- [ ] CRUD funcional em `/configuracoes`
- [ ] Renomear "Aluguel do Escritório" → "Aluguel" atualiza automaticamente os custos existentes
- [ ] Tentar deletar categoria com custos: bloqueia com mensagem
- [ ] Modais de venda/custo carregam categorias do banco

---

## ITEM 3 — Tabela de custos agrupada por grupo

### Comportamento atual
Em `views/custos.ejs`, a tabela mostra todas as categorias em ordem de inserção, sem cabeçalho de grupo.

### Comportamento desejado
- Antes de cada bloco de categorias do mesmo grupo, inserir linha de cabeçalho destacada visualmente
- Cada grupo tem linha de subtotal automática (somando todas as categorias do grupo na semana)
- Linha "Saldo da semana" continua no final
- Ordem dos grupos: **Salários · Freelancer · Comissões · Facilities · TI e Assinaturas · Outros Custos**

### Critério de aceite
- [ ] Tabela mostra grupos como seções com cabeçalho destacado
- [ ] Subtotal por grupo aparece no fim de cada seção
- [ ] Visual fica limpo, não sobrecarregado

---

## ITEM 4 — Investimento em Ads (categoria especial)

### Conceito
Ads continuam usando a tabela `costs` (não criar nova tabela), mas ganham tratamento visual e funcional separado. O usuário lança o **valor SEMANAL** e o sistema **divide automaticamente por 7**, criando 7 registros (um por dia da semana dom→sáb).

### Schema (migração aditiva)
Adicionar coluna na tabela `costs`:
```sql
-- Verificar primeiro se a coluna já existe via PRAGMA table_info(costs)
ALTER TABLE costs ADD COLUMN is_ads INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_costs_is_ads ON costs(is_ads);
```

Adicionar setting:
```sql
INSERT OR IGNORE INTO settings (key, value) VALUES ('include_ads_in_runway', '1');
```

### API nova
- `POST /api/ads-week` — body: `{ week_id, total_amount, scenario_id? }`. Lógica:
  1. Pega o range dom→sáb da semana via `lib/weeks.js`
  2. Calcula `daily_amount = total_amount / 7` (não trunca)
  3. Apaga os 7 custos existentes daquela semana com `is_ads=1` e mesmo `scenario_id` (DELETE com WHERE específico, não TRUNCATE)
  4. Insere 7 novos custos com `is_ads=1`, um por dia da semana, categoria `'Tráfego Pago (Google / Meta Ads)'`, status `planned`
  5. Tudo numa transação
- `GET /api/ads-week?from=&to=&scenario_id=` — retorna lista de semanas com seus totais de ads (agrupado por semana, somando os 7 dias)
- `DELETE /api/ads-week?week_id=&scenario_id=` — remove os 7 custos daquela semana

### Frontend — aba `/custos`
- Adicionar **botão "+ Investimento em Ads"** ao lado dos outros botões da toolbar
- Modal específico:
  - Seletor de semana (dom→sáb das próximas/passadas semanas)
  - Campo "Valor da semana (R$)"
  - Cenário (NULL ou ativo)
  - Texto explicativo: "Será dividido em R$ X / dia automaticamente"
- Na tabela semanal, **antes do cabeçalho dos grupos**, criar uma seção destacada visualmente:
  ```
  ━━━ INVESTIMENTO EM ADS ━━━
  Tráfego Pago (Google / Meta Ads)  | val | val | val
  Total Ads na semana               | sum | sum | sum
  ```
- Ads NÃO contam no "Subtotal Outros Custos" — são separados
- Linha "Saldo da semana" passa a considerar Ads + Custos (controlado pela setting `include_ads_in_runway`)

### Frontend — aba `/pedrra`
- KPI bar ganha 6º card: **"Ads na semana atual"** mostrando total de ads daquela semana
- No gráfico, adicionar terceira série: **barras laranjas** mostrando ads/semana (separadas das barras vermelhas de custos do Item 8)
- Tooltip enriquecido mostra ads separadamente

### Frontend — `/configuracoes`
- Toggle: **"Considerar Ads no cálculo do Saldo e Runway"** (default ON)
- Lê/escreve `settings.include_ads_in_runway`

### Backend — `lib/cashflow.js`
- Função `getCashToday()` continua somando todos os custos `paid` (incluindo `is_ads=1`)
- Função `getRunway()`: se `include_ads_in_runway=0`, somar burn excluindo `is_ads=1`. Se `=1`, somar tudo (comportamento atual).
- Função `getWeeklyCashflow()` retorna 2 campos novos por semana: `ads_paid` e `ads_planned` (separados de `costs_paid` e `costs_planned`)

### Critério de aceite
- [ ] Botão "+ Investimento em Ads" abre modal próprio
- [ ] Lançar R$ 7.000 numa semana cria 7 registros de R$ 1.000 com `is_ads=1`
- [ ] Editar uma semana de ads apaga os 7 antigos e cria 7 novos
- [ ] Aba `/custos` mostra ads como bloco separado com label "INVESTIMENTO EM ADS"
- [ ] PEDRRA mostra KPI "Ads na semana atual" e barras separadas no gráfico
- [ ] Toggle de runway funciona: desligar tira ads do cálculo
- [ ] Importante: Ads NÃO aparecem no "Subtotal Outros Custos" e NÃO podem ser lançados via "+ Custo" comum

---

## ITEM 5 — Seed dos custos reais (importação inicial)

### Conceito
Popular o sistema com 88 custos previstos vindos da planilha real do Sâmeque. Idempotente: se rodar duas vezes, não duplica.

### Schema (migração aditiva)
Adicionar coluna em `costs`:
```sql
-- Verificar primeiro se já existe via PRAGMA table_info(costs)
ALTER TABLE costs ADD COLUMN from_initial_seed INTEGER DEFAULT 0;
```

### Implementação
1. Criar arquivo `db/seeds/initial-costs.json` (anexado ao projeto — receberá conteúdo em chunks abaixo)
2. Criar script `scripts/seed-initial-costs.js` que:
   - Lê o JSON
   - Verifica se já existe **qualquer custo** com `from_initial_seed=1`. Se sim, **NÃO insere nada** e loga "Seed inicial já aplicado, abortando".
   - Senão, insere os 88 custos numa transação, todos com `status='planned'`, `scenario_id=NULL` (realidade), `from_initial_seed=1`, `created_by='seed-initial'`
   - Loga total inserido + valor total
3. Adicionar comando ao `package.json`:
   ```json
   "seed:initial-costs": "node scripts/seed-initial-costs.js"
   ```
4. **NÃO chamar automaticamente no boot** — só quando o usuário (Sâmeque) rodar `npm run seed:initial-costs` manualmente na VPS depois que tudo estiver deployado.

### Conteúdo do JSON
O conteúdo completo está no arquivo `db/seeds/initial-costs.json`. Tem 88 entradas de custos cobrindo:
- Salários jun-set 2026 (com valores específicos por mês conforme a planilha original do Sâmeque)
- Aluguel abr-dez 2026 (R$ 44.054 total)
- Comissões jun + jul (R$ 90.000 total)
- Suprimentos copa/cozinha (17 semanas)
- CRM, Cartão BTG, Google Workspace, etc.
- **Ads NÃO entram** (vão pelo Item 4)

Total geral: R$ 436.506,11.

### Critério de aceite
- [ ] Coluna `from_initial_seed` adicionada à tabela `costs`
- [ ] `npm run seed:initial-costs` insere os 88 custos
- [ ] Rodar de novo NÃO duplica (idempotente)
- [ ] Custos aparecem corretamente na aba `/custos` agrupados por categoria
- [ ] Soma total bate com R$ 436.506,11 (sem contar ads)

---

## ITEM 6 — Contas a receber (recebíveis)

### Conceito
Quando uma venda é parcelada (ex: R$ 5k Pix hoje + 5x R$ 5k cartão começando 07/06), cada parcela futura é um "recebível". O usuário pode ligar/desligar se contas a receber **entram na projeção de caixa**.

### Schema (migração aditiva)

```sql
CREATE TABLE IF NOT EXISTS receivables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER,
  expected_date TEXT NOT NULL,
  expected_amount REAL NOT NULL,
  payment_method TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'received', 'cancelled')) DEFAULT 'pending',
  client_name TEXT,
  notes TEXT,
  received_date TEXT,
  received_sale_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
  FOREIGN KEY (received_sale_id) REFERENCES sales(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_receivables_expected_date ON receivables(expected_date);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);
```

E setting:
```sql
INSERT OR IGNORE INTO settings (key, value) VALUES ('include_receivables_in_projection', '0');
```

### Modal "+ Venda" novo

Modal ganha seletor no topo:
- **(A) Venda 100% paga hoje** (default) — comportamento atual: lança 1 sale com data/bruto/líquido/método
- **(B) Venda parcelada** — abre subform:
  - Data da venda (default hoje)
  - Cliente
  - Closer
  - Valor pago hoje (R$, líquido)
  - Método do pagamento de hoje
  - Tabela editável de **parcelas futuras**:
    - Botão "+ adicionar parcela"
    - Cada linha: data prevista + valor previsto + método + remover
  - Resumo no rodapé: "Hoje: R$ X | Próximas N parcelas: R$ Y total | Total da venda: R$ Z"

Ao salvar venda parcelada (numa única transação):
- Cria 1 `sale` para o valor de hoje (data hoje, líquido digitado)
- Cria N `receivables` com status `pending`, `sale_id` apontando, `expected_date` por parcela

### API

- `GET /api/receivables?status=pending&from=&to=` — lista
- `POST /api/receivables` — cria avulso
- `PATCH /api/receivables/:id` — editar (data, valor, status)
- `POST /api/receivables/:id/mark-received` — marca como recebido. Cria automaticamente uma `sale` com `date=received_date`, `gross_amount=expected_amount`, `net_amount=expected_amount` (modal de confirmação permite editar net_amount). Liga o `received_sale_id`. Status vira `received`.
- `DELETE /api/receivables/:id` — soft delete (status `cancelled`) se `sale_id` existe; hard delete se órfão

### Onde aparecem

**1. Banner no PEDRRA**
Se houver recebíveis com `expected_date` nos próximos 7 dias e `status='pending'`, banner amarelo no topo:
```
⚠ 3 recebíveis vencendo nos próximos 7 dias · R$ 15.000 total · ver detalhes
```
"Ver detalhes" abre modal/drawer com a lista.

**2. Aba Custos e Vendas**
Adicionar nova seção abaixo das tabelas: **"Recebíveis pendentes (próximos 60 dias)"**. Lista com data prevista, valor, cliente, método, ações (marcar como recebido / editar / cancelar). Recebíveis vencidos (data < hoje, `status='pending'`) destacados em vermelho.

**3. PEDRRA — toggle de projeção**
Em `/configuracoes` ou no header da PEDRRA, toggle "Incluir recebíveis na projeção de caixa" (lê/escreve `settings.include_receivables_in_projection`). Quando ON, `getWeeklyCashflow` em `lib/cashflow.js` soma os recebíveis pending nas semanas futuras (na linha de "vendas projetadas"). OFF: ignora.

### Critério de aceite
- [ ] Modal de venda permite escolher 100% paga vs parcelada
- [ ] Venda parcelada cria 1 sale + N receivables corretamente
- [ ] Banner do PEDRRA aparece se houver recebíveis nos próximos 7 dias
- [ ] Lista de recebíveis pendentes na aba Custos e Vendas
- [ ] Marcar como recebido converte em sale automaticamente
- [ ] Toggle "incluir na projeção" liga/desliga o efeito no gráfico do PEDRRA
- [ ] Recebíveis vencidos aparecem em vermelho

---

## ITEM 7 — Gráfico do PEDRRA com indicação visual de custos por semana

### Comportamento desejado
- **Segunda série no gráfico:** barras embaixo da linha mostrando custo total daquela semana (custos pagos no passado, planejados no futuro). Use Chart.js mixed chart (line + bar com `type: 'bar'` no dataset de custos). **Atenção:** essa série de custos NÃO inclui ads (que vai como terceira série, ver Item 4).
- **Eixo Y secundário** (lado direito) para a escala dos custos
- **Tooltip enriquecido:** ao passar mouse na semana, mostrar:
  ```
  W19 · 03–09/mai
  Caixa: R$ 87.420
  Vendas: R$ 8.200
  Custos: R$ 11.400
  Ads: R$ 7.000
  Saldo da semana: -R$ 10.200
  ━━━━━━━━━━━━━━━
  Top 3 custos da semana:
  • Folha · R$ 7.000
  • Aluguel · R$ 2.354
  • CRM · R$ 2.500
  ```
- Cor das barras de custo: vermelho/laranja translúcido (não pode competir com a linha de caixa)
- Cor das barras de ads: laranja distinto

### Critério de aceite
- [ ] Gráfico mostra linha de caixa + barras de custo + barras de ads
- [ ] Tooltip detalha top 3 custos da semana e separa ads
- [ ] Visual fica claro, não confuso

---

## ITEM 8 — Cenários combinados no gráfico

### Comportamento atual
Apenas o cenário ativo é desenhado.

### Comportamento desejado
- No painel de cenários (header dropdown), cada cenário ganha **checkbox "mostrar no gráfico"** ao lado do nome
- O cenário ativo está sempre marcado (não pode desmarcar)
- Outros cenários podem ser marcados (até 3 visíveis simultâneos no gráfico, fora o ativo)
- Cada cenário aparece como linha pontilhada com sua cor (`scenarios.color`) na parte do **futuro** do gráfico
- Legenda do gráfico lista cada cenário visível com sua cor
- Escolha persistida em `settings` (key `pedrra_visible_scenario_ids`, valor JSON array de IDs)
- API: `GET/PUT /api/settings/visible-scenarios`

### Critério de aceite
- [ ] Posso marcar 2 cenários adicionais além do ativo no gráfico
- [ ] Linhas aparecem com cores distintas
- [ ] Legenda mostra todos os cenários visíveis
- [ ] Escolha persiste após reload

---

## ORDEM DE EXECUÇÃO

Fase por fase, commitando ao fim de cada uma. **PARE no fim de cada fase e me avise** pra eu validar antes de você seguir.

| Fase | Itens | Notas |
|---|---|---|
| **A** | Item 1 (bug funil) | Sem schema, conserto rápido |
| **B** | Item 2 (categorias CRUD) + Item 3 (tabela agrupada) | Schema novo `categories` |
| **C** | Item 4 (Ads — flag + UI dedicada) | `ALTER TABLE costs ADD is_ads`. Tem que vir ANTES da Fase D porque o seed depende disso. |
| **D** | Item 5 (seed dos custos reais) | `ALTER TABLE costs ADD from_initial_seed`. Cria script e JSON. NÃO executa o seed automaticamente — só prepara. |
| **E** | Item 6 (recebíveis) | Schema novo `receivables`, escopo grande |
| **F** | Item 7 (custos no gráfico) + Item 8 (cenários combinados) | Só frontend |

Ao fim de cada fase:
1. Teste local com `npm start`
2. Commit no formato `fase X: descrição curta em PT-BR`
3. Push
4. **PARE e me avise** — eu valido antes de você seguir
5. **NÃO rode comando da VPS automaticamente.** Apenas forneça o comando pronto pra eu colar no terminal Hostinger.

Depois da Fase F (ou onde fizer sentido), me avise pra eu rodar manualmente `npm run seed:initial-costs` na VPS pra popular os 88 custos iniciais.

---

## REGRAS REFORÇADAS

- Toda mudança de schema é aditiva (`ALTER TABLE` com check via `PRAGMA table_info`, `CREATE TABLE IF NOT EXISTS`)
- Toda mutação na API chama `audit.log()`
- Nada de console.log de debug deixado no código final
- Mensagens de commit em PT-BR claras
- Testar local **sempre** antes de subir
- Em qualquer dúvida sobre comportamento esperado, **PARE e me pergunte** — não invente

Bora.

