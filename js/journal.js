// ============================================================
// journal.js — Community Feed
// ============================================================

let _feedEntries    = [];
let _feedCohorts    = [];   // admin only
let _feedActiveCohort = null;

// ── Entry point ─────────────────────────────────────────────
async function loadJournal() {
  document.getElementById('journal-content').innerHTML = '<div class="loading-spinner">Loading...</div>';

  const user = getCurrentUser();

  if (user.role === 'admin') {
    try {
      _feedCohorts = await api('getAllCohorts', {}, 'GET');
      if (_feedCohorts.length === 0) {
        document.getElementById('journal-content').innerHTML = `
          <div class="card" style="text-align:center; padding:2rem; color:var(--text-light);">
            No cohorts exist yet. Create one in the Admin panel.
          </div>`;
        return;
      }
      if (!_feedActiveCohort) {
        _feedActiveCohort = user.cohortId || _feedCohorts[0].cohortId;
      }
    } catch (e) {
      document.getElementById('journal-content').innerHTML =
        `<div class="card"><p style="color:var(--red)">Error: ${e.message}</p></div>`;
      return;
    }
  } else {
    if (!user.cohortId) {
      document.getElementById('journal-content').innerHTML = `
        <div class="card" style="text-align:center; padding:2rem; color:var(--text-light);">
          Join a cohort to access the Community Feed.
        </div>`;
      return;
    }
    _feedActiveCohort = user.cohortId;
  }

  await fetchAndRenderFeed();
}

async function switchFeedCohort(cohortId) {
  _feedActiveCohort = cohortId;
  document.getElementById('feed-data').innerHTML = '<div class="loading-spinner">Loading...</div>';
  try {
    _feedEntries = await api('getCohortFeed', { cohortId: _feedActiveCohort }, 'GET');
    document.getElementById('feed-data').innerHTML = buildFeedHTML();
  } catch (e) {
    document.getElementById('feed-data').innerHTML =
      `<div class="card"><p style="color:var(--red)">Error: ${e.message}</p></div>`;
  }
}

async function fetchAndRenderFeed() {
  const user = getCurrentUser();

  const switcher = (user.role === 'admin' && _feedCohorts.length > 1)
    ? `<div style="margin-bottom:1rem;">
        <select class="input" style="width:auto; min-width:200px;"
          onchange="switchFeedCohort(this.value)">
          ${_feedCohorts.map(c =>
            `<option value="${c.cohortId}" ${c.cohortId === _feedActiveCohort ? 'selected' : ''}>
              ${escJournal(c.name)}
            </option>`
          ).join('')}
        </select>
      </div>`
    : '';

  // Only show composer for user's own cohort (admins posting to a foreign cohort is confusing)
  const canPost = user.cohortId === _feedActiveCohort;
  const composer = canPost ? `
    <div class="card">
      <h3 class="card-title">Post to Community</h3>
      <textarea id="community-post-text" class="input" rows="4"
        placeholder="Share an insight, tip, or experiment from your AI work..."
        style="resize:vertical;"></textarea>
      <div style="display:flex; justify-content:flex-end; margin-top:0.6rem;">
        <button class="btn btn-primary" onclick="doPostToCommunity()">Post</button>
      </div>
    </div>` : '';

  document.getElementById('journal-content').innerHTML = `
    ${switcher}
    ${composer}
    <div id="feed-data"><div class="loading-spinner">Loading...</div></div>
  `;

  try {
    _feedEntries = await api('getCohortFeed', { cohortId: _feedActiveCohort }, 'GET');
    document.getElementById('feed-data').innerHTML = buildFeedHTML();
  } catch (e) {
    document.getElementById('feed-data').innerHTML =
      `<div class="card"><p style="color:var(--red)">Error: ${e.message}</p></div>`;
  }
}

function buildFeedHTML() {
  if (_feedEntries.length === 0) {
    return `<div class="card" style="text-align:center; padding:2rem; color:var(--text-light);">
      No posts yet. Be the first to share something! 🐌
    </div>`;
  }

  return _feedEntries.map(entry => {
    const date = new Date(entry.sharedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `
      <div class="feed-card">
        <div class="feed-card-header">
          <img src="${entry.authorPhoto || ''}" alt="${escJournal(entry.authorName)}" class="avatar"
            onerror="this.style.display='none'">
          <div>
            <div style="font-weight:700; font-size:0.9rem;">${escJournal(entry.authorName)}</div>
            <div style="font-size:0.78rem; color:var(--text-light);">${date}</div>
          </div>
        </div>
        <p class="feed-preview">${escJournal(entry.preview)}</p>
      </div>
    `;
  }).join('');
}

// ── Actions ──────────────────────────────────────────────────
async function doPostToCommunity() {
  const content = document.getElementById('community-post-text').value.trim();
  if (!content) { showError('Post cannot be empty.'); return; }

  const btn = document.querySelector('#journal-content .btn-primary');
  btn.disabled = true; btn.textContent = 'Posting...';

  try {
    const entry = await api('createEntry', { content });
    await api('shareEntry', { entryId: entry.entryId });
    document.getElementById('community-post-text').value = '';
    showSuccess('Posted to Community Feed!');
    _feedEntries = await api('getCohortFeed', { cohortId: _feedActiveCohort }, 'GET');
    document.getElementById('feed-data').innerHTML = buildFeedHTML();
    btn.disabled = false; btn.textContent = 'Post';
  } catch (e) {
    showError(e.message);
    btn.disabled = false; btn.textContent = 'Post';
  }
}

// ── Helpers ──────────────────────────────────────────────────
function escJournal(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
