# 19n — Flaky em `subtasks-completion.test.js` sob carga paralela

> **Status: EXECUTADO** em 2026-07-17 — causa raiz: contenção do pool Sequelize
> (`max: 5`) sob 50 requisições HTTP concorrentes no teste de performance;
> corrigido com `bulkCreate` no setup e lotes de 5 (`BATCH_SIZE`) nas conclusões,
> eliminando o `SQLITE_BUSY`/timeout. 5 execuções seguidas de `npm run
> backend:test` verdes (124/124 suítes). Commit `789a994b`.
> **Escopo:** Investigar e estabilizar a suíte `backend/tests/integration/subtasks-completion.test.js`, que falhou **uma vez** na execução completa paralela (`npm run backend:test`) e passou isolada e no re-run.
> **Depende de:** -
> **Origem:** observado durante a execução do lote `19a`–`19b` (a suíte completa acusou 1 falha nessa suíte numa rodada; re-run da suíte completa e execução isolada ficaram 100% verdes).

## Diagnóstico

Na primeira rodada de `npm run backend:test` após o `19b`, a suíte
`tests/integration/subtasks-completion.test.js` acusou **1 teste falho** com
duração da suíte em ~20.9s (indício de timeout/contenção). Rodada isolada
(`npx cross-env NODE_ENV=test npx jest tests/integration/subtasks-completion.test.js`)
passou 14/14, e o re-run da suíte completa ficou 122 suítes / 1683 verdes.

Ou seja: **não é regressão determinística** das mudanças do lote 19 — é
instabilidade sob execução paralela do Jest (múltiplos workers). Hipóteses a
verificar:

1. **Contenção de SQLite** entre workers/handles. Cada worker usa um arquivo de
   DB próprio (`/tmp/test-*.sqlite3`), mas vale confirmar se essa suíte cria/usa
   handles adicionais ou se há `busy_timeout` insuficiente sob carga (o app usa
   `PRAGMA busy_timeout=5000` em `models/index.js:36`; o setup de teste pode não
   herdar isso).
2. **Timeout de teste** apertado para o tempo de setup dessa suíte quando a
   máquina está sob carga (os `beforeEach` recriam usuário + tarefas).
3. **Vazamento de estado** entre testes da própria suíte (ordenação/limpeza).

## Implementação Proposta

1. Reproduzir sob carga: rodar `npm run backend:test` algumas vezes (ou
   `jest --runInBand` vs paralelo) e capturar a mensagem de falha exata (qual
   `it`, qual assert). Sem a mensagem, não dá para corrigir a causa raiz.
2. Se for timeout: aumentar o timeout específico dessa suíte ou tornar o setup
   mais barato.
3. Se for contenção de DB: garantir `busy_timeout`/retry no setup de teste, ou
   isolar melhor o arquivo de DB por worker.
4. Não "consertar" mascarando com retry automático sem antes ter a causa.

## Critério de Pronto

- `npm run backend:test` verde de forma **repetida** (ex.: 5 execuções seguidas
  sem falha) — não apenas uma passagem.
- Causa raiz registrada neste plano (timeout vs contenção vs estado).
