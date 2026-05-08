# SPEC.md — Especificação Funcional do Comando Pulso

Este documento define o comportamento de cada tela e cada interação. Leia antes de implementar qualquer feature.

## 1. Estrutura de abas

O sistema tem **3 abas principais**, todas servidas como rotas separadas mas compartilhando layout/header. A aba que abre por padrão é **PEDRRA** para o role `master` e **/custos** para o role `financeiro`.

---

### 1.1 Aba 1 — Custos e Vendas Semana a Semana

**Rota:** `/custos`
**Quem acessa:** Sâmeque (master) e Rachel (financeiro)
**Função:** lançar e visualizar fatos reais (vendas e custos) e custos previstos para o futuro.

#### Visualização

Seletor para mostrar 1, 2, 3, 4, 5, 6, 8 ou 10 semanas. Default: 4 semanas (a passada + atual + 2 futuras).

**Sempre semanas dom→sáb.** A semana é ancorada pelo mês do domingo (semana 26/04→02/05 conta como abril porque o domingo cai em abril).

**Tabela:** uma linha por categoria, colunas = semanas selecionadas. Cada célula mostra o subtotal real + (se cenário ativo aplicável no futuro) overlay com previsto do cenário. Linha final = saldo da semana = vendas líquidas − custos da semana.

#### Lançamento de venda (granularidade DIÁRIA)

Campos do formulário:

- **Data** (obrigatório, default = hoje)
- **Valor bruto** (R$, obrigatório)
- **Valor líquido** (R$, **digitado pelo usuário, não calculado automaticamente** — o usuário sabe melhor)
- **Cliente** (texto, opcional)
- **Closer responsável** (FK para `team_members`, opcional, lista filtrada por role='closer')
- **Meio de pagamento** (enum: pix, cartao_avista, cartao_2x, cartao_6x, cartao_12x, outro — opcional)
- **Observações** (texto, opcional)

#### Lançamento de custo (granularidade DIÁRIA)

Campos do formulário:

- **Data** (obrigatório)
- **Valor** (R$, obrigatório)
- **Categoria** (enum/select com lista pré-cadastrada — ver §4)
- **Descrição** (texto)
- **Status:** `paid` ou `planned` (Rachel marca como `paid` quando confirma o pagamento)
- **Checkbox "É recorrente?"** — se marcado, abre subformulário:
  - **Padrão:** `monthly_day_X` (todo dia X do mês) ou `every_N_weeks` (a cada N semanas)
  - **Valor base** (R$)
  - **Data de início** (default = data do custo)
  - **Data fim** (opcional, NULL = indefinido)
- **Cenário** (default: NULL, ou seja, é custo da realidade compartilhado em todos cenários)

#### Edição

**Tudo é editável a qualquer momento.** Vendas reais podem ser corrigidas. Custos podem ser editados ou apagados (com auditoria). Ocorrências individuais de uma série recorrente podem ser editadas independentemente sem quebrar a série (ex: aluguel é R$ 4.000 todo mês mas em julho vai pagar R$ 4.500 — edita só a ocorrência de julho).

---

### 1.2 Aba 2 — Funil de Performance

**Rota:** `/funil`
**Quem acessa:** apenas Sâmeque (master)
**Função:** **laboratório puro de simulação**. NUNCA recebe fato real do funil. Apenas projeta hipóteses para alimentar a PEDRRA com receita projetada.

#### Time comercial editável

Lista de pessoas com `name` e `role` (`sdr` ou `closer`). CRUD completo na aba. Pessoas inativas (active=0) ficam ocultas mas preservam histórico.

#### Funil visual em DOIS ANDARES (visualmente separados)

**Andar superior — SDR:**
1. **Investimento em ads/semana** (R$, input)
2. **CPL** (R$, input — custo por lead)
3. **Leads gerados** (= ads ÷ CPL, calculado, número inteiro truncado pra baixo)
4. **Rebarba Selfiebook** (input adicional, soma direto em "calls agendadas" — NÃO passa por SDR)
5. **Por SDR cadastrado:** capacidade semanal (calls que ele agenda) + taxa de show/comparecimento individual

