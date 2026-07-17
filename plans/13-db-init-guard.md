# 13 — Guarda genérica contra wipe no `db-init`

> **Prioridade: ALTA** (risco de perda de dados) — **Esforço: baixo** —
> **Julgamento: não exige** (mecânico) — **Depende de: nada**

## Contexto

`npm run db:init` executa `backend/scripts/db-init.js`, que roda
`sequelize.sync({ force: true })` — DROP de todas as tabelas. Esse comando já
zerou o banco de produção duas vezes (2026-07-16/17, ver
`plans/09a-d1-code-removal.md` §Registro).

O commit `ef690f67` adicionou uma guarda, mas ela era específica do driver D1
(`isD1InitBlocked()`), e **foi removida junto com o D1** no `7782d689`. Hoje
`backend/scripts/db-init.js:23` roda o sync destrutivo incondicionalmente; as
únicas proteções restantes são:
- `backend/cmd/start.sh:92` — só chama `db-init` quando o arquivo do banco não existe;
- o guard de `require.main` (testado em `backend/tests/unit/db-init-guard.test.js`).

Nada protege um humano ou agente que rode `npm run db:init` na mão com banco
existente. Este plano restaura uma guarda **genérica** (não atrelada a driver).

## O que fazer

### 1. Baseline
```bash
npm run backend:test
```
Deve estar verde (baseline 2026-07-17: 114 suítes / 1644 testes). Vermelho =
parar e reportar.

### 2. Implementar a guarda em `backend/scripts/db-init.js`

Regra: **se o arquivo do banco já existe e não está vazio, recusar**, a menos
que `TUDUDI_ALLOW_DB_INIT=1` esteja setado no ambiente.

- O caminho do banco vem de `sequelize.options.storage` (dialecto sqlite) —
  usar exatamente essa fonte, não recalcular o path por conta própria.
- Implementar como função exportada e pura para ser testável:

```js
/**
 * sync({ force: true }) drops every table. Refuse to run it against a
 * database file that already exists and has content, unless the operator
 * explicitly opts in via TUDUDI_ALLOW_DB_INIT=1.
 *
 * @param {string|undefined} storagePath  sequelize.options.storage
 * @param {string|undefined} allowFlag    process.env.TUDUDI_ALLOW_DB_INIT
 * @returns {boolean} true when the destructive init must be refused
 */
function isInitBlocked(storagePath, allowFlag) {
    if (allowFlag === '1') return false;
    if (!storagePath || storagePath === ':memory:') return false;
    try {
        const stat = require('fs').statSync(storagePath);
        return stat.size > 0;
    } catch (_) {
        return false; // arquivo não existe: init é o caminho correto
    }
}
```

- Em `initDatabase()`, antes do `sequelize.sync`: se `isInitBlocked(...)`,
  imprimir mensagem clara (o arquivo existe, o comando destrói tudo, como
  liberar com `TUDUDI_ALLOW_DB_INIT=1`, e que `db:migrate` é o caminho para
  banco existente) e `process.exit(1)`.
- Exportar `isInitBlocked` no `module.exports` junto de `initDatabase`.
- Aplicar exatamente o mesmo guard em `backend/scripts/db-reset.js` **se o
  arquivo existir** (verificar; se o reset for outro script, replicar lá).

### 3. Testes

Estender `backend/tests/unit/db-init-guard.test.js` com casos unitários de
`isInitBlocked` (não rodar `initDatabase` de verdade):
- arquivo existente com `size > 0` e flag ausente → `true`;
- flag `'1'` → `false`;
- path inexistente → `false`;
- `':memory:'` e `undefined` → `false`.
Usar arquivo temporário criado no próprio teste (`os.tmpdir()`), removido no
`afterEach`.

### 4. Validação e lint

```bash
npm run backend:test
cd backend && npx eslint scripts/db-init.js tests/unit/db-init-guard.test.js
```

## Critério de pronto

- [ ] `npm run db:init` com banco de dev existente **recusa e sai com código 1** (testar manualmente e desfazer nada — a recusa não toca o banco).
- [ ] Com `TUDUDI_ALLOW_DB_INIT=1`, o comportamento antigo é preservado (NÃO testar contra o banco de dev — confiar nos testes unitários).
- [ ] Boot de banco novo continua funcionando (o caminho `start.sh` não seta a flag e o arquivo não existe → guard libera).
- [ ] Suíte backend verde; lint dos arquivos tocados limpo.

## Commit

Um commit: `fix(db): refuse destructive db-init against an existing database`
— corpo citando "Implements plans/13". Sem push. No mesmo commit: banner
EXECUTADO neste arquivo + mover a linha na tabela do `plans/README.md`.

## Armadilhas específicas

- **NUNCA rode `npm run db:init`/`db:reset` para "testar"** o caminho
  destrutivo — valide só pela recusa e pelos testes unitários.
- A suíte Jest usa `NODE_ENV=test` e banco próprio; segura por construção.
