function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

// ================= LOGIN =================
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
      document.getElementById("loginEmailError").textContent = "Invalid email";
      valid = false;
    }

    if (password.length < 6) {
      document.getElementById("loginPasswordError").textContent = "Min 6 characters";
      valid = false;
    }

    if (!valid) return;

    // Loading state
    btn.textContent = "Logging in...";
    btn.disabled = true;

    setTimeout(() => {
      // Simulated success
      document.getElementById("loginSuccess").textContent = "Login successful";

      if (document.getElementById("rememberMe").checked) {
        localStorage.setItem("userEmail", email);
      }

      // Redirect
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 1000);

    }, 1000);
  });
}

// ================= SIGNUP =================
const signupForm = document.getElementById("signupForm");

if (signupForm) {
  signupForm.addEventListener("submit", function(e) {
    e.preventDefault();

    let email = document.getElementById("signupEmail").value.trim();
    let password = document.getElementById("signupPassword").value.trim();

    let valid = true;

    const btn = document.getElementById("signupBtn");

    document.getElementById("signupEmailError").textContent = "";
    document.getElementById("signupPasswordError").textContent = "";
    document.getElementById("signupGeneralError").textContent = "";
    document.getElementById("signupSuccess").textContent = "";

    if (!email.includes("@")) {
      document.getElementById("signupEmailError").textContent = "Invalid email";
      valid = false;
    }

    if (password.length < 6) {
      document.getElementById("signupPasswordError").textContent = "Min 6 characters";
      valid = false;
    }

    if (!valid) return;

    // Loading state
    btn.textContent = "Creating...";
    btn.disabled = true;

    setTimeout(() => {
      document.getElementById("signupSuccess").textContent = "Account created";

      setTimeout(() => {
        window.location.href = "login.html";
      }, 1000);

    }, 1000);
  });
}