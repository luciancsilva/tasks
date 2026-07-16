# Frente 1 — Anexos de capa/projeto órfãos no R2

> **Status: EXECUTADO** em 2026-07-16 — commit `b707dce` (fix(projects): remove cover image object from R2).
> Mantido como registro de decisão.

## Diagnóstico

### Onde está a lógica de exclusão de projeto

- Rota: `backend/modules/projects/routes.js:81-91` — `DELETE /project/:uid` → `projectsController.delete`.
- Controller: `backend/modules/projects/controller.js:90-98` → `projectsService.delete`.
- Service: `backend/modules/projects/service.js:381-391` — busca o projeto via `projectsRepository.findOne({ uid })` (todas as colunas, incluindo `image_url`) e delega a `projectsRepository.deleteWithOrphaning(project, userId)`.
- Repository: `backend/modules/projects/repository.js:256-352` — `deleteWithOrphaning` roda em transação, deleta anexos de tasks/subtasks do R2 (linhas 290-312), deleta as tasks, orfana notas e **já contém** a remoção da capa no R2 (linhas 329-339): extrai o filename de `image_url` via regex `/\/api\/uploads\/projects\/(.+)$/` e chama `r2Service.deleteObject('projects/<filename>')`.

Conclusão do fluxo "deletar projeto": a chamada de remoção **existe** e o objeto `project` carregado tem `image_url`. O ponto fraco não é ausência de chamada, e sim que `r2Service.deleteObject` (`backend/services/r2Service.js:119-131`) engole **qualquer** erro e retorna `false` sem logar nada — falha silenciosa invisível. Além disso, não há teste cobrindo a limpeza da capa nesse fluxo.

### Onde está a exclusão da imagem de capa (sem deletar o projeto)

Não existe rota dedicada. O frontend remove/troca a capa via `PATCH /project/:uid` com `image_url: ''` (ou com a URL nova após `POST /api/upload/project-image`). O handler é `projectsService.update` (`backend/modules/projects/service.js:315-376`), que na linha 358-359 apenas faz `updateData.image_url = image_url === '' ? null : image_url` — **nenhuma chamada ao R2**. É ausência total de chamada, não falha silenciosa.

O mesmo vale para **troca** de capa: a URL antiga é sobrescrita e o objeto antigo fica órfão para sempre.

### Padrão de referência no próprio código

Avatar de usuário: `backend/modules/users/service.js:225-232` e `:250-256` — antes de trocar/limpar `avatar_image`, chama `r2Service.deleteObject('avatars/' + path.basename(old))`. É exatamente o comportamento que falta em projetos.

### Relação pai/filhos

Anexos de tasks dentro do projeto já são tratados por `deleteWithOrphaning` (inclusive subtasks, um nível). O escopo desta frente é a imagem de capa; a Frente 2 cria um helper reutilizável que esta frente aproveita indiretamente.

## Correção proposta

1. **Helper** `deleteProjectImageFromR2(imageUrl)` em `backend/modules/projects/repository.js` (ou util compartilhado): valida com a regex já usada e chama `r2Service.deleteObject`. Reusar tanto no `deleteWithOrphaning` quanto no update.
2. **`projectsService.update`**: quando `image_url` muda (limpa ou substituída) e o valor antigo aponta para `/api/uploads/projects/...`, deletar o objeto antigo do R2 **após** persistir o update com sucesso (nunca antes — se o update falhar, a capa antiga continua válida).
3. **Logging**: adicionar `logError` no catch de `r2Service.deleteObject` para eliminar a falha 100% silenciosa (mantendo o contrato best-effort de nunca lançar).
4. **Local da chamada — controller/service explícito, não hook Sequelize.** Riscos avaliados:
   - Hook `beforeDestroy`/`afterDestroy` no model: (a) `Task.destroy({ where })` em lote **não dispara** hooks por instância sem `individualHooks: true`; (b) hooks rodam dentro da transação — side effect externo (HTTP no R2) dentro de transação que pode sofrer rollback; (c) erro no hook aborta a transação por causa de um serviço de storage fora do ar. O código existente já segue o padrão explícito (repository/service), então manter.
   - Custo do padrão explícito: futuros novos fluxos de deleção precisam lembrar de chamar o helper — mitigado centralizando no repository.

## Testes

- `backend/tests/integration/projects.test.js` (ou novo arquivo): usando `aws-sdk-client-mock` (mesmo mock já usado em `task-attachments.test.js`), cobrir:
  - PATCH com `image_url: ''` dispara `DeleteObjectCommand` com a key antiga.
  - PATCH trocando a URL dispara delete da antiga.
  - PATCH sem tocar em `image_url` não dispara delete.
  - DELETE do projeto com capa dispara delete da key da capa.
