const express = require('express');
const router = express.Router();

// Import sub-routers for task-related routes
const attachmentsRouter = require('./attachments');
const eventsRouter = require('./events');

const { enableQueryLogging } = require('../../middleware/queryLogger');
const tasksController = require('./controller');
const {
    requireTaskReadAccess,
    requireTaskWriteAccess,
} = require('./middleware/access');

if (process.env.NODE_ENV === 'development') {
    enableQueryLogging();
}

router.get('/tasks', tasksController.list);

router.get('/tasks/metrics', tasksController.metrics);

router.post('/tasks/bulk', tasksController.bulkUpdate);
router.post('/tasks/bulk-delete', tasksController.bulkDelete);

router.post('/task', tasksController.create);

router.get('/task/:uid', requireTaskReadAccess, tasksController.getOne);

router.patch('/task/:uid', requireTaskWriteAccess, tasksController.update);

router.delete('/task/:uid', requireTaskWriteAccess, tasksController.delete);

router.get('/task/:uid/subtasks', tasksController.listSubtasks);

router.patch(
    '/task/:uid/subtasks/reorder',
    requireTaskWriteAccess,
    tasksController.reorderSubtasks
);

router.get('/task/:uid/next-iterations', tasksController.nextIterations);

// Plan 59: log a focus/pomodoro session on a task.
router.post(
    '/task/:uid/focus-session',
    requireTaskWriteAccess,
    tasksController.logFocusSession
);

// Mount sub-routers for task-related routes
router.use(attachmentsRouter);
router.use(eventsRouter);

module.exports = router;
