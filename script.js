const API_BASE_URL = "https://fastapi-backend-m2hs.onrender.com";
let authToken = localStorage.getItem("access_token") || null;

// -----------------------------
// Fonction générique pour appeler l'API
// -----------------------------
async function apiRequest(endpoint, method = "GET", body = null) {
  const headers = { "Content-Type": "application/json" };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  let data = {};
  try {
    data = await res.json();
  } catch (e) {}

  if (!res.ok) {
    throw new Error(data.detail || "Erreur API");
  }
  return data;
}

// -----------------------------
// Authentification
// -----------------------------
async function signup(email, password) {
  try {
    await apiRequest("/signup", "POST", { email, password });
    alert("Inscription réussie, veuillez vous connecter.");
  } catch (e) {
    alert("Erreur inscription: " + e.message);
  }
}

async function login(email, password) {
  try {
    const data = await apiRequest("/login", "POST", { email, password });
    authToken = data.access_token;
    localStorage.setItem("access_token", authToken);
    chargerBudgetMois();
  } catch (e) {
    alert("Erreur connexion: " + e.message);
  }
}

function logout() {
  authToken = null;
  localStorage.removeItem("access_token");
  document.getElementById("revenusList").innerHTML = "";
  document.getElementById("depensesList").innerHTML = "";
}

// -----------------------------
// GESTION DU BUDGET
// -----------------------------
async function chargerBudgetMois(mois = null) {
  if (!mois) {
    const d = new Date();
    mois = d.toISOString().slice(0, 7); // YYYY-MM
  }
  try {
    const data = await apiRequest(`/budget/month?month=${mois}`, "GET");
    afficherBudget(data.data);
  } catch (e) {
    console.error("Erreur chargement budget:", e.message);
  }
}

function afficherBudget(data) {
  const revenusList = document.getElementById("revenusList");
  const depensesList = document.getElementById("depensesList");

  if (revenusList) revenusList.innerHTML = "";
  if (depensesList) depensesList.innerHTML = "";

  if (data.revenus) {
    data.revenus.forEach(item => {
      if (revenusList) revenusList.innerHTML += `<li>${item.name}: ${item.amount} €</li>`;
    });
  }
  if (data.depenses) {
    data.depenses.forEach(item => {
      if (depensesList) depensesList.innerHTML += `<li>${item.name}: ${item.amount} €</li>`;
    });
  }
}

async function ajouterBudgetItem(type, nom, montant) {
  const mois = new Date().toISOString().slice(0, 7);
  try {
    await apiRequest("/budget/item", "POST", {
      month: mois,
      item_type: type,
      name: nom,
      amount: parseFloat(montant)
    });
    await chargerBudgetMois(mois);
  } catch (e) {
    alert("Erreur ajout: " + e.message);
  }
}

// -----------------------------
// LIAISON UI
// -----------------------------
document.addEventListener("DOMContentLoaded", () => {
  if (authToken) {
    chargerBudgetMois();
  }

  // Auth
  const signupBtn = document.getElementById("signupBtn");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (signupBtn) {
    signupBtn.addEventListener("click", () => {
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      signup(email, password);
    });
  }
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      login(email, password);
    });
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  // Revenus
  const addRevenuBtn = document.getElementById("addRevenuBtn");
  if (addRevenuBtn) {
    addRevenuBtn.addEventListener("click", () => {
      const name = document.getElementById("revenuName").value;
      const amount = document.getElementById("revenuAmount").value;
      ajouterBudgetItem("revenu", name, amount);
    });
  }

  // Dépenses
  const addDepenseBtn = document.getElementById("addDepenseBtn");
  if (addDepenseBtn) {
    addDepenseBtn.addEventListener("click", () => {
      const name = document.getElementById("depenseName").value;
      const amount = document.getElementById("depenseAmount").value;
      ajouterBudgetItem("depense", name, amount);
    });
  }
});
