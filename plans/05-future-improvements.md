# Frente 5 — Revisão geral de melhorias futuras (informativo; não implementar)

Itens observados durante a investigação das Frentes 1–4. Formato: o quê / onde / por quê / prioridade.

## Alta

1. **`PRAGMA foreign_keys = OFF` global fora de transação** — `backend/modules/tasks/routes.js:959-975`. O PRAGMA é emitido na conexão do pool sem transação; sob concorrência outra requisição pode executar com FKs desligadas, e um crash entre OFF e ON deixa a conexão permanentemente sem enforcement. Substituir por deleção ordenada explícita (ou `defer_foreign_keys`) dentro de transação.
2. **`r2Service.deleteObject` engole erros sem log** — `backend/services/r2Service.js:119-131`. Falhas de storage ficam invisíveis (raiz do sintoma da Frente 1). Logar no catch mantendo contrato best-effort. (Corrigido na execução das Frentes 1/2.)
3. **Módulo `tasks` foge do padrão arquitetural** — `backend/modules/tasks/routes.js` tem ~1000 linhas com lógica de negócio inline (delete recorrente, PRAGMA, SQL cru `DELETE FROM tasks_tags`), enquanto `projects` segue controller→service→repository. Dificulta teste unitário e é onde os bugs das Frentes 1/2 nasceram. Extrair service/controller.
4. **Side effects externos dentro de transação de banco** — `backend/modules/projects/repository.js:256-352` chama R2 (HTTP) dentro de `sequelize.transaction`. Rollback não desfaz o delete no bucket; storage lento segura a transação (e o lock de escrita do SQLite). Mover side effects para depois do commit (coletar keys, deletar após).

## Média

5. **Registros `task_attachments` órfãos no banco ao deletar task** — mesmo após a Frente 2 corrigir o R2, o design com FKs desligadas exige deleção manual consistente; considerar `ON DELETE CASCADE` real nas FKs de `task_attachments`/`task_events`.
6. **Race condition no limite de 20 anexos** — `backend/modules/tasks/attachments.js:106-116`: `count` + `create` sem lock; uploads paralelos passam do limite. Baixo impacto, mas trivial de apertar com constraint/validação transacional.
7. **Inconsistência de tratamento de erro** — módulos novos usam `next(error)` + `shared/middleware/errorHandler`; `tasks/routes.js` responde `res.status(400)` genérico e descarta o erro original (ex.: linhas 979-983, sem `logError`). Padronizar.
8. **Upload órfão quando a requisição é rejeitada** — o multer-s3 sobe o arquivo antes das validações; a limpeza best-effort existe (`attachments.js:25-29`) mas não cobre crash do processo. Considerar lifecycle rule no bucket (expirar objetos sem registro no DB) — barato e resolve todas as fontes de órfãos.
9. **Cobertura de testes do frontend baixa em fluxos críticos** — `frontend/__tests__` existe, mas fluxos como remoção de capa/branding dependem só de E2E. Adicionar testes de componente para os fluxos de settings/upload.
10. **Chaves i18n com drift entre 25 locales** — commit `350ddeb` ("add missing translation keys") indica ausência de verificação automática. Adicionar script/CI que compara chaves de `en/translation.json` com os demais locales.
11. **Segredos com fallback silencioso** — `backend/config/config.js:93-95` gera session secret aleatório por processo (sessões caem a cada restart, multi-réplica quebra login) e `encryptionKey` tem cadeia de fallback (`ENCRYPTION_KEY` → `SECRET_KEY` → session secret) que pode tornar dados CalDAV indecifráveis após mudança de env. Warning explícito no boot em produção.

## Baixa

12. **Artefato de dev em `public/`** — `public/generate-favicon.html` é ferramenta de desenvolvimento servida em produção. Remover do build.
13. **`BaseRepository` subutilizado** — `backend/shared/database/BaseRepository.js` é fino e vários módulos o contornam com queries diretas; ou enriquecer, ou remover para reduzir indireção.
14. **Nomenclatura de locale fora do padrão BCP-47** — `public/locales/jp` (deveria ser `ja`) e `ua` (deveria ser `uk`). Renomear exige migração da preferência salva dos usuários.
15. **`docker-compose.yml` com mudanças não commitadas** — estado do working tree atual; revisar/commitar ou descartar para manter reprodutibilidade.
16. **Documentação interna forte, mas sem doc do fluxo de storage R2 pós-migração** além do README — um `docs/15-storage.md` curto (prefixos de key, proxy de uploads, contrato best-effort) ajudaria contribuidores.
