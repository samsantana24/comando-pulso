# DEPLOY.md — Passos finais para colocar o Comando Pulso em produção

Este documento lista as ações que **só você (Sâmeque) pode executar** porque dependem de sistemas externos. O código está pronto e em `main` no GitHub.

---

## 1. Credenciais do Google OAuth

Acesse https://console.cloud.google.com → APIs & Services → Credentials.

1. Crie/selecione um projeto (ex.: "Comando Pulso").
2. **OAuth consent screen** → tipo *Internal* (limita ao Workspace `usepulso.org`).
3. **Credentials → Create credentials → OAuth client ID** → tipo *Web application*.
   - **Authorized redirect URIs:** `https://comando.usepulso.org/auth/google/callback`
4. Copie o **Client ID** e **Client Secret**.

Edite o `.env` local:

```
GOOGLE_CLIENT_ID=<cole_aqui>
GOOGLE_CLIENT_SECRET=<cole_aqui>
SESSION_SECRET=<gere_uma_string_random_de_64_chars>
```

Para gerar `SESSION_SECRET` no terminal local:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

---

## 2. Primeiro deploy na VPS

Cole este bloco no terminal web da Hostinger (logado como `root`):

```bash
cd /var/www/comando-pulso
git clone https://github.com/samsantana24/comando-pulso.git . 2>/dev/null || git pull
npm install --omit=dev
mkdir -p logs
```

Depois, crie o `.env` da VPS (mesmos valores do local — Client ID/Secret/Session secret + `NODE_ENV=production`):

```bash
cat > /var/www/comando-pulso/.env <<'EOF'
PORT=3001
SESSION_SECRET=COLE_SEU_SESSION_SECRET_AQUI
GOOGLE_CLIENT_ID=COLE_SEU_CLIENT_ID_AQUI
GOOGLE_CLIENT_SECRET=COLE_SEU_CLIENT_SECRET_AQUI
GOOGLE_CALLBACK_URL=https://comando.usepulso.org/auth/google/callback
ALLOWED_DOMAIN=usepulso.org
NODE_ENV=production
EOF
chmod 600 /var/www/comando-pulso/.env
```

Inicia com PM2:

```bash
cd /var/www/comando-pulso
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root
# o comando acima imprime uma linha que vc precisa copiar e rodar; depois roda:
pm2 save
```

Verifica:

```bash
pm2 status
curl -I https://comando.usepulso.org
```

Esperado: PM2 mostra `comando-pulso` online; curl retorna 200/302.

---

## 3. Backup automático diário (cron)

Cole na VPS:

```bash
mkdir -p /var/backups/comando-pulso
(crontab -l 2>/dev/null; echo "0 3 * * * cd /var/www/comando-pulso && /usr/bin/node scripts/backup.js >> /var/log/comando-pulso-backup.log 2>&1") | crontab -
```

Testa manual antes:

```bash
cd /var/www/comando-pulso && node scripts/backup.js
ls -la /var/backups/comando-pulso/
```

Esperado: arquivo `YYYY-MM-DD-HHMMSS.db` criado.

---

## 4. Primeiro login (você + Rachel)

1. Abra https://comando.usepulso.org no navegador.
2. Clique em "Entrar com Google" → escolha sua conta `@usepulso.org`.
3. Você cai em `/totp/setup`. Escaneie o QR code com Google Authenticator/Authy.
4. Digite o código de 6 dígitos. Pronto, totp_enabled = 1.
5. Você cai em `/pedrra` (cockpit).
6. Pedir Rachel pra repetir o fluxo (`rachel.moghrabi@usepulso.org`). Ela vai cair em `/custos`.

---

## 5. Ciclo de deploy normal (a partir daqui)

Quando uma nova alteração for feita localmente e pusheada pro GitHub:

```bash
# Cola no terminal web Hostinger:
cd /var/www/comando-pulso && git pull && npm install --omit=dev && pm2 restart comando-pulso && pm2 status
```

---

## 6. Troubleshooting rápido

- **Login Google volta com erro "Domínio não autorizado":** sua conta é `@usepulso.org`? Se sim, verificar se o usuário existe na tabela `users` do banco.
- **TOTP não bate:** clock skew? Sincronize o relógio do celular.
- **PM2 perdeu o processo após reboot:** rodou `pm2 startup systemd ...` e copiou o comando que ele imprimiu? Rode de novo + `pm2 save`.
- **Caixa hoje não bate:** verifique `/configuracoes` — toggle "incluir saldo inicial" e valor do `initial_cash_brl`.

---

## 7. Não esquecer

- Backup automático diário às 3h. Você consegue ver os arquivos em `/var/backups/comando-pulso/` (mantém últimos 30 dias).
- O `.env` na VPS tem permissões 600 — não é commitado, não é exposto.
- HTTPS já roda via Nginx (Let's Encrypt). Renovação automática se já estava configurada antes.
