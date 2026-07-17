# Changelog do fork vs. `chrisvel/tududi`

O que este fork tem que o upstream não tem. **68 commits** à frente de
`upstream/main` (v1.2.4, `fdb0b7d5`), medidos em 2026-07-17.

## Como regenerar (não edite a contagem à mão)

```bash
git fetch upstream
git rev-list --count upstream/main..main        # quantos à frente
git rev-list --count main..upstream/main        # quantos faltam entrar
git log --reverse --format='%h %ad %s' --date=short upstream/main..main
```

> **Por que este arquivo existe separado do README**: a versão anterior desta
> lista morava no `README.md` e era mantida à mão. Gerou cinco commits que só
> mexiam num número (`6d4b31c4`, `aec32dc4`, `bf8bf593`, `1ded0189`, `299c73b2`)
> e ainda assim estava errada — dizia 51 quando eram 66. Aqui a contagem vem do
> comando acima. Se divergir, o comando está certo e o arquivo está velho.

---

## Correções de bugs do upstream

Estes consertam bugs do `chrisvel/tududi`, não são features deste fork. São os
únicos candidatos naturais a PR upstream — cada um aceito lá sai do delta daqui
para sempre.

| Commit | O quê |
|---|---|
| `51b43544` | `add-goal-columns-to-projects` idempotente |
| `53feb397` | `add-people-to-tasks` e `add-color-to-people` idempotentes |
| `a598aa3e` | `isAdmin()` resolve usuário por `id` numérico **ou** `uid` — quebrava login OIDC/SSO |
| `36fe379a` | Usuário criado em teste deixa de virar admin silenciosamente |
| `ef690f67` | `db-init` para de zerar o banco a cada boot |
| `1a095535` | Fim do `PRAGMA foreign_keys = OFF` global no delete de tarefa |

As três primeiras migrations lançavam erro de SQL em re-execução, travando o
boot do container em qualquer deploy iterativo.

## Localização PT-BR

A maior fonte de conflito com o upstream: boa parte destes commits **substitui
texto hardcoded em inglês por `t()`**. O upstream segue com o hardcode, então
todo commit dele que toca esses componentes conflita.

| Commit | O quê |
|---|---|
| `f071873c` | Carga inicial de chaves PT |
| `67f3762e` | Habits e People |
| `16eb116f` | Bot do Telegram (comandos, notificações, digests) |
| `402ccc68` | Formatação de data PT-BR em Today e Calendar |
| `18e8a171` | Revisão ortográfica e padronização de caixa |
| `6febc958` | Chaves faltantes; fim do ALL CAPS na sidebar |
| `bc7229ee` | Telas secundárias e modais |
| `01de94b5` | Tela de tarefa (anexos, "Atribuído a", caixa de datas) |
| `192cbda2` | Texto restante em modais, filtros e utils |
| `350ddeb7` | Chaves referenciadas dinamicamente no código |
| `0728a580` | `check-i18n` só falha em drift do PT; demais 23 idiomas viram warning |

## Object storage no Cloudflare R2

Anexos, avatares, capas e branding saem do disco local efêmero.

| Commit | O quê |
|---|---|
| `f93153cf` | `r2Service.js` (`@aws-sdk/client-s3` + `multer-s3`); anexos, avatares e capas migram do disco |
| `af2dd3e4` | Bucket resolvido *lazy* — sem isso o boot quebra com `bucket is required` quando o R2 não está configurado |
| `fe4e1651` | Deletar tarefa remove do bucket os anexos dela, das subtasks e das recorrências futuras |
| `b707dce8` | Trocar/remover capa de projeto apaga o objeto antigo |
| `f40acbe8` | Deleção de objeto adiada para depois do commit da transação (`afterCommit`) |
| `09aaa778` | Nomes canônicos `CLOUDFLARE_*`, fallback para `R2_*` |
| `21cc51f6` | `putObjectFromFile` e `listObjects` no `r2Service` |

## Backup e disaster recovery

O banco é um arquivo SQLite num volume Docker. Sem isto, perder o host perde tudo.

