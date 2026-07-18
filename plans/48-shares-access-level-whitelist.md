# 48 — `createShare` não valida `access_level` contra whitelist

> **Status: PROPOSTO** — `access_level` do body só é checado quanto à presença, nunca contra `ro`/`rw`/`admin`; valor arbitrário é persistido. Sem escalação cross-user (só o dono seta), é robustez defensiva.
> **Esforço:** Trivial · **Natureza:** mecânico · **Modelo:** fraco (haiku)
> **Branch:** main · **Depende de:** -

## Diagnóstico

`backend/modules/shares/service.js` `createShare` (`:21-77`): `access_level` é
desestruturado do body (`:22-23`) e só validado por presença
(`!access_level`, `:29`). Depois é repassado cru a `execAction` como
`accessLevel: access_level` (`:73`), que persiste o share.

`backend/services/permissionsCalculators.js` consome `access_level` (`:73,83,92`)
sem normalizar/validar contra o conjunto esperado.

Só o dono do recurso (ou admin) chega nesse ponto — `isResourceOwner`/`isAdmin`
(`shares/service.js:34-43`) — então **não há escalação de privilégio entre
usuários**: o alvo do compartilhamento não consegue setar o próprio nível. O risco é
apenas um valor inesperado ("admin" onde não deveria, typo, string livre) gravado e
interpretado de forma imprevista pelos calculators. Severidade BAIXA.

## Implementação Proposta

1. Definir o whitelist de níveis válidos (confirmar quais os calculators de fato
   suportam em `permissionsCalculators.js` — provavelmente `ro`/`rw`, e `admin` se
   aplicável) e validar `access_level` em `createShare` antes do `execAction`,
   lançando `ValidationError` para valor fora do conjunto.
2. Se houver um único ponto canônico de constantes de permissão, reusar; senão,
   declarar o conjunto perto de `permissionsCalculators.js` e importar.

## Critério de Pronto

- Teste: `POST /shares` com `access_level` inválido (ex.: `"owner"`, `"xx"`) → 400,
  nada persistido.
- Teste: `ro`/`rw` (e `admin` se suportado) continuam funcionando.
- Suíte backend verde; lint dos arquivos tocados.
