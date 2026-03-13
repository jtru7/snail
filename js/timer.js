// ============================================================
// timer.js — Clock in/out, retro logs, CRUD
// ============================================================

let _timerInterval  = null;
let _activeSession  = null;
let _timeLogs       = [];

const NUDGES = [
  "Still thinking about starting? Bold strategy.",
  "The snail is judging you. Silently.",
  "Your colleagues are logging hours right now. Just saying.",
  "AI waits for no one. Well, except you apparently.",
  "Every minute you wait, the snail gets slower.",
  "Not logging = losing. Those are the rules.",
];

// ── Entry point ─────────────────────────────────────────────
async function loadTimer() {
  const user = getCurrentUser();
  if (!user) return;

  if (!user.cohortId) {
    renderJoinCohort();
    return;
  }

  document.getElementById('timer-content').innerHTML = '<div class="loading-spinner">Loading...</div>';

  try {
    const [sessionRes, logs] = await Promise.all([
      api('getActiveSession', {}),
      api('getTimeLogs', {}),
    ]);
    _activeSession = sessionRes.session;
    _timeLogs      = logs;
    renderTimer();
  } catch (e) {
    document.getElementById('timer-content').innerHTML =
      `<div class="card"><p style="color:var(--red)">Error: ${e.message}</p></div>`;
  }
}

// ── Cohort join (shown when user has no cohort) ──────────────
function renderJoinCohort() {
  document.getElementById('timer-content').innerHTML = `
    <div class="card" style="text-align:center; padding: 2.5rem 2rem;">
      <div style="font-size:3rem; margin-bottom:1rem;">🐌</div>
      <h3 style="margin-bottom:0.5rem;">Join a Cohort First</h3>
      <p style="color:var(--text-light); margin-bottom:1.5rem;">
        You need a cohort join code from your facilitator before you can log time.
      </p>
      <div style="display:flex; gap:0.5rem; max-width:320px; margin:0 auto;">
        <input id="join-code-input" class="input" placeholder="Enter join code (e.g. ABC123)"
          style="flex:1; text-transform:uppercase;" maxlength="6"
          oninput="this.value=this.value.toUpperCase()">
        <button class="btn btn-primary" onclick="submitJoinCohort()">Join</button>
      </div>
      <p id="join-error" style="color:var(--red); margin-top:0.75rem; font-size:0.85rem;"></p>
    </div>
  `;
}

async function submitJoinCohort() {
  const code = document.getElementById('join-code-input').value.trim();
  if (!code) return;

  const btn = document.querySelector('#timer-content .btn-primary');
  btn.disabled = true;
  btn.textContent = 'Joining...';

  try {
    await api('joinCohort', { joinCode: code });
    // Refresh user profile
    const user = await api('getOrCreateUser', {});
    Object.assign(getCurrentUser(), user);
    showSuccess('Cohort joined!');
    loadTimer();
  } catch (e) {
    document.getElementById('join-error').textContent = e.message;
    btn.disabled = false;
    btn.textContent = 'Join';
  }
}

// ── Main timer render ────────────────────────────────────────
function renderTimer() {
  clearInterval(_timerInterval);

  const totalMinutes  = _timeLogs.reduce((sum, l) => sum + Number(l.durationMinutes || 0), 0);
  const totalHours    = (totalMinutes / 60).toFixed(1);
  const pct           = Math.min(100, (totalMinutes / 600) * 100).toFixed(1);
  const nudge         = NUDGES[Math.floor(Math.random() * NUDGES.length)];

  document.getElementById('timer-content').innerHTML = `

    <!-- Progress -->
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:0.4rem;">
        <span class="card-title" style="margin:0;">Your Progress</span>
        <span style="font-weight:800; font-size:1.1rem;">${totalHours} <span style="color:var(--text-light); font-weight:400; font-size:0.85rem;">/ 10 hrs</span></span>
      </div>
      <div class="progress-wrap">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
      <p style="font-size:0.75rem; color:var(--text-light); margin-top:0.4rem;">${pct}% complete</p>
    </div>

    <!-- Clock -->
    <div class="card" id="clock-card">
      ${_activeSession ? renderActiveSession() : renderClockIn(nudge)}
    </div>

    <!-- Retro Log -->
    <details class="card" id="retro-section">
      <summary style="cursor:pointer; font-weight:700; list-style:none; display:flex; justify-content:space-between;">
        <span>+ Add Past Entry</span>
        <span style="color:var(--text-light); font-size:0.8rem;">retro log</span>
      </summary>
      <div style="margin-top:1rem;">
        ${renderRetroForm()}
      </div>
    </details>

    <!-- Log list -->
    <div id="log-list">
      ${renderLogList()}
    </div>
  `;

  if (_activeSession) startLiveClock();
  updateMascotSpeed(_timeLogs.length > 0 ? Math.floor(totalMinutes / 60) : 0);
}

