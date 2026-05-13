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

// Proxy Management
router.get('/proxies', fbController.getProxies);
router.post('/proxies', fbController.addProxy);
router.put('/proxies/:id', fbController.updateProxy);
router.delete('/proxies/:id', fbController.deleteProxy);
router.post('/proxies/test', fbController.testProxy);
router.post('/proxies/assign', fbController.assignProxyToPages);
router.get('/proxies/mappings', fbController.getPageProxyMappings);

module.exports = router;
