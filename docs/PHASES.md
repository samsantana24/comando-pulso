# PHASES.md — Plano de Execução em 8 Fases

Este projeto é construído **fase por fase**. **Não pule fases. Não combine fases.** Ao concluir cada fase, faça commit, teste local com `npm start`, valide visualmente, confirme com o usuário, e só depois siga para a próxima.

Cada fase tem um critério de aceite claro. Antes de declarar uma fase concluída, marque os checkboxes mentalmente e mostre o status ao usuário.

---

## Fase 0 — Bootstrap (~30 min)

**Objetivo:** infra mínima local + repo no GitHub + servidor respondendo "Olá mundo".

**Tarefas:**
1. Criar pasta `~/comando-pulso` no Mac (já criada se rodou o setup script)
2. Rodar `git init` na raiz do projeto
3. Criar `package.json` com as dependências exatas:

```json
{
  "name": "comando-pulso",
  "version": "0.1.0",
  "description": "Comando Pulso — sistema interno de gestão de caixa em tempo real",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "engines": { "node": ">=20" },
  "dependencies": {
    "better-sqlite3": "^11.3.0",
    "connect-sqlite3": "^0.9.15",
    "dotenv": "^16.4.5",
    "ejs": "^3.1.10",
    "express": "^4.21.0",
    "express-session": "^1.18.1",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "qrcode": "^1.5.4",
    "speakeasy": "^2.0.0"
  }
}
```

4. Rodar `npm install`
5. Criar `.gitignore`:
```
node_modules/
.env
data.db
data.db-shm
data.db-wal
sessions.db
sessions.db-shm
sessions.db-wal
logs/
*.log
.DS_Store
backups/
```

6. Criar `.env.example`:
```
PORT=3001
SESSION_SECRET=trocar_em_producao_string_random_64_chars
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://comando.usepulso.org/auth/google/callback
ALLOWED_DOMAIN=usepulso.org
NODE_ENV=development
```

7. Criar `.env` (cópia do example, preencher com valores reais — Sâmeque vai gerar Google OAuth credentials e te passar)
8. Criar estrutura de pastas:
```
server.js
db/
  connection.js
  migrations.js
  seed.js
  queries/
lib/
  auth.js
  totp.js
  weeks.js
  cashflow.js
  audit.js
  format.js
routes/
  index.js
  auth.js
  pedrra.js
  custos.js
  funil.js
  configuracoes.js
  api/
views/
  layout.ejs
  partials/
  login.ejs
  pedrra.ejs
  custos.ejs
  funil.ejs
  configuracoes.ejs
public/
  css/app.css
  js/
scripts/
  backup.js
```

9. Criar `server.js` mínimo que escuta na porta 3001 e responde "Comando Pulso · em construção" em `GET /`
10. Testar `npm start` localmente — confirmar que sobe na porta 3001
11. Criar repo GitHub `samsantana24/comando-pulso` privado (instruir Sâmeque a criar via interface ou usar `gh repo create`)
12. Push inicial: `git add . && git commit -m "Bootstrap inicial" && git push -u origin main`

**Critério de aceite (Fase 0):**
- [ ] `npm start` sobe sem erro
- [ ] `curl localhost:3001` retorna a string esperada
- [ ] Repo no GitHub privado, push inicial feito

---

## Fase 1 — Banco de dados (~45 min)

**Objetivo:** banco criado com todas as tabelas, seeds idempotentes, queries básicas funcionando.

**Tarefas:**
1. Implementar `db/connection.js`:
   - Singleton better-sqlite3
   - Habilitar pragmas: `journal_mode=WAL`, `foreign_keys=ON`, `synchronous=NORMAL`

2. Implementar `db/migrations.js` com TODOS os CREATE TABLE de `docs/SCHEMA.md`. Função `runMigrations()` exportada.

3. Implementar `db/seed.js` com seeds idempotentes (INSERT OR IGNORE):
   - 2 users (Sâmeque master, Rachel financeiro)
   - 3 settings (initial_cash_brl, include_initial_cash, default_payment_tax_pct)
   - 1 cenário "Base" ativo (apenas se nenhum cenário existir)
   - Para o cenário Base, criar registro vazio em `scenario_funnel` com defaults

4. Chamar `runMigrations()` + `runSeeds()` no boot do `server.js`

