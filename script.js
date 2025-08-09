// -----------------------------
// Config
// -----------------------------
const API_URL = "https://fastapi-backend-m2hs.onrender.com"; // adapte si nécessaire

function getAuthToken() {
  return localStorage.getItem("token"); // ou la clé que tu utilises
}

function apiCall(path, { method = "GET", body = null } = {}) {
  const token = getAuthToken();
  const headers = {
    "Accept": "application/json",
  };
  if (body !== null) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : null,
  })
    .then(async (res) => {
      const text = await res.text();
      const isJson = res.headers.get("content-type")?.includes("application/json");
      const data = isJson && text ? JSON.parse(text) : text;
      if (!res.ok) {
        // génère une erreur avec détail si possible
        const errMsg = (data && data.detail) ? data.detail : (typeof data === "string" ? data : JSON.stringify(data));
        throw new Error(errMsg || `HTTP ${res.status}`);
      }
      return data;
    });
}

// -----------------------------
// Chargement des données (au chargement / après login)
// -----------------------------
/**
 * charge le mois donné depuis le serveur et remplace la structure locale
 * @param {string} monthKey format "YYYY-MM"
 * @returns {Promise<void>}
 */
async function chargerDonneesUtilisateurMonth(monthKey) {
  if (!getAuthToken()) return; // pas connecté
  try {
    const resp = await apiCall(`/budget/month?month=${encodeURIComponent(monthKey)}`);
    // format attendu : { month: "...", data: { revenus: [...], depenses: [...], ... } }
    if (!resp || !resp.data) {
      console.warn("Aucune donnée pour le mois", monthKey);
      return;
    }
    const d = resp.data;
    // Transforme les items serveur en format local (adapte selon ta structure locale)
    const cle = monthKeyToLocalKey(monthKey); // si tu as une fonction pour convertir, sinon cle = monthKey
    // Exemple d'adaptation : gardons champs: id, nom, montant, date, recurrente, reported, metadata
    donneesParMois[cle] = {
      revenus: (d.revenus || []).map(x => ({ id: x.id, nom: x.name, montant: parseFloat(x.amount), date: x.date, metadata: x.metadata || {} })),
      depenses: (d.depenses || []).map(x => ({ id: x.id, nom: x.name, montant: parseFloat(x.amount), date: x.date, metadata: x.metadata || {} })),
      factures: (d.factures || []).map(x => ({ id: x.id, nom: x.name, montant: parseFloat(x.amount), date: x.date, recurrente: !!x.recurrent, metadata: x.metadata || {} })),
      investissements: (d.investissements || []).map(x => ({ id: x.id, nom: x.name, montant: parseFloat(x.amount), date: x.date, metadata: x.metadata || {} })),
      epargnes: (d.epargnes || []).map(x => ({ id: x.id, nom: x.name, montant: parseFloat(x.amount), date: x.date, metadata: x.metadata || {} })),
    };
    // appelle ta fonction UI pour re-render
    mettreAJourAffichage?.(); // si tu as cette fonction ; sinon appelle la tienne
  } catch (err) {
    console.error("Erreur chargerDonneesUtilisateurMonth:", err.message);
  }
}

// Si tu veux charger le mois courant
function monthKeyToLocalKey(monthKey) {
  // si ta clé locale est différente, ajuste ici. Par défaut on retourne identique.
  return monthKey;
}

// -----------------------------
// Sauvegarde bulk du mois (remplace entièrement le mois côté serveur)
// -----------------------------
/**
 * Sauvegarde l'intégralité des items du mois (bulk replace).
 * Le endpoint va effacer les items existants et insérer les nouveaux.
 * @param {string} monthKey "YYYY-MM"
 * @returns {Promise<void>}
 */
