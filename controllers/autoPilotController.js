/**
 * AutoPilot Controller
 * API endpoints for managing tasks, engine control, and analytics
 */

const { runQuery, getQuery, allQuery } = require('../database/db');
const { startEngine, stopEngine, getState, scanForVideos, executeRound } = require('../jobs/autoPilot');
const path = require('path');
const fs = require('fs');

// ═══════════════════════════════════════
// TASK CRUD
// ═══════════════════════════════════════

exports.createTask = async (req, res) => {
  try {
    const { name, folder_path, max_rounds, gap_minutes, rest_minutes, custom_times } = req.body;
    
    if (!name || !folder_path) {
      return res.status(400).json({ error: 'Task name and folder path are required.' });
    }
    if (!fs.existsSync(folder_path)) {
      return res.status(400).json({ error: 'Folder path does not exist.' });
    }

    const effectiveGap = Math.max(parseInt(gap_minutes) || 10, 10);
    const timesStr = Array.isArray(custom_times) ? JSON.stringify(custom_times) : '[]';

    const result = await runQuery(`
      INSERT INTO autopilot_tasks (name, folder_path, max_rounds, gap_minutes, rest_minutes, custom_times)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      name, folder_path,
      max_rounds ?? 5, effectiveGap, rest_minutes ?? 60, timesStr
    ]);

    res.json({ success: true, id: result.id, message: `Task "${name}" created.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task.', details: err.message });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const tasks = await allQuery(`SELECT * FROM autopilot_tasks ORDER BY created_at DESC`);
    
    // Enrich each task with video count
    for (const task of tasks) {
      if (fs.existsSync(task.folder_path)) {
        const videos = scanForVideos(task.folder_path);
        task.video_count = videos.length;
      } else {
        task.video_count = 0;
        task.folder_missing = true;
      }
    }
    
    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const { name, folder_path, max_rounds, gap_minutes, rest_minutes, custom_times } = req.body;
    const { id } = req.params;

    const effectiveGap = Math.max(parseInt(gap_minutes) || 10, 10);
    const timesStr = Array.isArray(custom_times) ? JSON.stringify(custom_times) : '[]';

    await runQuery(`
      UPDATE autopilot_tasks SET name=?, folder_path=?, max_rounds=?, gap_minutes=?, rest_minutes=?, custom_times=?
      WHERE id=?
    `, [name, folder_path, max_rounds, effectiveGap, rest_minutes, timesStr, id]);

    res.json({ success: true, message: 'Task updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task.' });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    await runQuery(`DELETE FROM autopilot_tasks WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task.' });
  }
};

// ═══════════════════════════════════════
// ENGINE CONTROL
// ═══════════════════════════════════════

exports.startAutoPilot = async (req, res) => {
  try {
    const { task_id, first_post_delay } = req.body;
    if (!task_id) return res.status(400).json({ error: 'task_id is required.' });

    // Start engine daemon — ONLY the cron ticker, NO immediate posting.
    // Posts will fire ONLY at the exact custom phase times.
    // If first_post_delay is set (in minutes), the first post will fire after that delay.
    const result = await startEngine(task_id, {
      firstPostDelay: first_post_delay || 0
    });

    const state = getState();
    res.json({ success: true, message: result.firstPostAt 
      ? `AutoPilot started! First post at ${result.firstPostAt}, then follows scheduled phases.`
      : 'AutoPilot started! Waiting for scheduled phase times.', state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.stopAutoPilot = async (req, res) => {
  try {
    const result = stopEngine();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getStatus = async (req, res) => {
  try {
    const state = getState();
    
    // Also get page count
    const pages = await allQuery(`SELECT COUNT(*) as count FROM pages`);
    state.connectedPages = pages[0]?.count || 0;
    
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get status.' });
  }
};

// ═══════════════════════════════════════
// LOGS
// ═══════════════════════════════════════

exports.getLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const task_id = req.query.task_id;
    
    let sql = `SELECT * FROM autopilot_logs`;
    let params = [];
    
    if (task_id) {
      sql += ` WHERE task_id = ?`;
      params.push(task_id);
    }
    
    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);
    
    const logs = await allQuery(sql, params);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs.' });
  }
};

exports.clearLogs = async (req, res) => {
  try {
    const { task_id } = req.query;
    if (task_id) {
      await runQuery(`DELETE FROM autopilot_logs WHERE task_id = ?`, [task_id]);
    } else {
      await runQuery(`DELETE FROM autopilot_logs`);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear logs.' });
  }
};

// ═══════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════

exports.getAnalytics = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 1; // Default to 1 (Today)
    const pageName = req.query.page_name || '';
    
    // Use system local time (works for any timezone — USA, BD, etc.)
    const now = new Date();
    const sinceDate = new Date(now.getTime() - (Math.max(days-1, 0) * 24 * 60 * 60 * 1000));
    const sinceStr = sinceDate.toISOString().split('T')[0];

    let pageFilter = '';
    let params = [sinceStr];

    if (pageName && pageName !== 'All') {
        pageFilter = ' AND page_name = ?';
        params.push(pageName);
    }

    // Totals
    const totals = await getQuery(`
      SELECT SUM(reels_posted) as total_posted, SUM(reels_success) as total_success, SUM(reels_failed) as total_failed 
      FROM page_analytics WHERE date >= ?${pageFilter}`, params);

    // Trend
    const dailyTrend = await allQuery(`
      SELECT date, SUM(reels_posted) as posted, SUM(reels_success) as success, SUM(reels_failed) as failed 
      FROM page_analytics WHERE date >= ?${pageFilter} GROUP BY date ORDER BY date ASC`, params);

    // Summary (all pages in that timeframe if 'All' is selected, otherwise just the single page info)
    const summary = await allQuery(`
      SELECT page_name, SUM(reels_posted) as posted, SUM(reels_success) as success, SUM(reels_failed) as failed 
      FROM page_analytics WHERE date >= ?${pageFilter} GROUP BY page_id ORDER BY posted DESC`, params);

    // Detailed analytics list
    const analytics = await allQuery(`SELECT * FROM page_analytics WHERE date >= ?${pageFilter} ORDER BY date DESC, page_name ASC`, params);

    res.json({ analytics, summary, totals: totals || {}, dailyTrend });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics.', details: err.message });
  }
};

exports.getPageDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const days = parseInt(req.query.days) || 30;

    const page = await getQuery(`SELECT * FROM pages WHERE id = ?`, [id]);
    if (!page) return res.status(404).json({ error: 'Page not found' });

    const dailyData = await allQuery(`
      SELECT * FROM page_analytics 
      WHERE page_id = ? AND date >= date('now', '-${days} days')
      ORDER BY date ASC
    `, [id]);

    const recentLogs = await allQuery(`
      SELECT * FROM autopilot_logs 
      WHERE page_id = ? 
      ORDER BY created_at DESC LIMIT 50
    `, [id]);

    const totals = await getQuery(`
      SELECT 
        SUM(reels_posted) as total_posted,
        SUM(reels_success) as total_success,
        SUM(reels_failed) as total_failed
      FROM page_analytics WHERE page_id = ?
    `, [id]);

    res.json({ page, dailyData, recentLogs, totals: totals || {} });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch page detail.' });
  }
};

// ═══════════════════════════════════════
// FOLDER BROWSER
// ═══════════════════════════════════════

exports.browseFolder = (req, res) => {
  // Deprecated: Replaced by manual path entry + scanFolder for Linux server compatibility
  res.status(400).json({ error: 'Browse feature is disabled on the server. Please manually enter the path and use Scan.' });
};

exports.scanFolder = (req, res) => {
  const { folder_path } = req.body;
  if (!folder_path || !fs.existsSync(folder_path)) {
    return res.status(400).json({ error: 'Invalid folder path.' });
  }
  const videos = scanForVideos(folder_path);
  res.json({ count: videos.length, videos: videos.map(v => path.basename(v)) });
};

exports.getPageStats = async (req, res) => {
  try {
    // Get today's stats from autopilot_logs grouped by page
    const todayStats = await allQuery(`
      SELECT 
        page_id,
        page_name,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as today_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as today_failed,
        COUNT(*) as today_total
      FROM autopilot_logs 
      WHERE date(created_at / 1000, 'unixepoch', 'localtime') = date('now', 'localtime')
      GROUP BY page_id
    `);

    // All-time stats
    const allTimeStats = await allQuery(`
      SELECT 
        page_id,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as total_success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        COUNT(*) as total_posts
      FROM autopilot_logs 
      GROUP BY page_id
    `);

    // Last post time per page (most recent success)
    const lastPostTimes = await allQuery(`
      SELECT page_id, MAX(created_at) as last_post_time
      FROM autopilot_logs 
      WHERE status = 'success'
      GROUP BY page_id
    `);

    // Last failed time per page (most recent failure)
    const lastFailedTimes = await allQuery(`
      SELECT page_id, MAX(created_at) as last_failed_time
      FROM autopilot_logs 
      WHERE status = 'failed'
      GROUP BY page_id
    `);

    // Create a map for easy lookup
    const statsMap = {};
    for (const s of todayStats) {
      statsMap[s.page_id] = {
        today_success: s.today_success,
        today_failed: s.today_failed,
        today_total: s.today_total,
        page_name: s.page_name
      };
    }
    for (const s of allTimeStats) {
      if (!statsMap[s.page_id]) statsMap[s.page_id] = {};
      statsMap[s.page_id].total_success = s.total_success;
      statsMap[s.page_id].total_failed = s.total_failed;
      statsMap[s.page_id].total_posts = s.total_posts;
    }
    for (const s of lastPostTimes) {
      if (!statsMap[s.page_id]) statsMap[s.page_id] = {};
      statsMap[s.page_id].last_post_time = s.last_post_time;
    }
    for (const s of lastFailedTimes) {
      if (!statsMap[s.page_id]) statsMap[s.page_id] = {};
      statsMap[s.page_id].last_failed_time = s.last_failed_time;
    }

    res.json({ stats: statsMap });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get page stats.', details: err.message });
  }
};

exports.resetSystem = async (req, res) => {
  try {
    const { runQuery } = require('../database/db');
    await runQuery(`DELETE FROM autopilot_logs`);
    await runQuery(`DELETE FROM page_analytics`);
    await runQuery(`UPDATE autopilot_state SET completed_phases = '[]', status = 'waiting'`);
    res.json({ success: true, message: 'All test data cleared successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset system data.', details: err.message });
  }
};