**Andar inferior — Closer:**
1. **Calls agendadas total** (do SDR + rebarba SB)
2. **Show rate aplicado** → calls realizadas
3. **Por Closer cadastrado:** % de conversão na call (venda direta) e % de conversão forecast
4. **Vendas em call** (NÚMERO INTEIRO TRUNCADO — se cálculo der 4,7 vendas, mostra 4)
5. **Bônus de forecast:** vendas extras que vêm da carteira de negociação (mostrado SEPARADO da receita base, não somado, exibido como "+N vendas extras"); também truncado pra inteiro

#### Configurações financeiras do funil

- **Ticket médio:** input editável (default R$ 10.000)
- **Taxa de pagamento média:** input editável (default 12%)
- **Receita projetada bruta** = vendas × ticket médio
- **Receita projetada líquida** = bruto × (1 − taxa)

#### Defaults históricos

No MVP, deixar todos os campos editáveis sem âncora histórica. Em fase futura, calcular médias móveis de 4 semanas a partir dos dados reais lançados na Aba 1.

#### Estado do funil

**Cada cenário guarda seu próprio snapshot completo do funil** (todos os inputs acima). Trocar cenário ativo carrega os valores do funil daquele cenário.

---

### 1.3 Aba 3 — PEDRRA (QG, abre por default para master)

**Rota:** `/pedrra`
**Quem acessa:** apenas Sâmeque (master)
**Função:** cockpit estratégico de comando.

#### Componentes da tela (de cima pra baixo):

**1. Header**
- Brand "Comando Pulso · PEDRRA" + tooltip explicando a sigla
- Indicador de cenário ativo + seletor (dropdown)
- Avatar do usuário + Sair

**2. KPI Bar (5 valores em destaque)**

- **Caixa hoje:** R$ acumulado considerando saldo inicial + todas as vendas pagas − todos os custos pagos até a data atual
- **Runway:** em semanas, calculado dinamicamente (caixa hoje ÷ burn médio semanal das próximas 4 semanas no cenário ativo). Se runway > 52 semanas, exibir "52+".
- **Resultado da semana passada:** vendas líquidas − custos pagos da semana anterior
- **Resultado da semana atual:** idem, semana em curso
- **Projeção próximas 2 semanas:** soma do resultado projetado das semanas W+1 e W+2 no cenário ativo

**3. Gráfico hero (Chart.js, line chart)**

- **Eixo X:** semanas (com dom→sáb e label da semana, ex "W19 · 03–09/mai")
- **Eixo Y:** caixa em conta (R$)
- **Janela default:** 1 semana passada + semana atual + 2 semanas futuras
- **Controles** para o usuário ajustar pra trás (1, 2, 4, 8) e pra frente (2, 4, 8, 12)
- **Linha sólida** para o histórico (real, imutável)
- **Marcador vertical** na "semana atual" (linha tracejada)
- **Linhas pontilhadas** para o futuro, **uma por cenário ativo na visualização** (até 3 cenários sobrepostos com cores distintas)

**4. Painel lateral de cenários**

- Lista de todos os cenários criados
- Botão "+ novo cenário" (cria em branco com nome editável)
- Cada cenário tem: nome, indicador "ativo" (radio), botão "duplicar", botão "renomear", botão "excluir"
- Apenas 1 cenário pode estar `ativo` por vez

**5. Tabela editável de projeção (abaixo do gráfico)**

- Uma linha por semana futura visível
- Colunas: vendas previstas (input), custos previstos (calculado a partir dos custos `planned` do cenário ativo + recorrentes), saldo projetado da semana, saldo acumulado projetado
- Editar a célula de vendas previstas redesenha o gráfico em tempo real

---

## 2. Cenários — modelo conceitual

Cenários são containers de **hipóteses para o futuro**. O passado é IMUTÁVEL e idêntico em todos os cenários — sempre é a verdade dos fatos lançados.

