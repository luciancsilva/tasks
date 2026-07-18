# 38 — robustez: auth full-column select + migrations não testadas

> **Status: EXECUTADO** — dois pontos de fragilidade expostos pelo bug do plano 37. Sem risco imediato de dados, mas ambos amplificam qualquer drift de schema em outage total. Achados no run de seed/MCP de 2026-07-18.
> **Esforço:** Médio · **Natureza:** julgamento (mexe em auth + infra de teste) · **Modelo:** médio/forte.
> **Branch:** `main` · **Depende de:** -

## 38-1 — `requireAuth` carrega o User com todas as colunas

`backend/middleware/auth.js:~71` faz `User.findByPk(id)` (SELECT de todas as
colunas) em **toda** requisição autenticada. Se a tabela `users` divergir do
model por uma única coluna — migration aditiva ainda não aplicada, drift de
ambiente — o SELECT lança e **todo endpoint autenticado dá 500** (login de
sessão, API, MCP). Foi exatamente o que derrubou o smoke-test MCP antes do fix
do plano 37.

**Ação proposta:** restringir o load de auth aos atributos que o middleware
realmente usa (`id`, `email`, `is_admin`, e o mínimo de sessão), via
`attributes: [...]`. Assim uma coluna nova do model que ainda não foi migrada não
derruba a autenticação inteira. **Cuidado:** mapear todos os consumidores de
`req.user`/`req.currentUser` a jusante para não omitir um campo usado — por isso
é julgamento, não mecânico.

## 38-2 — migrations não são exercidas pelos testes

`NODE_ENV=test` monta o schema via `sequelize.sync()` a partir dos **models**, então
as migrations **nunca rodam** na suíte. Uma migration quebrada (plano 37) passa
com 1709 testes verdes e só falha no deploy (`start.sh` → `db:migrate`). Mesma
classe do plano 12.

**Ação proposta:** um teste de fumaça que, num DB temporário limpo, rode
`db:migrate` (todas as migrations em ordem) e falhe se qualquer uma lançar.
Fecha a classe "migration quebrada passa no CI". Avaliar custo/tempo no CI e se
roda em Windows (ver armadilhas de execSync do plano 19k).

## Critério de Pronto

- 38-1: auth carrega só os atributos necessários; suíte verde; smoke manual de
  login + uma rota autenticada com uma coluna de model propositalmente não
  migrada não derruba tudo.
- 38-2: teste de migração falha propositalmente quando uma migration lança.
