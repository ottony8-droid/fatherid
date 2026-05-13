// Enhanced store with persistence helpers
const { runQuery, allQuery } = require('./database/db');

module.exports = {
  // Access token for Facebook API
  accessToken: null,

  // In‑memory cache of scheduled posts (used for quick UI access)
  scheduledPosts: [],

  /**
   * Persist a scheduled job to the SQLite queue table.
   * @param {Object} job – { id, page_id, page_access_token, message, media_path, scheduled_time }
   */
  async saveScheduledJob(job) {
    const sql = `INSERT INTO queue (id, page_id, page_access_token, message, media_path, scheduled_time, status) VALUES (?,?,?,?,?,?,'pending')`;
    await runQuery(sql, [job.id, job.page_id, job.page_access_token, job.message, job.media_path, job.scheduled_time]);
    this.scheduledPosts.push(job);
  },

  /** Load all pending jobs from DB into memory */
  async loadPendingJobs() {
    const rows = await allQuery(`SELECT * FROM queue WHERE status = 'pending'`);
    this.scheduledPosts = rows;
    return rows;
  },

  /** Flush any in‑memory jobs that haven't been persisted yet */
  async flushInMemoryQueues() {
    for (const job of this.scheduledPosts) {
      const exists = await allQuery(`SELECT 1 FROM queue WHERE id = ?`, [job.id]);
      if (!exists.length) {
        await this.saveScheduledJob(job);
      }
    }
  }
};
