<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/wide-logo-light.png">
    <source media="(prefers-color-scheme: light)" srcset="public/wide-logo-dark.png">
    <img src="public/wide-logo-light.png" alt="tududi" width="350">
  </picture>
</p>

<h1 align="center">Tududi — Fork PT-BR</h1>

<p align="center">
  Fork pessoal de <a href="https://github.com/chrisvel/tududi">chrisvel/tududi</a>, self-hosted.<br>
  Localização integral em PT-BR, storage em nuvem, backup offsite e correções de estabilidade.
</p>

---

## O que é

Gerenciador de tarefas self-hosted (Areas > Goals > Projects > Tasks), rodando
em Docker para uso pessoal. Este fork diverge do upstream em quatro frentes:

- **PT-BR de verdade** — interface, formatação de datas e bot do Telegram. Boa
  parte disso foi substituir texto hardcoded em inglês por `t()`.
- **Cloudflare R2** — anexos, avatares, capas e branding saem do disco local
  efêmero do container.
- **Backup offsite** — snapshot do SQLite pro R2, agendado, com restore testado.
- **Estabilidade** — migrations idempotentes, `isAdmin` funcionando com OIDC, e
  o fim do `db-init` que zerava o banco a cada boot.

**Lista completa commit a commit**: [docs/fork-changelog.md](docs/fork-changelog.md)
(68 commits à frente de `upstream/main`).

Sincronização com o upstream é **eventual e seletiva**, não rotineira — ver
[git-review.md](git-review.md).

---

## Rodando

### Docker (uso normal)

O [`docker-compose.yml`](docker-compose.yml) versionado aqui builda de
`github.com/luciancsilva/tasks.git#main` — ele sobe a `main` do GitHub, **não o
seu working tree**. Configure o `.env` (ver [`.env.example`](.env.example)) e:

```bash
docker compose up -d
```

App em **http://localhost:3002**.

Variáveis: as `TUDUDI_*` de sempre, mais `CLOUDFLARE_R2_*` (storage) e
`TUDUDI_DB_BACKUP_*` (snapshot pro R2). Todas documentadas no `.env.example`.

### Desenvolvimento local

```bash
git clone git@github.com:luciancsilva/tasks.git
cd tasks
npm install
npm run db:init       # SÓ na primeira vez — ver o aviso abaixo
npm start             # frontend :8080, backend :3002
```

Testes: `npm run backend:test` (114 suítes / 1644 testes) e
`npm run frontend:test` (6 / 96).

> ### ⚠️ `npm run db:init` apaga o banco inteiro
>
> `db:init` e `db:reset` são `sequelize.sync({ force: true })` — DROP de todas as
> tabelas. São o jeito certo de criar um banco **que ainda não existe**, e a
> forma mais rápida de destruir um que existe. Foi esse comando, disparado no
> boot, que zerou a produção duas vezes em julho/2026.
>
> - **Banco já existe** → nunca `db:init`. Use **`npm run db:migrate`** para
>   aplicar migrations pendentes.
> - **Inspecionar** → **`npm run db:status`** (só lê).
>
> **`db:migrate` não substitui `db:init` num banco vazio.** Bootstrapar só por
> migrations gera schema quebrado em silêncio: a primeira migration da ordem
> alfabética (`20250116...-add-first-day-of-week-to-users`) roda antes da que
> cria a tabela `users` (`20250615...`), não acha a tabela, pula, e é marcada
> como executada — a coluna nunca aparece. O container faz `db:init` e só depois
> migra, por isso funciona.

---

## Documentação

| Arquivo | O quê |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Arquitetura, padrões e índice de todo o `/docs` |
| [docs/fork-changelog.md](docs/fork-changelog.md) | O que este fork tem que o upstream não tem |
| [git-review.md](git-review.md) | Política de sincronização com o upstream |
| [plans/README.md](plans/README.md) | Planos executáveis por agentes + armadilhas do repo |
| [docs/backups.md](docs/backups.md) | Backup do banco e procedimento de restore |
| [docs/15-storage.md](docs/15-storage.md) | Object storage no R2 |
| [docs/16-branding.md](docs/16-branding.md) | Branding por instância |
| [docs/MEMORY.md](docs/MEMORY.md) | Convenções de commit e teste deste fork |

Documentação de usuário final (upstream): [docs.tududi.com](https://docs.tududi.com).
