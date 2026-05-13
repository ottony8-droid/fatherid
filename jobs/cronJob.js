const cron = require('node-cron');
const { runQuery, allQuery } = require('../database/db');
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
          await runQuery(`UPDATE queue SET status = 'processing' WHERE id = ?`, [post.id]);
          console.log(`[AutoReel System] Executing Sequence ID=${post.id}`);
          
          await postToPage(post.page_id, post.page_access_token, post.message, post.media_path);
          
          await runQuery(`UPDATE queue SET status = 'published' WHERE id = ?`, [post.id]);
          console.log(`[AutoReel System] Sequence ID=${post.id} Published safely!`);
          
          // AutoReel Logic: Physically archive video to prevent duplications natively
          if (post.media_path && fs.existsSync(post.media_path)) {
             try {
                const mediaDir = path.dirname(post.media_path);
                const fileName = path.basename(post.media_path);
                const postedDir = path.join(mediaDir, 'posted');
                
                // Guarantee the /posted directory exists in target specific Page folder
                if(!fs.existsSync(postedDir)) {
                   fs.mkdirSync(postedDir);
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
