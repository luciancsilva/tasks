# Testing Requirements

[← Back to Index](../CLAUDE.md)

---

## Test Organization

The suite currently runs **114 suites / 1644 tests** (backend), split as 55 unit
files and 59 integration files.

```
/backend/tests/
├── helpers/                   # Shared test utilities (createTestUser, ...)
├── unit/                      # Unit tests for isolated logic
│   ├── models/               # Model tests (task, project, user, ...)
│   ├── middleware/           # auth.test.js, authorize.test.js
│   ├── services/             # permissionsService, r2Service, dbBackupService, ...
│   ├── shared/               # Error classes, error handler
│   ├── utils/                # timezone-utils, slug-utils, migration-utils, ...
│   └── modules/              # Per-module unit tests
│       ├── tasks/           # recurringTaskService, dueTaskService
│       ├── caldav/
│       ├── mcp/
│       ├── oauth/
│       ├── oidc/
│       └── telegram/
│
└── integration/               # Integration tests for API endpoints
    │                          # Flat directory — one file per feature, NOT
    │                          # per-feature subdirectories.
    ├── tasks.test.js
    ├── subtasks.test.js
    ├── recurring-tasks.test.js
    ├── task-attachments.test.js
    ├── projects.test.js
    ├── branding.test.js
    ├── permissions-tasks.test.js
    ├── ... (59 files total)
    └── mcp/                   # The only integration subdirectory

/e2e/tests/                   # E2E tests (Playwright)
├── caldav-client.spec.ts
├── inbox.spec.ts
├── registration.spec.ts
└── today-view.spec.ts
```

Frontend suites are **colocated with the components**, not centralized under
`frontend/__tests__/` (which holds only `setup.ts`). Coverage is currently thin —
4 suites:

```
frontend/components/Shared/__tests__/MarkdownRenderer.checkbox.test.tsx
frontend/components/Task/TaskDetails/__tests__/TaskContentCard.test.tsx
frontend/components/Task/__tests__/RecurrenceDisplay.test.tsx
frontend/utils/dateUtils.test.ts
```

---

## Running Tests

### Backend Tests

```bash
# Run all backend tests (NODE_ENV=test)
npm test
# or
npm run backend:test

# Only unit / only integration
npm run backend:test:unit
npm run backend:test:integration

# Run a specific test file. Paths are relative to backend/, because the script
# does `cd backend` first.
npm run backend:test -- tests/unit/models/task.test.js

# Watch mode / coverage (backend)
npm run backend:test:watch
npm run backend:test:coverage
```

**`NODE_ENV=test` is the only safe setting by construction** — it targets
`backend/db/test.sqlite3`. A command with `NODE_ENV=development` or
`production` touches the real database of the checkout.

### Frontend Tests

```bash
# Run frontend tests
npm run frontend:test

# Watch mode / coverage
npm run frontend:test:watch
npm run frontend:test:coverage
```

Note `npm run test:watch` is an alias for the **frontend** watcher, and
`npm run test:coverage` runs frontend **and** backend coverage.

### E2E Tests

```bash
# Headless mode (default)
npm run test:ui

# Headed mode (see browser)
npm run test:ui:headed

# Specific test file
npx playwright test e2e/tests/inbox.spec.ts

# Debug mode
npx playwright test --debug
```

### Lint, Format, Type Check

```bash
npm run lint          # frontend + backend eslint + i18n key check
npm run format:fix    # prettier --write, frontend + backend
npm run typecheck     # tsc --noEmit
```

`npm run pre-push` runs `lint-staged` (staged files only), not the full suite.
The everything-check before a release is `npm run pre-release`.

**On Windows checkouts, avoid the global `npm run backend:lint`**: it reports
thousands of pre-existing `Delete ␍` (CRLF) errors that are unrelated to your
change. Lint the files you touched individually:

```bash
cd backend && npx eslint modules/tasks/service.js
```

---

## Testing Requirements

### For Bug Fixes

**MUST include a test** that would have caught the bug.

**Process:**
1. Write failing test that demonstrates the bug
2. Fix the bug
3. Verify test now passes
4. Submit PR with both test and fix

**Example:**
```javascript
// Test for bug: completed tasks showing in Today view
it('should not return completed tasks in Today view', async () => {
  // Arrange - Create completed task
  await Task.create({
    name: 'Completed Task',
    status: 2, // completed
    due_date: new Date().toISOString().split('T')[0],
    user_id: user.id
  });

  // Act - Get today's tasks
  const response = await request(app)
    .get('/api/v1/tasks/today')
    .set('Cookie', authCookie);

  // Assert - No completed tasks
  expect(response.status).toBe(200);
  const completedTasks = response.body.filter(t => t.status === 2);
  expect(completedTasks.length).toBe(0);
});
```

### For New Features

