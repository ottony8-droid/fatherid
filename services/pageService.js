// services/pageService.js
// Handles registration of pages and folder resolution for bulk operations
const path = require('path');
const fs = require('fs');
const { runQuery, allQuery } = require('../database/db');

/**
 * Register multiple page IDs (and optionally folder paths) in the pages table.
 * If a folder_path is not provided, it will be set to NULL.
 */
async function registerPages(pageIds) {
  for (const id of pageIds) {
    // Insert placeholder values for name, access_token, category, folder_path, user_token
    await runQuery(`INSERT OR REPLACE INTO pages (id, name, access_token, category, folder_path, user_token) VALUES (?,?,?,?,?,?)`, [id, id, null, null, null, null]);
  }
}

/**
 * Resolve the folder path for a given page name inside a master folder.
 * Returns the absolute path if the folder exists, otherwise null.
 */
function resolveFolderForPage(masterFolder, pageName) {
  const candidate = path.join(masterFolder, pageName);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    return candidate;
  }
  return null;
}

module.exports = { registerPages, resolveFolderForPage };
