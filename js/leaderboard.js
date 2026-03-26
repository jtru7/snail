// ============================================================
// leaderboard.js — Cohort leaderboard + 10 Hour Club
// ============================================================

let _lbCohorts       = [];   // admin only
let _lbActiveCohort  = null; // cohortId currently displayed

async function loadLeaderboard() {
  const user = getCurrentUser();
  document.getElementById('leaderboard-content').innerHTML = '<div class="loading-spinner">Loading...</div>';

  if (user.role === 'admin') {
    try {
      _lbCohorts = await api('getAllCohorts', {}, 'GET');
      if (_lbCohorts.length === 0) {
        document.getElementById('leaderboard-content').innerHTML = `
          <div class="card" style="text-align:center; padding:2rem; color:var(--text-light);">
            No cohorts exist yet. Create one in the Admin panel.
          </div>`;
        return;
      }
      // Default to admin's own cohort if they have one, otherwise first cohort
      if (!_lbActiveCohort) {
        _lbActiveCohort = user.cohortId || _lbCohorts[0].cohortId;
      }
    } catch (e) {
      document.getElementById('leaderboard-content').innerHTML =
        `<div class="card"><p style="color:var(--red)">Error: ${e.message}</p></div>`;
      return;
    }
  } else {
    if (!user.cohortId) {
      document.getElementById('leaderboard-content').innerHTML = `
        <div class="card" style="text-align:center; padding:2rem; color:var(--text-light);">
          Join a cohort to see the leaderboard.
        </div>`;
      return;
    }
    _lbActiveCohort = user.cohortId;
  }

  await fetchAndRenderLeaderboard(user);
}

async function switchLbCohort(cohortId) {
  _lbActiveCohort = cohortId;
  await fetchAndRenderLeaderboard(getCurrentUser());
}

async function fetchAndRenderLeaderboard(user) {
  document.getElementById('lb-data').innerHTML = '<div class="loading-spinner">Loading...</div>';

  try {
    const data = await api('getLeaderboard', { cohortId: _lbActiveCohort }, 'GET');

    // Fetch badges for all users in parallel
    const allEntries = [...data.tenHourClub, ...data.leaderboard];
    const badgeResults = await Promise.all(
      allEntries.map(e => api('getUserBadges', { userId: e.userId }, 'GET').catch(() => []))
    );

    const badgeMap = {};
    allEntries.forEach((e, i) => {
      const earned = badgeResults[i] || [];
      badgeMap[e.userId] = earned.map(b => {
        const meta = ALL_BADGES.find(a => a.type === b.badgeType);
        return meta ? meta.emoji : null;
      }).filter(Boolean);
    });

    document.getElementById('lb-data').innerHTML = buildLeaderboardHTML(data, user, badgeMap);
  } catch (e) {
    document.getElementById('lb-data').innerHTML =
      `<div class="card"><p style="color:var(--red)">Error: ${e.message}</p></div>`;
  }
}

// Called on initial load and after cohort switch — sets up the shell + data area
async function fetchAndRenderLeaderboard(user) {
  // Build shell with optional cohort switcher
  const switcher = (user.role === 'admin' && _lbCohorts.length > 1)
    ? `<div style="margin-bottom:1rem;">
        <select class="input" style="width:auto; min-width:200px;"
          onchange="switchLbCohort(this.value)">
          ${_lbCohorts.map(c =>
            `<option value="${c.cohortId}" ${c.cohortId === _lbActiveCohort ? 'selected' : ''}>
              ${escLb(c.name)}
            </option>`
          ).join('')}
        </select>
      </div>`
    : '';

  document.getElementById('leaderboard-content').innerHTML = `
    ${switcher}
    <div id="lb-data"><div class="loading-spinner">Loading...</div></div>
  `;

  try {
    const data = await api('getLeaderboard', { cohortId: _lbActiveCohort }, 'GET');

    const allEntries = [...data.tenHourClub, ...data.leaderboard];
    const badgeResults = await Promise.all(
      allEntries.map(e => api('getUserBadges', { userId: e.userId }, 'GET').catch(() => []))
    );

    const badgeMap = {};
    allEntries.forEach((e, i) => {
      const earned = badgeResults[i] || [];
      badgeMap[e.userId] = earned.map(b => {
        const meta = ALL_BADGES.find(a => a.type === b.badgeType);
        return meta ? meta.emoji : null;
      }).filter(Boolean);
    });

    document.getElementById('lb-data').innerHTML = buildLeaderboardHTML(data, user, badgeMap);
  } catch (e) {
    document.getElementById('lb-data').innerHTML =
      `<div class="card"><p style="color:var(--red)">Error: ${e.message}</p></div>`;
  }
}

