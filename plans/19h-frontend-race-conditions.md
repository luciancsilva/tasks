# 19h — Prevenção de Race Conditions / Stale State no Frontend (`ProjectDetails`, `ViewDetail` e `ProfileSettings`)

> **Status: EXECUTADO** em 2026-07-17 — guardas isMounted/AbortController em ProjectDetails e ViewDetail evitam sobrescrita por resposta obsoleta; ref de polling único em ProfileSettings elimina duplo start-polling.
> **Escopo:** Adicionar `AbortController` ou verificações de montagem (`isMounted`) nas requisições assíncronas em `ProjectDetails.tsx`, `ViewDetail.tsx` e unificar a inicialização de polling em `ProfileSettings.tsx`.
> **Depende de:** -

## Diagnóstico
1. `ProjectDetails.tsx:232` (`useEffect([uidSlug])`): dispara `loadProjectData()` e seta `setProject`, `setTasks` e `setNotes` no retorno sem checar cancelamento ou desmontagem.
2. `ViewDetail.tsx:374` (`useEffect([uid])`): dispara `fetchViewAndResults()` e seta estados sem checar se o usuário já navegou para outra view.
3. `ProfileSettings.tsx:612` e `667`: concorrência entre `fetchProfile` (linha 612) e `fetchTelegramInfo` (linha 667), que tentam disparar `handleStartPolling()` em paralelo na montagem do componente.

### Impacto
1. Cliques rápidos no menu em Projetos A → B fazem com que a resposta lenta do Projeto A chegue por último e sobrescreva a tela de B, exibindo tarefas e notas de A sob a URL de B.
2. O mesmo ocorre na navegação entre visualizações personalizadas (`ViewDetail.tsx`).
3. Em `ProfileSettings.tsx`, o componente envia duas requisições `POST /api/telegram/start-polling` simultâneas, gerando race condition e toast duplicado ou erro 409/500 do backend.

## Implementação Proposta

1. Em `ProjectDetails.tsx:232`:
   ```typescript
   useEffect(() => {
       if (!uidSlug) return;
       const controller = new AbortController();
       let isMounted = true;
       const loadProjectData = async () => {
           try {
               // passar { signal: controller.signal } se fetchProjectBySlug aceitar, ou:
               const projectData = await fetchProjectBySlug(uidSlug);
               if (!isMounted) return;
               setProject(projectData);
               setTasks(projectData.tasks || projectData.Tasks || []);
               // ...
           } catch (err) {
               if (isMounted) setError(true);
           }
       };
       loadProjectData();
       return () => {
           isMounted = false;
           controller.abort();
       };
   }, [uidSlug]);
   ```
2. Aplicar o mesmo padrão `isMounted` / `AbortController` em `ViewDetail.tsx:374`.
3. Em `ProfileSettings.tsx`, introduzir um `useRef(false)` para `isPollingStartedRef` de modo que `handleStartPolling` só seja acionado uma única vez por ciclo de montagem, ou consolidar a checagem dentro de `fetchTelegramInfo`.

## Critério de Pronto
- Executar `npm run frontend:test`.
- Verificar ausência de avisos de state update no console do React em testes de transição rápida.
