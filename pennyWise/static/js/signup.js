function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

function checkStrength(val) {
  const bars = [document.getElementById('s1'), document.getElementById('s2'), document.getElementById('s3'), document.getElementById('s4')];
  const label = document.getElementById('strengthLabel');
  bars.forEach(b => b.style.background = '#1f1f24');
  if (!val) { label.textContent = ''; return; }
  let score = 0;
  if (val.length >= 6) score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const colors = ['#e05c5c', '#e09a5c', '#c9a84c', '#5cba8a'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  for (let i = 0; i < score; i++) bars[i].style.background = colors[score - 1];
  label.textContent = labels[score - 1] || '';
  label.style.color = colors[score - 1] || '#4a4845';
}

const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", function(e) {
    e.preventDefault();
    let email = document.getElementById("signupEmail").value.trim();
    let password = document.getElementById("signupPassword").value.trim();
    let confirm = document.getElementById("confirmPassword").value.trim();
    let valid = true;
    const btn = document.getElementById("signupBtn");

    ['signupEmailError','signupPasswordError','confirmPasswordError','signupGeneralError','signupSuccess'].forEach(id => {
      document.getElementById(id).textContent = "";
    });

    if (!email.includes("@")) {
      document.getElementById("signupEmailError").textContent = "Please enter a valid email";
      valid = false;
    }
    if (password.length < 6) {
      document.getElementById("signupPasswordError").textContent = "Minimum 6 characters";
      valid = false;
    }
    if (password !== confirm) {
      document.getElementById("confirmPasswordError").textContent = "Passwords don't match";
      valid = false;
    }
    if (!document.getElementById("agreeTerms").checked) {
      document.getElementById("signupGeneralError").textContent = "Please agree to the terms to continue";
      valid = false;
    }
    if (!valid) return;

    btn.textContent = "Creating account...";
    btn.disabled = true;

    setTimeout(() => {
      document.getElementById("signupSuccess").textContent = "✓ Account created — redirecting to login";
      setTimeout(() => { window.location.href = "login.html"; }, 1200);
    }, 1000);
  });
}
