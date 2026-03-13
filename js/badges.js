// ============================================================
// badges.js — Badge display
// ============================================================

const ALL_BADGES = [
  { type: 'hours_1',         emoji: '⏱️',  label: '1 Hour',          description: 'Logged your first hour!' },
  { type: 'hours_5',         emoji: '⚡',  label: '5 Hours',          description: 'Halfway there — 5 hours logged.' },
  { type: 'hours_10',        emoji: '🏆',  label: '10 Hour Club',     description: 'Challenge complete! 10 hours logged.' },
  { type: 'streak_5',        emoji: '🔥',  label: '5-Day Streak',     description: '5 consecutive workdays with a log.' },
  { type: 'weekend_warrior', emoji: '🌟',  label: 'Weekend Warrior',  description: 'Logged time on a weekend.' },
  { type: 'posts_5',         emoji: '📝',  label: 'Prolific Poster',  description: '5 shared journal entries.' },
  { type: 'posts_10',        emoji: '📚',  label: 'Storyteller',      description: '10 shared journal entries.' },
  { type: 'posts_20',        emoji: '🌍',  label: 'Community Pillar', description: '20 shared journal entries.' },
];

async function loadBadges() {
  document.getElementById('badges-content').innerHTML = '<div class="loading-spinner">Loading...</div>';

  try {
    const earned = await api('getUserBadges', {}, 'GET');
    renderBadges(earned);
  } catch (e) {
    document.getElementById('badges-content').innerHTML =
      `<div class="card"><p style="color:var(--red)">Error: ${e.message}</p></div>`;
  }
}

function renderBadges(earned) {
  const earnedMap = {};
  earned.forEach(b => { earnedMap[b.badgeType] = b; });

  const earnedCount = earned.length;
  const totalCount  = ALL_BADGES.length;

  const cards = ALL_BADGES.map(badge => {
    const b       = earnedMap[badge.type];
    const isEarned = !!b;
    const date    = isEarned
      ? new Date(b.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null;

    return `
      <div class="badge-card ${isEarned ? 'badge-earned' : 'badge-locked'}">
        <div class="badge-emoji">${isEarned ? badge.emoji : '🔒'}</div>
        <div class="badge-label">${badge.label}</div>
        <div class="badge-desc">${badge.description}</div>
        ${isEarned
          ? `<div class="badge-date">Earned ${date}</div>`
          : `<div class="badge-date badge-date-locked">Not yet earned</div>`
        }
      </div>
    `;
  }).join('');

  document.getElementById('badges-content').innerHTML = `

    <!-- Summary -->
    <div class="card" style="text-align:center; padding:1.5rem;">
      <div style="font-size:2.5rem; font-weight:800; color:var(--green);">${earnedCount}<span style="font-size:1.2rem; color:var(--text-light); font-weight:400;"> / ${totalCount}</span></div>
      <div style="font-weight:600; margin-bottom:0.75rem; color:var(--text-light);">badges earned</div>
      <div class="progress-wrap">
        <div class="progress-fill" style="width:${((earnedCount / totalCount) * 100).toFixed(0)}%"></div>
      </div>
      ${earnedCount === 0 ? `<p class="snail-nudge" style="margin-top:1rem; margin-bottom:0;">No badges yet. The snail is disappointed. But hopeful.</p>` : ''}
      ${earnedCount === totalCount ? `<p style="margin-top:1rem; font-weight:700; color:var(--green);">All badges earned! The snail is absolutely flying. 🐌💨</p>` : ''}
    </div>

    <!-- Badge grid -->
    <div class="badge-grid">
      ${cards}
    </div>

    <!-- Refresh button -->
    <div style="text-align:center; margin-top:0.5rem;">
      <button class="btn btn-ghost" onclick="recheckBadges()">Check for new badges</button>
    </div>
  `;

  updateMascotSpeed(earnedCount);
}

async function recheckBadges() {
  const btn = document.querySelector('#badges-content .btn-ghost');
  btn.disabled = true; btn.textContent = 'Checking...';

  try {
    const result = await api('checkBadges', {});
    if (result.awarded && result.awarded.length > 0) {
      const names = result.awarded.map(b => b.meta?.label || b.badgeType).join(', ');
      showSuccess(`New badge${result.awarded.length > 1 ? 's' : ''} earned: ${names}!`);
      loadBadges();
    } else {
      showSuccess('All caught up — no new badges yet.');
      btn.disabled = false; btn.textContent = 'Check for new badges';
    }
  } catch (e) {
    showError(e.message);
    btn.disabled = false; btn.textContent = 'Check for new badges';
  }
}
