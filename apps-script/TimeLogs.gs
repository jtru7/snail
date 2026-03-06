// ============================================================
// TimeLogs.gs — Clock in/out, retro logs, CRUD, leaderboard
// ============================================================

function clockIn(tokenInfo) {
  const user = getUserByEmail(tokenInfo.email);
  if (!user) throw new Error('User not found');
  if (!user.data.cohortId) throw new Error('You must join a cohort before logging time');

  const active = getActiveSessionForUser(user.data.userId);
  if (active) throw new Error('You already have an active session. Please clock out first.');

  const sheet   = getSheet('time_logs');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const startTime = now();
  const log = {
    logId:           generateId(),
    userId:          user.data.userId,
    cohortId:        user.data.cohortId,
    startTime,
    endTime:         '',
    durationMinutes: 0,
    notes:           '',
    isRetro:         false,
    createdAt:       startTime,
    updatedAt:       startTime
  };
  sheet.appendRow(objectToRow(headers, log));
  return log;
}

function clockOut(params, tokenInfo) {
  const user = getUserByEmail(tokenInfo.email);
  if (!user) throw new Error('User not found');

  const active = getActiveSessionForUser(user.data.userId);
  if (!active) throw new Error('No active session found');

  const endTime       = now();
  const durationMinutes = Math.round((new Date(endTime) - new Date(active.data.startTime)) / 60000);
  const notes         = params.notes || '';

  updateRowById('time_logs', 'logId', active.data.logId, { endTime, durationMinutes, notes, updatedAt: endTime });

  try { checkAndAwardBadges(tokenInfo); } catch (_) {}

  return { ...active.data, endTime, durationMinutes, notes };
}

function getActiveSession(tokenInfo) {
  const user = getUserByEmail(tokenInfo.email);
  if (!user) throw new Error('User not found');
  const active = getActiveSessionForUser(user.data.userId);
  return { session: active ? active.data : null };
}

// Internal helper — returns { row, headers, data } or null
function getActiveSessionForUser(userId) {
  const sheet  = getSheet('time_logs');
  const data   = sheet.getDataRange().getValues();
  const headers = data[0];
  const userIdCol  = headers.indexOf('userId');
  const endTimeCol = headers.indexOf('endTime');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][userIdCol]) === String(userId) &&
        String(data[i][endTimeCol]) === '') {
      return { row: i + 1, headers, data: rowToObject(headers, data[i]) };
    }
  }
  return null;
}

