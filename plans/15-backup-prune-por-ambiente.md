# 15 — Retenção de snapshot por ambiente

> **Prioridade: BAIXA** (só morde se dois ambientes dividirem o mesmo bucket)
> — **Esforço: baixo** — **Julgamento: não exige** — **Depende de: nada**

## Contexto

`backend/services/dbBackupService.js`:
- a chave do snapshot embute o ambiente:
  `db-backups/${config.environment}-${timestamp}.sqlite3` (linha ~81);
- `pruneOldSnapshots(retention)` (linhas 34-48) lista o prefixo `db-backups/`
  **inteiro**, ordena lexicograficamente e apaga o excedente.

Com `development-*` e `production-*` no mesmo bucket, `development-` ordena
antes de `production-` — o prune apaga todos os snapshots de development
primeiro, independentemente da idade, e a contagem de retenção é global em vez
de por ambiente.

## O que fazer

### 1. Baseline
```bash
npm run backend:test
```

### 2. Fix

Em `createSnapshot()`, passar o prefixo completo do ambiente para o prune, e em
`pruneOldSnapshots` usar esse prefixo no `listObjects`:

```js
async function pruneOldSnapshots(retention, prefix) {
    const objects = await listObjects(prefix);
    // resto igual
}
// no createSnapshot:
const pruned = await pruneOldSnapshots(
    config.dbBackupRetention,
    `db-backups/${config.environment}-`
);
```

Dentro de um mesmo ambiente a ordenação lexicográfica continua correta
(timestamp UTC zero-padded) — não mudar o formato da chave.

### 3. Teste

Em `backend/tests/unit/services/dbBackupService.test.js` (já usa
`aws-sdk-client-mock`): caso com chaves `db-backups/development-...` e
`db-backups/production-...` misturadas no mock de `ListObjectsV2Command`,
verificando que o `Prefix` enviado é o do ambiente corrente e que só chaves
desse ambiente são deletadas.

### 4. Validação e lint
```bash
npm run backend:test
cd backend && npx eslint services/dbBackupService.js tests/unit/services/dbBackupService.test.js
```

## Critério de pronto

- [ ] `ListObjectsV2` recebe `Prefix: db-backups/<environment>-`.
- [ ] Teste novo cobrindo o cenário misto; suíte verde; lint limpo.

## Commit

`fix(backup): scope snapshot retention to the current environment` — corpo
citando "Implements plans/15". Sem push. Mesmo commit: banner EXECUTADO +
tabela do README.
