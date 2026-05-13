const express = require('express');
const router = express.Router();
const fbController = require('../controllers/fbController');

router.post('/auth', fbController.authenticate);
router.get('/sync-pages', fbController.syncPagesAPI);
router.get('/pages', fbController.getPages);
router.get('/queue', fbController.getQueueState);

// AutoReel Smart UI Endpoints
router.post('/scan', fbController.scanFolder);
router.post('/schedule', fbController.schedulePost);
router.get('/browse', fbController.browseFolder);
router.delete('/queue', fbController.clearQueue);
router.delete('/queue/:id', fbController.deleteQueueItem);
router.put('/queue/:id', fbController.updateQueueItemTime);
router.delete('/pages/:id', fbController.deletePage);

router.get('/tokens', fbController.getTokens);
router.delete('/tokens/:id', fbController.deleteToken);

module.exports = router;
