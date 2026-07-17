# 05 — Melhorias futuras (índice)

Levantamento feito em 2026-07-16 durante a execução das Frentes 1–4.
Os 16 itens originais foram **segregados por esforço** em três subplans
executáveis de forma independente:

| Subplan | Faixa de esforço | Itens |
|---|---|---|
| [05a-quick-wins.md](05a-quick-wins.md) | Baixo — 1 sessão curta por item | Limite de 20 anexos (race), lifecycle rule R2, checagem de drift i18n, warning de segredos no boot, remover `generate-favicon.html` |
| [05b-medium-effort.md](05b-medium-effort.md) | Médio — 1 sessão focada por item | CASCADEs reais, error handling do tasks, destino do BaseRepository, renomear locales `jp`/`ua` |
| [05c-high-effort.md](05c-high-effort.md) | Alto — multissessão/estrutural | Extrair service/controller do tasks, cobertura de testes frontend |

Itens já resolvidos desde o levantamento: logging em `r2Service.deleteObject`
(commit `b707dce`), `docker-compose.yml` pendente (commit `44c0ba2`), doc de
storage (absorvida por [06-docs-update.md](06-docs-update.md)), eliminar `PRAGMA foreign_keys = OFF` global (ME-1),
deletar anexos/capa fora da transação de banco (ME-2).

Ordem sugerida quando forem executados: 05a inteiro → ME-3 →
demais de 05b → 05c. Prioridade de risco mais alta: HE-1 (módulo tasks). Regras de execução por agente: [README.md](README.md).
