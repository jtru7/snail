// ============================================================
// journal.js — Journal entries + community feed
// ============================================================

let _journalEntries = [];
let _feedEntries    = [];
let _journalTab     = 'mine';

// ── Entry point ─────────────────────────────────────────────
async function loadJournal() {
  document.getElementById('journal-content').innerHTML = '<div class="loading-spinner">Loading...</div>';

  const user = getCurrentUser();

  try {
    const fetches = [api('getUserEntries', {})];
    if (user.cohortId) fetches.push(api('getCohortFeed', {}, 'GET'));

    const [entries, feed] = await Promise.all(fetches);
    _journalEntries = entries;
    _feedEntries    = feed || [];
    renderJournal();
  } catch (e) {
    document.getElementById('journal-content').innerHTML =
      `<div class="card"><p style="color:var(--red)">Error: ${e.message}</p></div>`;
  }
}

// ── Shell ────────────────────────────────────────────────────
function renderJournal() {
  const user = getCurrentUser();

  document.getElementById('journal-content').innerHTML = `
    <div class="admin-tabs">
      <button class="admin-tab ${_journalTab === 'mine' ? 'active' : ''}"
        onclick="switchJournalTab('mine')">My Journal (${_journalEntries.length})</button>
      <button class="admin-tab ${_journalTab === 'feed' ? 'active' : ''}"
        onclick="switchJournalTab('feed')"
        ${!user.cohortId ? 'disabled title="Join a cohort to see the feed"' : ''}>
        Community Feed (${_feedEntries.length})
      </button>
    </div>
    <div id="journal-tab-content"></div>
  `;
  renderJournalTab();
}

