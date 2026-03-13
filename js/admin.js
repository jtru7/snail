// ============================================================
// admin.js — Admin panel
// ============================================================

let _adminCohorts = [];
let _adminUsers   = [];
let _adminTab     = 'cohorts';

// ── Entry point ─────────────────────────────────────────────
async function loadAdmin() {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') {
    document.getElementById('admin-content').innerHTML =
      `<div class="card" style="text-align:center; padding:2rem; color:var(--red);">Admin access required.</div>`;
    return;
  }

  document.getElementById('admin-content').innerHTML = '<div class="loading-spinner">Loading...</div>';

  try {
    const [cohorts, users] = await Promise.all([
      api('getAllCohorts', {}, 'GET'),
      api('getAllUsers',   {}, 'GET'),
    ]);
    _adminCohorts = cohorts;
    _adminUsers   = users;
    renderAdmin();
  } catch (e) {
    document.getElementById('admin-content').innerHTML =
      `<div class="card"><p style="color:var(--red)">Error: ${e.message}</p></div>`;
  }
}

// ── Shell ────────────────────────────────────────────────────
function renderAdmin() {
  document.getElementById('admin-content').innerHTML = `
    <div class="admin-tabs">
      <button class="admin-tab ${_adminTab === 'cohorts' ? 'active' : ''}"
        onclick="switchAdminTab('cohorts')">Cohorts (${_adminCohorts.length})</button>
      <button class="admin-tab ${_adminTab === 'users' ? 'active' : ''}"
        onclick="switchAdminTab('users')">Users (${_adminUsers.length})</button>
    </div>
    <div id="admin-tab-content"></div>
  `;
  renderAdminTab();
}

