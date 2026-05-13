const API_BASE = 'http://localhost';

function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === 'password' ? 'text' : 'password';
}

// Restore saved username/email from "Remember me"
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('pw_remembered_user');
  if (saved) {
    document.getElementById('loginEmail').value = saved;
    document.getElementById('rememberMe').checked = true;
  }
});

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    // The backend accepts either username or email in the 'username' field
    const userInput = document.getElementById('loginEmail').value.trim();
    const password  = document.getElementById('loginPassword').value;
    const btn       = document.getElementById('loginBtn');

    // Clear previous messages
    ['loginEmailError','loginPasswordError','loginGeneralError','loginSuccess']
      .forEach(id => { document.getElementById(id).textContent = ''; });

    // ── Client-side validation ────────────────────────────────
    let valid = true;
    if (!userInput) {
      document.getElementById('loginEmailError').textContent = 'Please enter your username or email';
      valid = false;
    }
    if (password.length < 6) {
      document.getElementById('loginPasswordError').textContent = 'Minimum 6 characters';
      valid = false;
    }
    if (!valid) return;

    // ── Call the backend ──────────────────────────────────────
    btn.textContent = 'Signing in...';
    btn.disabled    = true;

    try {
      const res  = await fetch(`${API_BASE}/login`, {
        method:      'POST',
        credentials: 'include',                   // required — sends the session cookie
        headers:     { 'Content-Type': 'application/json' },
        // Backend checks data['username'] first, then data['email']
        body:        JSON.stringify({ username: userInput, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // Save username for "Remember me"
        if (document.getElementById('rememberMe').checked) {
          localStorage.setItem('pw_remembered_user', userInput);
        } else {
          localStorage.removeItem('pw_remembered_user');
        }

        document.getElementById('loginSuccess').textContent = '✓ Login successful — redirecting';
        setTimeout(() => { window.location.href = 'index.html'; }, 1000);

      } else if (res.status === 403) {
        // Email not yet verified
        document.getElementById('loginGeneralError').textContent =
          'Please verify your email address before signing in. Check your inbox.';

      } else if (res.status === 401) {
        document.getElementById('loginGeneralError').textContent =
          'Invalid username or password.';

      } else {
        document.getElementById('loginGeneralError').textContent =
          data.message || 'Login failed. Please try again.';
      }

    } catch (err) {
      // Network error (backend down, CORS issue, etc.)
      document.getElementById('loginGeneralError').textContent =
        'Could not reach the server. Please try again.';
    } finally {
      btn.textContent = 'Sign In';
      btn.disabled    = false;
    }
  });
}