- O usuário **cria cenários nomeados livremente** ("Base Maio", "Ofensivo Q3", "Pé no Chão")
- Sempre existe **0 ou 1 cenário ativo** (ao iniciar, sistema cria um cenário padrão chamado "Base" e marca como ativo)
- O cenário ativo afeta: (a) custos previstos no futuro, (b) inputs do funil de performance, (c) projeções de receita futura
- **Trocar de cenário ativo é instantâneo e visível em todas as abas**
- Cenários são editáveis a qualquer momento
- Cenário pode ser excluído (cascade nos seus custos/funnel inputs próprios)
- **Cenário NOVO nasce em branco** (todos os inputs zerados ou com defaults)
- Pode haver botão "duplicar cenário" que clona estado atual

---

## 3. Permissões

| Recurso | Sâmeque (master) | Rachel (financeiro) |
|---|---|---|
| /pedrra | ✅ | ❌ (redireciona para /custos) |
| /custos | ✅ | ✅ |
| /funil | ✅ | ❌ |
| Criar/editar/excluir cenários | ✅ | ❌ |
| Ativar cenário | ✅ | ❌ |
| Lançar venda | ✅ | ✅ |
| Lançar/editar custos | ✅ | ✅ |
| Editar time comercial | ✅ | ❌ |
| /configuracoes (saldo inicial etc.) | ✅ | ❌ |
| Audit log | ✅ visualiza | ❌ |
| Export/backup manual | ✅ | ❌ |

Roles no banco: `master` (Sâmeque) e `financeiro` (Rachel). Middleware `requireMaster` para rotas restritas.

---

## 4. Categorias de custo (lista inicial)

Pré-popular na primeira execução (seed) — todas editáveis pelo usuário depois.

### Salários
Cindy Steffany Donini · Erick Salgado · Juliana Costa Silva · Matheus Machado · Pedro Paulo Morais da Silva · Polyana Luvizotto · Rachel Moghrabi · Sâmeque Santana · Thalia Lourenço Batista · Yuri Rafael · Lays (Freelancer)

### Comissões
Estimativa Comissões

### Facilities
Aluguel do Escritório · Condomínio/IPTU · Energia Elétrica · Água e Saneamento · Internet/Telefonia · Limpeza e Conservação · Segurança/Portaria · Manutenção Predial · Materiais de Escritório · Suprimentos de Copa e Cozinha · Equipamentos · Outros Facilities

### TI e Assinaturas
Google Workspace (BTG) · Ferramentas Diversas (BTG) · Microsoft 365 · Claude/Anthropic API · Zoom/Meet Pro · Slack · Notion/ClickUp · CRM (RVOPS) · Cloud (AWS/Azure/GCP) · Antivírus/Segurança · Outros TI

### Outros Custos
Marketing e Publicidade · Tráfego Pago (Google/Meta Ads) · Honorários Contábeis/Jurídicos · Impostos e Taxas · Seguros · Viagens e Deslocamentos · Transporte/Uber/Taxi · Treinamento e Capacitação · Outros Operacionais · Cartão de Crédito BTG

A categoria é livre (string), mas o frontend oferece um select com essas opções pré-cadastradas. O usuário pode digitar uma nova.

---

## 5. Saldo inicial e configurações globais

- **Saldo inicial:** R$ 120.000,00 (configurável em `/configuracoes`)
- **Toggle "Incluir saldo inicial no cálculo":** sim/não. Default: sim. Quando desligado, o sistema mostra apenas o resultado do período (delta de caixa) sem somar o aporte inicial.
- **Taxa de pagamento default:** 12% (configurável)
- **Tudo persistido na tabela `settings` (key-value)**

---

## 6. Wireframes textuais

