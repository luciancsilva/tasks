# /plans — planos de trabalho executáveis por agentes

Diretório de planos de implementação deste fork. Serve tanto para humanos quanto
para agentes de IA (Claude Code, etc.) que forem executar trabalho aqui.

## Instruções ao agente — COMECE AQUI

**Ler este arquivo É a instrução de trabalho.** Se o usuário só mandou
"read the @plans/README.md" (ou equivalente), não espere mais contexto:
siga os passos abaixo imediatamente.

1. Leia este arquivo inteiro e o `CLAUDE.md` da raiz.
2. Liste ao usuário os planos **Abertos** (tabela abaixo) com uma linha de
   descrição cada e **pergunte em qual plano (ou item de plano) vai trabalhar** —
   não escolha sozinho.
3. Confirmado o plano, execute-o do início ao fim **sem pausar para pedir
   aprovação entre etapas**, seguindo as "Regras para o agente executor"
   abaixo (baseline de testes → implementação → testes/lint → um commit por
   item citando o plano → marcar EXECUTADO/atualizar tabelas).
4. Só interrompa por decisão que apenas o dono do repositório pode tomar
   (credencial, escolha de produto, mudança de API pública).
5. Ao final, entregue resumo: o que foi feito, resultado dos testes, desvios.
6. Antes de qualquer comando fora de `NODE_ENV=test`, leia os "Avisos
   permanentes".

## Racional

- **Um plano = uma unidade de trabalho commitável.** Cada arquivo descreve algo
  que pode ser implementado, testado e commitado de forma independente.
- **Planos citam código real** (`arquivo:linha`), nunca generalidades — o agente
  executor não deve precisar re-investigar o que o plano já investigou, apenas
  validar que as referências continuam verdadeiras.
- **Ciclo de vida**: proposto → executado → **marcado como EXECUTADO** (banner
  no topo com o commit da implementação) e mantido como registro de decisão.
  Saem do diretório: planos descartados, consumidos sem valor de registro
  (ex.: prompts de planejamento) e **planos de tecnologia removida do código** —
  nesse caso a história e a decisão ficam registradas no plano de remoção
  (exceção aplicada em 2026-07-17 ao remover o Cloudflare D1, ver `09`).
  Conteúdo permanente vira doc em `/docs`.
- **Numeração**: prefixo `NN-` é **identidade, não posição** — mensagens de
  commit citam o plano pelo número ("Implements plans/05b ME-1"), então um número
  aponta para sempre ao mesmo trabalho. **Números não são reciclados**: buracos
  na sequência (hoje 04, 07, 08) são planos removidos, e reusá-los faria um
  commit antigo apontar para um plano que não é o dele. Sufixos de letra
  (`05a`, `05b`) agrupam segregações de um mesmo levantamento. Ordem de execução
  é a das tabelas abaixo, não a do número.

## Estado atual

### Abertos — por esforço

| Esforço | Arquivo | O quê |
|---|---|---|
| Baixo | `11-backup-dir-volume.md` | Backup lógico grava em diretório efêmero (`/app/backend/backups`, fora de volume) |
| Médio | `09-d1-removal.md` | Remover a camada de dados Cloudflare D1 do código (~500 linhas + wiring) |
| Médio | `10-db-backup-r2.md` | Snapshot periódico do SQLite no R2 (disaster recovery offsite) |
| Médio | `06-docs-update.md` | Atualização integral do `/docs` |
| Alto | `05c-high-effort.md` | 2 itens estruturais: extrair service/controller do tasks (HE-1), cobertura de testes frontend (HE-2) |
| — | `05-future-improvements.md` | Índice do levantamento de melhorias (não é trabalho; aponta os 05x) |

### Executados — registro de decisão

| Arquivo | O quê | Status |
|---|---|---|
| `01-r2-cover-cleanup.md` | Capa de projeto órfã no R2 | EXECUTADO (`b707dce`) |
| `02-r2-task-cleanup.md` | Anexos órfãos ao deletar tarefa | EXECUTADO (`fe4e165`) |
| `03-branding-customization.md` | Logo/favicon/nome customizáveis | EXECUTADO (`887e486`) |
| `05a-quick-wins.md` | 5 itens de esforço baixo | EXECUTADO (2026-07-16) |
| `05b-medium-effort.md` | 4 itens de esforço médio | EXECUTADO (2026-07-16) |

