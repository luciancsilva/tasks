# /plans — planos de trabalho executáveis por agentes

Diretório de planos de implementação deste fork. Serve tanto para humanos quanto
para agentes de IA (Claude Code, etc.) que forem executar trabalho aqui.

## Instruções ao agente — COMECE AQUI

**Ler este arquivo É a instrução de trabalho.** Se o usuário só mandou
"read the @plans/README.md" (ou equivalente), não espere mais contexto:
siga os passos abaixo imediatamente.

1. Leia este arquivo inteiro e o `CLAUDE.md` da raiz.
2. Liste ao usuário os planos com status **Aberto** (tabela "Estado atual"
   abaixo) com uma linha de descrição cada e **pergunte em qual plano (ou
   item de plano) vai trabalhar** — não escolha sozinho.
3. Confirmado o plano, execute-o do início ao fim **sem pausar para pedir
   aprovação entre etapas**, seguindo as "Regras para o agente executor"
   abaixo (baseline de testes → implementação → testes/lint → um commit por
   item citando o plano → marcar EXECUTADO/atualizar tabelas).
4. Só interrompa por decisão que apenas o dono do repositório pode tomar
   (credencial, escolha de produto, mudança de API pública).
5. Ao final, entregue resumo: o que foi feito, resultado dos testes, desvios.
6. Antes de qualquer comando fora de `NODE_ENV=test`, leia os "Avisos
   permanentes" — o `.env` da raiz aponta para um banco D1 REAL de produção.

## Racional

- **Um plano = uma unidade de trabalho commitável.** Cada arquivo descreve algo
  que pode ser implementado, testado e commitado de forma independente.
- **Planos citam código real** (`arquivo:linha`), nunca generalidades — o agente
  executor não deve precisar re-investigar o que o plano já investigou, apenas
  validar que as referências continuam verdadeiras.
- **Ciclo de vida**: proposto → executado → **marcado como EXECUTADO** (banner
  no topo com o commit da implementação) e mantido como registro de decisão.
  Só saem do diretório planos descartados ou consumidos sem valor de registro
  (ex.: prompts de planejamento). Conteúdo permanente vira doc em `/docs`.
- **Numeração**: prefixo `NN-` define ordem sugerida de leitura/execução;
  sufixos de letra (`05a`, `05b`) agrupam segregações de um mesmo levantamento.

## Estado atual

| Arquivo | O quê | Esforço | Status |
|---|---|---|---|
| `01-r2-cover-cleanup.md` | Capa de projeto órfã no R2 | — | EXECUTADO (`b707dce`) |
| `02-r2-task-cleanup.md` | Anexos órfãos ao deletar tarefa | — | EXECUTADO (`fe4e165`) |
| `03-branding-customization.md` | Logo/favicon/nome customizáveis | — | EXECUTADO (`887e486`) |
| `04-d1-migration.md` | Camada de dados D1 via REST | — | EXECUTADO (`5e705e8`) |
| `05-future-improvements.md` | Índice do levantamento de melhorias | — | Aberto |
| `05a-quick-wins.md` | 5 itens de esforço baixo | Baixo | EXECUTADO (2026-07-16) |
| `05b-medium-effort.md` | 4 itens de esforço médio | Médio | EXECUTADO (2026-07-16) |
| `05c-high-effort.md` | 3 itens estruturais | Alto | Aberto |
| `06-docs-update.md` | Atualização integral do `/docs` | Médio | Aberto |
| `07-d1-activation.md` | Ativação do D1 em produção (migrations + smoke) | Baixo/Médio | EXECUTADO (2026-07-16) |

## Regras para o agente executor

1. **Antes de começar**: ler `CLAUDE.md` (aponta os docs de arquitetura e
   convenções) e o plano inteiro. Validar as referências `arquivo:linha` do
   plano contra o código atual — se divergirem muito, atualizar o plano antes
   de implementar.
2. **Baseline**: rodar `npm run backend:test` antes de qualquer mudança e
   registrar o resultado. Suíte vermelha na baseline = parar e reportar.
3. **Escopo**: implementar somente o que o plano descreve. Descoberta nova no
   caminho vira item novo em `05a/05b/05c` (ou plano novo), não scope creep.
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
   e a tabela "Estado atual" deste README.
7. **Bloqueio**: só interromper por decisão que exige o dono do repositório
   (credencial, escolha de produto, mudança de API pública). O resto: decidir
   pelo padrão já documentado e registrar o desvio no commit/resumo.

## Ordem sugerida de execução (hoje)

1. `05a` inteiro (quick wins — risco mínimo, valor imediato).
2. `06-docs-update.md` (docs alinhados antes das refatorações grandes).
3. `05b` na ordem ME-1 → ME-2 → ME-3 → ME-4 → ME-5 → ME-6 (ME-1 destrava os demais).
4. `05c` (estruturais; HE-1 primeiro, absorve parte de ME-4).

## Avisos permanentes ao executor

- **O D1 REAL ESTÁ LIGADO no `.env` da raiz** (`TUDUDI_DB_DRIVER=d1`, banco de
  produção `tasks` na Cloudflare). Scripts backend carregam esse `.env` como
  fallback — comando com `NODE_ENV=development|production` toca o banco REAL.
  `NODE_ENV=test` é seguro (trava em `config.d1.enabled` força SQLite local);
  a suíte Jest pode rodar à vontade. Para dev local isolado, rode com
  `TUDUDI_DB_DRIVER=` vazio no ambiente do comando.
- Lint global (`npm run backend:lint`) falha com milhares de `Delete ␍` em
  checkout Windows (CRLF) — ruído pré-existente; lintar os arquivos tocados
  individualmente e ignorar exclusivamente esse erro.
- Modo D1: transações são no-op (ver header de `backend/db/d1RestDriver.js`);
  não construir fluxo novo que dependa de rollback sem ler `05c` HE-3. Lições
  da primeira ativação: `07-d1-activation.md`.
- Env vars Cloudflare: nomes canônicos `CLOUDFLARE_*` (legados `R2_*`/`D1_*`
  aceitos como fallback); setup de credenciais documentado em `.env.example`.
- `docs/MEMORY.md` guarda preferências de PR/commit/testes do repositório.
- Segredos nunca entram em commit: `.env` e `AGENTS.md` são gitignored
  (AGENTS.md existe só neste checkout).