function switchAdminTab(tab) {
  _adminTab = tab;
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.admin-tab[onclick*="${tab}"]`).classList.add('active');
  renderAdminTab();
}

function renderAdminTab() {
  const el = document.getElementById('admin-tab-content');
  if (_adminTab === 'cohorts') el.innerHTML = renderCohortsTab();
  else                         el.innerHTML = renderUsersTab();
}

// ── Cohorts tab ──────────────────────────────────────────────
function renderCohortsTab() {
  const rows = _adminCohorts.length
    ? _adminCohorts.map(c => {
        const date    = new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const members = _adminUsers.filter(u => u.cohortId === c.cohortId).length;
        return `
          <div class="admin-row">
            <div>
              <div style="font-weight:700;">${escHtml(c.name)}</div>
              <div style="font-size:0.8rem; color:var(--text-light);">${members} member${members !== 1 ? 's' : ''} · created ${date}</div>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; justify-content:flex-end;">
              <span class="join-code" title="Join code" onclick="copyJoinCode('${c.joinCode}')">
                ${c.joinCode} <span style="font-size:0.7rem;">📋</span>
              </span>
              <button class="btn btn-ghost" style="font-size:0.75rem; padding:0.35rem 0.7rem;"
                onclick="doExportCohort('${c.cohortId}', '${escHtml(c.name)}', this)">Export CSV</button>
              <button class="btn btn-ghost" style="font-size:0.75rem; padding:0.35rem 0.7rem; color:var(--red);"
                onclick="confirmDeleteCohort('${c.cohortId}', '${escHtml(c.name)}')">Delete</button>
            </div>
          </div>
        `;
      }).join('')
    : `<p style="text-align:center; color:var(--text-light); padding:1.5rem 0;">No cohorts yet. Create one below.</p>`;

  return `
    <div class="card">
      <h3 class="card-title">Cohorts</h3>
      ${rows}
    </div>

    <div class="card">
      <h3 class="card-title">Create New Cohort</h3>
      <div style="display:flex; gap:0.5rem;">
        <input id="new-cohort-name" class="input" placeholder="Cohort name (e.g. Spring 2026)"
          style="flex:1;" onkeydown="if(event.key==='Enter') doCreateCohort()">
        <button class="btn btn-primary" onclick="doCreateCohort()">Create</button>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <div id="delete-modal" class="modal-overlay hidden">
      <div class="modal-box">
        <h3 style="margin-bottom:0.5rem; color:var(--red);">Delete Cohort</h3>
        <p id="delete-modal-msg" style="margin-bottom:1rem; font-size:0.9rem; color:var(--text-light);"></p>
        <p style="margin-bottom:0.5rem; font-size:0.85rem; font-weight:600;">
          Type the cohort name to confirm:
        </p>
        <input id="delete-confirm-input" class="input" placeholder="" style="margin-bottom:1rem;">
        <div style="display:flex; gap:0.5rem;">
          <button class="btn btn-danger" style="flex:1;" id="delete-confirm-btn" onclick="executeDeleteCohort()">
            Delete Everything
          </button>
          <button class="btn btn-ghost" onclick="closeDeleteModal()">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

// ── Users tab ────────────────────────────────────────────────
function renderUsersTab() {
  const rows = _adminUsers.map(u => {
    const cohort = _adminCohorts.find(c => c.cohortId === u.cohortId);
    const isAdmin = u.role === 'admin';
    return `
      <div class="admin-row">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <img src="${u.photoUrl || ''}" alt="${escHtml(u.name)}" class="avatar"
            onerror="this.style.display='none'">
          <div>
            <div style="font-weight:700;">${escHtml(u.name)}</div>
            <div style="font-size:0.8rem; color:var(--text-light);">${escHtml(u.email)}</div>
            <div style="font-size:0.8rem; color:var(--text-light);">${cohort ? escHtml(cohort.name) : 'No cohort'}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span class="role-badge ${isAdmin ? 'role-admin' : 'role-user'}">${u.role}</span>
          <button class="btn btn-ghost" style="font-size:0.75rem; padding:0.35rem 0.7rem;"
            onclick="doToggleRole('${u.userId}', '${u.role}', '${escHtml(u.name)}')">
            ${isAdmin ? 'Demote' : 'Make Admin'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="card">
      <h3 class="card-title">All Users</h3>
      ${rows || '<p style="text-align:center; color:var(--text-light); padding:1.5rem;">No users yet.</p>'}
    </div>
  `;
}

// ── Actions ──────────────────────────────────────────────────
async function doCreateCohort() {
  const input = document.getElementById('new-cohort-name');
  const name  = input.value.trim();
  if (!name) { showError('Cohort name is required.'); return; }

  const btn = document.querySelector('#admin-tab-content .btn-primary');
  btn.disabled = true; btn.textContent = 'Creating...';

  try {
    const cohort = await api('createCohort', { name });
    _adminCohorts.push(cohort);
    showSuccess(`Cohort "${cohort.name}" created! Join code: ${cohort.joinCode}`);
    renderAdminTab();
  } catch (e) {
    showError(e.message);
    btn.disabled = false; btn.textContent = 'Create';
  }
}

async function doExportCohort(cohortId, cohortName, btn) {
  btn.disabled = true; btn.textContent = 'Exporting...';

  try {
    const data = await api('exportCohort', { cohortId });
    downloadCohortCSV(data, cohortName);
    showSuccess('CSV downloaded.');
  } catch (e) {
    showError(e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Export CSV';
  }
}

let _pendingDeleteId   = null;
let _pendingDeleteName = null;

function confirmDeleteCohort(cohortId, cohortName) {
  _pendingDeleteId   = cohortId;
  _pendingDeleteName = cohortName;
  document.getElementById('delete-modal-msg').textContent =
    `This will permanently delete all time logs, journal entries, badges, and user data for "${cohortName}". This cannot be undone.`;
  document.getElementById('delete-confirm-input').value = '';
  document.getElementById('delete-confirm-input').placeholder = cohortName;
  document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('delete-modal').classList.add('hidden');
  _pendingDeleteId = _pendingDeleteName = null;
}

async function executeDeleteCohort() {
  const typed = document.getElementById('delete-confirm-input').value.trim();
  if (typed !== _pendingDeleteName) {
    showError('Name does not match. Try again.');
    return;
  }

  const btn = document.getElementById('delete-confirm-btn');
  btn.disabled = true; btn.textContent = 'Deleting...';

  try {
    await api('deleteCohort', { cohortId: _pendingDeleteId, confirmed: true });
    _adminCohorts  = _adminCohorts.filter(c => c.cohortId !== _pendingDeleteId);
    _adminUsers    = _adminUsers.map(u =>
      u.cohortId === _pendingDeleteId ? { ...u, cohortId: '' } : u
    );
    showSuccess(`Cohort "${_pendingDeleteName}" deleted.`);
    closeDeleteModal();
    renderAdmin();
  } catch (e) {
    showError(e.message);
    btn.disabled = false; btn.textContent = 'Delete Everything';
  }
}

async function doToggleRole(userId, currentRole, name) {
  const newRole = currentRole === 'admin' ? 'user' : 'admin';
  if (!confirm(`Change ${name}'s role to "${newRole}"?`)) return;

  try {
    await api('updateUserRole', { targetUserId: userId, role: newRole });
    const idx = _adminUsers.findIndex(u => u.userId === userId);
    if (idx !== -1) _adminUsers[idx] = { ..._adminUsers[idx], role: newRole };
    showSuccess(`${name} is now ${newRole}.`);
    renderAdminTab();
  } catch (e) {
    showError(e.message);
  }
}

function copyJoinCode(code) {
  navigator.clipboard.writeText(code)
    .then(() => showSuccess(`Copied: ${code}`))
    .catch(() => showError('Could not copy — try manually.'));
}

// ── CSV export helper ────────────────────────────────────────
function downloadCohortCSV(data, cohortName) {
  const userMap = {};
  data.users.forEach(u => { userMap[u.userId] = u; });

  const rows = [
    ['Name', 'Email', 'Date', 'Duration (min)', 'Duration (hrs)', 'Notes', 'Retro?'],
    ...data.timeLogs.map(log => {
      const u    = userMap[log.userId] || {};
      const date = log.startTime ? new Date(log.startTime).toLocaleDateString() : '';
      const hrs  = log.durationMinutes ? (log.durationMinutes / 60).toFixed(2) : '0';
      return [
        u.name    || '',
        u.email   || '',
        date,
        log.durationMinutes || 0,
        hrs,
        (log.notes || '').replace(/"/g, '""'),
        log.isRetro ? 'Yes' : 'No',
      ];
    })
  ];

  const csv     = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob    = new Blob([csv], { type: 'text/csv' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `${cohortName.replace(/\s+/g, '_')}_time_logs.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Utility ──────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
