# /plans — planos de trabalho executáveis por agentes

Diretório de planos de implementação deste fork. Serve tanto para humanos quanto
para agentes de IA (Claude Code, etc.) que forem executar trabalho aqui.

## Racional

- **Um plano = uma unidade de trabalho commitável.** Cada arquivo descreve algo
  que pode ser implementado, testado e commitado de forma independente.
- **Planos citam código real** (`arquivo:linha`), nunca generalidades — o agente
  executor não deve precisar re-investigar o que o plano já investigou, apenas
  validar que as referências continuam verdadeiras.
- **Ciclo de vida**: proposto → executado → **removido do diretório**. Plano
  executado sai daqui no mesmo commit (ou no seguinte) da implementação; o
  histórico fica no git. Plano permanente vira doc em `/docs`, não mora aqui.
- **Numeração**: prefixo `NN-` define ordem sugerida de leitura/execução;
  sufixos de letra (`05a`, `05b`) agrupam segregações de um mesmo levantamento.

## Estado atual

| Arquivo | O quê | Esforço |
|---|---|---|
| `05-future-improvements.md` | Índice do levantamento de melhorias | — |
| `05a-quick-wins.md` | 5 itens de esforço baixo | Baixo |
| `05b-medium-effort.md` | 6 itens de esforço médio | Médio |
| `05c-high-effort.md` | 3 itens estruturais | Alto |
| `06-docs-update.md` | Atualização integral do `/docs` | Médio |

Planos 000–04 (bugs de R2, branding, migração D1) foram executados nos commits
`fe4e165`, `b707dce`, `887e486`, `5e705e8` e removidos; conteúdo no histórico git.

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

- Lint global (`npm run backend:lint`) falha com milhares de `Delete ␍` em
  checkout Windows (CRLF) — ruído pré-existente; lintar os arquivos tocados
  individualmente e ignorar exclusivamente esse erro.
- Modo D1 (`TUDUDI_DB_DRIVER=d1`): transações são no-op (ver
  `backend/db/d1RestDriver.js`); não construir fluxo novo que dependa de
  rollback sem ler `05c` HE-3.
- `docs/MEMORY.md` guarda preferências de PR/commit/testes do repositório.
