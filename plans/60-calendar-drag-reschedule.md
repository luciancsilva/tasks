# 60 — Calendar drag-to-reschedule + drag-to-create

> **Status: PROPOSTO** — Calendar view (`Calendar.tsx`) mostra events de due_date (azul/verde) e defer_until (amber), sem drag. Hoje usa native HTML5 DnD em `CalendarMonthView.tsx:82-102` (handleDragStart/drop). Decisão aprovada: drag muda due_date + drag-to-create.
> **Esforço:** Alto · **Natureza:** julgamento médio · **Modelo:** médio
> **Branch:** `feat/60-calendar-drag` a partir da `main` · **Depende de:** -

## Contexto

Refs:
- `Calendar.tsx` `convertTasksToEvents` `:81-120` — event id `task-${id}` (due) / `task-defer-${id}` (defer).
- `CalendarMonthView.tsx` — native DnD `handleDragStart` `:82-87`, `handleDrop` `:96-102`, event div `draggable` `:164`, `onEventDrop(eventId, day)` prop `:32`.
- `Calendar.tsx` `handleEventDrop` `:205-264` — parse taskId, update `defer_until` ou `due_date`, chama `updateTask`.
- `@dnd-kit/core ^6.3.1` já dep (`package.json:76`).
- Day cell render `CalendarMonthView.tsx:128-187`.

Decisão: substituir native DnD por dnd-kit (mais robusto, acessível, já dep). Drag muda `due_date` only (defer não-draggable). Drag-to-create: drag em slot vazio cria task com `due_date=slot`.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. CalendarMonthView — dnd-kit
`frontend/components/Calendar/CalendarMonthView.tsx`:

### 2a. Imports
```tsx
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
```

### 2b. Draggable event
Substituir `handleDragStart` (`:82-87`) + `draggable` attr (`:164`) por componente `DraggableEvent`:
```tsx
const DraggableEvent: React.FC<{ event: CalendarEvent; onEventClick?: (e: CalendarEvent) => void }> = ({ event, onEventClick }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: event.id });
    const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
    const isDefer = event.id.startsWith('task-defer-');
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...(isDefer ? {} : listeners)} // defer não-draggable
            {...attributes}
            onClick={() => onEventClick?.(event)}
            className={`text-xs p-1 rounded truncate ${event.color} ${!isDefer ? 'cursor-grab' : ''}`}
        >
            {event.title}
        </div>
    );
};
```
Só events de due_date (`task-${id}`, não `task-defer-`) são draggable. Defer events são display-only.

### 2c. Droppable day cell
Substituir `handleDrop` (`:96-102`) + `onDragOver`/`onDrop` no cell (`:128-187`) por `DroppableCell`:
```tsx
const DroppableCell: React.FC<{ day: Date; events: CalendarEvent[]; onDateClick?: (d: Date) => void; onEventClick?: (e: CalendarEvent) => void; onEventDrop?: (eventId: string, day: Date) => void; onCreateOnDay?: (day: Date) => void }> = ({ day, events, onDateClick, onEventClick, onEventDrop, onCreateOnDay }) => {
    const { setNodeRef, isOver } = useDroppable({ id: `cell-${day.toISOString()}` });
    return (
        <div ref={setNodeRef} onClick={() => onDateClick?.(day)} className={`min-h-[80px] p-1 border ${isOver ? 'bg-blue-100 dark:bg-blue-900' : ''}`}>
            <span className="text-xs">{day.getDate()}</span>
            <div className="mt-1 space-y-0.5">
                {events.slice(0, 3).map(e => <DraggableEvent key={e.id} event={e} onEventClick={onEventClick} />)}
                {events.length > 3 && <span className="text-xs text-gray-400">+{events.length - 3}</span>}
            </div>
            {/* drop-to-create: quando cell vazia recebe drop sem event id, criar task */}
        </div>
    );
};
```

### 2d. DndContext wrapper
No render do grid (`:119`), envolver com:
```tsx
const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

<DndContext
    sensors={sensors}
    onDragEnd={(e) => {
        const eventId = e.active.id as string;
        const droppable = e.over?.id as string;
        if (droppable?.startsWith('cell-')) {
            const day = new Date(droppable.replace('cell-', ''));
            onEventDrop(eventId, day);
        }
    }}
>
    {/* grid de DroppableCell */}
</DndContext>
```

### 2e. Drag-to-create
Adicionar `onCreateOnDay` prop. No `DroppableCell`, quando cell vazia (0 events) recebe **double-click** (não drag de vazio — drag precisa de source), abrir modal new task com `due_date=day`:
```tsx
onDoubleClick={() => onCreateOnDay?.(day)}
```
Drag-to-create puro (drag de slot vazio) é estranho sem source. Usar double-click-to-create (mais natural) + drag-to-move. Documentar: "drag-to-create" vira "double-click-to-create" (mesma intenção UX).

## 3. Calendar.tsx — handler
`handleEventDrop` (`:205-264`): já parse taskId e update `due_date`. Manter. Adicionar `handleCreateOnDay`:
```tsx
const handleCreateOnDay = (day: Date) => {
    openTaskModal({ due_date: day.toISOString().split('T')[0] });
};
```
Passar `onCreateOnDay` ao `CalendarMonthView`.

## 4. Frontend — TaskModal pré-preenchido
Confirmar que `NewTask`/`TaskModal` aceita `due_date` pré-setado (ver `TaskDetails.tsx` isNew flow). Se não, adicionar prop `initialDueDate`.

## 5. Testes — frontend
`frontend/__tests__/`:
- `CalendarMonthView` com dnd: arrastar event de day1 para day2 chama `onEventDrop(eventId, day2)`.
- Double-click em cell vazia chama `onCreateOnDay(day)`.
- Defer event não é draggable (listeners vazios).

## 6. Lint
```bash
cd frontend && npx eslint --fix components/Calendar/CalendarMonthView.tsx components/Calendar.tsx
```

## Critério de pronto
- [ ] Drag de event (due_date) para outro dia → PATCH task com novo due_date.
- [ ] Defer events não-draggable.
- [ ] Double-click em cell vazia → abre new task com due_date=day.
- [ ] dnd-kit substitui native DnD; PointerSensor com activation distance 5px (não conflita com click).
- [ ] Suítes verde; lint limpo.

## Commit
`feat(calendar): drag-to-reschedule due_date and double-click-to-create` — "Implements plans/60". Branch `feat/60-calendar-drag`, sem merge/push.

## Fora de escopo
- Drag para mudar defer_until (tickler não-visualmente re-agendado).
- Drag para criar com duração (event span).
- Resize event (multi-day).
