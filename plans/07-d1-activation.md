# 07 — Ativação do Cloudflare D1 em produção (pendente)

**Status**: PENDENTE — código pronto (commit `5e705e8`), ativação nunca executada
contra um D1 real. Todos os testes do driver rodaram contra emulador/mocks.

Pré-requisito de leitura: `plans/README.md` (regras) e header de
`backend/db/d1RestDriver.js` (semântica: transações no-op, `defer_foreign_keys`,
PRAGMAs locais ignorados).

## Nomenclatura de env vars (canônica desde este plano)

Prefixo unificado `CLOUDFLARE_`; nomes legados `R2_*` e `D1_*` seguem aceitos
como fallback em `backend/config/config.js`.

| Variável | Uso | Obrigatória p/ D1 |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Conta (compartilhada R2 + D1) | Sim |
| `CLOUDFLARE_API_TOKEN` | Token com permissão **D1:Edit** | Sim |
| `CLOUDFLARE_D1_DATABASE_ID` | UUID do database D1 | Sim |
| `TUDUDI_DB_DRIVER=d1` | Liga o driver REST | Sim (vazio = SQLite local) |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` / `..._SECRET_ACCESS_KEY` / `..._BUCKET` / `..._ENDPOINT` / `..._REGION` | Storage R2 | Não (independente) |
| `CLOUDFLARE_D1_TIMEOUT_MS`, `CLOUDFLARE_D1_MAX_REQUESTS_PER_WINDOW`, `CLOUDFLARE_D1_API_BASE_URL` | Tuning opcional do client | Não |

**Atenção**: nunca preencher `TUDUDI_DB_DRIVER=d1` com token/database_id vazios —
o boot falha de propósito ("D1 is not configured").

## Passo a passo

### 1. Criar o database D1 (painel ou wrangler)

```bash
npx wrangler d1 create tududi
# anotar o database_id retornado (UUID)
```

Ou painel Cloudflare → Storage & Databases → D1 → Create.

### 2. Criar API token

Painel → My Profile → API Tokens → Create Token → Custom:
- Permissão: `Account / D1 / Edit` (somente essa; princípio do menor privilégio).
- Escopo: a conta do `CLOUDFLARE_ACCOUNT_ID`.

### 3. Preencher `.env`

```
TUDUDI_DB_DRIVER=d1
CLOUDFLARE_ACCOUNT_ID=<já preenchido, compartilhado com R2>
CLOUDFLARE_D1_DATABASE_ID=<uuid do passo 1>
CLOUDFLARE_API_TOKEN=<token do passo 2>
```

### 4. Smoke do client (antes das migrations)

```bash
cd backend && npx cross-env NODE_ENV=production TUDUDI_DB_DRIVER=d1 node -e "
const { D1Client } = require('./db/d1Client');
const { getConfig } = require('./config/config');
const d1 = getConfig().d1;
new D1Client(d1).query('SELECT 1 as ok').then(r => console.log(r.results)).catch(e => { console.error(e.message); process.exit(1); });"
```

Esperado: `[ { ok: 1 } ]`. Erro de auth/404 aqui = credencial errada; corrigir
antes de prosseguir.

### 5. Rodar as ~60 migrations contra o D1

```bash
cd backend && npx cross-env NODE_ENV=production TUDUDI_DB_DRIVER=d1 npx sequelize-cli db:migrate
```

- Cada statement = 1 request REST; espere alguns minutos.
- **Sem transação real**: se falhar no meio, NÃO tentar remendar — dropar o
  database (`wrangler d1 delete`), recriar e rodar de novo (banco vazio, custo zero).
- Validar: `npx wrangler d1 execute tududi --remote --command "SELECT name FROM sqlite_master WHERE type='table'"`
  deve listar ~30 tabelas + `SequelizeMeta`.

### 6. Criar usuário e subir

```bash
cd backend && npx cross-env NODE_ENV=production TUDUDI_DB_DRIVER=d1 node scripts/user-create.js <email> <senha> true
# subir app (docker compose ou npm) com o .env já apontando pro D1
```

### 7. Smoke funcional

- Login; criar projeto, tarefa, subtask; anexar arquivo (valida R2 + D1 juntos).
- Deletar a tarefa → conferir no bucket que o objeto do anexo sumiu.
- `GET /api/health`; navegar Today/Upcoming (queries com joins pesados —
  primeiro ponto onde latência REST aparece).

### 8. Observação pós-ativação (primeira semana)

- Logs: procurar `[d1RestDriver] unhandled error` e `D1Error`.
- Latência: páginas com N+1 (delete de projeto grande) serão visivelmente mais
  lentas; se doer, ver `plans/05c-high-effort.md` HE-3 (batch atômico).
- Rate limit: instância única dificilmente passa de 1100 req/5min; monitorar
  429 nos logs se houver outros consumidores da API na mesma conta.

## Rollback

`TUDUDI_DB_DRIVER=` (vazio) no `.env` e restart — volta pro arquivo SQLite local
intocado. Dados criados no D1 nesse meio-tempo NÃO voltam junto (export manual
via `wrangler d1 export` se precisar).

## Riscos específicos da primeira ativação

- Migrations antigas podem conter SQL que o emulador aceitou e o D1 real
  rejeite (PRAGMA exótico, `ALTER TABLE` complexo). Tratamento: caso a caso,
  ajustando `translateStatement` em `backend/db/d1RestDriver.js`.
- `defer_foreign_keys` tem escopo por request no D1 — fluxos que dependiam de
  FK OFF prolongado podem falhar com constraint; mitigação já aplicada no
  delete de tarefa (deleção explícita de dependentes), restante em
  `plans/05b-medium-effort.md` ME-1.
