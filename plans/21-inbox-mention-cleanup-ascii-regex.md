# 21 — Resto de `@pessoa` acentuada sobra no título ao criar tarefa pelo Inbox

> **Status: EXECUTADO** em 2026-07-17
> **Escopo:** Trocar o fallback de limpeza de texto em
> `frontend/components/Inbox/QuickCaptureInput.tsx:1102-1108` (`getCleanedContent`)
> de regex por char-class ASCII para remoção por token inteiro, no mesmo padrão
> já usado no backend (`cleanTextFromTagsAndProjects`,
> `backend/modules/inbox/inboxProcessingService.js:294-324`).
> **Depende de:** -
> **Origem:** reportado pelo dono — `@pessoa` com acento (nomes PT-BR: João,
> Márcia, Inês...) deixa resto no título da tarefa criada pelo Inbox, ao
> contrário das tags, que saem limpas.

## Diagnóstico

Ao criar tarefa/nota direto do Inbox (`handleSubmit`,
`QuickCaptureInput.tsx:1436`), o título final vem de
`getCleanedContent(trimmedText)`. Essa função tem dois caminhos:

```javascript
const getCleanedContent = (text: string): string => {
    if (analysisResult && lastAnalyzedTextRef.current === text.trim()) {
        return analysisResult.cleaned_content;   // caminho bom: backend, token inteiro
    }
    return cleanQuickCaptureText(text);          // caminho bom: limpa por tokenização/espaço
};
```

O caminho bom (`analysisResult.cleaned_content`) vem de
`cleanTextFromTagsAndProjects` no backend, que tokeniza por espaço e descarta o
**token inteiro** se começar com `#`/`+`/`@` — não importa o que vem depois,
então nomes acentuados saem limpos.

O caminho anterior de fallback (usado sempre que a análise debounced de 300ms
(`QuickCaptureInput.tsx:1180-1220`) ainda não terminou no momento do Enter)
usava regex por classe de caractere `[a-zA-Z0-9_-]`, que **não inclui acentos**. Em `@Márcia`, o regex casava só `@M` (o `á` quebrava a classe), e o
resto — `árcia` — permanecia solto no texto "limpo".

Foi corrigido também o descasamento de comparação: `lastAnalyzedTextRef.current` passou a gravar `text.trim()` (`QuickCaptureInput.tsx:1202`), e `getCleanedContent` passou a comparar contra `text.trim()` (`QuickCaptureInput.tsx:1103`), aumentando o cache hit e reduzindo fallbacks desnecessários.

### Impacto

Toda tarefa/nota criada pelo Inbox com `@pessoa` de nome acentuado sairá com o título limpo independentemente de a análise assíncrona ter concluído ou não.

## Implementação Proposta

1. Reescrever o fallback de `getCleanedContent` para tokenizar por espaço e
   descartar token inteiro que comece com `#`/`+`/`@`, no mesmo padrão de
   `cleanTextFromTagsAndProjects` (backend) — elimina a dependência de
   char-class e cobre qualquer alfabeto, não só acentos PT-BR. Tratar aspas
   (`@"Nome Completo"`) do mesmo jeito que o backend trata
   (`inboxProcessingService.js:266-272`).
2. Corrigir o descasamento trim vs não-trim em
   `lastAnalyzedTextRef.current` (`QuickCaptureInput.tsx:1202`) e nas verificações (`QuickCaptureInput.tsx:1103`).

## Critério de Pronto

- `npm run frontend:test` limpo.
- Teste unitário de `getCleanedContent` (ou do fluxo de submit) cobrindo
  `@Márcia`, `@João`, `#tag-acentuada` — confirma que nada sobra no texto
  limpo, inclusive no caminho de fallback (sem `analysisResult`).
- Teste manual: digitar e submeter rápido (antes do debounce) um item com
  `@pessoa` acentuada, conferir que o título da tarefa criada não tem resto.
