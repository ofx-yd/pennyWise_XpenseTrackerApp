const API_BASE = 'http://localhost';

function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === 'password' ? 'text' : 'password';
}

function checkStrength(val) {
  const bars  = ['s1','s2','s3','s4'].map(id => document.getElementById(id));
  const label = document.getElementById('strengthLabel');
  bars.forEach(b => b.style.background = '#1f1f24');
  if (!val) { label.textContent = ''; return; }

  let score = 0;
  if (val.length >= 6)                              score++;
  if (val.length >= 10)                             score++;
  if (/[A-Z]/.test(val) && /[0-9]/.test(val))      score++;
  if (/[^A-Za-z0-9]/.test(val))                    score++;

  const colors = ['#e05c5c', '#e09a5c', '#c9a84c', '#5cba8a'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  for (let i = 0; i < score; i++) bars[i].style.background = colors[score - 1];
  label.textContent  = labels[score - 1] || '';
  label.style.color  = colors[score - 1] || '#4a4845';
}

// Clear all error/success messages
function clearMessages() {
  ['signupUsernameError','signupEmailError','signupPasswordError',
   'confirmPasswordError','signupGeneralError','signupSuccess']
    .forEach(id => { document.getElementById(id).textContent = ''; });
}

const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    clearMessages();

    const username = document.getElementById('signupUsername').value.trim();
    const email    = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirm  = document.getElementById('confirmPassword').value;
    const btn      = document.getElementById('signupBtn');

    // ── Client-side validation (mirrors backend rules exactly) ──
    let valid = true;

    if (username.length < 3 || username.length > 50) {
      document.getElementById('signupUsernameError').textContent = 'Username must be 3–50 characters';
      valid = false;
    }
    if (!email.includes('@')) {
      document.getElementById('signupEmailError').textContent = 'Please enter a valid email';
      valid = false;
    }
    // Matches validatePassword() in utils.php: min 6, 1 uppercase, 1 number
    if (password.length < 6 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      document.getElementById('signupPasswordError').textContent =
        'Min. 6 characters, at least 1 uppercase letter and 1 number';
      valid = false;
    }
    if (password !== confirm) {
      document.getElementById('confirmPasswordError').textContent = "Passwords don't match";
      valid = false;
    }
    if (!document.getElementById('agreeTerms').checked) {
      document.getElementById('signupGeneralError').textContent = 'Please agree to the terms to continue';
      valid = false;
    }
    if (!valid) return;

    // ── Call the backend ──────────────────────────────────────
    btn.textContent = 'Creating account...';
    btn.disabled    = true;

    try {
      const res  = await fetch(`${API_BASE}/register`, {
        method:      'POST',
        credentials: 'include',                   // send/receive session cookie
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // Registration succeeded — user must verify email before logging in
        document.getElementById('signupSuccess').textContent =
          '✓ Account created! Please check your email to verify your account.';
        signupForm.reset();
        ['s1','s2','s3','s4'].forEach(id => document.getElementById(id).style.background = '#1f1f24');
        document.getElementById('strengthLabel').textContent = '';
      } else {
        // Show the error message returned by the backend
        document.getElementById('signupGeneralError').textContent =
          data.message || 'Registration failed. Please try again.';
      }

    } catch (err) {
      // Network error (backend is down, CORS misconfiguration, etc.)
      document.getElementById('signupGeneralError').textContent =
        'Could not reach the server. Please try again.';
    } finally {
      btn.textContent = 'Create Account';
      btn.disabled    = false;
    }
  });
}
