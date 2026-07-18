> **Status: EXECUTADO** em 2026-07-18 — Validação de ownership da Area adicionada ao `create`/`update` de Goal e query `getAll` escopada por `user_id`; testes de integração adicionados.

# 47 — Goal aceita `area_id` de qualquer usuário (IDOR → vazamento de metadado de Area)

> **Status: PROPOSTO** — `create`/`update` de goal gravam o `area_id` do body sem validar que a Area pertence ao usuário logado; associando a Area privada de outro usuário, o `include` do GET vaza nome/cor/uid dela.
> **Esforço:** Baixo · **Natureza:** julgamento · **Modelo:** médio (sonnet)
> **Branch:** main · **Depende de:** -

## Diagnóstico

`backend/modules/goals/service.js`:
- `create` (`:28-45`): `const { title, area_id, ... } = data;` (L29) e grava
  `area_id` direto (`:38`) sem checar dono. Só valida presença (`:33-35`).
- `update` (`:47-62`): `if (area_id !== undefined) updates.area_id = area_id;`
  (`:54`) — idem, sem validar dono.

O repositório inclui a Area associada na leitura: `goals/repository.js` `findByUid`
(`:26-33`), `findAllByUser`/`findAllByArea` (`:6-24`) trazem
`Area` com `attributes: ['id','uid','name','color']`.

O padrão correto já existe no fork para `project_id` em notes:
`backend/modules/notes/service.js:89-122` (`resolveProjectWithAccess`) resolve o
projeto e lança `ForbiddenError` se o usuário não é dono nem tem permissão. Em goals
essa checagem para `area_id` não existe.

Cenário: ids de Area são autoincrement (enumeráveis). Usuário A faz
`POST /goals` com `title` válido e `area_id = <id de uma Area privada de B>`. A goal
nasce pertencendo a A mas associada à Area de B. `GET /goals/:uid` (ou `GET /goals`)
retorna, no `include` da Area, `name`/`color`/`uid` da Area privada de B — vazamento
de metadado alheio via associação forjada. Não é escrita/deleção cross-user (a goal é
de A), então severidade MÉDIA.

Nota adicional (baixa, não é o foco): `goals/service.js:10` faz
`Area.findOne({ where: { uid: areaUid } })` sem `user_id` — mas o resultado só vira
`area.id` passado a `findAllByArea(userId, area.id)`, que filtra as goals por
`userId`, então não retorna dado de B. Corrigir junto por consistência é opcional.

## Implementação Proposta

1. Extrair um helper `resolveAreaOwnedByUser(userId, areaId)` (em `goals/service.js`
   ou repositório) que busca a Area por id **e** `user_id: userId` e lança
   `NotFoundError`/`ForbiddenError` se não for do usuário — espelhando
   `resolveProjectWithAccess` de notes.
2. Chamar no `create` (antes do `goalsRepository.create`) e no `update` (quando
   `area_id !== undefined`).
3. Opcional/consistência: escopar o `Area.findOne` de `getAll` (`:10`) por `user_id`.

## Critério de Pronto

- Teste de integração: usuário A `POST /goals` com `area_id` de Area do usuário B →
  403/404, goal **não** criada.
- Teste: `PATCH` de goal de A trocando `area_id` para Area de B → 403/404.
- Área própria continua funcionando (create/update normais).
- Suíte backend verde; lint dos arquivos tocados.