// ── Clock In state ───────────────────────────────────────────
function renderClockIn(nudge) {
  return `
    <div style="text-align:center; padding:1rem 0;">
      <p class="snail-nudge">${nudge}</p>
      <button class="btn btn-primary" style="font-size:1rem; padding:0.9rem 2.5rem;" onclick="doClockIn()">
        ⏱ Clock In
      </button>
    </div>
  `;
}

// ── Active session state ─────────────────────────────────────
function renderActiveSession() {
  return `
    <div style="text-align:center; padding:0.5rem 0;">
      <p style="font-size:0.85rem; color:var(--text-light); margin-bottom:0.25rem;">Session in progress</p>
      <div id="live-clock" style="font-size:3rem; font-weight:800; letter-spacing:2px; color:var(--green); margin-bottom:1.25rem;">
        00:00:00
      </div>
      <textarea id="clock-out-notes" class="input" placeholder="What did you work on? (optional)"
        rows="2" style="width:100%; margin-bottom:0.75rem; resize:none;"></textarea>
      <button class="btn btn-danger" style="width:100%;" onclick="doClockOut()">
        ⏹ Clock Out
      </button>
    </div>
  `;
}

// ── Retro form ───────────────────────────────────────────────
function renderRetroForm() {
  const now   = new Date();
  const local = d => {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const end   = local(now);
  const start = local(new Date(now - 60 * 60 * 1000)); // 1 hour ago default

  return `
    <div style="display:grid; gap:0.6rem;">
      <label style="font-size:0.85rem; font-weight:600;">Start time
        <input id="retro-start" class="input" type="datetime-local" value="${start}" style="display:block; margin-top:0.25rem; width:100%;">
      </label>
      <label style="font-size:0.85rem; font-weight:600;">End time
        <input id="retro-end" class="input" type="datetime-local" value="${end}" style="display:block; margin-top:0.25rem; width:100%;">
      </label>
      <label style="font-size:0.85rem; font-weight:600;">Notes (optional)
        <textarea id="retro-notes" class="input" rows="2" style="display:block; margin-top:0.25rem; width:100%; resize:none;"
          placeholder="What did you work on?"></textarea>
      </label>
      <button class="btn btn-primary" onclick="doAddRetroLog()">Add Entry</button>
    </div>
  `;
}

// ── Log list ─────────────────────────────────────────────────
function renderLogList() {
  if (_timeLogs.length === 0) {
    return `<p style="text-align:center; color:var(--text-light); padding:1rem; font-size:0.9rem;">No time logs yet. Clock in to get started!</p>`;
  }

  const items = _timeLogs.map(log => {
    const date = new Date(log.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const mins = Number(log.durationMinutes || 0);
    const dur  = mins >= 60
      ? `${Math.floor(mins/60)}h ${mins % 60}m`
      : `${mins}m`;
    const badge = log.isRetro
      ? `<span style="font-size:0.7rem; background:var(--bg); border:1px solid var(--border); border-radius:4px; padding:1px 5px; color:var(--text-light);">retro</span>`
      : '';

    return `
      <div class="log-item" id="log-${log.logId}">
        <div class="log-main">
          <div>
            <span class="log-date">${date}</span> ${badge}
            <div class="log-notes">${log.notes || '<em style="color:var(--text-light)">no notes</em>'}</div>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem; flex-shrink:0;">
            <span class="log-dur">${dur}</span>
            <button class="btn btn-ghost" style="padding:0.3rem 0.6rem; font-size:0.75rem;"
              onclick="toggleEditLog('${log.logId}')">Edit</button>
            <button class="btn btn-ghost" style="padding:0.3rem 0.6rem; font-size:0.75rem; color:var(--red);"
              onclick="doDeleteLog('${log.logId}')">✕</button>
          </div>
        </div>
        <div class="log-edit hidden" id="edit-${log.logId}">
          ${renderEditForm(log)}
        </div>
      </div>
    `;
  }).join('');

  return `<div class="card" style="padding:0.75rem;">${items}</div>`;
}

function renderEditForm(log) {
  const toLocal = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return `
    <div style="display:grid; gap:0.5rem; padding-top:0.75rem; border-top:1px solid var(--border); margin-top:0.75rem;">
      <label style="font-size:0.8rem; font-weight:600;">Start
        <input class="input" type="datetime-local" id="edit-start-${log.logId}" value="${toLocal(log.startTime)}"
          style="display:block; margin-top:0.2rem; width:100%;">
      </label>
      <label style="font-size:0.8rem; font-weight:600;">End
        <input class="input" type="datetime-local" id="edit-end-${log.logId}" value="${toLocal(log.endTime)}"
          style="display:block; margin-top:0.2rem; width:100%;">
      </label>
      <label style="font-size:0.8rem; font-weight:600;">Notes
        <textarea class="input" id="edit-notes-${log.logId}" rows="2"
          style="display:block; margin-top:0.2rem; width:100%; resize:none;">${log.notes || ''}</textarea>
      </label>
      <div style="display:flex; gap:0.5rem;">
        <button class="btn btn-primary" style="flex:1;" onclick="doSaveEdit('${log.logId}')">Save</button>
        <button class="btn btn-ghost" onclick="toggleEditLog('${log.logId}')">Cancel</button>
      </div>
    </div>
  `;
}

// ── Live clock ───────────────────────────────────────────────
function startLiveClock() {
  const update = () => {
    const el = document.getElementById('live-clock');
    if (!el) { clearInterval(_timerInterval); return; }
    const elapsed = Math.floor((Date.now() - new Date(_activeSession.startTime)) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    const pad = n => String(n).padStart(2, '0');
    el.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
  };
  update();
  _timerInterval = setInterval(update, 1000);
}

// ── Actions ──────────────────────────────────────────────────
async function doClockIn() {
  const btn = document.querySelector('#clock-card .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Clocking in...'; }

  try {
    _activeSession = await api('clockIn', {});
    renderTimer();
  } catch (e) {
    showError(e.message);
    if (btn) { btn.disabled = false; btn.textContent = '⏱ Clock In'; }
  }
}

async function doClockOut() {
  const notes = document.getElementById('clock-out-notes')?.value.trim() || '';
  const btn   = document.querySelector('#clock-card .btn-danger');
  if (btn) { btn.disabled = true; btn.textContent = 'Clocking out...'; }

  try {
    const log = await api('clockOut', { notes });
    _activeSession = null;
    _timeLogs.unshift(log);
    showSuccess(`Logged ${log.durationMinutes} minutes!`);
    renderTimer();
  } catch (e) {
    showError(e.message);
    if (btn) { btn.disabled = false; btn.textContent = '⏹ Clock Out'; }
  }
}

async function doAddRetroLog() {
  const startTime = document.getElementById('retro-start').value;
  const endTime   = document.getElementById('retro-end').value;
  const notes     = document.getElementById('retro-notes').value.trim();

  if (!startTime || !endTime) { showError('Start and end times are required.'); return; }

  const btn = document.querySelector('#retro-section .btn-primary');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    const log = await api('createRetroLog', {
      startTime: new Date(startTime).toISOString(),
      endTime:   new Date(endTime).toISOString(),
      notes,
    });
    _timeLogs.unshift(log);
    showSuccess(`Retro log added (${log.durationMinutes} min)`);
    renderTimer();
  } catch (e) {
    showError(e.message);
    btn.disabled = false; btn.textContent = 'Add Entry';
  }
}

function toggleEditLog(logId) {
  const el = document.getElementById(`edit-${logId}`);
  if (el) el.classList.toggle('hidden');
}

async function doSaveEdit(logId) {
  const startTime = document.getElementById(`edit-start-${logId}`)?.value;
  const endTime   = document.getElementById(`edit-end-${logId}`)?.value;
  const notes     = document.getElementById(`edit-notes-${logId}`)?.value.trim();

  const btn = document.querySelector(`#log-${logId} .btn-primary`);
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    const updated = await api('updateTimeLog', {
      logId,
      startTime: new Date(startTime).toISOString(),
      endTime:   new Date(endTime).toISOString(),
      notes,
    });
    const idx = _timeLogs.findIndex(l => l.logId === logId);
    if (idx !== -1) _timeLogs[idx] = updated;
    showSuccess('Log updated.');
    renderTimer();
  } catch (e) {
    showError(e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
  }
}

async function doDeleteLog(logId) {
  if (!confirm('Delete this time log?')) return;

  try {
    await api('deleteTimeLog', { logId });
    _timeLogs = _timeLogs.filter(l => l.logId !== logId);
    showSuccess('Log deleted.');
    renderTimer();
  } catch (e) {
    showError(e.message);
  }
}
