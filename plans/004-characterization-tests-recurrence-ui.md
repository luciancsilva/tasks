# Plan 004: Characterization tests for the recurrence display UI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a55e4ad..HEAD -- frontend/components/Task/RecurrenceDisplay.tsx`
> If this file changed since the plan was written, compare the "Current state"
> excerpt against the live code before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/002 (soft — for CI gating; the tests can be written and
  run locally without it)
- **Category**: tests
- **Planned at**: commit `a55e4ad`, 2026-07-11

## Why this matters

The frontend has ~193 component files and only 3 test files. The
highest-risk area is the recurring-task UI: recent bug-fix commits touched
recurrence display and calendar recurrence labels (e.g. "show task titles
instead of recurrence frequency labels", "prevent recurring tasks from being
renamed on drag and drop"). `RecurrenceDisplay.tsx` is the pure, prop-driven
component that turns a recurrence rule into the human-readable label and weekday
chips a user sees — exactly the surface those bugs lived near — and it has zero
tests. This plan adds **characterization tests**: they lock in the component's
*current* observable behavior so a future refactor or i18n change that silently
breaks the label output is caught. This is the safest first frontend test to add
(no drag-drop, no network) and establishes the pattern for testing the rest of
the recurrence UI.

## Current state

- Target file: `frontend/components/Task/RecurrenceDisplay.tsx` — a presentational
  component. Key behavior to characterize (excerpt):

```tsx
// frontend/components/Task/RecurrenceDisplay.tsx (abridged)
import { RecurrenceType } from '../../entities/Task';
import { getFirstDayOfWeek } from '../../utils/profileService';

const RecurrenceDisplay: React.FC<RecurrenceDisplayProps> = ({
    recurrenceType,
    recurrenceInterval = 1,
    recurrenceWeekdays,
    recurrenceEndDate,
    recurrenceMonthDay,
    completionBased = false,
    compact = false,
}) => {
    const { t } = useTranslation();
    const [firstDayOfWeek, setFirstDayOfWeek] = useState<number | null>(null);

    useEffect(() => {
        const loadFirstDayOfWeek = async () => {
            try {
                const day = await getFirstDayOfWeek();
                setFirstDayOfWeek(day);
            } catch (error) {
                setFirstDayOfWeek(1); // Default to Monday on error
            }
        };
        loadFirstDayOfWeek();
    }, []);

    const formatRecurrenceText = () => {
        switch (recurrenceType) {
            case 'daily':
                return recurrenceInterval > 1
                    ? t('recurrence.everyNDays', `Every ${recurrenceInterval} days`, { count: recurrenceInterval })
                    : t('recurrence.daily', 'Daily');
            case 'weekly':
                return recurrenceInterval > 1
                    ? t('recurrence.everyNWeeks', `Every ${recurrenceInterval} weeks`, { count: recurrenceInterval })
                    : t('recurrence.weekly', 'Weekly');
            case 'monthly':
                return recurrenceInterval > 1
                    ? t('recurrence.everyNMonths', `Every ${recurrenceInterval} months`, { count: recurrenceInterval })
                    : t('recurrence.monthly', 'Monthly');
            case 'monthly_weekday':
                return t('recurrence.monthlyWeekday', 'Monthly on weekday');
            case 'monthly_last_day':
                return t('recurrence.monthlyLastDay', 'Monthly on last day');
            default:
                return t('recurrence.recurring', 'Recurring');
        }
    };

    if (recurrenceType === 'none' || !recurrenceType) {
        return null;
    }
    // ... renders formatRecurrenceText(), a completionBased badge, weekday chips
    //     (weekly only), "On day N" (monthly + recurrenceMonthDay), and
    //     "Until <date>" (recurrenceEndDate).
};
```

  Observable behaviors to lock in:
  - `recurrenceType='none'` (or falsy) → renders nothing (component returns `null`).
  - `'daily'` with default interval → shows `Daily`; interval `3` → `Every 3 days`.
  - `'weekly'` → `Weekly`; interval `2` → `Every 2 weeks`.
  - `'monthly'` → `Monthly`; interval `2` → `Every 2 months`.
  - `'monthly_weekday'` → `Monthly on weekday`; `'monthly_last_day'` → `Monthly on last day`.
  - `completionBased={true}` → also shows `After completion`.
  - `'weekly'` + `recurrenceWeekdays=[1,3,5]` → renders the "Repeat on" section
    with weekday chips (Mon/Wed/Fri highlighted). This part depends on the async
    `getFirstDayOfWeek()` state, so assertions on chips need `findBy*`/`waitFor`.
  - `'monthly'` + `recurrenceMonthDay=15` → shows `On day 15`.
  - `recurrenceEndDate` set → shows an `Until ...` line.

- Two dependencies to mock in the test:
  - `react-i18next` `useTranslation` — the existing tests mock it so `t(key,
    fallback)` returns the fallback string. Reuse that exact approach, so
    assertions can be on the English fallback text (`Daily`, `Every 3 days`, …).
  - `../../utils/profileService` `getFirstDayOfWeek` — mock it to resolve a
    number (e.g. `1` for Monday) so the weekday ordering effect completes.

- Existing test to copy the structure/mocks from (READ IT FIRST):
  `frontend/components/Task/TaskDetails/__tests__/TaskContentCard.test.tsx`. Note
  its i18n mock:

```tsx
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, fallback: string) => fallback }),
}));
```

  Important: `RecurrenceDisplay` calls `t(key, fallback, { count })` with a third
  options argument for the "every N" strings. Make the mock's `t` return the
  `fallback` (second arg) regardless of the third arg, so `Every 3 days` renders
  literally (the fallback template already contains the interpolated number).

- Test infra (already configured, no changes needed): `jest.config.js`
  (`testEnvironment: 'jsdom'`, ts-jest, `roots: ['<rootDir>/frontend']`,
  `setupFilesAfterEach` at `frontend/__tests__/setup.ts`), `@testing-library/react`,
  `@testing-library/jest-dom`. Test-file glob:
  `frontend/**/__tests__/**/*.{test,spec}.{ts,tsx}` or `frontend/**/*.test.tsx`.

- The `RecurrenceType` type is exported from `frontend/entities/Task.ts` and
  includes at least `'none' | 'daily' | 'weekly' | 'monthly' | 'monthly_weekday'
  | 'monthly_last_day'` (confirm by reading the file before typing props).

## Commands you will need

| Purpose          | Command                                                      | Expected                |
|------------------|-------------------------------------------------------------|-------------------------|
| Frontend tests   | `npm run frontend:test`                                     | all pass, exit 0        |
| This test only   | `npx jest frontend/components/Task/__tests__/RecurrenceDisplay.test.tsx` | new tests pass |
| Typecheck        | `npm run typecheck` (if plan 002 landed) or `npx tsc --noEmit` | exit 0               |
| Lint             | `npm run frontend:lint`                                     | exit 0                  |

## Scope

**In scope** (the only file you should create/modify):
- `frontend/components/Task/__tests__/RecurrenceDisplay.test.tsx` (create)

**Out of scope** (do NOT touch):
- `frontend/components/Task/RecurrenceDisplay.tsx` — do NOT modify the component.
  If a behavior seems like a bug, characterize it **as-is** (write the test to
  match current output) and note it in Maintenance notes; do not "fix" it here.
- Kanban / Eisenhower drag-drop tests, `TaskRecurrenceSection.tsx`, `TaskItem.tsx`
  — these need `@dnd-kit` harness setup and are a separate, larger plan. Do NOT
  attempt them here.
- `jest.config.js`, `frontend/__tests__/setup.ts`, any other source or config.

## Git workflow

- Branch: `advisor/004-recurrence-display-tests`
- Commit style: Conventional Commits. Suggested:
  `test(frontend): add characterization tests for RecurrenceDisplay`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Read the pattern and the target

Read `frontend/components/Task/TaskDetails/__tests__/TaskContentCard.test.tsx`
(mock style) and `frontend/components/Task/RecurrenceDisplay.tsx` and
`frontend/entities/Task.ts` (the `RecurrenceType` union) fully before writing.

**Verify**: no command — confirm you can see the `formatRecurrenceText` switch
and the exported `RecurrenceType`.

### Step 2: Create the test file with the mocks

Create `frontend/components/Task/__tests__/RecurrenceDisplay.test.tsx`. Set up:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RecurrenceDisplay from '../RecurrenceDisplay';

// t(key, fallback, opts?) -> fallback, so English fallbacks render literally.
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

// Resolve first-day-of-week so the weekday-ordering effect settles.
jest.mock('../../../utils/profileService', () => ({
    getFirstDayOfWeek: jest.fn().mockResolvedValue(1),
}));
```

Confirm the relative path in the `jest.mock` for `profileService` is correct for
the test file's location (`frontend/components/Task/__tests__/` → the util is at
`frontend/utils/profileService`, i.e. `../../../utils/profileService`). Adjust if
your reading of the tree differs.

**Verify**: `npx jest frontend/components/Task/__tests__/RecurrenceDisplay.test.tsx`
runs (may report "no tests" until Step 3) with no module-resolution errors.

### Step 3: Write the characterization tests

Add tests covering each observable behavior listed in "Current state". At
minimum:

- renders nothing for `recurrenceType='none'` (assert `container.firstChild` is
  `null`).
- `'daily'` → `screen.getByText('Daily')`.
- `'daily'` + `recurrenceInterval={3}` → `getByText('Every 3 days')`.
- `'weekly'` → `getByText('Weekly')`; `+ interval 2` → `Every 2 weeks`.
- `'monthly'` → `getByText('Monthly')`; `+ interval 2` → `Every 2 months`.
- `'monthly_weekday'` → `Monthly on weekday`.
- `'monthly_last_day'` → `Monthly on last day`.
- `completionBased={true}` (with any recurring type) → `getByText('After completion')`.
- `'monthly'` + `recurrenceMonthDay={15}` → text containing `On day` and `15`.
- `recurrenceEndDate='2026-12-31'` → text containing `Until`.
- `'weekly'` + `recurrenceWeekdays={[1,3,5]}` → the "Repeat on" label appears;
  use `await screen.findByText('Repeat on:')` (or `waitFor`) because it renders
  after the async `getFirstDayOfWeek` state resolves. Assert the Mon/Wed/Fri
  short labels are present.

Follow Arrange-Act-Assert; one `it()` per behavior; group under a
`describe('RecurrenceDisplay', ...)`.

**Verify**: `npx jest frontend/components/Task/__tests__/RecurrenceDisplay.test.tsx`
→ all new tests pass.

### Step 4: Full frontend suite + lint + typecheck stay green

**Verify**:
- `npm run frontend:test` → all pass (the 3 existing + your new ones).
- `npm run frontend:lint` → exit 0.
- `npm run typecheck` (or `npx tsc --noEmit`) → exit 0.

## Test plan

- New file `frontend/components/Task/__tests__/RecurrenceDisplay.test.tsx`
  covering: null render, each recurrence-type label, singular vs. "every N"
  intervals, completion-based badge, weekday chips (async), "On day N", and
  "Until <date>".
- Structural pattern: `frontend/components/Task/TaskDetails/__tests__/TaskContentCard.test.tsx`.
- Verification: `npm run frontend:test` → all pass, including the new cases.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `frontend/components/Task/__tests__/RecurrenceDisplay.test.tsx` exists
- [ ] `npx jest frontend/components/Task/__tests__/RecurrenceDisplay.test.tsx`
      passes with at least 10 `it()` cases
- [ ] `npm run frontend:test` exits 0 (no existing test broken)
- [ ] `npm run frontend:lint` exits 0
- [ ] `RecurrenceDisplay.tsx` is unchanged (`git diff --stat` shows only the new
      test file)
- [ ] `plans/README.md` status row for 004 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `RecurrenceDisplay.tsx` does not match the "Current state" excerpt (drift).
- The `RecurrenceType` union in `frontend/entities/Task.ts` lacks any of the
  values used above — report the actual union rather than guessing.
- A weekday-chip assertion cannot be made to pass even with `findBy*`/`waitFor`
  after two attempts — report the rendered output; do not modify the component to
  make the test pass.
- You find yourself needing to edit `RecurrenceDisplay.tsx` — that means scope is
  wrong; stop and report.

## Maintenance notes

- These are **characterization** tests: they encode current behavior, not
  desired behavior. If a real bug is found while writing them, note it here and
  in the PR description rather than fixing it inside this plan.
- Natural follow-ups (separate plans): tests for `TaskRecurrenceSection.tsx`
  (the rule builder), and drag-drop characterization for `KanbanBoard.tsx` /
  `EisenhowerMatrix.tsx` using a `@dnd-kit` test harness. Those are higher-effort
  and deliberately excluded here.
- Reviewer should confirm the i18n mock returns the fallback string (so
  assertions read as English) and that no production component was modified.
