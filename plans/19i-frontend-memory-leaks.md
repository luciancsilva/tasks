# 19i — Limpeza de Timers (`clearTimeout`) e Prevenção de Memory Leaks no Frontend

> **Status: PROPOSTO** em 2026-07-17
> **Escopo:** Garantir a limpeza de timers (`clearTimeout`) em `usePersistedModal.ts`, `Areas.tsx`, `AreaModal.tsx` e `ProfileSettings.tsx`.
> **Depende de:** -

## Diagnóstico
Timers `setTimeout` são instanciados sem o respectivo `clearTimeout` no cleanup ou antes de novas chamadas:
1. `usePersistedModal.ts:59`: `openModal` grava em `timeoutRef.current = setTimeout(...)`, sem abortar timer prévio se invocado repetidamente.
2. `Areas.tsx:67-74` e componentes em `Shared/`: modais/dropdowns abrem `setTimeout` de 100ms para registrar `addEventListener`, podendo disparar ou acumular listeners se fechados antes de 100ms.
3. `AreaModal.tsx:54`: `setTimeout(() => nameInputRef.current?.focus(), 100)` não é limpo na desmontagem.
4. `ProfileSettings.tsx:667`: `setTimeout(() => handleStartPolling(), 1000)` agendado no `useEffect` sem função de retorno `return () => clearTimeout(...)`.

### Impacto
Se o usuário fechar uma modal ou navegar para fora de `ProfileSettings.tsx` em menos de 1 segundo, o timer é acionado sobre um componente desmontado, disparando requisições de rede em segundo plano e tentando atualizar o estado de um componente inexistente (`React state update on an unmounted component`), além de reter referências na memória.

## Implementação Proposta

1. Em `usePersistedModal.ts:48`:
   ```typescript
   const openModal = () => {
       if (timeoutRef.current) clearTimeout(timeoutRef.current);
       // ...
       timeoutRef.current = setTimeout(() => { ... }, MODAL_TIMEOUT);
   };
   ```
2. Em `AreaModal.tsx:54`:
   ```typescript
   useEffect(() => {
       if (isOpen) {
           const timer = setTimeout(() => {
               nameInputRef.current?.focus();
           }, 100);
           return () => clearTimeout(timer);
       }
   }, [isOpen]);
   ```
3. Em `ProfileSettings.tsx:667`:
   ```typescript
   useEffect(() => {
       let timerId: NodeJS.Timeout;
       // ... dentro de fetchTelegramInfo:
       if (!pollingData.status?.running) {
           timerId = setTimeout(() => {
               handleStartPolling();
           }, 1000);
       }
       // ...
       return () => {
           if (timerId) clearTimeout(timerId);
       };
   }, [profile?.telegram_bot_token]);
   ```

## Critério de Pronto
- `npm run frontend:test` limpo.
- Teste unitário de hook (`usePersistedModal.test.ts`) ou de componente confirmando que a desmontagem imediata aborta chamadas pendentes.
