// ============================================================
// Utils.gs — Shared spreadsheet helpers
// ============================================================

function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i]; });
  return obj;
}

function objectToRow(headers, obj) {
  return headers.map(h => (obj[h] !== undefined ? obj[h] : ''));
}

/** Returns { row (1-based), headers, data } or null */
function findRowById(sheetName, idField, idValue) {
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol   = headers.indexOf(idField);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(idValue)) {
      return { row: i + 1, headers, data: rowToObject(headers, data[i]) };
    }
  }
  return null;
}

function updateRowById(sheetName, idField, idValue, updates) {
  const result = findRowById(sheetName, idField, idValue);
  if (!result) throw new Error(`Record not found in ${sheetName} (${idField}=${idValue})`);
  const sheet = getSheet(sheetName);
  result.headers.forEach((h, i) => {
    if (updates[h] !== undefined) {
      sheet.getRange(result.row, i + 1).setValue(updates[h]);
    }
  });
  return { success: true };
}

function deleteRowById(sheetName, idField, idValue) {
  const result = findRowById(sheetName, idField, idValue);
  if (!result) throw new Error(`Record not found in ${sheetName}`);
  getSheet(sheetName).deleteRow(result.row);
  return { success: true };
}

// ── Date helpers ────────────────────────────────────────────

function isWorkday(dateStr) {
  const day = new Date(dateStr).getDay();
  return day >= 1 && day <= 5;
}

function isWeekend(dateStr) {
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
}

function toDateString(dateStr) {
  return new Date(dateStr).toISOString().split('T')[0];
}

/** Count workdays between d1 and d2 (exclusive d1, inclusive d2) */
function getWorkdayDiff(d1, d2) {
  let count = 0;
  const cursor = new Date(d1);
  while (cursor < d2) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day >= 1 && day <= 5) count++;
  }
  return count;
}
