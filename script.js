// Dynamic Base Domain Mapping Logic Context
const API_BASE = "https://your-render-backend-url.onrender.com/api";

// Password visibility switcher sequence
function togglePasswordVisibility(fieldId) {
  const el = document.getElementById(fieldId);
  if (el.type === "password") {
    el.type = "text";
  } else {
    el.type = "password";
  }
}

// Active UI Section tracking context helper
function setSessionUser(userData) {
  localStorage.setItem('smm_user', JSON.stringify(userData));
}

function getSessionUser() {
  return JSON.parse(localStorage.getItem('smm_user'));
}

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

// Global Validation Interceptor Engine
async function handleRequest(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server processing error occurred');
    return data;
  } catch (err) {
    alert(err.message);
    throw err;
  }
}
