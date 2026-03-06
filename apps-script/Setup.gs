// ============================================================
// Setup.gs — One-time spreadsheet initializer
//
// HOW TO USE:
//   1. Open your Google Sheet, then go to Extensions → Apps Script
//   2. Paste / sync all .gs files into the project
//   3. Fill in SPREADSHEET_ID and CLIENT_ID in Code.gs
//   4. Run initializeSpreadsheet() once from the editor
//   5. Verify the 6 tabs appear with headers, then deploy as Web App
// ============================================================

/**
 * Creates all required sheet tabs and writes header rows.
 * Safe to re-run — skips tabs that already exist and already have headers.
 */
function initializeSpreadsheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const SHEETS = [
    {
      name: 'users',
      headers: ['userId', 'email', 'name', 'photoUrl', 'role', 'cohortId', 'joinDate', 'lastActive']
    },
    {
      name: 'cohorts',
      headers: ['cohortId', 'name', 'joinCode', 'createdBy', 'createdAt']
    },
    {
      name: 'time_logs',
      headers: ['logId', 'userId', 'cohortId', 'startTime', 'endTime', 'durationMinutes', 'notes', 'isRetro', 'createdAt', 'updatedAt']
    },
    {
      name: 'journal_entries',
      headers: ['entryId', 'userId', 'cohortId', 'content', 'isShared', 'createdAt', 'updatedAt']
    },
    {
      name: 'badges',
      headers: ['badgeId', 'userId', 'badgeType', 'earnedAt']
    },
    {
      name: 'feed',
      headers: ['feedId', 'entryId', 'userId', 'cohortId', 'preview', 'sharedAt']
    }
  ];

  const results = [];

  SHEETS.forEach(({ name, headers }) => {
    let sheet = ss.getSheetByName(name);

    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      // Bold and freeze the header row
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
      results.push(`✓ Created: ${name}`);
    } else {
      // Sheet exists — check if headers are already written
      const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const hasHeaders = existingHeaders[0] === headers[0];
      if (!hasHeaders) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
        results.push(`✓ Headers written: ${name}`);
      } else {
        results.push(`– Already set up: ${name}`);
      }
    }
  });

  // Delete the default "Sheet1" if it's empty and still exists
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
    results.push('– Removed default Sheet1');
  }

  Logger.log('Setup complete:\n' + results.join('\n'));
  SpreadsheetApp.getUi().alert('Setup complete!\n\n' + results.join('\n'));
}
