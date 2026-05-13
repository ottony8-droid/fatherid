const cron = require('node-cron');
const { runQuery, getQuery, allQuery } = require('../database/db');
const { postToPage } = require('../services/facebookService');
const fs = require('fs');
const path = require('path');

const startCronJob = () => {
  cron.schedule('* * * * *', async () => {
    const now = Date.now();
    
    try {
      const pendingPosts = await allQuery(`SELECT * FROM queue WHERE status = 'scheduled' AND scheduled_time <= ?`, [now]);
      
      if (pendingPosts.length > 0) {
        console.log(`[AutoReel System] Pipeline picked up ${pendingPosts.length} post(s) to publish...`);
      }

      for (const post of pendingPosts) {
        try {
          // Duplicate check: skip if already processing/published
          const existing = await getQuery(
            `SELECT id FROM queue WHERE page_id = ? AND media_path = ? AND status IN ('processing', 'published') AND id != ?`,
            [post.page_id, post.media_path, post.id]
          );
          if (existing) {
            console.log(`[AutoReel System] Duplicate detected for ID=${post.id}, skipping.`);
            await runQuery(`UPDATE queue SET status = 'skipped', error_msg = 'Duplicate detected' WHERE id = ?`, [post.id]);
            continue;
          }

          await runQuery(`UPDATE queue SET status = 'processing' WHERE id = ?`, [post.id]);
          console.log(`[AutoReel System] Executing Sequence ID=${post.id}`);
          
          // Resolve proxy for this page
          let proxyConfig = null;
          try {
            const mapping = await getQuery(
              `SELECT p.* FROM proxies p INNER JOIN page_proxy pp ON p.id = pp.proxy_id WHERE pp.page_id = ? AND p.enabled = 1 LIMIT 1`,
              [post.page_id]
            );
            proxyConfig = mapping || null;
          } catch (e) {}

          await postToPage(post.page_id, post.page_access_token, post.message, post.media_path, proxyConfig);
          
          await runQuery(`UPDATE queue SET status = 'published' WHERE id = ?`, [post.id]);
          console.log(`[AutoReel System] Sequence ID=${post.id} Published safely!`);

          // Track in posted_videos for global dedup
          if (post.media_path) {
            const videoName = path.basename(post.media_path);
            let videoSize = 0;
            try { videoSize = fs.statSync(post.media_path).size; } catch (e) {}
            await runQuery(
              `INSERT OR IGNORE INTO posted_videos (video_name, video_size, page_id) VALUES (?, ?, ?)`,
              [videoName, videoSize, post.page_id]
            );
          }
          
          // Archive video to prevent duplications
          if (post.media_path && fs.existsSync(post.media_path)) {
             try {
                const mediaDir = path.dirname(post.media_path);
                const fileName = path.basename(post.media_path);
                const postedDir = path.join(mediaDir, 'posted');
                
                if(!fs.existsSync(postedDir)) {
                   fs.mkdirSync(postedDir, { recursive: true });
                }
                
                const finalDestPath = path.join(postedDir, fileName);
                fs.renameSync(post.media_path, finalDestPath);
             } catch(err) { 
                console.error("[AutoReel Cleanup Warn] Discarding archive move issue:", err.message);
             }
          }

        } catch (error) {
          await runQuery(`UPDATE queue SET status = 'failed', error_msg = ? WHERE id = ?`, [error.message, post.id]);
          console.error(`[AutoReel System] Task ID=${post.id} Aborted:`, error.message);
        }
      }
    } catch(dbErr) {
       console.error("[AutoReel Error] ", dbErr);
    }
  });
  
  console.log('[AutoReel System] Background Node.js Worker Active...');
};

module.exports = { startCronJob };