5. Implementar todos os módulos em `db/queries/` com prepared statements:
   - `users.js`, `settings.js`, `team.js`, `scenarios.js`, `sales.js`, `costs.js`, `recurrence.js`, `funnel.js`, `audit.js`

**Critério de aceite (Fase 1):**
- [ ] Ao rodar `npm start`, `data.db` é criado automaticamente
- [ ] Inspecionar com `sqlite3 data.db ".tables"` mostra todas as tabelas
- [ ] `sqlite3 data.db "SELECT * FROM settings"` retorna 3 linhas
- [ ] `sqlite3 data.db "SELECT * FROM scenarios"` retorna 1 linha (Base ativo)
- [ ] Rodar `npm start` 2 vezes não duplica seeds (idempotente)

---

## Fase 2 — Autenticação (~1h30)

**Objetivo:** login Google OAuth restrito a @usepulso.org + 2º fator TOTP.

**Pré-requisito:** Sâmeque precisa criar credenciais OAuth 2.0 no Google Cloud Console:
- Tipo: Web application
- Authorized redirect URI: `https://comando.usepulso.org/auth/google/callback`
- Pegar Client ID e Client Secret e colocar no `.env` (local e VPS)

**Tarefas:**
1. Implementar `lib/auth.js`:
   - Configurar passport com `passport-google-oauth20`
   - Strategy callback: validar `email.endsWith('@usepulso.org')`, criar/atualizar user
   - Middleware `requireAuth` (redireciona para /login se não autenticado)
   - Middleware `requireMaster` (403 se role !== 'master')
   - Middleware `requireTotp` (redireciona para /totp/verify se totp_enabled=1 e session.totp_verified !== true)

2. Implementar `lib/totp.js`:
   - `generateSecret(email)` — usa speakeasy
   - `generateQRCode(secret, email)` — usa qrcode
   - `verifyToken(secret, token)` — usa speakeasy

3. Implementar `routes/auth.js`:
   - `GET /login` — renderiza view com botão Google
   - `GET /auth/google` — passport.authenticate
   - `GET /auth/google/callback` — callback, redireciona conforme role e TOTP
   - `GET /totp/setup` — mostra QR code
   - `POST /totp/setup` — valida código, marca totp_enabled=1
   - `GET /totp/verify` — formulário pra digitar código
   - `POST /totp/verify` — valida e seta session.totp_verified=true
   - `POST /logout` — destrói sessão

4. Configurar express-session com connect-sqlite3 em `sessions.db` (separado de `data.db`)

5. Criar views: `login.ejs`, `totp-setup.ejs`, `totp-verify.ejs` com layout simples mas funcional

6. Aplicar middleware em todas as rotas protegidas

**Critério de aceite (Fase 2):**
- [ ] `GET /login` renderiza tela com botão Google
- [ ] Login com conta @usepulso.org funciona
- [ ] Login com conta de outro domínio é rejeitado (mostra erro)
- [ ] No primeiro login, redireciona para `/totp/setup` com QR code
- [ ] Após escanear QR e digitar código válido, marca totp_enabled=1
- [ ] Em login subsequente, pede TOTP em `/totp/verify`
- [ ] Logout funciona e destrói sessão
- [ ] Acessar `/pedrra` como Rachel redireciona para `/custos`

---

## Fase 3 — Aba 1 Custos e Vendas (~3h)

**Objetivo:** lançamento de venda diária + lançamento de custo (avulso e recorrente) + visualização tabular semana a semana.

**Tarefas:**
1. Implementar `lib/weeks.js` com funções:
   - `weekRangeFromDate(date)` → `{ sun, sat }`
   - `weekIdFromSunday(sunday)` → "2026-W19"
   - `monthAnchorFromSunday(sunday)` → mês onde cai o domingo
   - `getWeeksInRange(from, to)` → array de semanas

2. Implementar `routes/api/sales.js` (CRUD completo com auditoria):
   - `GET /api/sales?from=&to=`
   - `POST /api/sales`
   - `PATCH /api/sales/:id`
   - `DELETE /api/sales/:id`
   - Toda mutação chama `audit.log()`