**SHOULD include relevant tests** covering:
- Happy path (success case)
- Common edge cases
- Error conditions

**Not required to test:**
- Every possible combination
- Framework internals
- Third-party library behavior

---

## Test Patterns

### Backend Integration Test

**Arrange-Act-Assert Pattern:**

```javascript
// /backend/tests/integration/tasks/tasks.test.js
const request = require('supertest');
const app = require('../../../app');
const { Task, User } = require('../../../models');

describe('Task API', () => {
  let user;
  let authCookie;

  beforeEach(async () => {
    // Setup: Create user and authenticate
    user = await User.create({
      email: 'test@example.com',
      password: 'password123'
    });

    const res = await request(app)
      .post('/api/login')
      .send({ email: 'test@example.com', password: 'password123' });
    authCookie = res.headers['set-cookie'];
  });

  afterEach(async () => {
    // Cleanup
    await Task.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  it('should create task with valid data', async () => {
    // Arrange
    const taskData = {
      name: 'Test Task',
      priority: 1,
      due_date: '2026-03-15'
    };

    // Act
    const response = await request(app)
      .post('/api/v1/task')
      .set('Cookie', authCookie)
      .send(taskData);

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Test Task');
    expect(response.body.priority).toBe(1);

    // Verify in database
    const task = await Task.findOne({ where: { name: 'Test Task' } });
    expect(task).not.toBeNull();
    expect(task.user_id).toBe(user.id);
  });

  it('should return 400 for missing name', async () => {
    // Arrange
    const invalidData = { priority: 1 };

    // Act
    const response = await request(app)
      .post('/api/v1/task')
      .set('Cookie', authCookie)
      .send(invalidData);

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  it('should return 404 for non-existent task', async () => {
    // Act
    const response = await request(app)
      .get('/api/v1/task/99999')
      .set('Cookie', authCookie);

    // Assert
    expect(response.status).toBe(404);
  });
});
```

### Backend Unit Test

```javascript
// /backend/tests/unit/utils/timezone-utils.test.js
const { getTodayBoundsInUTC } = require('../../../utils/timezone-utils');

describe('timezone-utils', () => {
  describe('getTodayBoundsInUTC', () => {
    it('should return UTC bounds for today in given timezone', () => {
      // Arrange
      const timezone = 'America/New_York';

      // Act
      const { startOfDay, endOfDay } = getTodayBoundsInUTC(timezone);

      // Assert
      expect(startOfDay).toBeInstanceOf(Date);
      expect(endOfDay).toBeInstanceOf(Date);
      expect(endOfDay.getTime()).toBeGreaterThan(startOfDay.getTime());
    });

    it('should handle invalid timezone gracefully', () => {
      // Arrange
      const invalidTimezone = 'Invalid/Timezone';

      // Act & Assert
      expect(() => getTodayBoundsInUTC(invalidTimezone)).not.toThrow();
    });
  });
});
```

### Frontend Component Test

```typescript
// /frontend/components/Task/__tests__/TaskItem.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskItem } from '../TaskItem';
import { Task } from '../../../entities/Task';

describe('TaskItem', () => {
  const mockTask: Task = {
    id: 1,
    uid: 'test-uid-123',
    name: 'Test Task',
    completed: false,
    priority: 1,
    due_date: '2026-03-15'
  };

  it('renders task name', () => {
    // Act
    render(<TaskItem task={mockTask} onUpdate={jest.fn()} />);

    // Assert
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('shows priority badge', () => {
    // Act
    render(<TaskItem task={mockTask} onUpdate={jest.fn()} />);

    // Assert
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('calls onUpdate when checkbox is clicked', () => {
    // Arrange
    const mockOnUpdate = jest.fn();
    render(<TaskItem task={mockTask} onUpdate={mockOnUpdate} />);

    // Act
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    // Assert
    expect(mockOnUpdate).toHaveBeenCalledWith({
      ...mockTask,
      completed: true
    });
  });

  it('applies completed styling when task is done', () => {
    // Arrange
    const completedTask = { ...mockTask, completed: true };

    // Act
    render(<TaskItem task={completedTask} onUpdate={jest.fn()} />);

    // Assert
    const taskElement = screen.getByText('Test Task').closest('div');
    expect(taskElement).toHaveClass('line-through');
    expect(taskElement).toHaveClass('opacity-50');
  });
});
```

### E2E Test (Playwright)

