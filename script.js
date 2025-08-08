const SUPABASE_URL = "https://qenmnsjvxkpogiuzzjkw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlbm1uc2p2eGtwb2dpdXp6amt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NTM3NDgsImV4cCI6MjA3MDIyOTc0OH0.kN9CSND-DfGq3pxQeTln2pwypfoBFuUQ9sn3K9eqC20";

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

const expenseName = document.getElementById("expense-name");
const expenseAmount = document.getElementById("expense-amount");
const addExpenseBtn = document.getElementById("add-expense-btn");
const expenseList = document.getElementById("expense-list");

// INSCRIPTION
registerBtn.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signUp({
        email: registerEmail.value,
        password: registerPassword.value,
    });
    if (error) {
        alert("Erreur inscription : " + error.message);
    } else {
        alert("Compte créé ! Connecte-toi.");
    }
});

// CONNEXION
loginBtn.addEventListener("click", async () => {
    const { error, data } = await supabaseClient.auth.signInWithPassword({
        email: loginEmail.value,
        password: loginPassword.value,
    });
    if (error) {
        alert("Erreur connexion : " + error.message);
    } else {
        authSection.style.display = "none";
        appSection.style.display = "block";
        loadExpenses();
    }
});

// DÉCONNEXION
logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    authSection.style.display = "block";
    appSection.style.display = "none";
    expenseList.innerHTML = "";
});

// AJOUT DÉPENSE
addExpenseBtn.addEventListener("click", async () => {
    const name = expenseName.value.trim();
    const amount = parseFloat(expenseAmount.value);
    if (!name || isNaN(amount) || amount <= 0) {
        alert("Merci de saisir un nom valide et un montant supérieur à 0.");
        return;
    }
    const user = supabaseClient.auth.getUser();
    const { error } = await supabaseClient.from("expenses").insert([{ name, amount }]);
    if (error) {
        alert("Erreur ajout dépense : " + error.message);
    } else {
        expenseName.value = "";
        expenseAmount.value = "";
        loadExpenses();
    }
});

// CHARGER LES DÉPENSES
async function loadExpenses() {
    const { data, error } = await supabaseClient.from("expenses").select("*").order("id", { ascending: false });
    if (error) {
        alert("Erreur chargement dépenses : " + error.message);
        return;
    }
    expenseList.innerHTML = "";
    data.forEach((expense) => {
        const li = document.createElement("li");
        li.textContent = `${expense.name} - ${expense.amount} €`;
        expenseList.appendChild(li);
    });
}
