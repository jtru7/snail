// ============================================================
// app.js — Main app init + routing
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbyZWe24plqIymT1Nv9mwqfM66fbQTnvS3SJ4Wi1L4lI49cSI8kAHjplN8hdL7hhx8tE/exec';

// ── API helper ──────────────────────────────────────────────
async function api(action, params = {}, method = 'POST') {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  if (method === 'GET') {
    const qs = new URLSearchParams({ action, token, ...params }).toString();
    const res = await fetch(`${API_URL}?${qs}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action, token, ...params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ── Routing ─────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const view = document.getElementById(`view-${name}`);
  if (view) view.classList.remove('hidden');

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-btn[data-view="${name}"]`);
  if (navBtn) navBtn.classList.add('active');
}

// ── Toasts ──────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('error-toast');
  el.textContent = msg;
  el.style.background = '';
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function showSuccess(msg) {
  const el = document.getElementById('error-toast');
  el.textContent = msg;
  el.style.background = 'var(--green)';
  el.classList.remove('hidden');
  setTimeout(() => { el.classList.add('hidden'); el.style.background = ''; }, 3000);
}

// ── Mascot speed (based on badge count) ─────────────────────
function updateMascotSpeed(badgeCount) {
  const mascot = document.getElementById('mascot');
  mascot.className = 'mascot';
  if (badgeCount >= 8)      mascot.classList.add('speed-max');
  else if (badgeCount >= 5) mascot.classList.add('speed-4');
  else if (badgeCount >= 3) mascot.classList.add('speed-3');
  else if (badgeCount >= 2) mascot.classList.add('speed-2');
  else if (badgeCount >= 1) mascot.classList.add('speed-1');
}

// ── Post sign-in setup ──────────────────────────────────────
function onSignIn(user) {
  document.getElementById('app-nav').classList.remove('hidden');
  document.getElementById('signout-btn').classList.remove('hidden');
  document.getElementById('user-info').innerHTML = `
    <img src="${user.photoUrl}" alt="${user.name}" class="avatar">
    <span>${user.name.split(' ')[0]}</span>
  `;

  if (user.role === 'admin') {
    document.querySelector('.nav-btn[data-view="admin"]').classList.remove('hidden');
  }

  showView('timer');
  loadTimer();
}

// ── Init ────────────────────────────────────────────────────
window.addEventListener('load', () => {
  showView('login');
  initAuth();
});