## Regras para o agente executor

1. **Antes de começar**: ler `CLAUDE.md` (aponta os docs de arquitetura e
   convenções) e o plano inteiro. Validar as referências `arquivo:linha` do
   plano contra o código atual — se divergirem muito, atualizar o plano antes
   de implementar.
2. **Baseline**: rodar `npm run backend:test` antes de qualquer mudança e
   registrar o resultado. Suíte vermelha na baseline = parar e reportar.
3. **Escopo**: implementar somente o que o plano descreve. Descoberta nova no
   caminho vira plano novo (ou item num subplan `05x` **aberto**), não scope
   creep — e nunca item novo em plano já EXECUTADO, que o reabriria.
4. **Testes**: toda mudança de comportamento ganha teste de integração seguindo
   os padrões existentes (`backend/tests/integration/`, mock R2 via
   `aws-sdk-client-mock`, ver `task-attachments.test.js`). Rodar a suíte
   completa + lint dos arquivos tocados antes do commit.
5. **Commit**: um commit por plano (ou por item, nos subplans 05x), mensagem
   convencional (`fix:`/`feat:`/`refactor:`), corpo citando o plano
   (ex.: "Implements plans/05b ME-1"). Sem emojis, sem `Co-authored-by`
   (preferências em `docs/MEMORY.md`).
6. **Encerramento**: remover do plano o item executado (ou o arquivo inteiro,
   se esgotado) no mesmo commit; atualizar o índice `05-future-improvements.md`
   e as tabelas "Estado atual" deste README.
7. **Bloqueio**: só interromper por decisão que exige o dono do repositório
   (credencial, escolha de produto, mudança de API pública). O resto: decidir
   pelo padrão já documentado e registrar o desvio no commit/resumo.

## Ordem sugerida de execução (hoje)

1. `09-d1-removal.md` — tira código morto do caminho; os planos abaixo mexem em
   `config.js`/`models` e ficam mais simples sem os branches de D1.
2. `11-backup-dir-volume.md` — quick win; o repo hoje não tem backup nenhum
   confiável.
3. `10-db-backup-r2.md` — disaster recovery de verdade (offsite).
4. `06-docs-update.md` — docs alinhados antes das refatorações grandes; validar
   antes o status real dos itens (parte parece já executada).
5. `05c` — estruturais; HE-1 (módulo tasks) é o de maior risco no repo.

## Avisos permanentes ao executor

- **O banco é SQLite local**: `/app/db/production.sqlite3` no container, via
  volume `tududi_db`. O Cloudflare D1 foi tentado e revertido em 2026-07-17
  (latência inviável por REST + wipe recorrente); o código do driver ainda está
  no repo até `09-d1-removal.md` ser executado, mas **desligado**
  (`TUDUDI_DB_DRIVER=` vazio). Não religar sem ler o `09` §Registro.
- **Nunca decidir "o banco existe?" por artefato local** (arquivo, volume, path)
  se o banco for remoto — nenhum deles descreve um banco remoto. Essa confusão
  zerou o banco de produção duas vezes em 2026-07-16/17 (`09` §Registro).
- Lint global (`npm run backend:lint`) falha com milhares de `Delete ␍` em
  checkout Windows (CRLF) — ruído pré-existente; lintar os arquivos tocados
  individualmente e ignorar exclusivamente esse erro.
- Env vars Cloudflare: nomes canônicos `CLOUDFLARE_*` (legados `R2_*` aceitos
  como fallback); setup documentado em `.env.example`. **`CLOUDFLARE_ACCOUNT_ID`
  é usada pelo R2** para montar o endpoint — não remover junto com o D1.
- `docs/MEMORY.md` guarda preferências de PR/commit/testes do repositório.
- Segredos nunca entram em commit: `.env` e `AGENTS.md` são gitignored
  (AGENTS.md existe só neste checkout).
