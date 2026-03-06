// ============================================================
// Admin.gs — Admin-only cohort export and wipe operations
// ============================================================

/**
 * Export all data for a cohort as structured JSON.
 * The frontend is responsible for converting to CSV if needed.
 */
function exportCohortData(params, tokenInfo) {
  const requester = getUserByEmail(tokenInfo.email);
  if (!requester || requester.data.role !== 'admin') throw new Error('Admin access required');
  if (!params.cohortId) throw new Error('cohortId is required');

  const cohortId  = params.cohortId;
  const cohortRow = findRowById('cohorts', 'cohortId', cohortId);
  if (!cohortRow) throw new Error('Cohort not found');

  // Users in cohort
  const usersSheet = getSheet('users');
  const usersData  = usersSheet.getDataRange().getValues();
  const usersHdrs  = usersData[0];
  const cohortUsers = usersData.slice(1)
    .map(row => rowToObject(usersHdrs, row))
    .filter(u => String(u.cohortId) === String(cohortId));

  const userIds = new Set(cohortUsers.map(u => String(u.userId)));

  // Time logs for cohort
  const logsSheet = getSheet('time_logs');
  const logsData  = logsSheet.getDataRange().getValues();
  const logsHdrs  = logsData[0];
  const timeLogs  = logsData.slice(1)
    .map(row => rowToObject(logsHdrs, row))
    .filter(log => String(log.cohortId) === String(cohortId));

  // Journal entries for cohort
  const journalSheet  = getSheet('journal_entries');
  const journalData   = journalSheet.getDataRange().getValues();
  const journalHdrs   = journalData[0];
  const journalEntries = journalData.slice(1)
    .map(row => rowToObject(journalHdrs, row))
    .filter(e => String(e.cohortId) === String(cohortId));

  // Badges for cohort users
  const badgeSheet = getSheet('badges');
  const badgeData  = badgeSheet.getDataRange().getValues();
  const badgeHdrs  = badgeData[0];
  const badges     = badgeData.slice(1)
    .map(row => rowToObject(badgeHdrs, row))
    .filter(b => userIds.has(String(b.userId)));

  return {
    cohort:         cohortRow.data,
    users:          cohortUsers,
    timeLogs,
    journalEntries,
    badges
  };
}

/**
 * Permanently delete all data for a cohort:
 *   - Removes time_logs, journal_entries, feed, and badges for cohort members
 *   - Resets users' cohortId to ''
 *   - Deletes the cohort record
 *
 * Requires { cohortId, confirmed: true } in params to prevent accidents.
 */
function deleteCohortData(params, tokenInfo) {
  const requester = getUserByEmail(tokenInfo.email);
  if (!requester || requester.data.role !== 'admin') throw new Error('Admin access required');
  if (!params.cohortId) throw new Error('cohortId is required');
  if (!params.confirmed) throw new Error('Pass confirmed: true to confirm deletion');

  const cohortId  = params.cohortId;
  const cohortRow = findRowById('cohorts', 'cohortId', cohortId);
  if (!cohortRow) throw new Error('Cohort not found');
  const cohortName = cohortRow.data.name;

  // Identify users in cohort (we need their IDs to clear badges)
  const usersSheet = getSheet('users');
  const usersData  = usersSheet.getDataRange().getValues();
  const usersHdrs  = usersData[0];
  const cohortIdCol = usersHdrs.indexOf('cohortId') + 1; // 1-based for getRange

  const cohortUserIds = new Set();
  for (let i = 1; i < usersData.length; i++) {
    if (String(usersData[i][usersHdrs.indexOf('cohortId')]) === String(cohortId)) {
      cohortUserIds.add(String(usersData[i][usersHdrs.indexOf('userId')]));
    }
  }

  // Delete cohort-scoped rows in bulk (bottom-to-top to preserve indices)
  deleteRowsWhere('time_logs',       row => String(row.cohortId) === String(cohortId));
  deleteRowsWhere('journal_entries', row => String(row.cohortId) === String(cohortId));
  deleteRowsWhere('feed',            row => String(row.cohortId) === String(cohortId));
  deleteRowsWhere('badges',          row => cohortUserIds.has(String(row.userId)));

  // Reset cohortId on each cohort member (re-read after deletions above)
  const freshUsersData = usersSheet.getDataRange().getValues();
  for (let i = freshUsersData.length - 1; i >= 1; i--) {
    if (String(freshUsersData[i][usersHdrs.indexOf('cohortId')]) === String(cohortId)) {
      usersSheet.getRange(i + 1, cohortIdCol).setValue('');
    }
  }

  // Finally, delete the cohort record itself
  deleteRowById('cohorts', 'cohortId', cohortId);

  return { success: true, deleted: cohortName };
}

// ── Shared bulk-delete helper ─────────────────────────────

/**
 * Delete all rows in `sheetName` where predicate(rowObj) returns true.
 * Iterates bottom-to-top so row deletions don't shift remaining indices.
 */
function deleteRowsWhere(sheetName, predicate) {
  const sheet   = getSheet(sheetName);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = data.length - 1; i >= 1; i--) {
    if (predicate(rowToObject(headers, data[i]))) {
      sheet.deleteRow(i + 1);
    }
  }
}