function switchJournalTab(tab) {
  _journalTab = tab;
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.admin-tab[onclick*="${tab}"]`).classList.add('active');
  renderJournalTab();
}

function renderJournalTab() {
  const el = document.getElementById('journal-tab-content');
  if (_journalTab === 'mine') el.innerHTML = renderMyJournal();
  else                        el.innerHTML = renderFeed();
}

// ── My Journal tab ───────────────────────────────────────────
function renderMyJournal() {
  const user    = getCurrentUser();
  const entries = _journalEntries.map(e => renderEntryCard(e, user)).join('');

  return `
    <!-- New entry -->
    <div class="card">
      <h3 class="card-title">New Entry</h3>
      <textarea id="new-entry-text" class="input" rows="4"
        placeholder="What did you try with AI today? What worked? What didn't?"
        style="resize:vertical;"></textarea>
      <div style="display:flex; justify-content:flex-end; margin-top:0.6rem;">
        <button class="btn btn-primary" onclick="doCreateEntry()">Save Entry</button>
      </div>
    </div>

    <!-- Entry list -->
    <div id="entry-list">
      ${entries || '<p style="text-align:center; color:var(--text-light); padding:1.5rem; font-size:0.9rem;">No entries yet. Write your first one above!</p>'}
    </div>
  `;
}

function renderEntryCard(entry, user) {
  const date     = new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const edited   = entry.updatedAt !== entry.createdAt
    ? `<span style="font-size:0.75rem; color:var(--text-light);"> · edited</span>` : '';
  const shared   = isTruthy(entry.isShared);
  const canShare = !shared && !!user.cohortId;

  return `
    <div class="journal-card" id="jentry-${entry.entryId}">
      <div class="journal-card-header">
        <span class="journal-date">${date}${edited}</span>
        <div style="display:flex; gap:0.4rem; align-items:center;">
          ${shared
            ? `<span class="shared-badge">✓ Shared</span>`
            : canShare
              ? `<button class="btn btn-ghost" style="font-size:0.75rem; padding:0.3rem 0.65rem;"
                   onclick="doShareEntry('${entry.entryId}')">Share to Feed</button>`
              : ''
          }
          <button class="btn btn-ghost" style="font-size:0.75rem; padding:0.3rem 0.65rem;"
            onclick="toggleEntryEdit('${entry.entryId}')">Edit</button>
          <button class="btn btn-ghost" style="font-size:0.75rem; padding:0.3rem 0.65rem; color:var(--red);"
            onclick="doDeleteEntry('${entry.entryId}')">✕</button>
        </div>
      </div>

      <!-- Content view -->
      <div id="jview-${entry.entryId}" class="journal-content-text">${escJournal(entry.content)}</div>

      <!-- Edit form (hidden) -->
      <div id="jedit-${entry.entryId}" class="hidden" style="margin-top:0.75rem;">
        <textarea class="input" id="jedit-text-${entry.entryId}" rows="4"
          style="resize:vertical;">${escAttr(entry.content)}</textarea>
        <div style="display:flex; gap:0.5rem; justify-content:flex-end; margin-top:0.5rem;">
          <button class="btn btn-primary" onclick="doUpdateEntry('${entry.entryId}')">Save</button>
          <button class="btn btn-ghost" onclick="toggleEntryEdit('${entry.entryId}')">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

// ── Community Feed tab ───────────────────────────────────────
function renderFeed() {
  if (_feedEntries.length === 0) {
    return `<div class="card" style="text-align:center; padding:2rem; color:var(--text-light);">
      No shared entries yet. Be the first to share one from My Journal!
    </div>`;
  }

  const cards = _feedEntries.map(entry => {
    const date = new Date(entry.sharedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `
      <div class="feed-card">
        <div class="feed-card-header">
          <img src="${entry.authorPhoto || ''}" alt="${escAttr(entry.authorName)}" class="avatar"
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

  return `<div>${cards}</div>`;
}

// ── Actions ──────────────────────────────────────────────────
async function doCreateEntry() {
  const content = document.getElementById('new-entry-text').value.trim();
  if (!content) { showError('Entry cannot be empty.'); return; }

  const btn = document.querySelector('#journal-tab-content .btn-primary');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    const entry = await api('createEntry', { content });
    _journalEntries.unshift(entry);
    document.getElementById('new-entry-text').value = '';
    showSuccess('Entry saved.');
    renderJournalTab();
  } catch (e) {
    showError(e.message);
    btn.disabled = false; btn.textContent = 'Save Entry';
  }
}

function toggleEntryEdit(entryId) {
  const view = document.getElementById(`jview-${entryId}`);
  const edit = document.getElementById(`jedit-${entryId}`);
  const isEditing = !edit.classList.contains('hidden');

  if (isEditing) {
    edit.classList.add('hidden');
    view.classList.remove('hidden');
  } else {
    edit.classList.remove('hidden');
    view.classList.add('hidden');
    document.getElementById(`jedit-text-${entryId}`)?.focus();
  }
}

async function doUpdateEntry(entryId) {
  const content = document.getElementById(`jedit-text-${entryId}`)?.value.trim();
  if (!content) { showError('Entry cannot be empty.'); return; }

  const btn = document.querySelector(`#jedit-${entryId} .btn-primary`);
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    const updated = await api('updateEntry', { entryId, content });
    const idx = _journalEntries.findIndex(e => e.entryId === entryId);
    if (idx !== -1) _journalEntries[idx] = updated;
    showSuccess('Entry updated.');
    renderJournalTab();
  } catch (e) {
    showError(e.message);
    btn.disabled = false; btn.textContent = 'Save';
  }
}

async function doDeleteEntry(entryId) {
  if (!confirm('Delete this journal entry?')) return;

  try {
    await api('deleteEntry', { entryId });
    _journalEntries = _journalEntries.filter(e => e.entryId !== entryId);
    showSuccess('Entry deleted.');
    renderJournalTab();
  } catch (e) {
    showError(e.message);
  }
}

async function doShareEntry(entryId) {
  const btn = document.querySelector(`#jentry-${entryId} button[onclick*="doShareEntry"]`);
  if (btn) { btn.disabled = true; btn.textContent = 'Sharing...'; }

  try {
    const result = await api('shareEntry', { entryId });
    const idx = _journalEntries.findIndex(e => e.entryId === entryId);
    if (idx !== -1) _journalEntries[idx].isShared = true;
    if (!result.alreadyShared) _feedEntries.unshift(result);
    showSuccess('Shared to the community feed!');
    renderJournalTab();
  } catch (e) {
    showError(e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Share to Feed'; }
  }
}

// ── Utilities ────────────────────────────────────────────────
function isTruthy(val) {
  return val === true || val === 'TRUE' || val === 'true';
}

function escJournal(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function escAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
