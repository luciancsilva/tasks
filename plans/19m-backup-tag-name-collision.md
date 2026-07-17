# 19m — Restore de backup colide em `UNIQUE(user_id, name)` de tags entre usuários

> **Status: EXECUTADO** em 2026-07-17 — Resolução de colisão por nome na importação de Tag e Person (backupService.js) reaproveitando entidades existentes.
> **Escopo:** Tornar a importação de tags em `backend/services/backupService.js` resiliente a colisão de nome: quando o usuário-alvo já tem uma tag com o mesmo `name` (mas `uid` diferente), reaproveitar a tag existente em vez de tentar criar e violar `UNIQUE(user_id, name)`.
> **Depende de:** -
> **Origem:** descoberto durante a execução do `19b` (o teste de round-trip precisou limpar as tags de sistema para não colidir).

## Diagnóstico

`importUserData` (`backupService.js`, bloco "Import tags first") resolve tags **apenas por `uid`**:

```javascript
const existingTag = await Tag.findOne({ where: { uid: tagData.uid, user_id: userId }, transaction });
if (existingTag && options.merge) { /* skip, map id */ }
else if (!existingTag) { await Tag.create({ uid, name, user_id }); }
```

O model `Tag` tem índice `UNIQUE(user_id, name)` (tags de sistema são semeadas para todo usuário novo — mesmos nomes, `uid`s diferentes). Ao restaurar o backup de um usuário **sobre outro usuário** (ou em outra instância) que já tenha uma tag de mesmo nome com `uid` distinto, a busca por `uid` não acha nada, cai no `create`, e o SQLite lança `SQLITE_CONSTRAINT: UNIQUE constraint failed: tags.user_id, tags.name`. Como todo o import roda numa transação única, **a restauração inteira aborta e faz rollback** — o backup fica inutilizável nesse cenário.

### Impacto

Restaurar o backup de um usuário em uma conta que já tenha tags (praticamente todas, por causa das tags de sistema semeadas no cadastro) falha por completo. O caminho "restaurar no mesmo usuário após wipe" funciona; o de migração entre contas/instâncias, não.

## Implementação Proposta

1. No import de tags, após não encontrar por `uid`, procurar por `name`:
   ```javascript
   let existingTag = await Tag.findOne({ where: { uid: tagData.uid, user_id: userId }, transaction });
   if (!existingTag) {
       existingTag = await Tag.findOne({ where: { name: tagData.name, user_id: userId }, transaction });
   }
   if (existingTag) {
       stats.tags.skipped++;
       uidToIdMap.tags[tagData.uid] = existingTag.id; // reaproveita a tag de mesmo nome
   } else {
       const newTag = await Tag.create({ uid: tagData.uid, name: tagData.name, user_id: userId }, { transaction });
       stats.tags.created++;
       uidToIdMap.tags[tagData.uid] = newTag.id;
   }
   ```
   Assim o `uidToIdMap.tags` continua correto (aponta para a tag existente de mesmo nome) e os vínculos task/project/note-tag reconstroem sem violar o índice.
2. Avaliar se o mesmo padrão de colisão por nome afeta **Person** (`UNIQUE(user_id, name)` em `people`, `person.js:62`). Se sim, aplicar a mesma resolução por nome no import de People adicionado pelo `19b`.

## Critério de Pronto

- `npm run backend:test` limpo.
- Teste de integração: usuário A com tags exporta; importa em usuário B que já tem tag de mesmo nome; verifica que o restore **completa** (sem rollback), reaproveita a tag existente e mantém os vínculos. Remover, do `tests/integration/backup-people-roundtrip.test.js`, o `Tag.destroy` de contorno quando este plano estiver pronto.