3. Implementar `routes/api/costs.js` (CRUD completo):
   - `GET /api/costs?from=&to=&scenario_id=`
   - `POST /api/costs` — se `is_recurring=true`, chama lógica de recorrência
   - `PATCH /api/costs/:id`
   - `DELETE /api/costs/:id`

4. Implementar `routes/api/recurrences.js`:
   - `POST` cria regra + gera ocorrências para `[start_date, end_date OR (hoje + 6 meses)]`
   - `PATCH` regenera ocorrências futuras (date > hoje), preserva passadas
   - `DELETE` remove regra; ocorrências passadas mantidas com `recurrence_id=NULL`

5. Implementar `routes/api/team.js`:
   - CRUD com soft delete se houver vendas associadas

6. Implementar `routes/custos.js`:
   - `GET /custos` — renderiza view com semanas configuráveis
   - Recebe query `?weeks=4` (default) e calcula range

7. Implementar `views/custos.ejs`:
   - Header com cenário ativo
   - Seletor de janela (1, 2, 3, 4, 5, 6, 8, 10 semanas)
   - Botões "+ Venda", "+ Custo", "+ Custo recorrente"
   - Tabela de categorias × semanas
   - Lista de lançamentos recentes

8. Implementar `public/js/custos.js`:
   - Modais para os formulários
   - Fetch das APIs e atualização da tabela
   - Validação client-side básica

9. Estilização básica em `public/css/app.css`:
   - CSS variables (cores, espaçamento, tipografia)
   - Layout limpo
   - Responsivo desktop-first

**Critério de aceite (Fase 3):**
- [ ] Sâmeque e Rachel acessam `/custos`
- [ ] Lançar venda diária funciona com todos os campos
- [ ] Lançar custo avulso funciona
- [ ] Criar custo recorrente gera ocorrências corretas nas semanas futuras
- [ ] Editar uma ocorrência específica não quebra a série recorrente
- [ ] Excluir uma regra de recorrência preserva ocorrências passadas
- [ ] Alternar janela (4 → 8 semanas) atualiza a tabela
- [ ] Audit log tem entradas pra cada mutação
- [ ] CRUD de team_members funciona

---

## Fase 4 — Cenários (~1h30)

**Objetivo:** criar/editar/excluir/ativar cenários + persistir cenário ativo globalmente.

**Tarefas:**
1. Implementar `routes/api/scenarios.js`:
   - `GET /api/scenarios` — lista todos
   - `POST /api/scenarios` — cria com `scenario_funnel` vazio associado
   - `PATCH /api/scenarios/:id`
   - `DELETE /api/scenarios/:id` — cascade
   - `POST /api/scenarios/:id/activate` — desativa todos os outros, ativa este
   - `POST /api/scenarios/:id/duplicate` — clona o cenário (incluindo funnel + custos hipotéticos)

2. Adicionar dropdown de cenário ativo no header (`views/partials/header.ejs`):
   - Lista todos cenários
   - Marca o ativo
   - Permite trocar (POST /api/scenarios/:id/activate)

3. Persistir cenário ativo via setting global (mais robusto que session):
   - Setting `active_scenario_id` no banco
   - Função `getActiveScenarioId()` em `lib/cashflow.js`

4. Garantir que `/custos` respeita `scenario_id` selecionado para custos planejados futuros (custos com `scenario_id=NULL` são da realidade, sempre visíveis; custos com `scenario_id=X` só visíveis quando X é ativo)

**Critério de aceite (Fase 4):**
- [ ] Criar cenário "Ofensivo" funciona
- [ ] Ativar cenário "Ofensivo" desativa "Base"
- [ ] Custos lançados com `scenario_id` específico só aparecem quando aquele cenário é ativo
- [ ] Custos da realidade (`scenario_id=NULL`) aparecem em todos os cenários
- [ ] Duplicar cenário copia funnel + custos hipotéticos
- [ ] Excluir cenário (que não seja o único) funciona
- [ ] Tentar excluir o único cenário ativo é bloqueado (mostrar erro)

---

## Fase 5 — Funil de Performance (~2h30)

**Objetivo:** laboratório de simulação com dois andares (SDR/Closer), inputs editáveis, cálculos em tempo real, persistência por cenário.

**Tarefas:**
1. Implementar `routes/api/funnel.js`:
   - `GET /api/funnel?scenario_id=` — retorna `scenario_funnel` + `scenario_team_performance` daquele cenário
   - `PUT /api/funnel?scenario_id=` — upsert do `scenario_funnel` + replace de `scenario_team_performance` (delete all + insert)

