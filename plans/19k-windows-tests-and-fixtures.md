# 19k — Correção dos Testes da Baseline (`user-create-script` no Windows e mock `inboxProcessingService`)

> **Status: EXECUTADO** em 2026-07-17 — corrigido mock parsed_people em inboxProcessingService.test.js e path/env do execSync em user-create-script.test.js; baseline backend 100%.
> **Escopo:** Corrigir as 5 falhas da suíte de testes de baseline (`AB-1` e `AB-2`): a execução do subprocesso em `user-create-script.test.js` no Windows e as expectativas do mock em `inboxProcessingService.test.js`.
> **Depende de:** -

## Diagnóstico
Na execução da baseline (`npm run backend:test`), 1661 de 1666 testes passaram, com apenas 5 falhas concentradas em dois arquivos:
1. `tests/unit/services/inboxProcessingService.test.js` (4 testes falhando com `Expected - 0, Received + 1` em `parsed_people: Array []`): O serviço foi atualizado para extrair pessoas/menções (`parsed_people`), mas o objeto de expectativa do Jest não incluiu essa propriedade.
2. `tests/integration/user-create-script.test.js:197` (1 teste falhando no comando `execSync('npm run user:create ...', { cwd, env: process.env })` com `SQLITE_ERROR: no such table: users`): No Windows, invocar `npm run` via `execSync` em processo secundário repassa caminhos ou diretórios de trabalho de forma inconsistente, fazendo o script abrir o banco de dados padrão vazio (`backend/db/development.sqlite3`) em vez do banco de teste temporário providenciado pelo setup do Jest.

## Implementação Proposta

1. Em `tests/unit/services/inboxProcessingService.test.js`, adicionar `parsed_people: []` em todas as asserções `expect(result).toEqual({ ... })` que verificam o retorno de `processInboxItem`.
2. Em `tests/integration/user-create-script.test.js:197`:
   - Em vez de rodar `npm run user:create ${email} ${password}` via `execSync`, chamar diretamente o node com caminho absoluto normalizado (`path.resolve` / `path.join`) e forçar `NODE_ENV=test` explicitamente:
     ```javascript
     const scriptPath = path.resolve(__dirname, '../../scripts/user-create.js');
     const output = execSync(
         `node "${scriptPath}" "${email}" "${password}"`,
         {
             cwd: path.resolve(__dirname, '../..'),
             env: {
                 ...process.env,
                 NODE_ENV: 'test',
                 DB_FILE: setup.testDbPath,
                 TUDUDI_TRUST_PROXY: '1'
             }
         }
     );
     ```

## Critério de Pronto
- `npm run backend:test` passando 100% (1666 testes de 1666, 0 falhas).
