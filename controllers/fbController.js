const { db, runQuery, getQuery, allQuery } = require('../database/db');
const { fetchAllPages, getAxiosConfig } = require('../services/facebookService');
const fs = require('fs');
const path = require('path');

async function getDefaultProxyConfig() {
  try {
    const proxy = await getQuery(`SELECT * FROM proxies WHERE enabled = 1 ORDER BY id ASC LIMIT 1`);
    if (proxy) return { type: proxy.type, host: proxy.host, port: proxy.port, username: proxy.username, password: proxy.password };
  } catch (e) {}
  return null;
}

exports.authenticate = async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ error: 'Access token is required' });
  try {
    const axios = require('axios');
    const proxyConfig = await getDefaultProxyConfig();
    const axiosCfg = getAxiosConfig(proxyConfig);
    if (proxyConfig) console.log(`[Auth] Using proxy: ${proxyConfig.host}:${proxyConfig.port}`);
    
    // Fetch user name and ID
    let name = 'Unknown Profile';
    let fb_id = '';
    try {
      const userRes = await axios.get(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${access_token}`, axiosCfg);
      if (userRes.data && userRes.data.name) {
        name = userRes.data.name;
        fb_id = userRes.data.id;
      }
    } catch (e) {
      console.error('[Auth] Could not fetch profile:', e.response?.data?.error?.message || e.message);
    }

    const existing = await getQuery(`SELECT id FROM users WHERE access_token = ?`, [access_token]);
    if (!existing) {
       await runQuery(`INSERT INTO users (access_token, name, fb_id) VALUES (?, ?, ?)`, [access_token, name, fb_id]);
    } else {
       await runQuery(`UPDATE users SET name = ?, fb_id = ? WHERE access_token = ?`, [name, fb_id, access_token]);
    }

    await exports.syncPagesBackground(access_token);
    res.json({ message: 'Token authenticated successfully', session_token: access_token });
  } catch (error) {
    res.status(500).json({ error: 'Database error storing user session.' });
  }
};

exports.syncPagesBackground = async (token) => {
  const axios = require('axios');
  const proxyConfig = await getDefaultProxyConfig();
  const axiosCfg = getAxiosConfig(proxyConfig);
  if (proxyConfig) console.log(`[Sync] Using proxy: ${proxyConfig.host}:${proxyConfig.port}`);
  
  // Clear existing pages for this token to ensure clean state
  await runQuery(`DELETE FROM pages WHERE user_token = ?`, [token]);
  
  // Fetch pages directly with explicit fields to guarantee access_token is returned
  let url = `https://graph.facebook.com/v21.0/me/accounts?access_token=${token}&fields=id,name,access_token,category&limit=100`;
  const pages = [];
  
  while (url) {
    try {
      const res = await axios.get(url, axiosCfg);
      if (res.data && res.data.data) {
        for (const p of res.data.data) {
          pages.push(p);
          await runQuery(
            `INSERT OR REPLACE INTO pages (id, name, access_token, category, folder_path, user_token) VALUES (?, ?, ?, ?, ?, ?)`,
            [p.id, p.name, p.access_token || '', p.category || 'Page', null, token]
          );
        }
      }
      url = res.data.paging?.next || null;
    } catch (err) {
      console.error('[Sync] Error fetching pages:', JSON.stringify(err.response?.data || err.message));
      break;
    }
  }
  
  console.log(`[Sync] Saved ${pages.length} pages with access tokens for token ${token.substring(0, 15)}...`);
  return pages;
}

exports.syncPagesAPI = async (req, res) => {
  const token = req.headers['authorization'];
  if(!token) return res.status(401).json({error: "Missing token"});
  try {
    const syncedPages = await exports.syncPagesBackground(token);
    res.json({ message: 'Pages synced successfully.', total: syncedPages.length, pages: syncedPages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync pages from Facebook API', details: error.message });
  }
}

exports.getPages = async (req, res) => {
  try {
    const pages = await allQuery(`SELECT * FROM pages`);
    res.json({ pages, total: pages.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
};

// 1. New SCANN Endpoint for ViralQueue Box Preview UI
exports.scanFolder = async (req, res) => {
  const { root_folder, include_subfolders, target_page_id } = req.body;
  if(!root_folder || !fs.existsSync(root_folder)) {
     return res.status(400).json({ error: 'Directory does not exist or invalid.' });
  }

  try {
    let filesFound = [];
    const dbPages = await allQuery(`SELECT id, name FROM pages`);
      
    if (!dbPages || dbPages.length === 0) {
       return res.status(400).json({ error: 'No Facebook pages synced! Connect your account first to fetch your pages.' });
    }

    const { target_page_ids } = req.body;
    if(!target_page_ids || !Array.isArray(target_page_ids) || target_page_ids.length === 0) {
       return res.status(400).json({ error: 'Select at least one Target Facebook Page.' });
    }

    const isMulti = target_page_ids.length > 1;

    for (const pId of target_page_ids) {
       const p = dbPages.find(itm => itm.id === pId);
       if(!p) continue;

       let actual_scan_dir = root_folder;
       const smartPath = path.join(root_folder, p.name);
       const isSubfolderMatch = fs.existsSync(smartPath) && fs.statSync(smartPath).isDirectory();

       if (isSubfolderMatch) {
          actual_scan_dir = smartPath;
       } else if (isMulti) {
          continue; // Safety: Require subfolder match in multi-select to avoid duplicate spam from root
       }

       const scanDir = async (dirPath, recursive) => {
         const entries = fs.readdirSync(dirPath, { withFileTypes: true });
         for(let e of entries) {
            if(e.name === 'posted') continue;
            const fullPath = path.join(dirPath, e.name);
            if(e.isDirectory() && recursive) {
               await scanDir(fullPath, recursive);
            } else if (e.isFile() && !e.name.startsWith('.')) {
               filesFound.push(fullPath);
            }
         }
       }
       await scanDir(actual_scan_dir, include_subfolders);
    }
    filesFound.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    
    // Send back UI-friendly mapping format exactly like ViralQueue "local://..."
    res.json({ 
       count: filesFound.length, 
       paths: filesFound
    });
  } catch(err) {
    res.status(500).json({error: "Failed to scan.", details: err.message});
  }
};

// 2. Modified Schedule System
exports.schedulePost = async (req, res) => {
  try {
    const token = req.headers['authorization'];
    if (!token) throw new Error('Auth Missing.');

    const { 
       root_folder, include_subfolders, target_page_ids,
       start_time, distribution_type, distribution_value, distribution_gap, custom_times,
       skip_days, instant_first_post
    } = req.body;

    if (!target_page_ids || !Array.isArray(target_page_ids) || target_page_ids.length === 0) {
       throw new Error("Select at least one Target Facebook Page.");
    }

    if (!fs.existsSync(root_folder)) throw new Error("Invalid Root Path.");
    let startTimeMs = new Date(start_time).getTime();
    if (isNaN(startTimeMs)) throw new Error("Invalid Start Time.");

    if (!instant_first_post && startTimeMs < Date.now() + (20 * 60 * 1000)) {
       throw new Error("Facebook requires the first scheduled post to be at least 20 minutes in the future. Please select a later start time.");
    }

    const dbPages = await allQuery(`SELECT id, name, access_token FROM pages`);
    const skipArray = skip_days ? skip_days.split(',') : [];

    const safelyAdvanceDays = (ms) => {
       let nextMs = ms;
       let limit = 0;
       while (true) {
         limit++; if(limit>50) break;
         const dayName = new Intl.DateTimeFormat('en-US', {weekday: 'short'}).format(new Date(nextMs));
         if(skipArray.includes(dayName)) {
            nextMs += 24 * 60 * 60 * 1000;
         } else break;
       }
       return nextMs;
    };

    let queuedCount = 0;
    const isMulti = target_page_ids.length > 1;
    let bulkQueueInserts = [];
    let pageStaggerOffsetMs = 0; // Prevent local upload congestion

    for (const pId of target_page_ids) {
       const p = dbPages.find(itm => itm.id === pId);
       if(!p) continue;
       
       let actual_run_dir = root_folder;
       const smartPath = path.join(root_folder, p.name);
       const isSubfolderMatch = fs.existsSync(smartPath) && fs.statSync(smartPath).isDirectory();

       if (isSubfolderMatch) {
          actual_run_dir = smartPath;
       } else if (isMulti) {
          continue; // Enforce smart path in multi to avoid duplication
       }

       const extractFiles = (dir, rec) => {
          let local = [];
          fs.readdirSync(dir, {withFileTypes: true}).forEach(e => {
             if(e.name === 'posted') return;
             let full = path.join(dir, e.name);
             if(e.isDirectory() && rec) local.push(...extractFiles(full, rec));
             else if(e.isFile() && !e.name.startsWith('.')) local.push(full);
          }); return local;
       };

       const foundFiles = extractFiles(actual_run_dir, include_subfolders);
       foundFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
       
       if(foundFiles.length === 0) continue; 

       // Apply a staggered starting time to offset bulk local uploads safely
       let currentStamp = startTimeMs + pageStaggerOffsetMs;
       let postOnThisDay = 0;

       if (distribution_type === 'custom_times' && Array.isArray(custom_times) && custom_times.length > 0) {
           const timeParts = custom_times[0].split(':');
           let nd = new Date(currentStamp);
           nd.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
           currentStamp = nd.getTime();
       }

       currentStamp = safelyAdvanceDays(currentStamp);
       let isFirstVideoInBatch = true;
       
       for(let f of foundFiles) {
         const title = path.parse(f).name;
         const qid = Date.now().toString() + Math.floor(Math.random()*100000);
         
         // Core logic: For index 0, intercept the scheduled time fully.
         let assignedTime = currentStamp;
         if (instant_first_post && isFirstVideoInBatch) {
            assignedTime = Date.now(); // Schedule exactly NOW natively bypassing DB constraints
         }
         
         bulkQueueInserts.push({ qid, pid: p.id, pat: p.access_token, title, f, currentStamp: assignedTime, status: 'scheduled' });
         queuedCount++;
         
         if (isFirstVideoInBatch && instant_first_post) {
            // Because the FIRST post was instantly sacrificed, we DO NOT advance the schedule incrementer!
            // This forces Video #2 to logically assume the EXACT `currentStamp` time that Video #1 abandoned.
            isFirstVideoInBatch = false;
            continue; 
         }
         isFirstVideoInBatch = false;

         if (distribution_type === 'custom_times' && Array.isArray(custom_times) && custom_times.length > 0) {
             postOnThisDay++;
             if (postOnThisDay >= custom_times.length) {
                postOnThisDay = 0;
                currentStamp += 24 * 60 * 60 * 1000;
                currentStamp = safelyAdvanceDays(currentStamp);
             }
             const timeParts = custom_times[postOnThisDay].split(':');
             let nd = new Date(currentStamp);
             nd.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
             currentStamp = nd.getTime();
         } 
         else if (distribution_type === 'daily_pattern') {
             const postsPerDay = parseInt(distribution_value) || 1;
             const hoursGap = parseFloat(distribution_gap) || 4;

             postOnThisDay++;
             if (postOnThisDay >= postsPerDay) {
                postOnThisDay = 0;
                let nd = new Date(currentStamp);
                nd.setDate(nd.getDate() + 1);
                const origDate = new Date(startTimeMs);
                nd.setHours(origDate.getHours(), origDate.getMinutes(), 0, 0);
                currentStamp = safelyAdvanceDays(nd.getTime());
             } else {
                currentStamp += hoursGap * 60 * 60 * 1000;
             }
         }
       }
       
       // Increase offset by 3 minutes for next page in loop purely to bottleneck safe background processing
       pageStaggerOffsetMs += (3 * 60 * 1000);
    }

    if (bulkQueueInserts.length > 0) {
       await new Promise((resolve, reject) => {
          db.serialize(() => {
             db.run("BEGIN TRANSACTION");
             const stmt = db.prepare(`INSERT INTO queue (id, page_id, page_access_token, message, media_path, scheduled_time, status) VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`);
             for(let row of bulkQueueInserts) {
                stmt.run(row.qid, row.pid, row.pat, row.title, row.f, row.currentStamp);
             }
             stmt.finalize();
             db.run("COMMIT", (err) => {
                if (err) reject(err); else resolve();
             });
          });
       });
    }

    res.json({ message: 'Success', total_queued: queuedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getQueueState = async (req, res) => {
  try {
    const queue = await allQuery(`SELECT id, page_id, message, media_path, scheduled_time, status, error_msg FROM queue ORDER BY scheduled_time ASC`);
    res.json({ queue });
  } catch(err) {
    res.status(500).json({ error: 'Failed to retreive queue entries.' });
  }
};

exports.browseFolder = (req, res) => {
  res.status(400).json({ error: 'Browse is not available on Linux VPS. Please type the path manually and click Scan.' });
};

exports.updateQueueItemTime = async (req, res) => {
  try {
    const { runQuery } = require('../database/db');
    const { scheduled_time } = req.body;
    if (!scheduled_time) return res.status(400).json({ error: 'Missing scheduled_time' });

    await runQuery(`UPDATE queue SET scheduled_time = ? WHERE id = ?`, [scheduled_time, req.params.id]);
    res.json({ success: true, message: 'Time updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update time.' });
  }
};

exports.deleteQueueItem = async (req, res) => {
  try {
    const { runQuery } = require('../database/db');
    await runQuery(`DELETE FROM queue WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task.' });
  }
};

exports.clearQueue = async (req, res) => {
  try {
    const { runQuery } = require('../database/db');
    const { page_id } = req.query;
    if (page_id) {
       await runQuery(`DELETE FROM queue WHERE page_id = ?`, [page_id]);
    } else {
       await runQuery(`DELETE FROM queue`);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear queue.' });
  }
};

exports.deletePage = async (req, res) => {
  try {
    const { runQuery } = require('../database/db');
    await runQuery(`DELETE FROM pages WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete page.' });
  }
};

exports.getTokens = async (req, res) => {
  try {
    const { allQuery } = require('../database/db');
    const tokens = await allQuery(`
      SELECT u.id, u.access_token, u.name, u.fb_id, COUNT(p.id) as pageCount 
      FROM users u 
      LEFT JOIN pages p ON u.access_token = p.user_token 
      GROUP BY u.id
    `);
    res.json({ tokens });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
};

exports.deleteToken = async (req, res) => {
  try {
    const { runQuery, getQuery } = require('../database/db');
    const user = await getQuery(`SELECT access_token FROM users WHERE id = ?`, [req.params.id]);
    if(user) {
      await runQuery(`DELETE FROM pages WHERE user_token = ?`, [user.access_token]);
      await runQuery(`DELETE FROM users WHERE id = ?`, [req.params.id]);
    }
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: 'Failed' });
  }
};

// ═══════════════════════════════════════
// PROXY MANAGEMENT
// ═══════════════════════════════════════

exports.getProxies = async (req, res) => {
  try {
    const proxies = await allQuery(`SELECT * FROM proxies ORDER BY created_at DESC`);
    res.json({ proxies });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch proxies.' });
  }
};

exports.addProxy = async (req, res) => {
  try {
    const { name, type, host, port, username, password } = req.body;
    if (!name || !host || !port) {
      return res.status(400).json({ error: 'Name, host, and port are required.' });
    }
    const validTypes = ['http', 'https', 'socks4', 'socks5'];
    const proxyType = validTypes.includes(type) ? type : 'http';

    const result = await runQuery(
      `INSERT INTO proxies (name, type, host, port, username, password) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, proxyType, host, parseInt(port), username || null, password || null]
    );
    res.json({ success: true, id: result.id, message: `Proxy "${name}" added.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add proxy.', details: err.message });
  }
};

exports.updateProxy = async (req, res) => {
  try {
    const { name, type, host, port, username, password, enabled } = req.body;
    const { id } = req.params;
    await runQuery(
      `UPDATE proxies SET name=?, type=?, host=?, port=?, username=?, password=?, enabled=? WHERE id=?`,
      [name, type, host, parseInt(port), username || null, password || null, enabled ? 1 : 0, id]
    );
    res.json({ success: true, message: 'Proxy updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update proxy.' });
  }
};

exports.deleteProxy = async (req, res) => {
  try {
    const { id } = req.params;
    await runQuery(`DELETE FROM page_proxy WHERE proxy_id = ?`, [id]);
    await runQuery(`DELETE FROM proxies WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete proxy.' });
  }
};

exports.testProxy = async (req, res) => {
  try {
    const { type, host, port, username, password } = req.body;
    const { getAxiosConfig } = require('../services/facebookService');
    const axiosCfg = getAxiosConfig({ type, host, port: parseInt(port), username, password });
    
    const axios = require('axios');
    
    // Use HTTPS endpoints for better proxy compatibility
    let ip = '';
    let location = '';
    let country = '';
    
    const ipRes = await axios.get('https://api.ipify.org?format=json', { ...axiosCfg, timeout: 15000 });
    ip = ipRes.data?.ip || '';
    
    if (ip) {
      try {
        const geoRes = await axios.get(`https://ipinfo.io/${ip}/json`, { ...axiosCfg, timeout: 10000 });
        location = `${geoRes.data?.city || ''}, ${geoRes.data?.country || ''}`;
        country = geoRes.data?.country || '';
      } catch (e) {}
      
      res.json({ success: true, ip, location: location || 'Unknown', country: country || 'Unknown' });
    } else {
      res.json({ success: false, error: 'Could not determine proxy IP.' });
    }
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
};

exports.assignProxyToPages = async (req, res) => {
  try {
    const { proxy_id, page_ids } = req.body;
    if (!proxy_id || !Array.isArray(page_ids)) {
      return res.status(400).json({ error: 'proxy_id and page_ids array are required.' });
    }

    // Remove old mappings for this proxy
    await runQuery(`DELETE FROM page_proxy WHERE proxy_id = ?`, [proxy_id]);

    // Insert new mappings
    for (const pageId of page_ids) {
      await runQuery(`INSERT OR REPLACE INTO page_proxy (page_id, proxy_id) VALUES (?, ?)`, [pageId, proxy_id]);
    }

    res.json({ success: true, message: `Proxy assigned to ${page_ids.length} page(s).` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign proxy.', details: err.message });
  }
};

exports.getPageProxyMappings = async (req, res) => {
  try {
    const mappings = await allQuery(`
      SELECT pp.page_id, pp.proxy_id, p.name as proxy_name, p.type, p.host, p.port
      FROM page_proxy pp
      JOIN proxies p ON pp.proxy_id = p.id
    `);
    res.json({ mappings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch proxy mappings.' });
  }
};
