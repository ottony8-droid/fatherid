const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/autoPilotController');

// Task CRUD
router.post('/tasks', ctrl.createTask);
router.get('/tasks', ctrl.getTasks);
router.put('/tasks/:id', ctrl.updateTask);
router.delete('/tasks/:id', ctrl.deleteTask);

// Engine Control
router.post('/start', ctrl.startAutoPilot);
router.post('/stop', ctrl.stopAutoPilot);
router.get('/status', ctrl.getStatus);

// Logs
router.get('/logs', ctrl.getLogs);
router.delete('/logs', ctrl.clearLogs);

// Analytics
router.get('/analytics', ctrl.getAnalytics);
router.get('/analytics/page/:id', ctrl.getPageDetail);

// Page Stats (today per-page)
router.get('/page-stats', ctrl.getPageStats);

// Reset System
router.post('/reset', ctrl.resetSystem);

// Folder tools
router.get('/browse', ctrl.browseFolder);
router.post('/scan-folder', ctrl.scanFolder);

module.exports = router;