### 6.1 PEDRRA (`/pedrra`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⬤ Comando Pulso · PEDRRA      [Cenário ativo: Base ▼]   ⚙ 👤 Sair  │
├──────────────────────────────────────────────────────────────────────┤
│ ┌──────────┬──────────┬──────────┬──────────┬──────────────────────┐ │
│ │ Caixa    │ Runway   │ Sem.     │ Sem.     │ Próximas 2 semanas    │ │
│ │ R$ 87.4k │ 12 sem   │ passada  │ atual    │ R$ -8.7k (cenário)    │ │
│ │          │          │ -3.2k    │ +2.1k    │                       │ │
│ └──────────┴──────────┴──────────┴──────────┴──────────────────────┘ │
│                                                                       │
│ [Janela: ←1sem  hoje  →2sem ▼]                                       │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │              GRÁFICO DE CAIXA (Chart.js)                        │   │
│ │       linha sólida (passado real) +                             │   │
│ │       linhas pontilhadas por cenário (futuro)                   │   │
│ └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│ ┌──────────────────┬──────────────────────────────────────────────┐  │
│ │ CENÁRIOS         │ TABELA DE PROJEÇÃO                           │  │
│ │ ⦿ Base           │ Semana | Vnd prev | Cst prev | Saldo | Acum  │  │
│ │ ○ Ofensivo Q3    │ W19    | 8.200    | 11.4k    | -3.2  | 87.4k │  │
│ │ ○ Pé no chão     │ W20    | [edit ]  | 5.500    | ...   | ...   │  │
│ │ + novo cenário   │ W21    | [edit ]  | 5.500    | ...   | ...   │  │
│ └──────────────────┴──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 Custos e Vendas (`/custos`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⬤ Comando Pulso · Custos e Vendas       Cenário ativo: Base ▼       │
├──────────────────────────────────────────────────────────────────────┤
│ [Mostrar 4 sem ▼]   [+ Venda]   [+ Custo]   [+ Custo recorrente]    │
│                                                                       │
│ ┌─────────────┬──────────┬──────────┬──────────┬──────────┐         │
│ │ Categoria   │ W18      │ W19 ●    │ W20      │ W21      │         │
│ ├─────────────┼──────────┼──────────┼──────────┼──────────┤         │
│ │ Vendas      │ 12.000   │ 8.200    │ —        │ —        │         │
│ │ Aluguel     │ —        │ 2.354    │ —        │ —        │         │
│ │ Folha       │ —        │ 7.000    │ —        │ —        │         │
│ │ Ads         │ —        │ 2.500    │ 2.500    │ 2.500    │         │
│ │ Saldo sem.  │ +5.700   │ -3.200   │ -2.500   │ -2.500   │         │
│ └─────────────┴──────────┴──────────┴──────────┴──────────┘         │
│                                                                       │
│ Lançamentos recentes:                                                │
│ • 07/05 - Venda R$ 5.000 (cliente XYZ, pix)         [editar][excl]  │
│ • 07/05 - Custo Ads R$ 2.500                        [editar][excl]  │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.3 Funil (`/funil`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⬤ Comando Pulso · Funil      Cenário ativo: Base ▼   ⚠ LABORATÓRIO │
├──────────────────────────────────────────────────────────────────────┤
│ Time comercial: [+ adicionar SDR/Closer]                             │
│                                                                       │
│ ╔══════════════════════════════════════════════════════════════╗    │
│ ║ ANDAR SUPERIOR — SDR                                          ║    │
│ ║ Investimento ads/semana: R$ [5.500   ]                       ║    │
│ ║ CPL: R$ [180  ]   →  Leads gerados: 30 (calculado)           ║    │
│ ║                                                                ║    │
│ ║ Polyana   capacidade [10 ]/sem   show% [70 ]                  ║    │
│ ║ Erick     capacidade [12 ]/sem   show% [65 ]                  ║    │
│ ║ Matheus   capacidade [10 ]/sem   show% [70 ]                  ║    │
│ ║                                                                ║    │
│ ║ + Rebarba SB: [3] (entram direto em calls agendadas)         ║    │
│ ╚══════════════════════════════════════════════════════════════╝    │
│            ↓ entrega calls agendadas                                 │
│ ╔══════════════════════════════════════════════════════════════╗    │
│ ║ ANDAR INFERIOR — CLOSER                                       ║    │
│ ║ Calls realizadas (aplicado show rate): 22                    ║    │
│ ║                                                                ║    │
│ ║ Thalia    conv call% [28 ]                                    ║    │
│ ║ Yuri      conv call% [22 ]                                    ║    │
│ ║ Juliana   conv call% [25 ]                                    ║    │
│ ║                                                                ║    │
│ ║ Vendas em call (truncado): 5                                  ║    │
│ ║ Bônus forecast (% calls): [5%]  →  +1 venda extra            ║    │
│ ║                                                                ║    │
│ ║ Ticket médio: R$ [10.000]    Taxa pgto: [12%]                ║    │
│ ║ Receita projetada bruta: R$ 50.000                           ║    │
│ ║ Receita projetada líquida: R$ 44.000                         ║    │
│ ╚══════════════════════════════════════════════════════════════╝    │
│                                                                       │
│ [Salvar funil neste cenário]                                         │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.4 Configurações (`/configuracoes`)

Seções:
1. **Saldo** — input "Saldo inicial em conta (R$)" + checkbox "Incluir saldo no cálculo de runway"
2. **Taxa de pagamento default** — input %
3. **Time comercial** — CRUD de SDRs e Closers
4. **Categorias de custo** — listar, adicionar, editar, remover
5. **Audit log** — tabela das últimas 100 mudanças
6. **Backup** — botão "Exportar JSON completo"

---

## 7. Rotas e endpoints

### 7.1 Páginas (server-rendered, EJS)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/` | público | redireciona para /login se não autenticado, /pedrra (master) ou /custos (financeiro) se autenticado |
| GET | `/login` | público | tela de login com botão "Entrar com Google" |
| GET | `/auth/google` | público | inicia OAuth |
| GET | `/auth/google/callback` | público | callback OAuth, valida domínio @usepulso.org |
| GET | `/totp/setup` | autenticado sem TOTP | mostra QR code para configurar |
| POST | `/totp/setup` | autenticado sem TOTP | valida código informado e marca totp_enabled=1 |
| GET | `/totp/verify` | autenticado com TOTP | pede código a cada login |
| POST | `/totp/verify` | autenticado com TOTP | valida e libera sessão |
| POST | `/logout` | autenticado | encerra sessão |
| GET | `/pedrra` | master | cockpit |
| GET | `/custos` | autenticado | aba 1 |
| GET | `/funil` | master | aba 2 |
| GET | `/configuracoes` | master | settings, time, audit log |

### 7.2 API JSON (todas autenticadas, JSON in/out)

**Cenários**
- `GET /api/scenarios` — lista todos
- `POST /api/scenarios` — cria (body: `{ name, description }`)
- `PATCH /api/scenarios/:id` — atualiza
- `DELETE /api/scenarios/:id` — exclui
- `POST /api/scenarios/:id/activate` — marca como ativo (desativa os outros)
- `POST /api/scenarios/:id/duplicate` — clona (copia funnel + custos do cenário)

**Vendas**
- `GET /api/sales?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/sales` — cria
- `PATCH /api/sales/:id`
- `DELETE /api/sales/:id`

**Custos**
- `GET /api/costs?from=...&to=...&scenario_id=...&include_recurring=1`
- `POST /api/costs` — se `body.is_recurring=true`, cria `recurrence_rule` + gera ocorrências
- `PATCH /api/costs/:id` — edita ocorrência específica
- `DELETE /api/costs/:id` — remove ocorrência específica

**Recorrências**
- `GET /api/recurrences`
- `PATCH /api/recurrences/:id` — ao editar, regenera ocorrências futuras (≥ hoje)
- `DELETE /api/recurrences/:id` — remove regra; ocorrências passadas mantidas como avulsas (recurrence_id → NULL via ON DELETE SET NULL)

**Time**
- `GET /api/team`
- `POST /api/team` — `{ name, role }`
- `PATCH /api/team/:id`
- `DELETE /api/team/:id` — soft delete (active=0) se houver vendas associadas; hard delete se órfão

**Funil**
- `GET /api/funnel?scenario_id=...` — retorna `scenario_funnel` + `scenario_team_performance` daquele cenário
- `PUT /api/funnel?scenario_id=...` — atualiza (upsert)

**Caixa e Runway**
- `GET /api/cashflow?past=N&future=N&scenario_id=` — retorna `{ cash_at_start, cash_today, projected_weekly_net, include_ads_in_runway, include_receivables_in_projection, series: [...] }`. Cada item da `series`: `{ week_id, sun, sat, label, is_past, is_current, is_future, sales_real, costs_paid, costs_planned, ads_paid, ads_planned, sales_projected, receivables_projected, top_costs: [{category, total}], week_delta, cash_after }`. **`sales_projected` e `receivables_projected` são SEMPRE separados — somar só se `include_receivables_in_projection=1`**.
- `GET /api/cashflow/runway?scenario_id=` — retorna `{ runway_weeks, weekly_burn, current_cash }`. `runway_weeks` é número (1 casa decimal) ou string `"52+"` quando burn ≤ 0. Burn por semana = `costs_planned + costs_paid + (ads se include_ads=1) - sales_projected - (receivables se include_receivables=1)`.

**Settings**
- `GET /api/settings` — retorna objeto key-value
- `PUT /api/settings` — batch update. Whitelist: `initial_cash_brl`, `include_initial_cash`, `default_payment_tax_pct`, `include_ads_in_runway`, `include_receivables_in_projection`, `pedrra_visible_scenario_ids` (JSON array de scenario IDs)

**Audit**
- `GET /api/audit?limit=100` (master only)

**Categorias** (Onda 2)
- `GET /api/categories` — retorna `{ list: [...], grouped: { "Salários": [...], ... } }`. Cada item: `{ id, name, group_name, display_order, active }`
- `POST /api/categories` (master) — body `{ name, group_name, display_order? }` — 400 se nome duplicado
- `PATCH /api/categories/:id` (master) — body `{ name?, group_name?, display_order? }`. Renomear executa **transação que atualiza todos os custos com a categoria antiga** (`UPDATE costs SET category=? WHERE category=?`)
- `DELETE /api/categories/:id?move_to=<nome>` (master) — se houver custos associados e `move_to` ausente, retorna 400 com `{ error, costs_count, category_name, code: 'HAS_COSTS' }`. Se `move_to` presente, transação move custos pra categoria-destino antes de deletar.

**Investimento em Ads** (Onda 2)
- `GET /api/ads-week?from=&to=&scenario_id=` — retorna array agrupado por semana: `{ week_id, sun, sat, label, total, count }`
- `POST /api/ads-week` (master) — body `{ week_start_date: 'YYYY-MM-DD', total_amount: number, scenario_id?: number|null }`. Lógica: pega range dom→sáb da semana, **apaga (DELETE com WHERE específico) os 7 custos existentes com is_ads=1 daquela semana e mesmo scenario_id**, insere 7 novos custos com `amount = total_amount/7` (sem truncar), `is_ads=1`, `category='Tráfego Pago (Google / Meta Ads)'`, `status='planned'`. Tudo numa transação. Resposta: `{ week_id, week_start, total_amount, daily_amount, occurrences: [...] }`
- `DELETE /api/ads-week?week_start_date=&scenario_id=` (master) — remove os 7 custos da semana

**Recebíveis** (Onda 2)
- `GET /api/receivables?status=&from=&to=` — retorna lista
- `POST /api/receivables` — body `{ expected_date, expected_amount, payment_method?, client_name?, notes?, sale_id? }`. `expected_amount` deve ser > 0
- `POST /api/receivables/sale-with-installments` — body `{ date, gross_amount, net_amount, client_name?, closer_id?, payment_method?, notes?, installments: [{expected_date, expected_amount, payment_method?}] }`. Cria 1 sale (parte paga hoje) + N receivables com status=pending, todos atomicamente
- `PATCH /api/receivables/:id` — edita campos
- `POST /api/receivables/:id/mark-received` — body `{ received_date?, net_amount? }`. Cria sale com a data informada e marca o recebível como `status='received'`, vinculando `received_sale_id`. Em transação.
- `DELETE /api/receivables/:id` — soft delete (status=cancelled) se tem `sale_id`, hard delete se órfão

**Validações comuns** (Onda 2.5)
Todos os POSTs/PATCHes de `sales`, `costs`, `receivables`, `ads-week`:
- `date` (e `expected_date`, `received_date`, `recurrence_start`, `recurrence_end`, `week_start_date`): formato `YYYY-MM-DD`, no range `2025-01-01 a 2030-12-31`
- `gross_amount` / `net_amount` / `total_amount`: ≥ 0
- `amount` / `expected_amount`: > 0
- Categoria `'Tráfego Pago (Google / Meta Ads)'` em `/api/costs` (com `is_ads != 1`): rejeitada com 400 — usar `/api/ads-week`

---

## 8. Regras de cálculo críticas

### 8.1 Caixa hoje
```
caixa_hoje = (saldo_inicial se include_initial_cash=1 else 0)
           + Σ(net_amount) de sales com date ≤ hoje
           − Σ(amount) de costs com status='paid' e date ≤ hoje
```

### 8.2 Resultado da semana
```
resultado_semana = Σ(net_amount sales na semana)
                 − Σ(amount costs status='paid' na semana)
```

### 8.3 Runway
```
runway = caixa_hoje ÷ burn_medio_4_semanas

onde burn_medio_4_semanas = média de:
  - custos planejados das próximas 4 semanas no cenário ativo
  - custos recorrentes da realidade
```

Se `burn ≤ 0` (semanas onde sobra), `runway = "52+"`.

### 8.4 Truncamento de vendas no funil
Vendas em call e bônus forecast são SEMPRE inteiros truncados pra baixo (`Math.floor`). Não arredondar.

### 8.5 Semanas dom→sáb
Função utilitária em `lib/weeks.js`:
```js
function weekRangeFromDate(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = dom, 6 = sáb
  const sun = new Date(d); sun.setDate(d.getDate() - day);
  const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
  return { sun, sat };
}

function weekIdFromSunday(sunday) {
  // formato "2026-W19" baseado no domingo de início
}
```

A semana é ancorada pelo mês do domingo (semana 26/04→02/05 conta como abril porque o domingo cai em abril).

### 8.6 Auditoria automática
Toda operação POST/PATCH/DELETE em entidades de negócio (sales, costs, scenarios, team, settings) deve chamar `audit.log()` com `user_email` da sessão, action, entity_type, entity_id, before/after JSON. Helper em `lib/audit.js`.

### 8.7 Cálculo idempotente de recorrência
Quando criar uma `recurrence_rule`, gerar ocorrências em `costs` para o intervalo `[start_date, end_date OR (hoje + 6 meses)]`. Se a regra é editada e end_date muda, regenerar ocorrências futuras (date > hoje), preservar passadas. Usar `recurrence_id` pra agrupar.

---

## 9. Critérios de aceite globais (DoD do MVP)

Antes de declarar o MVP entregue:

- [ ] Sâmeque e Rachel conseguem logar via Google + TOTP em https://comando.usepulso.org
- [ ] Sâmeque vê 3 abas (PEDRRA, Custos, Funil) + Configurações; Rachel vê apenas Custos
- [ ] PEDRRA mostra os 5 KPIs corretos com base em dados reais lançados
- [ ] Lançar venda, lançar custo, criar custo recorrente, editar ocorrência específica — todos funcionam
- [ ] Criar 3 cenários distintos, alternar entre eles, ver impacto no PEDRRA
- [ ] Funil calcula vendas em call inteiras + bônus forecast separado
- [ ] Audit log registra todas as mutações com user_email, before/after
- [ ] Backup diário rodando via cron na VPS
- [ ] HTTPS funcional, redirect HTTP→HTTPS automático
- [ ] Nenhum console.log acidental em produção
- [ ] `data.db` nunca foi destruído durante desenvolvimento
- [ ] CLAUDE.md no projeto com instruções permanentes de deploy

