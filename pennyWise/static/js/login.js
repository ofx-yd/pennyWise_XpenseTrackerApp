function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", function(e) {
    e.preventDefault();
    let email = document.getElementById("loginEmail").value.trim();
    let password = document.getElementById("loginPassword").value.trim();
    let valid = true;
    const btn = document.getElementById("loginBtn");

    document.getElementById("loginEmailError").textContent = "";
    document.getElementById("loginPasswordError").textContent = "";
    document.getElementById("loginGeneralError").textContent = "";
    document.getElementById("loginSuccess").textContent = "";

    if (!email.includes("@")) {
      document.getElementById("loginEmailError").textContent = "Please enter a valid email";
      valid = false;
    }
    if (password.length < 6) {
      document.getElementById("loginPasswordError").textContent = "Minimum 6 characters";
      valid = false;
    }
    if (!valid) return;

    btn.textContent = "Signing in...";
    btn.disabled = true;

    setTimeout(() => {
      document.getElementById("loginSuccess").textContent = "✓ Login successful — redirecting";
      if (document.getElementById("rememberMe").checked) {
        localStorage.setItem("userEmail", email);
      }
      setTimeout(() => { window.location.href = "index.html"; }, 1000);
    }, 1000);
  });
}