```typescript
// /e2e/tests/tasks.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Task Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:8080/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/tasks');
  });

  test('should create new task', async ({ page }) => {
    // Arrange
    await page.click('button:has-text("New Task")');

    // Act
    await page.fill('input[name="name"]', 'E2E Test Task');
    await page.selectOption('select[name="priority"]', '1');
    await page.fill('input[name="due_date"]', '2026-03-15');
    await page.click('button:has-text("Save")');

    // Assert
    await expect(page.locator('text=E2E Test Task')).toBeVisible();
  });

  test('should complete task', async ({ page }) => {
    // Arrange - Create a task first
    await page.click('button:has-text("New Task")');
    await page.fill('input[name="name"]', 'Task to Complete');
    await page.click('button:has-text("Save")');

    // Act - Complete the task
    const taskItem = page.locator('text=Task to Complete').locator('..');
    await taskItem.locator('input[type="checkbox"]').check();

    // Assert
    await expect(taskItem).toHaveClass(/line-through/);
  });

  test('should filter tasks by priority', async ({ page }) => {
    // Arrange - Create tasks with different priorities
    await createTask(page, 'High Priority Task', 2);
    await createTask(page, 'Low Priority Task', 0);

    // Act - Filter by high priority
    await page.selectOption('select[name="priority_filter"]', '2');

    // Assert
    await expect(page.locator('text=High Priority Task')).toBeVisible();
    await expect(page.locator('text=Low Priority Task')).not.toBeVisible();
  });
});

async function createTask(page, name: string, priority: number) {
  await page.click('button:has-text("New Task")');
  await page.fill('input[name="name"]', name);
  await page.selectOption('select[name="priority"]', priority.toString());
  await page.click('button:has-text("Save")');
  await page.waitForSelector(`text=${name}`);
}
```

---

## Test Database

Backend tests use a separate test database:

- Automatically created in test environment
- Migrations run before tests
- Database cleared between tests (in `afterEach`)
- Configured in `/backend/config/database.js`

**Example cleanup:**
```javascript
afterEach(async () => {
  // Clean up test data
  await Task.destroy({ where: {} });
  await Project.destroy({ where: {} });
  await User.destroy({ where: {} });
});
```

---

## Mocking

### Mock External Services

```javascript
// Mock email service in tests
jest.mock('../../../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

it('should send notification email', async () => {
  const emailService = require('../../../services/emailService');
  
  await taskService.create({ name: 'Task', notify: true }, userId);
  
  expect(emailService.sendEmail).toHaveBeenCalled();
});
```

### Mock R2 / Object Storage

Any test touching attachments, avatars, project covers or branding **must** mock
R2 so the suite never hits the network. Use `aws-sdk-client-mock` against the
shared client instance from `r2Service` — multer-s3 streams uploads through that
exact instance, so mocking it keeps every command in memory.

Reference: `backend/tests/integration/task-attachments.test.js`.

```javascript
const { mockClient } = require('aws-sdk-client-mock');
const {
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { Readable } = require('stream');
const r2Service = require('../../services/r2Service');

// Mocking the shared client instance intercepts all S3/R2 traffic.
const s3Mock = mockClient(r2Service.getClient());

// The download route only calls .pipe()/.on(), so a plain Readable suffices.
const makeBodyStream = (content) => Readable.from([Buffer.from(content)]);

beforeEach(() => {
    s3Mock.reset();
    s3Mock.on(PutObjectCommand).resolves({});
    s3Mock.on(DeleteObjectCommand).resolves({});
    s3Mock.on(GetObjectCommand).resolves({ Body: makeBodyStream('hello') });
});

it('deletes the R2 object when the task is deleted', async () => {
    // Act
    await request(app).delete(`/api/task/${task.uid}`).set('Cookie', authCookie);

    // Assert
    expect(s3Mock.commandCalls(DeleteObjectCommand).length).toBe(1);
});
```

Remember `r2Service.deleteObject` is **best-effort**: it logs and returns `false`
on failure instead of throwing. A test asserting that a delete failure does not
break the request should make the mock reject and still expect a 2xx.

### Mock Frontend Dependencies

The frontend suites do not use `msw`. They mock modules directly with
`jest.mock`, which keeps tests synchronous and dependency-free.

Reference: `frontend/components/Task/__tests__/RecurrenceDisplay.test.tsx`.

```typescript
// t(key, fallback) -> fallback, so English fallbacks render literally.
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

// Stub the service call so the component's effect settles.
jest.mock('../../../utils/profileService', () => ({
    getFirstDayOfWeek: jest.fn().mockResolvedValue(1),
}));
```

---

## Coverage Goals

While not strictly enforced, aim for:
- **Critical paths:** 80%+ coverage
- **Business logic:** 70%+ coverage
- **UI components:** 50%+ coverage

**Run coverage report:**
```bash
npm run test:coverage

# Open HTML report
open coverage/index.html
```

---

## Before Submitting PR

✅ All tests passing:
```bash
npm test
npm run test:ui
```

✅ No linting errors (see the CRLF caveat above for Windows):
```bash
npm run lint
```

✅ Code formatted:
```bash
npm run format:fix
```

---

[← Back to Index](../CLAUDE.md)
