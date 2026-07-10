console.log("Gowind SMM Panel V3.0 Loaded");

function showMessage() {
    alert("Welcome to Gowind SMM Panel!");
}
const form = document.getElementById("loginForm");

if (form) {
    form.addEventListener("submit", function(e) {
        e.preventDefault();

        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;

        if (username === "admin" && password === "admin123") {
            window.location.href = "dashboard.html";
        } else {
            document.getElementById("message").innerHTML =
                "❌ Invalid Username or Password";
        }
    });
}
