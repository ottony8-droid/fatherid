/**
 * AutoPilot Reel Blaster Engine v8 — FINAL
 * ──────────────────────────────────────────
 * RULES:
 *   1. Start button → WAITING. No posting until scheduled phase time.
 *   2. Every scheduled phase → FRESH round from page 1.
 *   3. Crash mid-phase → On restart, immediately resume remaining pages.
 *   4. 10-min buffer → Stop catch-up work before next phase starts.
 *   5. After catch-up or buffer stop → currentPageIndex resets to 0.
 *   6. Midnight → Full reset for new day.
 */

const fs = require('fs');
const path = require('path');
const { runQuery, getQuery, allQuery } = require('../database/db');
const { postToPage } = require('../services/facebookService');
const axios = require('axios');

let serverInfo = { ip: '...', location: '...', flag: '🇺🇳' };

// Fetch real server info once
async function initServerInfo() {
  try {
    const res = await axios.get('http://ip-api.com/json/');
    if (res.data && res.data.status === 'success') {
      const { query, city, country, countryCode, timezone } = res.data;
      // Convert country code to emoji flag
      const flag = countryCode.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397));
      serverInfo = {
        ip: query,
        location: `${city}, ${country}`,
        flag: flag,
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      };
    }
  } catch (e) {
    console.error('[Engine] Failed to fetch server info:', e.message);
  }
}
initServerInfo();

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.m4v'];

let engine = {
  isRunning: false,
  stopRequested: false,
  task: null,
  status: 'idle',
  currentPageIndex: 0,   // Only used for crash recovery
  totalPages: 0,
  currentPageName: '',
  currentVideoName: '',
  videosRemaining: 0,
  ticker: null,
  lastRunDate: null,
  completedPhases: []
};

// ══════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════

/**
 * Returns the current LOCAL date/time of the system.
 * Previously hardcoded to BDT (UTC+6). Now uses the system's own timezone
 * so the tool works from any location (USA, BD, etc.).
 */
function getLocalDate() {
  return new Date();
}

