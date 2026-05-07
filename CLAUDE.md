# CLAUDE.md — Instruções Permanentes do Projeto Comando Pulso

Este arquivo é lido automaticamente pelo Claude Code em toda sessão. É a constituição do projeto.

## Identidade do projeto

**Nome:** Comando Pulso
**Sigla central:** PEDRRA — Progresso · Execução · Disciplina · Ritmo · Resultado · Avanço
**Filosofia:** "Calculadora viva, dashboard vivo, planilha viva." O usuário é o cérebro. O sistema é a calculadora. O sistema **nunca opina** sobre o que vender ou investir; ele apenas responde "se eu fizer X, o que acontece com meu caixa".
**Domínio público:** https://comando.usepulso.org
**Usuários:** dois apenas — Sâmeque (CEO, role `master`, acesso total) e Rachel (financeiro, role `financeiro`, acesso restrito a Custos e Vendas).

## Stack técnica obrigatória

Idêntica ao projeto irmão `usepulso-proposta`, para consistência operacional.

- **Runtime:** Node.js 20
- **Framework:** Express 4
- **Views:** EJS (server-rendered)
- **Banco:** SQLite via `better-sqlite3` (síncrono, single-file)
- **Sessões:** `express-session` + `connect-sqlite3` (persistidas em SQLite, não em memória)
- **Auth:** Google OAuth 2.0 via `passport` + `passport-google-oauth20`, restrito ao domínio `@usepulso.org`
- **2º fator:** TOTP via `speakeasy` + `qrcode` (Google Authenticator/Authy)
- **Variáveis de ambiente:** `dotenv`
- **Frontend interativo:** vanilla JS + Chart.js (CDN cdnjs) para gráfico hero da PEDRRA
- **Estilização:** CSS puro com custom properties. Sem Tailwind, sem framework CSS.
- **Process manager:** PM2

**NÃO use:** Tailwind, React, Vue, Next.js, Prisma, ORM. Mantenha simples e síncrono.

## Infraestrutura JÁ CONFIGURADA (não mexer)

- **VPS:** Hostinger, `srv701648.hstgr.cloud`, IP `103.199.187.118`, Ubuntu 24.04
- **Pasta na VPS:** `/var/www/comando-pulso` (já criada, vazia)
- **Domínio:** `comando.usepulso.org` (DNS ok, SSL Let's Encrypt ativo)
- **Nginx:** vhost configurado, faz proxy de `https://comando.usepulso.org` → `localhost:3001`
- **Porta interna obrigatória:** `3001`
- **Processo PM2 (deve ter este nome exato):** `comando-pulso`
- **Acesso à VPS:** terminal web do painel Hostinger, usuário `root`. Sem SSH direto.
- **Pasta local (Mac):** `~/comando-pulso`
- **Repositório GitHub:** `samsantana24/comando-pulso` (privado, branch `main`)

## ⚠️ REGRA CRÍTICA DE PROTEÇÃO DE DADOS

Este projeto teve histórico de perda de dados em deploy anterior do Sistema Pulso. **NUNCA, em nenhuma circunstância, em nenhum script de migração, em nenhum comando de deploy, em nenhuma rotina de teste, execute:**

- `rm -f data.db`, `rm data.db`, `rm sessions.db`
- `DROP TABLE`, `DELETE FROM` sem WHERE específico, `TRUNCATE`

**Toda migração é exclusivamente aditiva:**
- `CREATE TABLE IF NOT EXISTS`
- `ALTER TABLE` com checagem prévia de existência da coluna (consulte `pragma_table_info` antes)
- `CREATE INDEX IF NOT EXISTS`

Se em qualquer momento durante desenvolvimento parecer necessário resetar o banco, **PARE e pergunte ao usuário DUAS VEZES com confirmações explícitas** antes de qualquer ação destrutiva.

## Documentação completa do projeto

Antes de codar qualquer coisa, leia também:

- `docs/SPEC.md` — especificação funcional completa das 3 abas, cenários, permissões, wireframes
- `docs/SCHEMA.md` — schema SQL completo do banco com todos os CREATE TABLE
- `docs/PHASES.md` — plano de execução em 8 fases com critérios de aceite

## Ciclo de deploy obrigatório

Toda alteração que o usuário pedir, executar este ciclo SEM PERGUNTAR:

### Etapa 1 — Editar localmente
- Editar arquivos em `~/comando-pulso`
- NÃO editar `data.db`, `sessions.db`, `node_modules/`, `.env`, `logs/`
- Se a alteração precisar de nova dependência, atualizar `package.json` e rodar `npm install`

### Etapa 2 — Testar local antes de subir
- `cd ~/comando-pulso && npm start` em background (timeout 5s)
- Verificar que servidor sobe na porta 3001 sem erro
- Procurar mensagem de boot do servidor no log
- Parar processo após teste
- Se erro, NÃO prosseguir — corrigir antes

### Etapa 3 — Subir pro GitHub
```bash
cd ~/comando-pulso
git add .
git status
git commit -m "<descrição clara em PT-BR, ≤60 chars>"
git push
```

Mensagens de commit em PT-BR, específicas. Bom: "Adiciona modal de venda na aba custos". Ruim: "Atualizações", "Fix", "Mudanças".

### Etapa 4 — Aplicar na VPS
GERAR comando único pronto para o usuário colar no terminal web Hostinger:

```bash
cd /var/www/comando-pulso && git pull && npm install --omit=dev && pm2 restart comando-pulso && pm2 status
```

Apresentar dentro de bloco de código com instrução: "Cola este comando no terminal da VPS pra aplicar:".

### Etapa 5 — Reportar
Resumo final no formato:

- ✅ Alteração: <o que mudou em 1 linha>
- ✅ Commit: `<hash curto>` — <mensagem>
- ✅ Local OK: servidor sobe sem erro
- ✅ Push GitHub: OK
- 🔄 Pendente: colar comando da Etapa 4 na VPS

## Regras de ouro

1. **Sempre testar local antes de subir.** Se quebrar local, NÃO sobe.
2. **Mensagens de commit em PT-BR**, específicas e claras.
3. **NUNCA editar arquivos do .gitignore** (data.db, .env, sessions.db, node_modules, logs).
4. **Migrações sempre aditivas.** Sem comandos destrutivos.
5. **Em dúvida sobre destruição de dado, PARAR e perguntar duas vezes.**
6. **Modo de operação:** trabalhar fase por fase conforme `docs/PHASES.md`. Não pular fases. Não combinar fases. Confirmar critério de aceite ao fim de cada fase antes de seguir.
7. **Para qualquer ambiguidade ou decisão que não esteja explícita na spec**, perguntar antes de assumir. O usuário valoriza precisão > velocidade.
8. **Logs sensíveis:** nunca logar tokens, secrets, dados de sessão. Em produção (NODE_ENV=production), logs estruturados em JSON.

## Comandos úteis durante desenvolvimento

- `/compact` — resume a conversa quando contexto ficar pesado, mantém o essencial
- `/context` — visualiza uso de contexto atual
- `/clear` — APAGA conversa (use com cautela, apenas entre tarefas independentes)
- `claude --continue` (terminal) — retoma última sessão
- `claude --resume` (terminal) — escolhe sessão anterior

## Princípio operacional

O usuário (Sâmeque) está em modo de guerra. Vai usar este sistema diariamente para tomar decisões de caixa. Falhas em cálculos de runway, perda de dados, ou bugs no fluxo de cenários são INACEITÁVEIS. Trabalhe com cuidado de engenheiro sênior. Teste antes de subir. Pergunte em vez de assumir.