function createRetroLog(params, tokenInfo) {
  const user = getUserByEmail(tokenInfo.email);
  if (!user) throw new Error('User not found');
  if (!user.data.cohortId) throw new Error('You must join a cohort before logging time');
  if (!params.startTime || !params.endTime) throw new Error('startTime and endTime are required');

  const start = new Date(params.startTime);
  const end   = new Date(params.endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('Invalid date format');
  if (end <= start) throw new Error('endTime must be after startTime');

  const durationMinutes = Math.round((end - start) / 60000);
  const sheet   = getSheet('time_logs');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const ts      = now();

  const log = {
    logId:           generateId(),
    userId:          user.data.userId,
    cohortId:        user.data.cohortId,
    startTime:       start.toISOString(),
    endTime:         end.toISOString(),
    durationMinutes,
    notes:           params.notes || '',
    isRetro:         true,
    createdAt:       ts,
    updatedAt:       ts
  };
  sheet.appendRow(objectToRow(headers, log));

  try { checkAndAwardBadges(tokenInfo); } catch (_) {}

  return log;
}

function updateTimeLog(params, tokenInfo) {
  const user = getUserByEmail(tokenInfo.email);
  if (!user) throw new Error('User not found');
  if (!params.logId) throw new Error('logId is required');

  const logResult = findRowById('time_logs', 'logId', params.logId);
  if (!logResult) throw new Error('Time log not found');

  if (logResult.data.userId !== user.data.userId && user.data.role !== 'admin') {
    throw new Error('Access denied');
  }

  const updates = { updatedAt: now() };

  if (params.notes !== undefined) updates.notes = params.notes;

  if (params.startTime !== undefined || params.endTime !== undefined) {
    const start = new Date(params.startTime || logResult.data.startTime);
    const end   = new Date(params.endTime   || logResult.data.endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('Invalid date format');
    if (end <= start) throw new Error('endTime must be after startTime');
    updates.startTime       = start.toISOString();
    updates.endTime         = end.toISOString();
    updates.durationMinutes = Math.round((end - start) / 60000);
  }

  updateRowById('time_logs', 'logId', params.logId, updates);

  try { checkAndAwardBadges(tokenInfo); } catch (_) {}

  return { ...logResult.data, ...updates };
}

function deleteTimeLog(params, tokenInfo) {
  const user = getUserByEmail(tokenInfo.email);
  if (!user) throw new Error('User not found');
  if (!params.logId) throw new Error('logId is required');

  const logResult = findRowById('time_logs', 'logId', params.logId);
  if (!logResult) throw new Error('Time log not found');

  if (logResult.data.userId !== user.data.userId && user.data.role !== 'admin') {
    throw new Error('Access denied');
  }

  deleteRowById('time_logs', 'logId', params.logId);
  return { success: true };
}

function getTimeLogs(params, tokenInfo) {
  const user = getUserByEmail(tokenInfo.email);
  if (!user) throw new Error('User not found');

  let targetUserId = user.data.userId;
  if (params.userId && params.userId !== user.data.userId) {
    if (user.data.role !== 'admin') throw new Error('Access denied');
    targetUserId = params.userId;
  }

  const sheet  = getSheet('time_logs');
  const data   = sheet.getDataRange().getValues();
  const headers = data[0];
  const userIdCol = headers.indexOf('userId');

  const logs = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][userIdCol]) === String(targetUserId)) {
      logs.push(rowToObject(headers, data[i]));
    }
  }

  logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return logs;
}

function getLeaderboard(params, tokenInfo) {
  const user = getUserByEmail(tokenInfo.email);
  if (!user) throw new Error('User not found');

  const cohortId = params.cohortId || user.data.cohortId;
  if (!cohortId) throw new Error('No cohort specified');

  // Verify requester is in this cohort or is admin
  if (user.data.cohortId !== cohortId && user.data.role !== 'admin') {
    throw new Error('Access denied');
  }

  // Gather all users in the cohort
  const usersSheet = getSheet('users');
  const usersData  = usersSheet.getDataRange().getValues();
  const usersHdrs  = usersData[0];
  const cohortUsers = usersData.slice(1)
    .map(row => rowToObject(usersHdrs, row))
    .filter(u => String(u.cohortId) === String(cohortId));

  if (cohortUsers.length === 0) return { leaderboard: [], tenHourClub: [] };

  // Sum completed time log minutes per user
  const logsSheet = getSheet('time_logs');
  const logsData  = logsSheet.getDataRange().getValues();
  const logsHdrs  = logsData[0];
  const endTimeCol = logsHdrs.indexOf('endTime');

  const minutesByUser = {};
  for (let i = 1; i < logsData.length; i++) {
    const log = rowToObject(logsHdrs, logsData[i]);
    if (String(log.cohortId) === String(cohortId) && String(logsData[i][endTimeCol]) !== '') {
      const uid = String(log.userId);
      minutesByUser[uid] = (minutesByUser[uid] || 0) + Number(log.durationMinutes || 0);
    }
  }

  const entries = cohortUsers.map(u => ({
    userId:       u.userId,
    name:         u.name,
    photoUrl:     u.photoUrl,
    totalMinutes: minutesByUser[u.userId] || 0,
    totalHours:   Math.round(((minutesByUser[u.userId] || 0) / 60) * 10) / 10
  }));

  entries.sort((a, b) => b.totalMinutes - a.totalMinutes);

  const ranked      = entries.map((e, i) => ({ ...e, rank: i + 1 }));
  const tenHourClub = ranked.filter(e => e.totalMinutes >= 600);
  const leaderboard = ranked.filter(e => e.totalMinutes < 600);

  return { leaderboard, tenHourClub };
}
