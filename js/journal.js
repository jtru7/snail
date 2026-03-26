// ============================================================
// journal.js — Community Feed
// ============================================================

let _feedEntries = [];

// ── Entry point ─────────────────────────────────────────────
async function loadJournal() {
  document.getElementById('journal-content').innerHTML = '<div class="loading-spinner">Loading...</div>';

  const user = getCurrentUser();

  if (!user.cohortId) {
    document.getElementById('journal-content').innerHTML = `
      <div class="card" style="text-align:center; padding:2rem; color:var(--text-light);">
        Join a cohort to access the Community Feed.
      </div>`;
    return;
  }

  try {
    _feedEntries = await api('getCohortFeed', {}, 'GET');
    renderJournal();
  } catch (e) {
    document.getElementById('journal-content').innerHTML =
      `<div class="card"><p style="color:var(--red)">Error: ${e.message}</p></div>`;
  }
}

// ── Render ───────────────────────────────────────────────────
function renderJournal() {
  const feedCards = _feedEntries.length
    ? _feedEntries.map(entry => {
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
      }).join('')
    : `<div class="card" style="text-align:center; padding:2rem; color:var(--text-light);">
        No posts yet. Be the first to share something! 🐌
      </div>`;

  document.getElementById('journal-content').innerHTML = `

    <!-- Composer -->
    <div class="card">
      <h3 class="card-title">Post to Community</h3>
      <textarea id="community-post-text" class="input" rows="4"
        placeholder="Share an insight, tip, or experiment from your AI work..."
        style="resize:vertical;"></textarea>
      <div style="display:flex; justify-content:flex-end; margin-top:0.6rem;">
        <button class="btn btn-primary" onclick="doPostToCommunity()">Post</button>
      </div>
    </div>

    <!-- Feed -->
    <div id="feed-list">${feedCards}</div>
  `;
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
    // Reload feed to show the new post
    _feedEntries = await api('getCohortFeed', {}, 'GET');
    renderJournal();
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