2. Implementar `routes/funil.js`:
   - `GET /funil` — renderiza view com state do cenário ativo

3. Implementar `views/funil.ejs`:
   - Header com cenário ativo + tag "LABORATÓRIO" visível
   - Andar superior SDR (com box visual delimitado)
   - Andar inferior Closer (com box visual delimitado)
   - Lista de SDRs cadastrados com inputs `capacity_per_week` + `show_rate%` por linha
   - Lista de Closers cadastrados com input `conversion_pct` por linha
   - Botão "+ adicionar pessoa" → modal para CRUD de team
   - Inputs globais: ads/sem, CPL, rebarba SB, ticket médio, taxa pgto
   - Botão "Salvar funil neste cenário"

4. Implementar `public/js/funil.js`:
   - Cálculos em tempo real ao editar qualquer input:
     - `leads_gerados = floor(ads / cpl)`
     - `total_calls_agendadas = sum(SDRs.capacity * SDRs.show_rate%) + rebarba_sb`
     - Aplica show rate médio dos SDRs ativos
     - `vendas_call = floor(calls_realizadas * media_conv_closer)`
     - `vendas_forecast_bonus = floor(calls_realizadas * forecast_bonus_pct)`
     - `receita_bruta = vendas_call * ticket_avg`
     - `receita_liquida = receita_bruta * (1 - taxa/100)`
   - **TRUNCAR vendas com Math.floor sempre**
   - Mostrar bônus forecast SEPARADO ("+N vendas extras"), não somado na receita base

**Critério de aceite (Fase 5):**
- [ ] `/funil` acessível só para Sâmeque
- [ ] Tag "LABORATÓRIO" visível no header
- [ ] Editar ads/CPL recalcula leads em tempo real
- [ ] Editar capacidade ou show% de SDR atualiza calls agendadas
- [ ] Adicionar/remover SDR no funil reflete imediatamente
- [ ] Vendas em call sempre inteiras (testar com 4.7 → mostra 4)
- [ ] Bônus forecast aparece separado, formato "+N vendas"
- [ ] Receita líquida = bruta × (1 − taxa)
- [ ] Salvar persiste no banco
- [ ] Trocar cenário ativo carrega outro state do funil

---

## Fase 6 — PEDRRA (~3h)

**Objetivo:** cockpit estratégico funcional com KPIs, gráfico Chart.js, painel de cenários, tabela editável.

**Tarefas:**
1. Implementar `lib/cashflow.js`:
   - `getCashToday()` — saldo inicial (se incluído) + sales pagas − costs pagos até hoje
   - `getWeekResult(weekId)` — resultado real de uma semana
   - `getProjectedWeekResult(weekId, scenarioId)` — projeção da semana no cenário
   - `getRunway(scenarioId)` — calcula em semanas; "52+" se >52
   - `getCashflowSeries(from, to, scenarioId)` — array semanal com saldo acumulado

2. Implementar `routes/api/cashflow.js`:
   - `GET /api/cashflow?from=&to=&scenario_id=`
   - `GET /api/runway?scenario_id=`

3. Implementar `routes/pedrra.js`:
   - `GET /pedrra` — renderiza view (master only)

4. Implementar `views/pedrra.ejs`:
   - Header com brand + tooltip PEDRRA + dropdown cenário ativo
   - KPI bar (5 cards)
   - Container do gráfico
   - Painel lateral de cenários (lista + ações)
   - Tabela editável de projeção

5. Implementar `public/js/pedrra.js`:
   - Carregar Chart.js via CDN: `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js`
   - Line chart com:
     - Linha sólida pro passado (cor primária)
     - Marcador vertical na semana atual (linha tracejada)
     - Linhas pontilhadas pro futuro, uma por cenário visível (até 3 sobrepostos)
     - Tooltip mostrando saldo + delta da semana
   - Controles de janela: `←1/2/4/8` `→2/4/8/12` semanas (default 1+2)
   - Atualização ao trocar cenário ativo (sem recarregar página)
   - Tabela editável: editar venda projetada redesenha gráfico em tempo real

