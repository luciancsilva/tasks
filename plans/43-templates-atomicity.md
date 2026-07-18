# 43 — Delete/clone/save de template não-atômico

> **Status: PROPOSTO** — deletar um template apaga as tasks e depois a linha do template fora de transação (crash entre as duas deixa o template órfão vazio); save-as-template/clone criam o projeto fora da transação da cópia de tasks (falha deixa projeto vazio).
> **Esforço:** Baixo · **Natureza:** mecânico · **Modelo:** fraco (haiku)
> **Branch:** main · **Depende de:** -

## Diagnóstico

`backend/modules/templates/service.js`, `delete` (`:432-435`):
```
await Task.destroy({ where: { project_id: template.id, user_id: userId } }); // L432
await template.destroy();                                                     // L435
```
Sem transação: crash entre as duas remove todas as tasks e mantém a linha do template
órfã (aparece vazia na lista).

`saveProjectAsTemplate` (`:167-180`):
```
const template = await templatesRepository.create({ ... });   // L167
await this._copyTasksToProject(source, template, userId, ...); // L178
```
`cloneTemplate` (`:216-230`):
```
const newProject = await projectsRepository.create({ ... });  // L216
await this._copyTasksToProject(template, newProject, userId, ...); // L227
```
`_copyTasksToProject` abre a própria transação internamente (`:270`, conforme o
levantamento), mas o `create` do template/projeto fica **fora** dela. Falha na cópia
das tasks deixa um projeto/template criado e vazio (parcialmente aplicado).

## Implementação Proposta

1. `delete`: envolver `Task.destroy` + `template.destroy` em `sequelize.transaction`,
   passando `{ transaction: t }` a ambos.
2. `saveProjectAsTemplate` e `cloneTemplate`: abrir uma transação que englobe o
   `create` do template/projeto **e** a `_copyTasksToProject`. Como `_copyTasksToProject`
   já usa transação própria (`:245-270`), refatorar para aceitar uma tx externa opcional
   e reusá-la (evita transação aninhada) — mesma abordagem dos serviços de tasks/projects
   (planos 19a/19e). Se o custo do refactor for alto, alternativa mínima: mover o `create`
   para dentro do escopo transacional de `_copyTasksToProject`.

## Critério de Pronto

- Teste: mock de `_copyTasksToProject` lançando em `saveProjectAsTemplate`/`cloneTemplate`
  → nenhum template/projeto vazio persiste (rollback).
- Teste: mock de `template.destroy` lançando após `Task.destroy` no `delete` → as tasks
  não são removidas (rollback).
- Suíte backend verde; lint dos arquivos tocados.
