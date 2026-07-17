# 12 — Migration fora de ordem quebra o bootstrap por migrations

Regras de execução: `plans/README.md`. Achado durante a revisão de documentação
de 2026-07-17, ao validar se `db:migrate` servia como comando de setup (não serve).

## O problema

As migrations rodam em ordem alfabética do nome do arquivo. Uma está fora de
ordem:

| Ordem | Arquivo | O que faz |
|---|---|---|
| 1º | `20250116000000-add-first-day-of-week-to-users.js` | `ALTER users ADD first_day_of_week` |
| 2º | `20250615000001-create-users.js` | `CREATE TABLE users` |

A primeira tem data de **janeiro/2025**; a que cria a tabela é de **junho/2025**.
Alterar antes de criar.

Contra um banco vazio, a sequência é:

1. `add-first-day-of-week-to-users` chama `safeAddColumns` →
   `backend/utils/migration-utils.js:8-13` não acha a tabela `users`, loga
   `Table users does not exist, skipping column additions` e **retorna sem erro**.
2. Umzug marca a migration como **executada** no `SequelizeMeta`.
3. `create-users` (`:5`) cria `users` — e **não** define `first_day_of_week`
   (confirmado por grep).
4. A coluna nunca mais é adicionada: a migration que a adicionaria já consta
   como executada.

Resultado: schema sem `first_day_of_week`, enquanto `backend/models/User.js:69`
declara a coluna. Falha em runtime, **sem nenhum erro na migração**.

É a única migration fora de ordem — validado com:

```bash
ls backend/migrations/ | awk '$0 < "20250615000001"'
```

## Por que não explodiu ainda

`backend/cmd/start.sh:92-97` só chama `db-init.js` quando o arquivo do banco não
existe, e `db-init` faz `sequelize.sync({ force: true })` — que cria o schema
**a partir dos models**, com a coluna. As migrations rodam depois e viram no-op
graças aos guards `safe*`. O caminho do container nunca depende das migrations
para bootstrapar.

Quem cai no buraco: qualquer um que rode `npm run db:migrate` contra um banco
vazio, que é o gesto padrão de qualquer projeto Sequelize. A doc já foi corrigida
para não recomendar isso (2026-07-17), mas o buraco continua.

## Por que consertar mesmo assim

- **As migrations não são uma fonte de verdade confiável do schema.** Hoje o
  `sync({force:true})` é que é. Isso é um problema de disaster recovery: um
  restore que dependa de reconstruir por migrations sai quebrado e silencioso.
- O modo de falha é **silencioso**, que é o pior. Nenhum erro, nenhum log de
  alerta — só uma coluna faltando descoberta em runtime.

## Como consertar

Renomear a migration para ordenar **depois** de `create-users`:

```
20250116000000-add-first-day-of-week-to-users.js
  → 20250615000002-add-first-day-of-week-to-users.js
```

**Bancos existentes não quebram**: o nome antigo está no `SequelizeMeta`, então o
Umzug vê o nome novo como pendente e roda de novo — mas `safeAddColumns`
(`migration-utils.js:17-25`) só adiciona coluna que não existe. Contra banco já
migrado, no-op. Verificar isso, não presumir.

## Validação — o teste é o entregável

Um teste que bootstrapa um SQLite vazio **só por migrations** e afirma que o
schema bate com os models. É o teste que teria pego isto, e que pega o próximo.

1. Baseline: `npm run backend:test`.
2. Teste novo em `backend/tests/unit/` (há precedente de guard de banco em
   `db-init-guard.test.js`): sobe SQLite em memória ou temp, roda o Umzug com
   todas as migrations, e checa que `users` tem `first_day_of_week`.
3. Confirmar que o teste **falha** antes do rename (senão ele não testa nada).
4. Renomear a migration. Teste passa.
5. Rodar `npm run db:status` contra o banco de dev deste checkout para conferir
   que nada regrediu. **Não** rodar `db:init`/`db:reset`.

## Critério de pronto

- Migration renomeada; ordem alfabética coerente com a dependência.
- Teste de bootstrap-por-migrations verde, e vermelho se revertido o rename.
- Suíte backend verde (baseline: 114 suítes / 1644 testes).
- Commit citando `Implements plans/12`.

## Fora de escopo

- Auditar as outras 94 migrations em busca de outros problemas de ordem (esta é
  a única *fora de ordem*; dependências entre as demais não foram verificadas).
- Trocar o bootstrap do `start.sh` de `sync({force:true})` para migrations. É a
  mudança certa a prazo, mas é outro plano e mexe no boot de produção.
