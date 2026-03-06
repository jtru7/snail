// ============================================================
// Journal.gs — Journal entry CRUD + community feed
// ============================================================

function createEntry(params, tokenInfo) {
  const user = getUserByEmail(tokenInfo.email);
  if (!user) throw new Error('User not found');
  if (!params.content || !params.content.trim()) throw new Error('Content is required');

  const sheet   = getSheet('journal_entries');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const ts      = now();

  const entry = {
    entryId:   generateId(),
    userId:    user.data.userId,
    cohortId:  user.data.cohortId || '',
    content:   params.content.trim(),
    isShared:  false,
    createdAt: ts,
    updatedAt: ts
  };
  sheet.appendRow(objectToRow(headers, entry));
  return entry;
}

function updateEntry(params, tokenInfo) {
  const user = getUserByEmail(tokenInfo.email);
  if (!user) throw new Error('User not found');
  if (!params.entryId) throw new Error('entryId is required');
  if (!params.content || !params.content.trim()) throw new Error('Content is required');

  const result = findRowById('journal_entries', 'entryId', params.entryId);
  if (!result) throw new Error('Entry not found');

  if (result.data.userId !== user.data.userId && user.data.role !== 'admin') {
    throw new Error('Access denied');
  }

  const updates = { content: params.content.trim(), updatedAt: now() };
  updateRowById('journal_entries', 'entryId', params.entryId, updates);

  // Keep feed preview in sync if this entry is shared
  if (result.data.isShared === true || result.data.isShared === 'TRUE' || result.data.isShared === 'true') {
    try {
      const feedRow = findRowById('feed', 'entryId', params.entryId);
      if (feedRow) {
        updateRowById('feed', 'entryId', params.entryId, { preview: params.content.trim().substring(0, 200) });
      }
    } catch (_) {}
  }

  return { ...result.data, ...updates };
}

function deleteEntry(params, tokenInfo) {
  const user = getUserByEmail(tokenInfo.email);
  if (!user) throw new Error('User not found');
  if (!params.entryId) throw new Error('entryId is required');

  const result = findRowById('journal_entries', 'entryId', params.entryId);
  if (!result) throw new Error('Entry not found');

  if (result.data.userId !== user.data.userId && user.data.role !== 'admin') {
    throw new Error('Access denied');
  }

  deleteRowById('journal_entries', 'entryId', params.entryId);

  // Remove from feed if it was shared
  const isShared = result.data.isShared;
  if (isShared === true || isShared === 'TRUE' || isShared === 'true') {
    try { deleteRowById('feed', 'entryId', params.entryId); } catch (_) {}
  }

  return { success: true };
}

function shareEntry(params, tokenInfo) {
  const user = getUserByEmail(tokenInfo.email);
  if (!user) throw new Error('User not found');
  if (!params.entryId) throw new Error('entryId is required');

  const result = findRowById('journal_entries', 'entryId', params.entryId);
  if (!result) throw new Error('Entry not found');
  if (result.data.userId !== user.data.userId) throw new Error('Access denied');

  const alreadyShared = result.data.isShared === true || result.data.isShared === 'TRUE' || result.data.isShared === 'true';
  if (alreadyShared) return { alreadyShared: true };
  if (!user.data.cohortId) throw new Error('You must join a cohort to share entries');

  const ts = now();
  updateRowById('journal_entries', 'entryId', params.entryId, { isShared: true, updatedAt: ts });

  const feedSheet   = getSheet('feed');
  const feedHeaders = feedSheet.getRange(1, 1, 1, feedSheet.getLastColumn()).getValues()[0];

  const feedEntry = {
    feedId:   generateId(),
    entryId:  params.entryId,
    userId:   user.data.userId,
    cohortId: user.data.cohortId,
    preview:  result.data.content.substring(0, 200),
    sharedAt: ts
  };
  feedSheet.appendRow(objectToRow(feedHeaders, feedEntry));

  try { checkAndAwardBadges(tokenInfo); } catch (_) {}

  return feedEntry;
}

function getUserEntries(params, tokenInfo) {
  const user = getUserByEmail(tokenInfo.email);
  if (!user) throw new Error('User not found');

  let targetUserId = user.data.userId;
  if (params.userId && params.userId !== user.data.userId) {
    if (user.data.role !== 'admin') throw new Error('Access denied');
    targetUserId = params.userId;
  }

  const sheet   = getSheet('journal_entries');
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const userIdCol = headers.indexOf('userId');

  const entries = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][userIdCol]) === String(targetUserId)) {
      entries.push(rowToObject(headers, data[i]));
    }
  }

  entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return entries;
}

function getCohortFeed(params, tokenInfo) {
  const user = getUserByEmail(tokenInfo.email);
  if (!user) throw new Error('User not found');

  const cohortId = params.cohortId || user.data.cohortId;
  if (!cohortId) throw new Error('No cohort specified');

  if (user.data.cohortId !== cohortId && user.data.role !== 'admin') {
    throw new Error('Access denied');
  }

  // Get feed entries for cohort
  const feedSheet = getSheet('feed');
  const feedData  = feedSheet.getDataRange().getValues();
  const feedHdrs  = feedData[0];
  const cohortCol = feedHdrs.indexOf('cohortId');

  const feedEntries = feedData.slice(1)
    .filter(row => String(row[cohortCol]) === String(cohortId))
    .map(row => rowToObject(feedHdrs, row));

  // Build a userId -> { name, photoUrl } map for enrichment
  const usersSheet = getSheet('users');
  const usersData  = usersSheet.getDataRange().getValues();
  const usersHdrs  = usersData[0];
  const userMap    = {};
  usersData.slice(1).forEach(row => {
    const u = rowToObject(usersHdrs, row);
    userMap[u.userId] = { name: u.name, photoUrl: u.photoUrl };
  });

  const enriched = feedEntries.map(entry => ({
    ...entry,
    authorName:  (userMap[entry.userId] || {}).name     || 'Unknown',
    authorPhoto: (userMap[entry.userId] || {}).photoUrl || ''
  }));

  enriched.sort((a, b) => new Date(b.sharedAt) - new Date(a.sharedAt));

  const limit = params.limit ? Math.max(1, parseInt(params.limit, 10)) : 50;
  return enriched.slice(0, limit);
}