async function switchLbCohort(cohortId) {
  _lbActiveCohort = cohortId;
  document.getElementById('lb-data').innerHTML = '<div class="loading-spinner">Loading...</div>';

  const user = getCurrentUser();
  try {
    const data = await api('getLeaderboard', { cohortId: _lbActiveCohort }, 'GET');

    const allEntries = [...data.tenHourClub, ...data.leaderboard];
    const badgeResults = await Promise.all(
      allEntries.map(e => api('getUserBadges', { userId: e.userId }, 'GET').catch(() => []))
    );

    const badgeMap = {};
    allEntries.forEach((e, i) => {
      const earned = badgeResults[i] || [];
      badgeMap[e.userId] = earned.map(b => {
        const meta = ALL_BADGES.find(a => a.type === b.badgeType);
        return meta ? meta.emoji : null;
      }).filter(Boolean);
    });

    document.getElementById('lb-data').innerHTML = buildLeaderboardHTML(data, user, badgeMap);
  } catch (e) {
    document.getElementById('lb-data').innerHTML =
      `<div class="card"><p style="color:var(--red)">Error: ${e.message}</p></div>`;
  }
}

function buildLeaderboardHTML({ leaderboard, tenHourClub }, currentUser, badgeMap) {
  const html = [];

  // ── 10 Hour Club ─────────────────────────────────────────
  if (tenHourClub.length > 0) {
    const members = tenHourClub.map(entry => {
      const isMe   = entry.userId === currentUser.userId;
      const badges = renderBadgePips(badgeMap[entry.userId]);
      return `
        <div class="lb-row club-row ${isMe ? 'lb-me' : ''}">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <span class="lb-rank">🏆</span>
            <img src="${entry.photoUrl || ''}" alt="${escLb(entry.name)}" class="avatar"
              onerror="this.style.display='none'">
            <div>
              <span class="lb-name">${escLb(entry.name)}${isMe ? ' <span class="lb-you">you</span>' : ''}</span>
              ${badges}
            </div>
          </div>
          <span class="lb-hours club-hours">${entry.totalHours}h</span>
        </div>
      `;
    }).join('');

    html.push(`
      <div class="card" style="border: 2px solid var(--orange);">
        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
          <span style="font-size:1.4rem;">🏆</span>
          <h3 style="font-weight:800; color:#7A4F00;">10 Hour Club</h3>
        </div>
        ${members}
      </div>
    `);
  }

  // ── Main leaderboard ─────────────────────────────────────
  if (leaderboard.length === 0 && tenHourClub.length === 0) {
    html.push(`
      <div class="card" style="text-align:center; padding:2rem; color:var(--text-light);">
        No time logged yet in this cohort. Be the first! 🐌
      </div>
    `);
  } else if (leaderboard.length > 0) {
    const rows = leaderboard.map(entry => {
      const isMe   = entry.userId === currentUser.userId;
      const pct    = Math.min(100, (entry.totalMinutes / 600) * 100).toFixed(0);
      const medal  = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null;
      const badges = renderBadgePips(badgeMap[entry.userId]);

      return `
        <div class="lb-row ${isMe ? 'lb-me' : ''}">
          <div style="display:flex; align-items:center; gap:0.75rem; min-width:0;">
            <span class="lb-rank">${medal || `#${entry.rank}`}</span>
            <img src="${entry.photoUrl || ''}" alt="${escLb(entry.name)}" class="avatar"
              onerror="this.style.display='none'">
            <div style="min-width:0;">
              <div class="lb-name">${escLb(entry.name)}${isMe ? ' <span class="lb-you">you</span>' : ''}</div>
              <div class="progress-wrap" style="height:6px; width:120px; margin-top:4px;">
                <div class="progress-fill" style="width:${pct}%;"></div>
              </div>
              ${badges}
            </div>
          </div>
          <span class="lb-hours">${entry.totalHours}h <span style="font-size:0.75rem; color:var(--text-light); font-weight:400;">/ 10</span></span>
        </div>
      `;
    }).join('');

    html.push(`
      <div class="card">
        <h3 class="card-title">Rankings</h3>
        ${rows}
      </div>
    `);
  }

  // ── Nudge if current user not on board (only in their own cohort) ─
  if (currentUser.cohortId === _lbActiveCohort) {
    const allEntries = [...tenHourClub, ...leaderboard];
    const meInList   = allEntries.find(e => e.userId === currentUser.userId);
    if (!meInList) {
      html.push(`
        <div class="snail-nudge">
          You're not on the board yet. Clock in to stake your claim. 🐌
        </div>
      `);
    }
  }

  return html.join('');
}

function renderBadgePips(emojis) {
  if (!emojis || emojis.length === 0) return '';
  return `<div class="lb-badges">${emojis.map(e => `<span class="lb-badge-pip">${e}</span>`).join('')}</div>`;
}

function escLb(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
