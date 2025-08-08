const SUPABASE_URL = "https://ejvbaftvwcbdfmurtzaz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqdmJhZnR2d2NiZGZtdXJ0emF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1NzI4ODIsImV4cCI6MjA3MDE0ODg4Mn0.8VuFZsMWk-YhZ-EfjuzxxZagXguTwMH6V-izba9WpvU";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const registerEmail = document.getElementById("register-email");
const registerPassword = document.getElementById("register-password");

const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const logoutBtn = document.getElementById("logout-btn");

const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");

// INSCRIPTION
registerBtn.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signUp({
        email: registerEmail.value,
        password: registerPassword.value
    });
    if (error) {
        alert("Erreur inscription : " + error.message);
    } else {
        alert("Vérifie tes mails pour confirmer ton compte !");
    }
});

// CONNEXION
loginBtn.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signInWithPassword({
        email: loginEmail.value,
        password: loginPassword.value
    });
    if (error) {
        alert("Erreur connexion : " + error.message);
    } else {
        authSection.style.display = "none";
        appSection.style.display = "block";
    }
});

// DÉCONNEXION
logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    authSection.style.display = "block";
    appSection.style.display = "none";
});
