require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize database safely
require('./database/db');

const fbRoutes = require('./routes/fbRoutes');
const autoPilotRoutes = require('./routes/autoPilotRoutes');

const app = express();
const PORT = process.env.PORT || 5005;

app.use(cors());
app.use(express.json());

// ═══ Serve built frontend statically (single-port architecture) ═══
const frontendDist = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendDist));

// API Routes (must come BEFORE the catch-all)
app.use('/api', fbRoutes);
app.use('/api/autopilot', autoPilotRoutes);

app.get('/health', (req, res) => {
  res.send('AutoPilot Reel Blaster Server is up and running!');
});

// ═══ SPA Catch-all: serve index.html for any non-API route ═══
const fs = require('fs');
const indexPath = path.join(frontendDist, 'index.html');
app.get('*', (req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('Frontend not built yet. Run: cd frontend && npm run build');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('[AutoPilot] Reel Blaster Engine ready. Waiting for task activation...');
  if (fs.existsSync(indexPath)) {
    console.log(`[Frontend] Serving built UI from ${frontendDist}`);
  } else {
    console.log('[Frontend] No built frontend found. Run: cd frontend && npm run build');
  }
  
  // Power Outage / Reboot Auto-Resume Mechanism
  // Wait for database tables to be fully created before resuming
  const { dbReady } = require('./database/db');
  const { resumeEngineIfActive } = require('./jobs/autoPilot');
  dbReady.then(() => {
    resumeEngineIfActive();
  });
});

// Graceful shutdown: flush in‑memory queues and close DB
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Shutting down gracefully...');
  try {
    const { stopEngine } = require('./jobs/autoPilot');
    stopEngine();
    const store = require('./store');
    if (store.flushInMemoryQueues) await store.flushInMemoryQueues();
    const { db } = require('./database/db');
    db.close(() => console.log('SQLite connection closed.'));
  } catch (e) {
    console.error('Error during shutdown:', e);
  } finally {
    process.exit(0);
  }
});
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Shutting down gracefully...');
  try {
    const { stopEngine } = require('./jobs/autoPilot');
    stopEngine();
    const store = require('./store');
    if (store.flushInMemoryQueues) await store.flushInMemoryQueues();
    const { db } = require('./database/db');
    db.close(() => console.log('SQLite connection closed.'));
  } catch (e) {
    console.error('Error during shutdown:', e);
  } finally {
    process.exit(0);
  }
});
