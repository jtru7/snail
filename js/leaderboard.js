// ============================================================
// leaderboard.js — Cohort leaderboard + 10 Hour Club
// ============================================================

async function loadLeaderboard() {
  const user = getCurrentUser();

  if (!user.cohortId) {
    document.getElementById('leaderboard-content').innerHTML = `
      <div class="card" style="text-align:center; padding:2rem; color:var(--text-light);">
        Join a cohort to see the leaderboard.
      </div>`;
    return;
  }

  document.getElementById('leaderboard-content').innerHTML = '<div class="loading-spinner">Loading...</div>';

  try {
    const data = await api('getLeaderboard', {}, 'GET');
    renderLeaderboard(data, user);
  } catch (e) {
    document.getElementById('leaderboard-content').innerHTML =
      `<div class="card"><p style="color:var(--red)">Error: ${e.message}</p></div>`;
  }
}

function renderLeaderboard({ leaderboard, tenHourClub }, currentUser) {
  const html = [];

  // ── 10 Hour Club ─────────────────────────────────────────
  if (tenHourClub.length > 0) {
    const members = tenHourClub.map(entry => {
      const isMe = entry.userId === currentUser.userId;
      return `
        <div class="lb-row club-row ${isMe ? 'lb-me' : ''}">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <span class="lb-rank">🏆</span>
            <img src="${entry.photoUrl || ''}" alt="${escLb(entry.name)}" class="avatar"
              onerror="this.style.display='none'">
            <span class="lb-name">${escLb(entry.name)}${isMe ? ' <span class="lb-you">you</span>' : ''}</span>
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
      const isMe  = entry.userId === currentUser.userId;
      const pct   = Math.min(100, (entry.totalMinutes / 600) * 100).toFixed(0);
      const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null;

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

  // ── Current user not on board yet ────────────────────────
  const allEntries = [...tenHourClub, ...leaderboard];
  const meInList   = allEntries.find(e => e.userId === currentUser.userId);
  if (!meInList) {
    html.push(`
      <div class="snail-nudge">
        You're not on the board yet. Clock in to stake your claim. 🐌
      </div>
    `);
  }

  document.getElementById('leaderboard-content').innerHTML = html.join('');
}

function escLb(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
