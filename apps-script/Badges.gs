// ============================================================
// Badges.gs — Badge computation and awarding
// ============================================================

const BADGE_META = {
  hours_1:         { label: '1 Hour',           description: 'Logged your first hour!' },
  hours_5:         { label: '5 Hours',           description: 'Halfway there — 5 hours logged.' },
  hours_10:        { label: '10 Hour Club',      description: 'Challenge complete! 10 hours logged.' },
  streak_5:        { label: '5-Day Streak',      description: '5 consecutive workdays with a log.' },
  weekend_warrior: { label: 'Weekend Warrior',   description: 'Logged time on a weekend.' },
  posts_5:         { label: 'Prolific Poster',   description: '5 shared journal entries.' },
  posts_10:        { label: 'Storyteller',       description: '10 shared journal entries.' },
  posts_20:        { label: 'Community Pillar',  description: '20 shared journal entries.' }
};

function getUserBadges(params, tokenInfo) {
  const user = getUserByEmail(tokenInfo.email);
  if (!user) throw new Error('User not found');

  const targetUserId = params.userId || user.data.userId;

  const sheet   = getSheet('badges');
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const userIdCol = headers.indexOf('userId');

  const badges = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][userIdCol]) === String(targetUserId)) {
      const badge = rowToObject(headers, data[i]);
      badge.meta  = BADGE_META[badge.badgeType] || {};
      badges.push(badge);
    }
  }

  badges.sort((a, b) => new Date(a.earnedAt) - new Date(b.earnedAt));
  return badges;
}

function checkAndAwardBadges(tokenInfo) {
  const user = getUserByEmail(tokenInfo.email);
  if (!user) return { awarded: [] };

  const userId = user.data.userId;

  // ── Load already-earned badge types ──────────────────────
  const badgeSheet   = getSheet('badges');
  const badgeData    = badgeSheet.getDataRange().getValues();
  const badgeHeaders = badgeData[0];
  const earnedSet    = new Set();

  for (let i = 1; i < badgeData.length; i++) {
    if (String(badgeData[i][badgeHeaders.indexOf('userId')]) === String(userId)) {
      earnedSet.add(badgeData[i][badgeHeaders.indexOf('badgeType')]);
    }
  }

  // ── Load completed time logs ──────────────────────────────
  const logsSheet   = getSheet('time_logs');
  const logsData    = logsSheet.getDataRange().getValues();
  const logsHeaders = logsData[0];
  const logsUserCol = logsHeaders.indexOf('userId');
  const logsEndCol  = logsHeaders.indexOf('endTime');

  const completedLogs = [];
  for (let i = 1; i < logsData.length; i++) {
    if (String(logsData[i][logsUserCol]) === String(userId) &&
        String(logsData[i][logsEndCol])  !== '') {
      completedLogs.push(rowToObject(logsHeaders, logsData[i]));
    }
  }

  const totalMinutes = completedLogs.reduce((sum, log) => sum + Number(log.durationMinutes || 0), 0);

  // ── Load shared journal entry count ───────────────────────
  const journalSheet   = getSheet('journal_entries');
  const journalData    = journalSheet.getDataRange().getValues();
  const journalHeaders = journalData[0];
  const journalUserCol = journalHeaders.indexOf('userId');
  const journalSharedCol = journalHeaders.indexOf('isShared');

  let sharedCount = 0;
  for (let i = 1; i < journalData.length; i++) {
    if (String(journalData[i][journalUserCol]) === String(userId)) {
      const v = journalData[i][journalSharedCol];
      if (v === true || v === 'TRUE' || v === 'true') sharedCount++;
    }
  }

  // ── Evaluate each badge ───────────────────────────────────
  const toAward = [];

  if (!earnedSet.has('hours_1')         && totalMinutes >= 60)   toAward.push('hours_1');
  if (!earnedSet.has('hours_5')         && totalMinutes >= 300)  toAward.push('hours_5');
  if (!earnedSet.has('hours_10')        && totalMinutes >= 600)  toAward.push('hours_10');
  if (!earnedSet.has('posts_5')         && sharedCount  >= 5)    toAward.push('posts_5');
  if (!earnedSet.has('posts_10')        && sharedCount  >= 10)   toAward.push('posts_10');
  if (!earnedSet.has('posts_20')        && sharedCount  >= 20)   toAward.push('posts_20');

  if (!earnedSet.has('weekend_warrior')) {
    const hasWeekend = completedLogs.some(log => isWeekend(log.startTime));
    if (hasWeekend) toAward.push('weekend_warrior');
  }

  if (!earnedSet.has('streak_5')) {
    if (hasConsecutiveWorkdayStreak(completedLogs, 5)) toAward.push('streak_5');
  }

  // ── Write new badges ──────────────────────────────────────
  const earnedAt = now();
  const awarded  = [];

  toAward.forEach(badgeType => {
    const badge = { badgeId: generateId(), userId, badgeType, earnedAt };
    badgeSheet.appendRow(objectToRow(badgeHeaders, badge));
    awarded.push({ ...badge, meta: BADGE_META[badgeType] || {} });
  });

  return { awarded };
}

// ── Streak helpers ────────────────────────────────────────

/**
 * Returns true if `logs` contains at least `n` consecutive M–F workdays
 * each having at least one completed log entry.
 */
function hasConsecutiveWorkdayStreak(completedLogs, n) {
  if (completedLogs.length === 0) return false;

  // Collect unique workday date strings (YYYY-MM-DD)
  const workdaySet = new Set();
  completedLogs.forEach(log => {
    if (isWorkday(log.startTime)) workdaySet.add(toDateString(log.startTime));
  });
  if (workdaySet.size < n) return false;

  const dates = Array.from(workdaySet).sort(); // ascending

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const expectedNext = toDateString(nextWorkday(new Date(dates[i - 1])).toISOString());
    if (expectedNext === dates[i]) {
      streak++;
      if (streak >= n) return true;
    } else {
      streak = 1;
    }
  }
  return false;
}

/** Returns the next Monday–Friday date after `date` (a Date object). */
function nextWorkday(date) {
  const d = new Date(date);
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}
