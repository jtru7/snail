// ============================================================
// auth.js — Google OAuth flow (GSI)
// ============================================================

const CLIENT_ID = '225662015987-j2cmhq6239e77kfqe32acq93dmgri72t.apps.googleusercontent.com';

let _token = null;
let _currentUser = null;

function initAuth() {
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: false,
  });

  google.accounts.id.renderButton(
    document.getElementById('google-signin-btn'),
    { theme: 'outline', size: 'large', text: 'sign_in_with', shape: 'pill', width: 280 }
  );

  // Show One Tap prompt
  google.accounts.id.prompt();
}

async function handleCredentialResponse(response) {
  _token = response.credential;

  try {
    const user = await api('getOrCreateUser', {});
    _currentUser = user;
    onSignIn(user);
  } catch (e) {
    console.error('Sign-in error:', e);
    showError('Sign-in failed. Please try again.');
    _token = null;
  }
}

function getToken()       { return _token; }
function getCurrentUser() { return _currentUser; }

function signOut() {
  google.accounts.id.disableAutoSelect();
  _token = null;
  _currentUser = null;
  document.getElementById('app-nav').classList.add('hidden');
  document.getElementById('signout-btn').classList.add('hidden');
  document.getElementById('user-info').innerHTML = '';
  showView('login');
}
