// ============================================================
// Auth.gs — Token verification & user management
// ============================================================

function verifyToken(token) {
  if (!token) return null;
  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return null;
    const payload = JSON.parse(response.getContentText());
    // Validate audience matches our client ID
    if (payload.aud !== CLIENT_ID) return null;
    return {
      email:    payload.email,
      name:     payload.name,
      photoUrl: payload.picture,
      sub:      payload.sub
    };
  } catch (e) {
    return null;
  }
}

function getOrCreateUser(tokenInfo) {
  const sheet   = getSheet('users');
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf('email');

  // Return existing user
  for (let i = 1; i < data.length; i++) {
    if (data[i][emailCol] === tokenInfo.email) {
      return rowToObject(headers, data[i]);
    }
  }

  // Create new user (role defaults to 'user')
  const newUser = {
    userId:     generateId(),
    email:      tokenInfo.email,
    name:       tokenInfo.name,
    photoUrl:   tokenInfo.photoUrl,
    role:       'user',
    cohortId:   '',
    joinDate:   now(),
    lastActive: now()
  };
  sheet.appendRow(objectToRow(headers, newUser));
  return newUser;
}

function getUserByEmail(email) {
  const sheet   = getSheet('users');
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf('email');
  for (let i = 1; i < data.length; i++) {
    if (data[i][emailCol] === email) {
      return { row: i + 1, data: rowToObject(headers, data[i]) };
    }
  }
  return null;
}

function getUserById(userId) {
  const result = findRowById('users', 'userId', userId);
  return result; // { row, headers, data } or null
}

function updateLastActive(email) {
  try {
    const result = getUserByEmail(email);
    if (!result) return;
    const sheet   = getSheet('users');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const col     = headers.indexOf('lastActive') + 1;
    sheet.getRange(result.row, col).setValue(now());
  } catch (_) {}
}

function updateUserRole(params, tokenInfo) {
  const requester = getUserByEmail(tokenInfo.email);
  if (!requester || requester.data.role !== 'admin') throw new Error('Admin access required');

  const validRoles = ['user', 'admin'];
  if (!validRoles.includes(params.role)) throw new Error('Invalid role');

  const target = getUserById(params.targetUserId);
  if (!target) throw new Error('Target user not found');

  updateRowById('users', 'userId', params.targetUserId, { role: params.role });
  return { success: true };
}

function getUserProfile(userId, tokenInfo) {
  const requester = getUserByEmail(tokenInfo.email);
  if (!requester) throw new Error('Requester not found');

  // Users can view their own profile; admins can view anyone
  if (requester.data.userId !== userId && requester.data.role !== 'admin') {
    throw new Error('Access denied');
  }
  const target = getUserById(userId);
  if (!target) throw new Error('User not found');
  return target.data;
}

function getAllUsers(tokenInfo) {
  const requester = getUserByEmail(tokenInfo.email);
  if (!requester || requester.data.role !== 'admin') throw new Error('Admin access required');

  const sheet   = getSheet('users');
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(row => rowToObject(headers, row));
}
