// ============================================================
// Cohorts.gs — Cohort creation, join codes, membership
// ============================================================

function createCohort(params, tokenInfo) {
  const requester = getUserByEmail(tokenInfo.email);
  if (!requester || requester.data.role !== 'admin') throw new Error('Admin access required');
  if (!params.name || !params.name.trim()) throw new Error('Cohort name is required');

  const sheet   = getSheet('cohorts');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Guarantee unique join code
  let joinCode;
  let attempts = 0;
  do {
    joinCode = generateJoinCode();
    attempts++;
    if (attempts > 20) throw new Error('Could not generate unique join code');
  } while (getCohortByCode(joinCode));

  const cohort = {
    cohortId:  generateId(),
    name:      params.name.trim(),
    joinCode,
    createdBy: requester.data.userId,
    createdAt: now()
  };
  sheet.appendRow(objectToRow(headers, cohort));
  return cohort;
}

function joinCohort(params, tokenInfo) {
  const requester = getUserByEmail(tokenInfo.email);
  if (!requester) throw new Error('User not found');

  const code   = (params.joinCode || '').toUpperCase().trim();
  const cohort = getCohortByCode(code);
  if (!cohort) throw new Error('Invalid join code');

  updateRowById('users', 'userId', requester.data.userId, { cohortId: cohort.cohortId });
  return { success: true, cohort };
}

function getCohortByCode(code) {
  const sheet   = getSheet('cohorts');
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const codeCol = headers.indexOf('joinCode');
  for (let i = 1; i < data.length; i++) {
    if (data[i][codeCol] === code) return rowToObject(headers, data[i]);
  }
  return null;
}

function getMyCohort(tokenInfo) {
  const requester = getUserByEmail(tokenInfo.email);
  if (!requester || !requester.data.cohortId) return { cohort: null };
  const result = findRowById('cohorts', 'cohortId', requester.data.cohortId);
  return { cohort: result ? result.data : null };
}

function getAllCohorts(tokenInfo) {
  const requester = getUserByEmail(tokenInfo.email);
  if (!requester || requester.data.role !== 'admin') throw new Error('Admin access required');

  const sheet   = getSheet('cohorts');
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(row => rowToObject(headers, row));
}
