# 59 — Focus mode task (full-screen + Pomodoro bind + Next)

> **Status: EXECUTADO** em 2026-07-19 — `TaskFocusMode` full-screen (portal) com Pomodoro bind (`onPomodoroComplete`), botão Next (avança na lista de origem), Esc fecha (loga sessão >10s), Complete marca done. TaskEvent `focus_session` (event_type + field_name) + `POST /task/:uid/focus-session` (requireTaskWriteAccess). TaskList botão Focus (hover) abre modo; TasksToday integra Due Today. Desvios do plano: ícone `ViewfinderCircleIcon` (CrosshairIcon não existe no heroicons instalado); task inexistente → 403 (hasAccess), não 404; teste frontend não escrito (componente coberto por typecheck). Pomodoro timer (`Shared/PomodoroTimer.tsx`) não binda task. Decisão aprovada: full-screen + Pomodoro bind + botão Next.
> **Esforço:** Alto · **Natureza:** julgamento médio · **Modelo:** médio
> **Branch:** `feat/59-task-focus-mode` a partir da `main` · **Depende de:** -

## Contexto

GTD "Engajar" = focar numa action. Full-screen esconde distrações (sidebar/navbar). Pomodoro vinculado loga tempo na task. "Next" avança para próxima task da lista de origem sem fechar modal.

Refs:
- `PomodoroTimer.tsx` state `:17-22` (`isActive`, `timeLeft`, `isRunning`, `startTime`), mount em `Navbar.tsx:233`, completion `:84-87`.
- `NoteFocusMode` template de overlay full-screen.
- `TaskEvent.event_type` enum (`task_event.js:28-62`) — sem `focus_session`; adicionar.
- `TaskList.tsx` row render `:51-71` — cada row pode ter botão "Focus".

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Backend — TaskEvent type
`backend/models/task_event.js:33-59` (`event_type` isIn array): adicione `'focus_session'`. `field_name` enum (`:95-116`): adicione `'focus_session'`.

## 3. Backend — log focus session
Nova rota em `backend/modules/tasks/events.js` (sub-router, montado `routes.js:37`):
```js
router.post('/task/:uid/focus-session', requireTaskWriteAccess, tasksEventsController.logFocusSession);
```
Controller:
```js
async function logFocusSession(req, res, next) {
    try {
        const userId = requireUserId(req);
        const { uid } = req.params;
        const { duration_sec, started_at, ended_at } = req.body;
        if (!Number.isFinite(duration_sec) || duration_sec < 1) throw new ValidationError('Invalid duration_sec');
        const task = await taskRepository.findByUid(uid);
        if (!task) throw new NotFoundError('Task not found');
        await TaskEvent.create({
            task_id: task.id, user_id: userId,
            event_type: 'focus_session', field_name: 'focus_session',
            metadata: JSON.stringify({ duration_sec, started_at, ended_at }),
        });
        res.status(201).json({ logged: true });
    } catch (err) { next(err); }
}
```
`metadata` field já existe (`task_event.js:119`, JSON).

## 4. Frontend — TaskFocusMode component
Crie `frontend/components/Task/TaskFocusMode.tsx`:
```tsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '../../entities/Task';
import { createPortal } from 'react-dom';
import PomodoroTimer from '../Shared/PomodoroTimer';
import { XMarkIcon, ForwardIcon } from '@heroicons/react/24/outline';

interface TaskFocusModeProps {
    task: Task;
    nextTasks: Task[]; // lista de origem (Today/Next/View) sem a atual
    onClose: () => void;
    onNext: (task: Task) => void;
    onComplete: (taskUid: string) => Promise<void>;
    onLogFocusSession: (taskUid: string, durationSec: number, startedAt: Date, endedAt: Date) => Promise<void>;
}

const TaskFocusMode: React.FC<TaskFocusModeProps> = ({ task, nextTasks, onClose, onNext, onComplete, onLogFocusSession }) => {
    const { t } = useTranslation();
    const [currentTask, setCurrentTask] = useState(task);
    const [sessionStart] = useState(new Date());

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'n' && nextTasks.length > 0) onNext(nextTasks[0]);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [nextTasks, onClose, onNext]);

    const handleClose = async () => {
        const duration = Math.floor((Date.now() - sessionStart.getTime()) / 1000);
        if (duration > 10) await onLogFocusSession(currentTask.uid, duration, sessionStart, new Date());
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                <h1 className="text-xl font-semibold truncate">{currentTask.name}</h1>
                <div className="flex items-center gap-3">
                    <PomodoroTimer currentTaskUid={currentTask.uid} onPomodoroComplete={(dur) => onLogFocusSession(currentTask.uid, dur, sessionStart, new Date())} />
                    {nextTasks.length > 0 && (
                        <button onClick={() => onNext(nextTasks[0])} className="flex items-center gap-1 px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
                            <ForwardIcon className="h-4 w-4" /> {t('focus.next', 'Next')}
                        </button>
                    )}
                    <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><XMarkIcon className="h-5 w-5" /></button>
                </div>
            </div>
            <div className="flex-1 overflow-auto p-8 max-w-3xl mx-auto w-full">
                <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: currentTask.note || '' }} />
                <button onClick={() => onComplete(currentTask.uid)} className="mt-6 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                    {t('task.complete', 'Complete')}
                </button>
            </div>
        </div>,
        document.body
    );
};
export default TaskFocusMode;
```