| Commit | O quê |
|---|---|
| `ec4544ee` | Backup lógico num volume persistente |
| `0c9332b7` | Snapshot via `VACUUM INTO` + upload pro R2, com retenção |
| `d21f8790` | Agendamento por `node-cron` |
| `3ef1c2cd` | Restore **executado de verdade** e documentado ([backups.md](backups.md)) |

## Branding por instância

| Commit | O quê |
|---|---|
| `887e4862` | Nome, logos (claro/escuro) e favicon customizáveis por admin, com fallback |
| `86edfbec` | Lint/formatação |

## Refatorações estruturais

Segunda maior fonte de conflito — e a pior, porque o conflito é **semântico**,
não textual: o upstream mexe em arquivos que aqui não existem mais.

| Commit | O quê |
|---|---|
| `e1738ce2` | `BaseRepository` removido; 13 repositórios viram classes planas; cascade nativo no banco |
| `8f86039a` | Módulo tasks: `routes.js` de 1064 para 39 linhas via `controller.js` + `service.js` |

## Infra, CI e Docker

| Commit | O quê |
|---|---|
| `5310631d` | CI no GitHub Actions: testes frontend, typecheck, `npm audit` |
| `44c0ba25` | Compose buildando do fork, env 100% interpolada do `.env` |
| `d553e1b7` | Artefatos do GitHub Pages do upstream removidos (`index.html`, `CNAME`, `.nojekyll`, `screenshots/`) |
| `989d2fe0`, `3741b706` | Lint/formatação |

## Testes

| Commit | O quê |
|---|---|
| `61c36075` | Testes de caracterização do `RecurrenceDisplay` |
| `d3b6b58c` | `BrandingTab` e o guarda de avatar (`getSafeAvatarUrl`) |

## Cloudflare D1 — tentado e **revertido**

Não existe mais no código. Fica registrado porque os commits estão na história e
a lição custou caro: o D1 faz **1 round-trip HTTP por statement** (telas de 5-30s,
sem transação real, sem pool) e a operação zerou o banco de produção duas vezes.
Registro completo em [`plans/09a-d1-code-removal.md`](../plans/09a-d1-code-removal.md).

| Commit | O quê |
|---|---|
| `5e705e8b` | Driver sqlite3-compatível via `dialectModule` + client HTTP com retry e rate limiter |
| `753b826a` | Correções da primeira ativação real |
| `06b04667` | `.env.example` com setup de tokens Cloudflare |
| `7782d689` | **Remoção do código** |
| `30f00551` | **Remoção das referências na doc** |

Sobreviveu à remoção: o `.env.example` e os nomes `CLOUDFLARE_*` (a parte R2).

## Governança e documentação

`/plans` — planos executáveis por agentes, e o registro das decisões.

| Commit | O quê |
|---|---|
| `e6de6648`, `e1624ee2`, `3fdb7911`, `b137dc93`, `b13d387b` | Workflow do `/plans`: subplans por esforço, regras de execução, `read the @plans/README.md` como gatilho |
| `3bb1e213`, `55c462cd` | Planos do D1 descartados; remoção e backup R2 planejados |
| `8a620172`, `bf7e99f0` | `05a` implementado; status EXECUTADO |
| `feebf50b`, `656bf687`, `5565d758` | `/docs` e `CLAUDE.md` alinhados ao código |
| `1e9d9e7c` | README realinhado (D1 saiu, backup entrou) |

### Ruído (registrado como lição, não como feito)

| Commit | O quê |
|---|---|
| `dec60bd3`, `cc5cb740`, `b46a04ff`, `1316a2e0` | Churn do README |
| `6d4b31c4`, `aec32dc4`, `bf8bf593`, `1ded0189`, `299c73b2` | Só atualizam a contagem de commits no README |

Nove commits em documentação que `git log` já entregava de graça. É por isso que
este arquivo traz o comando de regeneração em vez de um número escrito à mão.

## Merges de sincronização

| Commit | O quê |
|---|---|
| `a11fa2dc` | Upstream até v1.2.3 (#1268, #1269) |
| `d038ebc6` | Upstream v1.2.4 |

Política atual de sincronização: [`../git-review.md`](../git-review.md).
