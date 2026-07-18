# 62 — Quick-add hotkey universal (Ctrl+Space → overlay → Inbox)

> **Status: PROPOSTO** — Hoje 6 Alt+Shift+ create-only, falham dentro inputs, abrem modais (não captura inline). Decisão aprovada: Ctrl+Space → overlay mini-input → Inbox.
> **Esforço:** Médio · **Natureza:** julgamento baixo · **Modelo:** médio
> **Branch:** `feat/62-quick-add-overlay` a partir da `main` · **Depende de:** -

## Contexto

Refs:
- `useKeyboardShortcuts.ts` `:29-33` (`useKeyboardShortcuts(shortcuts, handlers, enabled)`), guard `isInputElement` `:47` (ignora se focado em input).
- `Layout.tsx` fetch shortcuts `:70-85`, modais gateados por useState `:57-66`, render `:530-611`.
- `keyboardShortcutsService.ts` `ShortcutAction` union `:4`, `DEFAULT_SHORTCUTS`, `matchesShortcut` `:92-104`.
- `inboxProcessingService.js` `processInboxItem` `:475-500` — token parsing.

Ctrl+Space overlay: funciona em QUALQUER contexto (inclusive dentro inputs) — intercept global, NÃO passa pelo guard `isInputElement`. Token parsing reusa `processInboxItem` (mas só `!priority` do plano 68 + `#tag`/`+proj`/`@person`/`$area` existentes). Captura direto pra Inbox.

## 1. Baseline
```bash
npm run backend:test && npm run frontend:test
```

## 2. Frontend — QuickAddOverlay component
Crie `frontend/components/Shared/QuickAddOverlay.tsx`:
```tsx
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { createInboxItem } from '../../utils/inboxService';

interface QuickAddOverlayProps {
    onClose: () => void;
}

const QuickAddOverlay: React.FC<QuickAddOverlayProps> = ({ onClose }) => {
    const { t } = useTranslation();
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleSubmit = async () => {
        if (!value.trim()) { onClose(); return; }
        setSaving(true);
        try {
            await createInboxItem({ content: value.trim(), source: 'quick-add' });
            setValue('');
        } finally {
            setSaving(false);
            onClose();
        }
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    });

    return createPortal(
        <div className="fixed inset-0 z-[110] flex items-start justify-center pt-32 bg-black/30" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={t('quickAdd.placeholder', 'Capture anything... #tag +project @person $area !priority')}
                    className="w-full text-lg px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                    disabled={saving}
                />
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>{t('quickAdd.hint', 'Enter = capture to Inbox · Esc = close')}</span>
                    {saving && <span>{t('quickAdd.saving', 'Saving...')}</span>}
                </div>
            </div>
        </div>,
        document.body
    );
};
export default QuickAddOverlay;
```

## 3. Frontend — Layout listener + mount
`frontend/Layout.tsx`:

### 3a. State
Após os useState de modais (`:57-66`):
```tsx
const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
```

### 3b. Global listener (NÃO use useKeyboardShortcuts — bypass guard)
```tsx
useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
            e.preventDefault();
            e.stopPropagation();
            setIsQuickAddOpen(true);
        }
    };
    document.addEventListener('keydown', onKey, true); // capture phase → intercept antes de inputs
    return () => document.removeEventListener('keydown', onKey, true);
}, []);
```
`capture: true` (terceiro arg) garante intercept antes do target (input/textarea). `e.preventDefault()` bloqueia IME/spaço default.

### 3c. Render
No bloco de modais (`:530-611`):
```tsx
{isQuickAddOpen && <QuickAddOverlay onClose={() => setIsQuickAddOpen(false)} />}
```

## 4. Frontend — inboxService
`frontend/utils/inboxService.ts`: confirmar `createInboxItem` existe (per Fase 1 map, sim). Signature: `createInboxItem({ content, source })`.

## 5. Configurabilidade (opcional v1)
`keyboardShortcutsService.ts` `ShortcutAction` (`:4`): adicione `'quickAdd'`. `DEFAULT_SHORTCUTS`: adicione `{ action: 'quickAdd', key: 'Space', ctrl: true }`. Profile KeyboardShortcutsTab: permitir customizar. V1 pode hard-code Ctrl+Space (listener dedicado em Layout) e deixar customização para depois.

## 6. Testes — frontend
`frontend/__tests__/`:
- Ctrl+Space abre overlay (mesmo com foco em input).
- Enter captura para Inbox (chama `createInboxItem`); Esc fecha.
- Click fora fecha.

## 7. Lint
```bash
cd frontend && npx eslint --fix components/Shared/QuickAddOverlay.tsx Layout.tsx utils/keyboardShortcutsService.ts hooks/useKeyboardShortcuts.ts
```

## Critério de pronto
- [ ] Ctrl+Space (Win) / Cmd+Space (Mac) abre overlay de qualquer contexto (inclusive dentro inputs).
- [ ] Enter captura para Inbox; Esc fecha; click fora fecha.
- [ ] Overlay mostra placeholder com sintaxe de tokens.
- [ ] Não conflita com Alt+Shift+ existentes.
- [ ] Suítes verde; lint limpo.

## Commit
`feat(quickadd): universal Ctrl+Space overlay capturing to Inbox` — "Implements plans/62". Branch `feat/62-quick-add-overlay`, sem merge/push.

## Fora de escopo
- Customização do atalho (v1 hard-code).
- Token preview live no overlay (mostrar chips parseados enquanto digita) — refinamento futuro.
- AI suggestion no overlay.