function getLocalTimeHHMM() {
  const d = getLocalDate();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Keep old names as aliases for backward compatibility
const getBDTDate = getLocalDate;
const getBDTTimeHHMM = getLocalTimeHHMM;

function minutesUntilNextPhase() {
  if (!engine.task) return Infinity;
  let times = [];
  try { times = JSON.parse(engine.task.custom_times || '[]'); } catch (e) {}

  const d = getLocalDate();
  const nowMins = d.getHours() * 60 + d.getMinutes();

  let closest = Infinity;
  for (const t of times) {
    if (engine.completedPhases.includes(t)) continue;
    const [h, m] = t.split(':').map(Number);
    let diff = (h * 60 + m) - nowMins;
    if (diff <= 0) diff += 1440;
    if (diff < closest) closest = diff;
  }
  return closest;
}

function scanForVideos(folderPath) {
  if (!fs.existsSync(folderPath)) return [];
  const files = [];
  try {
    for (const e of fs.readdirSync(folderPath, { withFileTypes: true })) {
      if (e.name === 'posted' || e.name === 'failed') continue;
      if (e.isFile() && !e.name.startsWith('.')) {
        if (VIDEO_EXTENSIONS.includes(path.extname(e.name).toLowerCase()))
          files.push(path.join(folderPath, e.name));
      }
    }
  } catch (e) {}
  files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  return files;
}

function deleteVideo(p) { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {} }
function moveToFailed(p) {
  try {
    const d = path.join(path.dirname(p), 'failed');
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.renameSync(p, path.join(d, path.basename(p)));
  } catch (e) {}
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ══════════════════════════════════════════════
// DB
// ══════════════════════════════════════════════

async function save() {
  try {
    await runQuery(`UPDATE autopilot_state SET 
      status=?, active_task_id=?, current_page_index=?, total_pages=?,
      videos_remaining=?, last_activity=?, completed_phases=?, last_run_date=?
      WHERE id=1`, [
      engine.status, engine.task?.id || null,
      engine.currentPageIndex, engine.totalPages,
      engine.videosRemaining, Date.now(),
      JSON.stringify(engine.completedPhases), engine.lastRunDate
    ]);
  } catch (e) { console.error('[Engine] save error:', e.message); }
}

async function logPost(taskId, taskName, phase, pageId, pageName, vPath, vName, caption, status, err = null) {
  try {
    await runQuery(`INSERT INTO autopilot_logs (task_id,task_name,round,page_id,page_name,video_path,video_name,caption,status,error_msg,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [taskId, taskName, parseInt(phase.replace(':', '')) || 0, pageId, pageName, vPath, vName, caption, status, err, Date.now()]);
  } catch (e) {}
}

async function trackAnalytics(pageId, pageName, status) {
  const today = getBDTDate().toISOString().split('T')[0];
  try {
    await runQuery(`INSERT OR IGNORE INTO page_analytics (page_id, page_name, date) VALUES (?,?,?)`, [pageId, pageName, today]);
    if (status === 'success')
      await runQuery(`UPDATE page_analytics SET reels_posted=reels_posted+1, reels_success=reels_success+1 WHERE page_id=? AND date=?`, [pageId, today]);
    else
      await runQuery(`UPDATE page_analytics SET reels_failed=reels_failed+1 WHERE page_id=? AND date=?`, [pageId, today]);
  } catch (e) {}
}

async function postWithRetry(pageId, token, caption, videoPath) {
  let lastErr = null;
  for (let a = 0; a < 3; a++) {
    try {
      if (a > 0) await sleep(10000);
      return { success: true, result: await postToPage(pageId, token, caption, videoPath) };
    } catch (e) { lastErr = e; console.error(`[Engine] ❌ Attempt ${a + 1}:`, e.message); }
  }
  return { success: false, error: lastErr?.message || 'Unknown' };
}

// ══════════════════════════════════════════════
// ROUND EXECUTOR
// ══════════════════════════════════════════════

async function executeRound(task, phaseLabel, startIdx = 0) {
  if (engine.stopRequested) return;

  engine.status = 'posting';
  await save();

  const pages = await allQuery(`SELECT id, name, access_token FROM pages ORDER BY name DESC`);
  if (!pages.length) {
    engine.status = 'waiting'; await save(); return;
  }
  engine.totalPages = pages.length;

  console.log(`\n═══ 🚀 [${phaseLabel}] page ${startIdx + 1}/${pages.length} ═══`);

  for (let i = startIdx; i < pages.length; i++) {
    if (engine.stopRequested) break;

    // ★ 10-MINUTE BUFFER: stop before next phase
    const mins = minutesUntilNextPhase();
    if (mins <= 10 && mins > 0) {
      console.log(`[Engine] ⏰ Next phase in ${mins} min. Stopping current work.`);
      break;
    }

    const videos = scanForVideos(task.folder_path);
    engine.videosRemaining = videos.length;
    if (!videos.length) { console.log('[Engine] 📭 No videos.'); break; }

    const page = pages[i], vPath = videos[0];
    const vName = path.basename(vPath), caption = path.parse(vPath).name;

    engine.currentPageName = page.name;
    engine.currentVideoName = vName;
    await save();

    console.log(`[Engine] 📤 [${i + 1}/${pages.length}] "${vName}" → "${page.name}"`);
    const result = await postWithRetry(page.id, page.access_token, caption, vPath);

    if (result.success) {
      deleteVideo(vPath);
      await logPost(task.id, task.name, phaseLabel, page.id, page.name, vPath, vName, caption, 'success');
      await trackAnalytics(page.id, page.name, 'success');
      console.log(`[Engine] ✅ OK`);
    } else {
      moveToFailed(vPath);
      await logPost(task.id, task.name, phaseLabel, page.id, page.name, vPath, vName, caption, 'failed', result.error);
      await trackAnalytics(page.id, page.name, 'failed');
    }

    // Save resume point (NEXT page) for crash recovery
    engine.currentPageIndex = i + 1;
    engine.videosRemaining = scanForVideos(task.folder_path).length;
    await save();

    if (i < pages.length - 1 && !engine.stopRequested) {
      console.log(`[Engine] ⏳ Gap ${task.gap_minutes}m`);
      engine.nextPostAt = Date.now() + (task.gap_minutes * 60000);
      engine.nextPageName = pages[i + 1].name;
      engine.status = 'resting';
      await save();
      
      await sleep(task.gap_minutes * 60000);
      
      engine.nextPostAt = null;
      engine.nextPageName = null;
      if (!engine.stopRequested) {
        engine.status = 'posting';
        await save();
      }
    }
  }

  // Round ended
  if (!engine.stopRequested) {
    if (!engine.completedPhases.includes(phaseLabel)) {
      engine.completedPhases.push(phaseLabel);
    }
    // ★ ALWAYS reset to 0 after any round ends ★
    // Next scheduled phase will start FRESH from page 1
    engine.currentPageIndex = 0;
    engine.currentPageName = '';
    engine.currentVideoName = '';
    engine.status = 'waiting';
    await save();
    console.log(`═══ ✅ [${phaseLabel}] Done. Reset to page 0. ═══\n`);
  }
}

// ══════════════════════════════════════════════
// CRON TICK — every 30s
// ══════════════════════════════════════════════

async function tick() {
  if (engine.stopRequested || engine.status === 'posting' || engine.status === 'resting') return;
  if (!engine.task) return;

  const today = getLocalDate().toISOString().split('T')[0];
  if (engine.lastRunDate !== today) {
    console.log(`[Engine] 🌅 New day. Full reset.`);
    engine.lastRunDate = today;
    engine.completedPhases = [];
    engine.currentPageIndex = 0;
    await save();
  }

  // Check "first post delay" timer
  if (engine.firstPostAt && Date.now() >= engine.firstPostAt && !engine.completedPhases.includes('FIRST')) {
    console.log(`[Engine] 🚀 FIRST POST delay elapsed! Starting immediate round.`);
    engine.firstPostAt = null;
    engine.currentPageIndex = 0;
    engine.completedPhases.push('FIRST');
    executeRound(engine.task, 'First', 0).catch(e => console.error('[Engine] Error:', e));
    return;
  }

  let times = [];
  try { times = JSON.parse(engine.task.custom_times || '[]'); } catch (e) {}

  const now = getLocalTimeHHMM();

  if (times.includes(now) && !engine.completedPhases.includes(now)) {
    console.log(`[Engine] ⏰ PHASE: ${now} (Local Time)`);
    // ★ EVERY scheduled phase starts FRESH from page 0 ★
    engine.currentPageIndex = 0;
    executeRound(engine.task, now, 0).catch(e => console.error('[Engine] Error:', e));
  }
}

// ══════════════════════════════════════════════
// START
// ══════════════════════════════════════════════

async function startEngine(taskId, opts = {}) {
  if (engine.isRunning) throw new Error('Already running!');

  const task = await getQuery(`SELECT * FROM autopilot_tasks WHERE id=?`, [taskId]);
  if (!task) throw new Error('Task not found.');

  // firstPostDelay: minutes to wait before first post (default: 0 = disabled)
  const firstPostDelayMins = opts.firstPostDelay || 0;

  engine = {
    isRunning: true, stopRequested: false, task,
    status: 'waiting',
    currentPageIndex: opts.resumePageIndex || 0,
    totalPages: 0, currentPageName: '', currentVideoName: '',
    videosRemaining: scanForVideos(task.folder_path).length,
    ticker: null,
    lastRunDate: opts.lastRunDate || getLocalDate().toISOString().split('T')[0],
    completedPhases: opts.completedPhases || [],
    firstPostAt: firstPostDelayMins > 0 ? Date.now() + (firstPostDelayMins * 60000) : null
  };

  try { const c = await getQuery(`SELECT COUNT(*) as cnt FROM pages`); engine.totalPages = c?.cnt || 0; } catch (e) {}
  await save();

  const localNow = getLocalTimeHHMM();
  console.log(`\n[Engine] 🔆 "${task.name}"`);
  console.log(`[Engine] System Local Time: ${localNow}`);
  console.log(`[Engine] Phases: ${task.custom_times}`);
  console.log(`[Engine] Done: [${engine.completedPhases.join(', ')}] | ResumeIdx: ${engine.currentPageIndex}`);
  if (engine.firstPostAt) {
    console.log(`[Engine] 🕐 First post will trigger in ${firstPostDelayMins} minutes (at ${new Date(engine.firstPostAt).toLocaleTimeString()})`);
  }

  engine.ticker = setInterval(tick, 30000);
  return { message: 'Started.', firstPostAt: engine.firstPostAt ? new Date(engine.firstPostAt).toLocaleTimeString() : null };
}

function stopEngine() {
  engine.stopRequested = true;
  if (engine.ticker) clearInterval(engine.ticker);
  engine.status = 'stopped';
  engine.isRunning = false;
  save();
  console.log('[Engine] 🛑 STOPPED');
  return { message: 'Stopped.' };
}

function getState() {
  return {
    isRunning: engine.isRunning, status: engine.status,
    taskName: engine.task?.name || null, taskId: engine.task?.id || null,
    currentPageIndex: engine.currentPageIndex, totalPages: engine.totalPages,
    currentPageName: engine.currentPageName, currentVideoName: engine.currentVideoName,
    videosRemaining: engine.videosRemaining,
    customTimes: engine.task?.custom_times || '[]',
    gapMinutes: engine.task?.gap_minutes || 2,
    localTime: getLocalTimeHHMM(),
    serverInfo: serverInfo,
    firstPostAt: engine.firstPostAt ? new Date(engine.firstPostAt).toLocaleTimeString() : null
  };
}

// ══════════════════════════════════════════════
// RESUME ON RESTART
// ══════════════════════════════════════════════

async function resumeEngineIfActive() {
  try {
    const row = await getQuery("SELECT * FROM autopilot_state WHERE id=1");
    if (!row) return;
    if (!['posting', 'waiting', 'running'].includes(row.status) || !row.active_task_id) return;

    const savedIdx = row.current_page_index || 0;
    const wasPosting = row.status === 'posting';

    console.log(`[Engine] 🚨 Previous: status=${row.status}, pageIdx=${savedIdx}`);

    let completed = [];
    try { completed = JSON.parse(row.completed_phases || '[]'); } catch (e) {}

    setTimeout(async () => {
      try {
        await startEngine(row.active_task_id, {
          completedPhases: completed,
          lastRunDate: row.last_run_date,
          resumePageIndex: savedIdx
        });

        // Crash recovery: if there's unfinished work, continue NOW
        if (savedIdx > 0 || wasPosting) {
          const mins = minutesUntilNextPhase();
          if (mins > 10) {
            console.log(`[Engine] 🔋 RESUME from page ${savedIdx}. Next phase in ${mins}m.`);
            executeRound(engine.task, 'Resume', savedIdx)
              .catch(e => console.error('[Engine] Resume error:', e));
          } else {
            // Not enough time — just wait for next phase (which starts fresh)
            console.log(`[Engine] ⏰ Next phase in ${mins}m. Skipping catch-up.`);
            engine.currentPageIndex = 0;
            await save();
          }
        } else {
          console.log(`[Engine] ✅ No unfinished work. Waiting for phase.`);
        }
      } catch (e) { console.error('[Engine] Resume failed:', e.message); }
    }, 5000);
  } catch (e) { console.error('[Engine] resume error:', e.message); }
}

module.exports = { startEngine, stopEngine, getState, scanForVideos, resumeEngineIfActive, executeRound };