6. Conectar projeção do funil → injetar receita projetada nas semanas futuras (cada semana futura ganha venda projetada baseada no funil do cenário ativo, dividida igualmente nas próximas N semanas — ou aplicada na semana N+1 conforme decisão de modelagem)

**Critério de aceite (Fase 6):**
- [ ] Abrir `/pedrra` mostra os 5 KPIs corretos com base nos dados lançados
- [ ] Gráfico Chart.js renderiza com janela default (1+0+2)
- [ ] Trocar janela atualiza o gráfico
- [ ] Linha sólida pro passado, pontilhada pro futuro
- [ ] Marcador da semana atual visível
- [ ] Painel de cenários permite criar, ativar, renomear, excluir, duplicar
- [ ] Trocar cenário ativo recalcula tudo (KPIs, gráfico, tabela)
- [ ] Tabela editável: editar venda projetada de uma semana redesenha o gráfico em tempo real
- [ ] Runway calculado dinamicamente, "52+" para casos extremos

---

## Fase 7 — Polish, audit, backup, deploy (~2h)

**Objetivo:** configurações funcionais, backup automático, deploy em produção, fluxo end-to-end testado.

**Tarefas:**
1. Implementar `routes/configuracoes.js` e `views/configuracoes.ejs`:
   - Form de saldo inicial + toggle include
   - Form de taxa pagamento default
   - CRUD de team_members
   - CRUD de categorias de custo (lista editável)
   - Tabela das últimas 100 entradas do audit log
   - Botão "Exportar JSON completo" (chama `/api/export`)

2. Implementar `routes/api/export.js`:
   - `GET /api/export` — retorna JSON com todas as tabelas exceto users/sessions

3. Implementar `scripts/backup.js`:
   - Copia `data.db` para `/var/backups/comando-pulso/YYYY-MM-DD-HHMMSS.db`
   - Limpa backups com mais de 30 dias

4. Configurar cron na VPS — instruir usuário a rodar:
```bash
mkdir -p /var/backups/comando-pulso
(crontab -l 2>/dev/null; echo "0 3 * * * cd /var/www/comando-pulso && /usr/bin/node scripts/backup.js >> /var/log/comando-pulso-backup.log 2>&1") | crontab -
```

5. Headers de segurança — middleware customizado:
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - CSP básica permitindo cdnjs

6. Refinar UI: tipografia (Inter ou system stack), espaçamento (rem-based), suporte a `prefers-color-scheme` opcional

7. Deploy final em produção:
   - `ecosystem.config.js` com nome `comando-pulso`, script `server.js`, instâncias 1, log path
   - Subir código pro GitHub
   - Comando de deploy na VPS:
```bash
cd /var/www/comando-pulso && git clone https://github.com/samsantana24/comando-pulso.git . && npm install --omit=dev && pm2 start ecosystem.config.js && pm2 save
```

8. Configurar PM2 startup: `pm2 startup` e seguir instrução do output, depois `pm2 save`

9. Testar fluxo completo end-to-end na URL pública

**Critério de aceite (Fase 7):**
- [ ] `/configuracoes` permite editar todas as settings, time, categorias
- [ ] Audit log visível e populado
- [ ] Backup script roda sem erro
- [ ] Cron configurado e testado (rodar manualmente uma vez)
- [ ] Sistema rodando em https://comando.usepulso.org
- [ ] Login Google + TOTP funciona em produção
- [ ] Todas as 3 abas funcionam end-to-end em produção
- [ ] PM2 configurado pra reiniciar no boot da VPS

---

## DoD do MVP (Definition of Done)

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

---

## Mensagem inicial recomendada para o Claude Code

Ao abrir o projeto pela primeira vez no Claude Code, mande esta mensagem:

```
Leia CLAUDE.md, docs/SPEC.md, docs/SCHEMA.md e docs/PHASES.md inteiros antes de fazer qualquer coisa.

Depois, confirme que entendeu resumindo de volta:
1. O nome do projeto, domínio, stack
2. As 3 abas e quem acessa cada uma
3. A regra crítica de proteção de dados
4. As 8 fases na ordem
5. O ciclo de deploy

Se tudo certo, comece a Fase 0 — Bootstrap.

Trabalhe com cuidado de engenheiro sênior. Teste antes de subir. Pergunte em vez de assumir. Bora.
```

