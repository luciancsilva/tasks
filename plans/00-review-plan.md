## Contexto

Este é um fork pessoal do tududi (https://github.com/chrisvel/tududi), já com melhorias aplicadas em relação ao upstream original. O objetivo de longo prazo é transformar este fork na minha ferramenta de gestão de tarefas com foco em **GTD** (Getting Things Done), substituindo o TickTick e o mindwtr (https://docs.mindwtr.app/) no meu fluxo pessoal e profissional.

## O que eu preciso de você

Você tem liberdade para decidir a melhor forma de conduzir esse trabalho — use seu próprio critério sobre ordem, profundidade e ferramentas. Eu não quero um roteiro fixo de fases; confio no seu julgamento técnico e na sua leitura do repositório para chegar às entregas abaixo. Onde eu dou instruções mais específicas é porque são não-negociáveis; fora isso, a forma de chegar lá é com você.

As entregas que eu espero, ao final:

1. **Uma auditoria de qualidade dos commits/PRs** deste fork em relação ao upstream — o que foi bem feito, o que é dívida técnica, onde faltam testes, onde há risco de regressão. Use o nível de profundidade que você achar que o código pede.

2. **Propostas de melhorias de usabilidade**, vindas de duas fontes: (a) sua própria leitura do código e da experiência de uso, e (b) uma comparação com o que o TickTick e o mindwtr (https://docs.mindwtr.app/) oferecem hoje que este fork não oferece. Aqui eu quero seu ponto de vista de verdade — inclusive sobre o que você acha que *não* vale a pena copiar, mesmo que exista no TickTick ou no mindwtr. É uma ferramenta pessoal, não precisa perseguir paridade de features.

3. **Antes de fechar qualquer plano de implementação, me apresente as propostas e pergunte o que faz ou não sentido para mim.** Isso é obrigatório — não pule direto para gerar planos de execução sem essa validação. Como você estrutura essa conversa (tudo de uma vez, por blocos temáticos, etc.) fica a seu critério.

4. **Planos de execução detalhados** para cada iniciativa que eu validar, escritos para serem executados por um agente com bem menos autonomia e critério do que você. Isso significa: escopo bem delimitado, passos concretos, critérios claros de "pronto", e nada que dependa de julgamento próprio de quem for executar. O formato exato do plano fica a seu critério, desde que cumpra esse objetivo.

5. **Uma skill de MCP.** Se este fork expõe (ou vier a expor) um servidor MCP, revise com cuidado todas as ferramentas expostas — comportamento, parâmetros, efeitos colaterais, ordem de operações, armadilhas — e escreva uma skill que permita a um agente menos capaz usar esse MCP corretamente sem precisar explorar por tentativa e erro. Gere também o plano de execução correspondente, caso a skill precise ser instalada ou sincronizada em algum lugar específico do meu ambiente.

## Regras não-negociáveis

- Não implemente código de feature nova sem plano aprovado por mim.
- O checkpoint de validação das propostas de melhoria (item 3) é obrigatório antes de qualquer plano final.
- Documentos e planos em Markdown, em português.
- Sempre que houver uma decisão de escopo ou prioridade que dependa de mim, pergunte em vez de assumir.