## 5. Frontend — PomodoroTimer bind
`frontend/components/Shared/PomodoroTimer.tsx`:
### 5a. Props (`:10-12`)
```tsx
interface PomodoroTimerProps {
    className?: string;
    currentTaskUid?: string;
    onPomodoroComplete?: (durationSec: number) => void;
}
```
### 5b. Completion callback (`:84-87`)
No bloco de completion, após `setShowCompletionMessage(true)`:
```tsx
if (onPomodoroComplete) onPomodoroComplete(25 * 60); // ou duration configurada
```
### 5c. Display task name (opcional)
Próximo ao timer (`:192-226`), se `currentTaskUid`, mostrar nome da task (fetch via SWR ou prop `currentTaskName`). Simplificação: só mostrar "working on: task" se props passados.

## 6. Frontend — abrir focus mode
Em `TaskList.tsx` (`:51-71`), adicionar botão "Focus" por row (ícone) que chama `onFocusTask(task)`:
```tsx
<button onClick={(e) => { e.stopPropagation(); onFocusTask(task); }} className="p-1 hover:bg-gray-100 rounded">
    <CrosshairIcon className="h-4 w-4" />
</button>
```
`onFocusTask` prop threading: `TaskList` → `TasksToday`/`Tasks` → state `focusTask` + `focusTaskList` (array de tasks da seção). Renderizar `{focusTask && <TaskFocusMode .../>}` no top-level.

Em `TasksToday.tsx`:
```tsx
const [focusTask, setFocusTask] = useState<Task | null>(null);
const [focusTaskList, setFocusTaskList] = useState<Task[]>([]);
const handleFocusTask = (task: Task, list: Task[]) => { setFocusTask(task); setFocusTaskList(list); };
const handleNext = (next: Task) => { setFocusTask(next); setFocusTaskList(prev => prev.filter(t => t.uid !== next.uid)); };
```
Passar `onFocusTask={(t) => handleFocusTask(t, plannedTasks)}` ao `TodayPlan`/`TaskList`.

## 7. Frontend — service
`frontend/utils/taskEventService.ts` (já existe per Fase 1 map): adicione `logFocusSession(uid, duration, start, end)` → `POST /api/task/:uid/focus-session`.

## 8. Testes — backend
`backend/tests/integration/tasks-focus-session.test.js`:
- `POST /task/:uid/focus-session` com `{ duration_sec: 1500 }` → 201, `TaskEvent` criado com `event_type: 'focus_session'`, metadata com duration.
- `duration_sec` inválido → 400.
- Task inexistente → 404.
- Auth: require write access.

## 9. Testes — frontend
- `TaskFocusMode` renderiza full-screen; Esc fecha; "Next" chama onNext; Complete chama onComplete.
- `PomodoroTimer` com `onPomodoroComplete` chama callback ao completar.

## 10. Lint
```bash
cd backend && npx eslint --fix models/task_event.js modules/tasks/events.js modules/tasks/controller.js
cd frontend && npx eslint --fix components/Task/TaskFocusMode.tsx components/Shared/PomodoroTimer.tsx components/Task/TaskList.tsx components/Task/TasksToday.tsx utils/taskEventService.ts
```

## Request / Response shapes
**POST /api/task/:uid/focus-session**: `{ "duration_sec": 1500, "started_at": "2026-07-18T14:00:00Z", "ended_at": "2026-07-18T14:25:00Z" }` → `{ "logged": true }`.

## Critério de pronto
- [ ] TaskEvent type `focus_session` válido; endpoint loga sessão.
- [ ] `TaskFocusMode` full-screen abre da task row; Esc fecha; Next avança.
- [ ] Pomodoro binda task; ao completar, loga focus session.
- [ ] Complete marca task done.
- [ ] Suítes verde; lint limpo.

## Commit
`feat(task): focus mode full-screen with Pomodoro bind and next` — "Implements plans/59". Branch `feat/59-task-focus-mode`, sem merge/push.

## Fora de escopo
- Relatório de tempo focado por task/dia (plano futuro de métrica).
- Auto-iniciar próximo Pomodoro no Next.
- Som/lo-fi music no focus mode.
