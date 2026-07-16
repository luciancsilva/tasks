# Resumo — ordem recomendada de execução (Frentes 1–4)

| Ordem | Frente | Documento | Dependência |
|-------|--------|-----------|-------------|
| 1º | Frente 2 — anexos de tarefa órfãos no R2 | `02-r2-task-cleanup.md` | — (cria o helper de limpeza de anexos reutilizado pela Frente 1) |
| 2º | Frente 1 — capa de projeto órfã no R2 | `01-r2-cover-cleanup.md` | Reusa o helper da Frente 2 no `deleteWithOrphaning` |
| 3º | Frente 3 — branding (logo/favicon/nome) | `03-branding-customization.md` | Usa a tabela `settings` existente e o pipeline R2; deve existir **antes** da Frente 4 para que o estado novo já nasça coberto pela migração |
| 4º | Frente 4 — Cloudflare D1 via REST API | `04-d1-migration.md` | Por último: toca a fundação de dados; exige suíte inteira verde antes e depois. A Frente 3 não cria tabela nova (usa `settings`), então a compatibilidade é automática |

Racional:

- **2 antes de 1**: a Frente 2 extrai o helper `deleteAttachmentsForTaskIds`, que a Frente 1 aproveita ao refatorar `projectsRepository.deleteWithOrphaning`; na ordem inversa haveria retrabalho.
- **3 antes de 4**: o enunciado prevê que a Frente 3 introduz estado novo que a 4 precisa contemplar. Na modelagem escolhida (chaves na tabela `settings` global + objetos no R2), nenhum schema novo é criado — mas a ordem é mantida para que a suíte de testes que valida a Frente 4 já exercite o código de branding.
- **4 por último**: maior raio de impacto (camada de acesso a dados inteira); precisa da base estável e testada.
- **Frente 5** (`05-future-improvements.md`) é informativa, fora da ordem de execução.

Cada frente: implementação completa → `npm test` (backend) + lint → commit próprio.
