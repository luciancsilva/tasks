# 29 — sidebar: botão `+` em PESSOAS

> **Status: EXECUTADO** em 2026-07-18 — adicionado botão `+` de criação rápida ao lado de PESSOAS na sidebar, abrindo o `PersonModal`.
> **Esforço:** Baixo · **Natureza:** mecânico (copia padrão SidebarProjects/Tags) · **Modelo:** fraco (haiku).
> **Branch:** `main` · **Depende de:** -

## Diagnóstico

`frontend/components/Sidebar/SidebarPeople.tsx` (1-38) tem só o nav `<li>`
(20-32) linkando `/people` — **sem `+` e sem prop de modal**. Recebe apenas
`handleNavClick`/`location` de `Sidebar.tsx:123-126`.

Padrão a copiar (todos usam `PlusCircleIcon` + `stopPropagation` → abrem modal via
prop):
- `frontend/components/Sidebar/SidebarProjects.tsx:44-54` → `openProjectModal()`.
- `frontend/components/Sidebar/SidebarTags.tsx:48-59` → `openTagModal(null)`.
- `Sidebar.tsx` threa­da os openers como props (25-46, 142-147).

Modal existente a reusar: `frontend/components/People/PersonModal.tsx` +
`createPerson` (`frontend/utils/peopleService.ts`); fluxo de referência
`frontend/components/People/PeopleList.tsx` `openCreate` 113-116 / `handleSave`
77-87.

## Implementação Proposta

1. `SidebarPeople.tsx`: adicionar botão `PlusCircleIcon` com `stopPropagation`
   chamando `openPersonModal`, modelado em `SidebarProjects.tsx:44-54`.
2. `Sidebar.tsx`: threa­dar `openPersonModal` como prop (padrão dos outros
   openers) até `SidebarPeople` (123-126); montar `PersonModal` no mesmo lugar em
   que os outros modais são montados.
3. Reusar `PersonModal` + `createPerson` — não criar fluxo novo.

## Critério de Pronto

- `npm run frontend:test`.
- Teste: clicar `+` abre `PersonModal`; salvar chama `createPerson`.
- Verificação manual: `+` em PESSOAS cria pessoa e ela aparece na lista.
- Lint dos arquivos tocados.
