# 14a — MCP `delete_task` deve usar a deleção inteligente do serviço

> **Prioridade: ALTA** (perda de dados: anexos órfãos no R2 + histórico de
> recorrência destruído) — **Esforço: baixo** — **Julgamento: não exige** —
> **Depende de: nada**

## Contexto

Existem dois caminhos de deleção de tarefa com comportamentos diferentes:

1. **Rota REST** → `tasksService.delete(uid)`
   (`backend/modules/tasks/service.js:603-675`): transação; remove anexos da
   tarefa e subtasks via `deleteAttachmentsForTaskIds` (rows na transação,
   objetos R2 pós-commit); instâncias recorrentes **futuras** são deletadas
   (com anexos), as **passadas** são destacadas em tarefas standalone para
   preservar o histórico.

2. **Tool MCP `delete_task`** (`backend/modules/mcp/tools/taskTools.js:466-509`):
   chama `task.destroy()` cru. Sem transação, sem limpeza de R2 (os rows de
   `task_attachments` caem por cascade, os objetos ficam órfãos no bucket) e o
   cascade apaga instâncias recorrentes passadas — perde histórico.

## O que fazer

### 1. Baseline
```bash
npm run backend:test
```
Verde esperado (2026-07-17: 114/1644). Vermelho = parar e reportar.

### 2. Trocar o corpo do handler

Em `backend/modules/mcp/tools/taskTools.js`, no handler de `delete_task`
(linhas ~480-508):
- manter o `findTaskByIdentifier` + checagens de not found / ownership como estão;
- substituir `await task.destroy();` por:

```js
const tasksService = require('../../tasks/service'); // no topo do arquivo
// ...
await tasksService.delete(task.uid);
```

- `tasksService.delete` já lança `NotFoundError` se a task sumir entre as duas
  chamadas; deixar o erro propagar (o wrapper do server converte em `isError`).
- Não alterar o formato da resposta da tool.

Atenção ao import circular: `taskTools.js` já importa de
`../../tasks/repository` e `../../tasks/core/serializers`; importar
`../../tasks/service` segue o mesmo padrão. Se o Node acusar ciclo
(improvável), fazer o require dentro do handler.

### 3. Teste de integração

Em `backend/tests/integration/mcp/mcp-tools.test.js` (seguir o padrão dos
testes existentes no arquivo; mock R2 com `aws-sdk-client-mock` como em
`backend/tests/integration/task-attachments.test.js`):
- criar task com um `TaskAttachment`, chamar a tool `delete_task`, verificar
  que o `DeleteObjectCommand` foi enviado para o `file_path` do anexo e que o
  row sumiu;
- criar task recorrente com uma instância filha **passada** (due_date ontem,
  `recurring_parent_id` apontando para a pai), deletar a pai via tool,
  verificar que a filha **continua existindo** com `recurring_parent_id: null`.
  Padrão de seed de recorrência pronto para copiar:
  `backend/tests/integration/smart-recurring-deletion.test.js` (cria pai +
  filhas passadas/futuras e afirma exatamente esse comportamento na rota REST —
  replicar o cenário trocando a chamada da rota pela tool MCP).

### 4. Validação e lint
```bash
npm run backend:test
cd backend && npx eslint modules/mcp/tools/taskTools.js tests/integration/mcp/mcp-tools.test.js
```

## Critério de pronto

- [ ] Handler não chama mais `task.destroy()` direto.
- [ ] Dois testes novos acima passando; suíte inteira verde.
- [ ] Lint dos arquivos tocados limpo.

## Commit

`fix(mcp): route delete_task through tasksService.delete` — corpo citando
"Implements plans/14a". Sem push. Mesmo commit: banner EXECUTADO aqui + tabela
do `plans/README.md`.
