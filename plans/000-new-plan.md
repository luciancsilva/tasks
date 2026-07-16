\## Passo 0 — Limpeza prévia



Antes de iniciar qualquer investigação ou planejamento, apague todo o

conteúdo existente no diretório /plans deste repositório (se existir).

Esse diretório deve ficar vazio antes de você começar a gerar os novos

documentos de plano das frentes abaixo.



Preciso de um plano de implementação extremamente detalhado para cinco

frentes de trabalho neste repositório. Você NÃO deve implantar, editar ou

criar nenhum arquivo de código nesta etapa (apenas os documentos de plano

em /plans). Você também NÃO deve usar subagents ou o Task tool — toda a

investigação e o plano devem ser feitos por você mesmo, diretamente.



O banco de dados de produção está vazio atualmente, então nenhuma das

frentes abaixo precisa contemplar migração de dados reais existentes — é

greenfield.



\## Frente 1: Bug — anexos de capa/projeto não são removidos do R2



Hoje, ao deletar a imagem de capa de um projeto, ou ao deletar o projeto

inteiro, os anexos correspondentes não são removidos do bucket R2 (ficam

órfãos, ocupando espaço indefinidamente).



Investigue e documente no plano:

\- Onde no código está a lógica de exclusão de projeto (rota, controller,

&#x20; hook de modelo Sequelize)

\- Onde está a lógica de exclusão de imagem de capa especificamente

\- Por que a chamada de remoção no R2 não está sendo disparada nesses dois

&#x20; fluxos — se é ausência total de chamada, ou se existe mas falha

&#x20; silenciosamente

\- Se há relação entre pai (projeto) e filhos (anexos de tarefas dentro do

&#x20; projeto) que também precisa ser considerada nesse fluxo, ou se o escopo é

&#x20; só a imagem de capa do projeto em si

\- Proponha onde e como a chamada de exclusão no R2 deveria ser inserida

&#x20; (ex: hook `beforeDestroy`/`afterDestroy` do Sequelize, ou lógica explícita

&#x20; no controller) e os riscos de cada abordagem (ex: hook que falha silencia

&#x20; o erro vs. controller que trata explicitamente)



\## Frente 2: Bug — anexos de tarefa não são removidos do R2 ao deletar a tarefa inteira



Hoje, deletar anexos individuais de uma tarefa remove corretamente o arquivo

do R2 (esse fluxo funciona). Mas deletar a tarefa inteira não aciona a

remoção dos anexos associados a ela no R2.



Investigue e documente no plano:

\- Onde está o código do fluxo que funciona corretamente (exclusão individual

&#x20; de anexo) — esse é o padrão de referência a ser replicado

\- Onde está o código de exclusão de tarefa, e por que ele não reaproveita ou

&#x20; não dispara a mesma lógica de remoção do R2

\- Se a melhor correção é fazer a exclusão de tarefa chamar a mesma rotina

&#x20; usada na exclusão individual de anexo (reuso de código), ou se precisa de

&#x20; uma lógica separada

\- Qualquer risco de regressão: por exemplo, se a tarefa tem subtasks com

&#x20; anexos próprios, se cascata precisa ser tratada em profundidade



\## Frente 3: Feature — personalização de logo, favicon e nome da ferramenta



Quero adicionar a possibilidade de substituir o logo, o favicon e o nome

exibido da ferramenta (hoje fixo como "tududi"), configurável pelo usuário,

com fallback pro padrão atual quando nada for customizado.



Investigue e documente no plano:

\- Onde hoje o logo e o favicon estão referenciados no código (arquivos

&#x20; estáticos, componentes React, HTML base, manifest.json/PWA se existir)

\- Onde o nome "tududi" aparece hardcoded na interface (título da página,

&#x20; header, emails transacionais se houver, meta tags) — mapeie todas as

&#x20; ocorrências, não só as óbvias

\- Onde e como fica o menu de configurações hoje (estrutura de rotas/páginas

&#x20; de settings existente), pra propor a nova seção de personalização

&#x20; encaixada no mesmo padrão visual e de código já usado nas outras opções

&#x20; de configuração

\- Modelagem de dados: como armazenar essas preferências (nova tabela/campo

&#x20; em settings de usuário ou de instância — considere se personalização é

&#x20; por usuário ou global pra instância inteira, já que isso muda o design;

&#x20; se não estiver claro pelo código, aponte a ambiguidade e proponha a opção

&#x20; mais consistente com o padrão multi-usuário que o Tududi já tem)

\- Upload de logo/favicon: como isso se conecta com o fluxo de upload já

&#x20; existente (o mesmo mecanismo usado pra anexos, hoje já apontando pro R2)

&#x20; — reaproveitar esse pipeline ou justificar se precisa de tratamento

&#x20; diferente (ex: redimensionamento de imagem, validação de formato/tamanho

&#x20; específica pra logo e favicon)

\- Fallback: como garantir que, na ausência de customização, o app renderiza

&#x20; exatamente o logo/favicon/nome padrão atual sem quebrar nada

\- Internacionalização: localize o sistema de i18n já usado no restante do

&#x20; código (biblioteca, estrutura de arquivos de tradução, convenção de

&#x20; chaves) e detalhe como as novas strings dessa feature (labels do menu de

&#x20; configuração, textos de ajuda, mensagens de validação) devem ser

&#x20; adicionadas seguindo exatamente o mesmo padrão — incluindo quais idiomas

&#x20; hoje têm cobertura completa e precisam receber as novas chaves



\## Frente 4: Migração da camada de dados para Cloudflare D1 via REST API



Contexto da decisão já tomada: vou substituir o SQLite local (Sequelize)

pelo Cloudflare D1, acessado diretamente via REST API da Cloudflare

(endpoint `/accounts/{account\_id}/d1/database/{database\_id}/query`,

autenticado por API token) — sem Worker-proxy intermediário. O banco está

vazio, então não há dados reais para migrar, só a camada de código.



Quero que você detalhe minuciosamente:



1\. \*\*Inventário do estado atual\*\*: mapeie todos os models Sequelize, todas

&#x20;  as queries/associations relevantes, todas as migrations existentes, e

&#x20;  qualquer lógica que dependa de recursos específicos do SQLite local

&#x20;  (transações síncronas, funções SQLite-específicas, etc.) — inclua aqui

&#x20;  também qualquer model/tabela nova criada na Frente 3, já que ela precisa

&#x20;  nascer compatível com essa migração



2\. \*\*Escolha de ORM/camada de acesso\*\*: avalie se substituir o Sequelize

&#x20;  por Drizzle ORM (que tem suporte nativo a D1) é o caminho recomendado

&#x20;  dado o estado atual do código, ou se existe alternativa mais simples

&#x20;  dado que o acesso será via REST API HTTP (não via binding nativo de

&#x20;  Worker) — Drizzle foi pensado primariamente pra binding nativo, então

&#x20;  confirme se ele suporta bem o modo REST API HTTP também, ou se isso

&#x20;  muda a recomendação. Se não suportar bem, proponha alternativa (ex:

&#x20;  client HTTP fino e customizado sobre a REST API, com queries SQL

&#x20;  explícitas).



3\. \*\*Client de acesso ao D1 via REST API\*\*: detalhe como estruturar o

&#x20;  client HTTP (autenticação com API token, tratamento de erro, timeout,

&#x20;  parsing da resposta, tratamento do rate limit global de 1200

&#x20;  requisições/5min da conta Cloudflare)



4\. \*\*Reescrita de schema\*\*: como cada model Sequelize atual deve ser

&#x20;  traduzido para schema compatível com D1/SQLite via a ferramenta

&#x20;  escolhida, incluindo índices e chaves estrangeiras



5\. \*\*Reescrita de migrations\*\*: como recriar o sistema de migrations

&#x20;  (schema inicial) na ferramenta escolhida, já que o sistema de migration

&#x20;  do Sequelize deixa de ser usado



6\. \*\*Pontos de código a alterar\*\*: liste todos os arquivos que hoje

&#x20;  importam/usam Sequelize diretamente e precisarão ser reescritos para

&#x20;  usar a nova camada de acesso



7\. \*\*Testes\*\*: se há testes automatizados cobrindo camada de dados hoje, e

&#x20;  como eles precisarão ser adaptados (mocks de D1 via REST API em vez de

&#x20;  SQLite em memória, por exemplo)



8\. \*\*Ordem de execução recomendada\*\*: sequência lógica de implementação

&#x20;  dessa frente, com dependências entre etapas explícitas



9\. \*\*Riscos e pontos de atenção\*\*: liste explicitamente qualquer

&#x20;  funcionalidade que dependa de comportamento específico do SQLite local

&#x20;  que pode não ter equivalente direto via D1 REST API (ex: latência por

&#x20;  requisição, ausência de transação real síncrona já que é HTTP)



\## Frente 5: Revisão geral de melhorias futuras na estrutura do projeto



Depois de ter investigado a fundo o repositório pras frentes 1 a 4, faça uma

avaliação geral e independente da estrutura do projeto como um todo — não

restrita aos temas acima. Documente oportunidades de melhoria que você

identificar em: organização de pastas/módulos, dívida técnica aparente,

cobertura de testes, tratamento de erros, padrões de segurança (ex:

validação de input, gestão de segredos), performance, qualidade de

documentação interna, e qualquer duplicação ou inconsistência de padrão que

você observar comparando partes diferentes do código. Liste cada item com:

o que é, onde está (arquivo/módulo), por que importa, e um nível de

prioridade sugerido (alta/média/baixa). Não implemente nada disso — é só

um mapeamento para eu decidir o que vale perseguir depois.



\## Formato de entrega



Apresente as cinco frentes como documentos de plano separados dentro de

/plans, com nomes de arquivo claros (ex: 01-r2-cover-cleanup.md,

02-r2-task-cleanup.md, 03-branding-customization.md, 04-d1-migration.md,

05-future-improvements.md). Não pule para conclusões genéricas — cite

arquivos e trechos de código reais do repositório para embasar cada parte

do plano. Ao final, gere também um arquivo 00-resumo.md com a ordem

recomendada de execução das frentes 1 a 4 (qual deveria ser feita primeiro,

e se alguma depende de outra — note que a Frente 3 introduz estado novo que

a Frente 4 precisa contemplar, então a ordem entre elas provavelmente

importa). A Frente 5 é apenas informativa e não entra nessa ordem de

execução.



Não implemente nada. Não use subagents. Apenas apresente o plano completo

em /plans e aguarde minha aprovação antes de qualquer próximo passo.

