# Sincronização com o upstream

Política deste fork em relação a `chrisvel/tududi`. Vale para humanos e para
agentes de IA.

## Posição: hard fork de fato

**Não sincronize por rotina.** Este fork está 68 commits à frente do upstream e
o que vem de lá entrega pouco valor para este uso. Tempo passar não é motivo
para fazer merge.

Sincronize apenas quando houver **um motivo nomeado**:

- correção de segurança no upstream;
- um bug que te afeta e que já foi corrigido lá;
- uma feature específica que você quer.

Em qualquer um dos três: traga **aquele commit**, não a branch.

## Antes de qualquer coisa: meça

O número que importa não é "quantos commits estou à frente" — é quantos commits
do upstream faltam entrar, e se eles tocam nas áreas que este fork reescreveu.

```bash
git fetch upstream
git rev-list --count main..upstream/main    # o que falta entrar (custo real)
git log --oneline main..upstream/main       # o que é
```

Se o resultado for zero, não há trabalho. Estar à frente não gera pendência.

## Mapa de conflito — onde vai doer

Duas áreas deste fork conflitam com quase todo commit upstream que as toque.
Saber disso antes economiza a tentativa:

**i18n (conflito textual, garantido).** Este fork substituiu texto hardcoded em
inglês por `t()` em dezenas de componentes. O upstream segue com o hardcode.
Qualquer commit dele nesses arquivos conflita.

**Refatorações estruturais (conflito semântico, pior).** `BaseRepository` não
existe mais aqui (`e1738ce2`); o `routes.js` do módulo tasks tem 39 linhas aqui
e 1064 lá (`8f86039a`). O upstream mexe em arquivos que aqui não existem. O git
não avisa — o merge "passa" e o comportamento quebra.

Diante de um commit upstream nessas áreas: prefira **reimplementar a intenção** a
aplicar o diff.

## Procedimento

1. **Fetch e meça** (acima). Zero pendente = pare aqui.
2. **Working tree limpo** antes de mexer. Se houver mudança não commitada, pare
   e avise — não faça stash automático de trabalho alheio.
3. **Para cada commit candidato**, decida e registre: **Apply** (aplica limpo),
   **Adapt** (reimplementa a intenção) ou **Skip** (não interessa / já
   implementado aqui de outro jeito / depende de um Skip anterior).
4. **Traga por `cherry-pick`**, não merge. Merge arrasta o que você não avaliou.
5. **Valide**: `npm run backend:test` e `npm run frontend:test` verdes. Falhou e
   não dá pra consertar com segurança? Reverta a integração.
6. **Commit local. Push só com autorização explícita do dono** — a `main` é o
   que o Docker builda, publicar ali mexe no ambiente dele.
7. **Atualize [`docs/fork-changelog.md`](docs/fork-changelog.md)** apenas se a
   integração mudou o que o fork *é*. A contagem de commits daquele arquivo é
   gerada por comando — não a edite à mão.

## O caminho que reduz divergência de verdade

Alguns commits daqui consertam bugs **do upstream**, não são features deste fork:
migrations idempotentes (`51b43544`, `53feb397`), `isAdmin` com OIDC (`a598aa3e`),
`db-init` zerando o banco no boot (`ef690f67`).

Cada um desses aceito como PR no upstream **sai do delta daqui para sempre**. É o
único movimento que diminui a divergência em vez de mudá-la de lugar. Hoje este
fork não abre PR upstream por padrão; essa classe específica é a exceção que vale
reconsiderar.

## O que não fazer

- **Não mantenha changelog à mão.** A versão anterior desta política mandava
  atualizar o `README.md` a cada sync com a lista de diferenças commit a commit.
  Resultado: cinco commits que só mexiam num número (`6d4b31c4`, `aec32dc4`,
  `bf8bf593`, `1ded0189`, `299c73b2`) e a contagem ainda assim errada — dizia 51
  quando eram 66. `git log` já faz isso de graça e sem mentir.
- **Não faça merge de `upstream/main` inteiro** para "ficar em dia". Foi assim
  que o delta virou uma superfície de conflito em vez de uma lista de escolhas.
- **Não rode `npm run db:init`/`db:reset`** para "preparar o ambiente". São
  `sequelize.sync({ force: true })`. Ver [plans/README.md](plans/README.md#armadilhas).

## Relatório esperado

Ao final de uma sincronização, entregue: commits avaliados, decisão e
justificativa de cada um, operações git feitas, conflitos e como foram
resolvidos, resultado dos testes, e riscos remanescentes.
