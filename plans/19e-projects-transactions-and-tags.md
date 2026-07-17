# 19e — Transações no Cadastro de Projetos e Correção de Erro Engolido em Tags (`ProjectsService`)

> **Status: EXECUTADO** em 2026-07-17 — `ProjectsService.create` e `update` rodam em `sequelize.transaction()` com a transação propagada a `updateProjectTags`/`findTagsByNames`/`createTag`/`setTags`; o `try/catch` que engolia falha de tag foi removido (agora aborta e faz rollback). Delete da imagem antiga no R2 movido para pós-commit.
> **Escopo:** Envolver `ProjectsService.create` e `update` em `sequelize.transaction()` e remover o `try/catch` que engole falhas de vinculação de tags em `projects/service.js:293-302` e `58-62`.
> **Depende de:** -

## Diagnóstico
As funções `ProjectsService.create` (`backend/modules/projects/service.js:293`), `update` (`service.js:372`) e `updateProjectTags` (`service.js:58`) não utilizam transações. Além disso, `updateProjectTags` usa `Promise.all` para criar tags concorrentemente, e o `try/catch` em `create` engole falhas ao vincular as tags (`project.setTags(...)`), retornando `{ ...project, tags: [] }` em caso de erro sem disparar rollback.

### Impacto
Se a vinculação de tags falhar no `create`, as tags parciais criadas pelo `Promise.all` ficam órfãs no banco de dados, enquanto o projeto retorna com status `200 OK` desvinculado de todas as tags. No `update`, se as tags falharem com `500 Internal Server Error`, o novo nome/descrição já estão commitados definitivamente no SQLite.

## Implementação Proposta

1. Em `updateProjectTags` (`service.js:58`), aceitar `{ transaction }` na options e propagar para `Tag.findOrCreate` / `createTag` e `project.setTags(..., { transaction })`.
2. Em `ProjectsService.create` (`service.js:293`):
   ```javascript
   return sequelize.transaction(async (t) => {
       const project = await projectsRepository.create(projectData, { transaction: t });
       if (tags && tags.length > 0) {
           await updateProjectTags(project, tags, userId, { transaction: t });
       }
       return project;
   });
   ```
3. Remover o bloco `try/catch` que engole erros de tag e deixar a exceção abortar a transação limpa.
4. Aplicar o mesmo padrão transacional em `ProjectsService.update` (`service.js:372`).

## Critério de Pronto
- `npm run backend:test:unit` sem erros nas rotas e serviços de projetos.
- Teste unitário em `tests/unit/modules/projects/service.test.js` onde `project.setTags` rejeita com erro e o teste verifica que `projectsRepository.create` sofre rollback.
