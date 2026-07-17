# 20 — `SyncStateRepository.deleteByCalendarId` chama método `delete` inexistente

> **Status: EXECUTADO** em 2026-07-17 — Trocado `this.delete` por `this.destroy` em `SyncStateRepository.deleteByCalendarId` e envolvida a deleção em `calendar-controller.js:220` em transação `sequelize.transaction`.
> **Escopo:** Corrigir `deleteByCalendarId` em `backend/modules/caldav/repositories/sync-state-repository.js:201-209`, que chama `this.delete(state, options)` — método que a classe não define (só existe `destroy(instance, options)`, linha 28). Mesma família de bug do `19l`, call site diferente.
> **Depende de:** -
> **Origem:** descoberto durante investigação do `19l` (auditoria da mesma classe, à procura de `deleteByTaskId`).

## Diagnóstico

`SyncStateRepository` define `destroy(instance, options)` (linha 28) como método de
deleção de instância. Mas `deleteByCalendarId` (linhas 201-209) chama
`this.delete(state, options)`:

```javascript
async deleteByCalendarId(calendarId, options = {}) {
    const syncStates = await this.findByCalendarId(calendarId, options);
    await Promise.all(
        syncStates.map((state) => this.delete(state, options))
    );
    return syncStates.length;
}
```

`this.delete` não existe na classe (confirmado por leitura completa do arquivo — não
há alias, nem herança de outra classe). Chamada real em produção:
`backend/modules/caldav/api/calendar-controller.js:220`, ao deletar um calendário
CalDAV inteiro — apaga o registro do calendário mas a limpeza dos `CalDAVSyncState`
associados lança `TypeError: this.delete is not a function`.

### Impacto

Deletar um calendário CalDAV via API não limpa os `sync_state` órfãos (o erro
provavelmente aborta a função antes ou é engolido por try/catch no controller —
**conferir isso no controller antes de implementar**, pois muda se há rollback
parcial). Sync states apontando para um `calendar_id` que não existe mais poluem
o estado de sync.

## Implementação Proposta

1. Em `sync-state-repository.js:205`, trocar `this.delete(state, options)` por
   `this.destroy(state, options)`.
2. Conferir `calendar-controller.js:220` — se a chamada está dentro de
   `try/catch`, entender o que acontece hoje quando o `TypeError` é lançado
   (rollback? erro 500 pro usuário? falha silenciosa?) e se precisa de
   transação (mesmo padrão do `19l`, envolver deleção do calendário + limpeza
   de sync states em `sequelize.transaction`).

## Critério de Pronto

- `npm run backend:test` limpo.
- Teste (unit ou integração) que deleta um calendário com sync states associados
  e verifica que `deleteByCalendarId` completa sem `TypeError` e os sync states
  somem.