async function sauvegarderDonneesMoisBulk(monthKey) {
  if (!getAuthToken()) throw new Error("Pas de token");
  const cle = monthKeyToLocalKey(monthKey);
  const local = donneesParMois[cle] || { revenus: [], depenses: [], factures: [], investissements: [], epargnes: [] };

  // Convertir la structure locale en payload attendu
  const items = [];
  function pushItems(list, type) {
    (list || []).forEach(it => {
      items.push({
        month: monthKey,
        item_type: type,
        name: it.nom || it.name || "Sans nom",
        amount: Number(it.montant || it.amount || 0),
        date: it.date || null,
        recurrent: !!it.recurrente || !!it.recurrent,
        reported: !!it.reported,
        metadata: it.metadata || {}
      });
    });
  }
  pushItems(local.revenus, "revenu");
  pushItems(local.depenses, "depense");
  pushItems(local.factures, "facture");
  pushItems(local.investissements, "investissement");
  pushItems(local.epargnes, "epargne");

  try {
    const body = { month: monthKey, items };
    const res = await apiCall("/budget/month", { method: "POST", body });
    console.log("Sauvegarde mois OK :", res);
    // facultatif : recharger pour récupérer les ids assignés par la base
    await chargerDonneesUtilisateurMonth(monthKey);
  } catch (err) {
    console.error("Erreur sauvegarderDonneesMoisBulk:", err.message);
  }
}

// -----------------------------
// CRUD item individuel (créer / update / delete)
// -----------------------------
/**
 * crée ou met à jour un item sur le serveur.
 * Si item.id existe -> PUT, sinon POST.
 * itemLocal = { id?, nom, montant, date?, recurrente?, reported?, metadata? }
 * type = 'depense' | 'revenu' | 'facture' | 'investissement' | 'epargne'
 */
async function sauvegarderItemServeur(itemLocal, type, monthKey) {
  if (!getAuthToken()) throw new Error("Pas de token");
  const payload = {
    month: monthKey,
    item_type: type,
    name: itemLocal.nom || itemLocal.name || "Sans nom",
    amount: Number(itemLocal.montant || itemLocal.amount || 0),
    date: itemLocal.date || null,
    recurrent: !!itemLocal.recurrente || !!itemLocal.recurrent,
    reported: !!itemLocal.reported,
    metadata: itemLocal.metadata || {}
  };

  try {
    if (itemLocal.id) {
      // update
      const res = await apiCall(`/budget/item/${encodeURIComponent(itemLocal.id)}`, { method: "PUT", body: payload });
      console.log("Item mis à jour:", res);
      return res;
    } else {
      // create
      const res = await apiCall("/budget/item", { method: "POST", body: payload });
      console.log("Item créé:", res);
      // retourne l'objet créé (avec id)
      return res;
    }
  } catch (err) {
    console.error("Erreur sauvegarderItemServeur:", err.message);
    throw err;
  }
}

/**
 * suppression d'un item serveur
 * @param {string} itemId
 */
async function supprimerItemServeur(itemId) {
  if (!getAuthToken()) throw new Error("Pas de token");
  try {
    const res = await apiCall(`/budget/item/${encodeURIComponent(itemId)}`, { method: "DELETE" });
    console.log("Item supprimé:", res);
    return res;
  } catch (err) {
    console.error("Erreur supprimerItemServeur:", err.message);
    throw err;
  }
}

// -----------------------------
// Intégration avec ton code existant (exemples d'usage)
// -----------------------------
/*
  Exemple : appeler au load
  window.addEventListener('load', async () => {
    const mois = `${annee}-${String(moisIndex+1).padStart(2,'0')}`;
    await chargerDonneesUtilisateurMonth(mois);
  });

  Exemple : après ajout local d'une dépense (dans ta fonction ajouterDepense)
  async function ajouterDepenseUI(nom, montant) {
    // 1. ajoute localement (comme tu fais déjà)
    const cle = obtenirCleMois(...); // ta logique pour cle
    const newItemLocal = { nom, montant };
    donneesParMois[cle].depenses.push(newItemLocal);
    mettreAJourAffichage();

    // 2. sauvegarde sur serveur
    try {
      const created = await sauvegarderItemServeur(newItemLocal, 'depense', cle);
      // 3. récupère l'id renvoyé par le serveur et l'ajoute localement pour futures maj/supp
      if (created && created.id) newItemLocal.id = created.id;
    } catch (err) {
      // optionnel : rollback ou marquer comme non synchronisé
      console.error(err);
    }
  }

  Exemple : sauvegarder tout le mois (si tu veux faire un "Save" global)
  document.getElementById('btnSaveMonth').addEventListener('click', async () => {
    const cle = obtenirCleMois(...);
    await sauvegarderDonneesMoisBulk(cle);
    alert('Données sauvegardées');
  });
*/

// -----------------------------
// Fin
// -----------------------------

