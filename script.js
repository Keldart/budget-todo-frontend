/* ======= CONFIG ======= */
const API_BASE = "https://fastapi-backend-m2hs.onrender.com";
let authToken = localStorage.getItem("maitriz_token") || null;
let utilisateurConnecte = !!authToken;

/* ======= UTIL - fetch wrapper ======= */
async function apiRequest(path, method = "GET", body = null) {
  const headers = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { json = text; }
  if (!res.ok) {
    const err = (json && json.detail) ? json.detail : (json || res.statusText);
    const e = new Error(err || "Erreur API");
    e.status = res.status;
    throw e;
  }
  return json;
}

/* ======= AUTH ======= */
// Appelle /signup
async function sInscrire(email, password) {
  try {
    const resp = await apiRequest("/signup", "POST", { email, password });
    // signup renvoie message + user_id ; après signup, faire login ou demander confirmation.
    return resp;
  } catch (e) {
    console.error("Erreur signup:", e);
    throw e;
  }
}

// Appelle /login et stocke token
async function seConnecter(email, password) {
  try {
    const resp = await apiRequest("/login", "POST", { email, password });
    if (resp && resp.access_token) {
      authToken = resp.access_token;
      localStorage.setItem("maitriz_token", authToken);
      utilisateurConnecte = true;
      // charger les données utilisateur depuis le serveur
      await chargerDonneesUtilisateurActuelles();
      return resp.user;
    } else {
      throw new Error("Réponse login invalide");
    }
  } catch (e) {
    console.error("Erreur login:", e);
    throw e;
  }
}

function logout() {
  authToken = null;
  utilisateurConnecte = false;
  localStorage.removeItem("maitriz_token");
}

/* ======= SYNC MOIS ======= */
/*
  Charge les items pour un mois donné "YYYY-MM".
  Renvoie la structure { month, data: { revenus, depenses, factures, investissements, epargnes } }
*/
async function loadMonthFromServer(monthYYYYMM) {
  if (!utilisateurConnecte) throw new Error("Utilisateur non connecté");
  const q = new URLSearchParams({ month: monthYYYYMM });
  return await apiRequest(`/budget/month?${q.toString()}`, "GET");
}

/*
  Crée un item unique côté serveur.
  item doit correspondre à ton BudgetItemIn:
  { month: "YYYY-MM", item_type: "revenu"|"depense"|..., name, amount, date?, recurrent?, reported?, metadata? }
*/
async function createItemOnServer(item) {
  if (!utilisateurConnecte) throw new Error("Utilisateur non connecté");
  return await apiRequest("/budget/item", "POST", item);
}

/*
  Update item on server (full replace)
  item must be same shape as BudgetItemIn
*/
async function updateItemOnServer(itemId, item) {
  if (!utilisateurConnecte) throw new Error("Utilisateur non connecté");
  return await apiRequest(`/budget/item/${itemId}`, "PUT", item);
}

/*
  Delete item
*/
async function deleteItemOnServer(itemId) {
  if (!utilisateurConnecte) throw new Error("Utilisateur non connecté");
  return await apiRequest(`/budget/item/${itemId}`, "DELETE");
}

/*
  Bulk save for a month: delete existing month items and insert new ones.
  items: Array<BudgetItemIn>
*/
async function saveMonthBulkToServer(monthYYYYMM, items) {
  if (!utilisateurConnecte) throw new Error("Utilisateur non connecté");
  return await apiRequest("/budget/month", "POST", { month: monthYYYYMM, items });
}

/* ======= Intégration avec ton code local actuel =======
   - Remplace ta fonction sauvegarderDonnees() par la version ci-dessous
   - Remplace chargerDonnees() par chargerDonneesUtilisateurActuelles()
   - Après chaque ajout local (ajouterRevenu etc.) appelle createItemOnServer pour persister
*/

/* Remplacement de sauvegarderDonnees */
async function sauvegarderDonnees() {
  // Si utilisateur connecté -> essayer d'envoyer en temps réel (best-effort)
  if (!utilisateurConnecte) {
    // fallback local
    localStorage.setItem('donneesParMois', JSON.stringify(donneesParMois));
    return;
  }

  // stratégie simple : bulk save current month only (optimisable)
  try {
    const cle = obtenirCleMois(moisActuel.mois, moisActuel.annee); // ex: "2025-08"
    const donnees = obtenirDonneesMois(moisActuel.mois, moisActuel.annee);

    // transformer en payload Supabase-friendly
    const payload = [];
    function pushType(typeName, arr, item_type) {
      arr.forEach(it => {
        payload.push({
          month: cle,
          item_type,
          name: it.nom || it.name || "Item",
          amount: (it.montant !== undefined ? it.montant : it.amount) || 0,
          date: it.date || null,
          recurrent: !!it.recurrente || !!it.recurrent,
          reported: !!it.reporte || !!it.reported,
          metadata: it.metadata || {}
        });
      });
    }
    pushType("revenus", donnees.revenus, "revenu");
    pushType("depenses", donnees.depenses, "depense");
    pushType("factures", donnees.factures, "facture");
    pushType("investissements", donnees.investissements, "investissement");
    pushType("epargnes", donnees.epargnes, "epargne");

    // appel bulk
    await saveMonthBulkToServer(cle, payload);
  } catch (e) {
    console.warn("Sauvegarde distante échouée, fallback local:", e);
    localStorage.setItem('donneesParMois', JSON.stringify(donneesParMois));
  }
}

/* Remplacement de chargerDonnees -> tentera charger depuis serveur si connecté */
async function chargerDonneesUtilisateurActuelles() {
  // load local first
  const donneesStockees = localStorage.getItem('donneesParMois');
  if (donneesStockees && Object.keys(donneesParMois).length === 0) {
    donneesParMois = JSON.parse(donneesStockees);
  }

  if (!utilisateurConnecte) return;

  // charger mois courant + éventuellement d'autres mois (ici on charge le moisActuel)
  const cle = obtenirCleMois(moisActuel.mois, moisActuel.annee);
  try {
    const serverResp = await loadMonthFromServer(cle);
    if (serverResp && serverResp.data) {
      // reconvertir en structure locale attendue par l'app
      donneesParMois[cle] = {
        revenus: (serverResp.data.revenus || []).map(i => ({ nom: i.name, montant: parseFloat(i.amount), id: i.id })),
        depenses: (serverResp.data.depenses || []).map(i => ({ nom: i.name, montant: parseFloat(i.amount), id: i.id })),
        factures: (serverResp.data.factures || []).map(i => ({ nom: i.name, montant: parseFloat(i.amount), recurrente: !!i.recurrent, id: i.id })),
        investissements: (serverResp.data.investissements || []).map(i => ({ nom: i.name, montant: parseFloat(i.amount), id: i.id, reporte: !!i.reported })),
        epargnes: (serverResp.data.epargnes || []).map(i => ({ nom: i.name, montant: parseFloat(i.amount), id: i.id, reporte: !!i.reported }))
      };
      mettreAJourAffichage();
      // keep local copy too
      localStorage.setItem('donneesParMois', JSON.stringify(donneesParMois));
    }
  } catch (e) {
    console.warn("Impossible de charger depuis le serveur :", e);
  }
}

/* Appeler createItemOnServer après chaque ajout local pour persister rapidement.
   Exemple : modifier ajouterRevenu() pour appeler createItemOnServer(itemPayload) */
async function _afterAddLocalItem(itemObj, itemType) {
  // itemObj is local { nom, montant, ... } ; transform to server item
  if (!utilisateurConnecte) return;
  const cle = obtenirCleMois(moisActuel.mois, moisActuel.annee);
  const serverItem = {
    month: cle,
    item_type: itemType,
    name: itemObj.nom,
    amount: itemObj.montant,
    date: itemObj.date || null,
    recurrent: !!itemObj.recurrente || !!itemObj.recurrent,
    reported: !!itemObj.reporte || !!itemObj.reported,
    metadata: itemObj.metadata || {}
  };
  try {
    const created = await createItemOnServer(serverItem);
    // si backend retourne id, associer-le localement (pratique pour update/delete)
    if (created && created.id) {
      itemObj.id = created.id;
      // update local storage
      localStorage.setItem('donneesParMois', JSON.stringify(donneesParMois));
    }
  } catch (e) {
    console.warn("Echec création item distant (on garde local):", e);
  }
}

/* Exemple d'intégration simple : patcher ajouterRevenu() */
/* Dans ton code existant, remplace simplement la ligne sauvegarderDonnees(); par :
   await _afterAddLocalItem(donnees.revenus[donnees.revenus.length - 1], 'revenu');
   (et garder la sauvegarde locale) */

/* ======= DELETE / UPDATE integration ======= */
/* Lorsque tu supprimes un item localement, si item.id existe -> deleteItemOnServer(item.id) */
async function _afterDeleteLocalItem(itemObj) {
  if (!utilisateurConnecte) return;
  if (!itemObj || !itemObj.id) return;
  try {
    await deleteItemOnServer(itemObj.id);
  } catch (e) {
    console.warn("Suppression distante échouée :", e);
  }
}

/* Lorsque tu modifies un item existant localement, tenter un update distant */
async function _afterUpdateLocalItem(itemObj) {
  if (!utilisateurConnecte) return;
  if (!itemObj || !itemObj.id) return;
  const cle = obtenirCleMois(moisActuel.mois, moisActuel.annee);
  const payload = {
    month: cle,
    item_type: itemObj.item_type || "depense", // adapter selon ton usage
    name: itemObj.nom || itemObj.name,
    amount: itemObj.montant || itemObj.amount,
    date: itemObj.date || null,
    recurrent: !!itemObj.recurrente || !!itemObj.recurrent,
    reported: !!itemObj.reporte || !!itemObj.reported,
    metadata: itemObj.metadata || {}
  };
  try {
    await updateItemOnServer(itemObj.id, payload);
  } catch (e) {
    console.warn("Update distant échoué :", e);
  }
}

/* ======= UTILISATION / NOTES =======
 - Remplace les appels à sauvegarderDonnees() et chargerDonnees() par les nouvelles versions ci-dessus.
 - Après un ajout local (ex: donnees.revenus.push(...)), appelle:
     await _afterAddLocalItem(donnees.revenus[donnees.revenus.length-1], 'revenu');
 - Lors d'une suppression, avant de splice() récupérer l'objet (pour lire id) puis après le splice appeler:
     await _afterDeleteLocalItem(objSupprime);
 - Lors d'une modification d'item (edit), mettre item.id si présent et appeler:
     await _afterUpdateLocalItem(item);
 - La bulk-save `sauvegarderDonnees()` tente d'envoyer tout le mois (plus simple pour synchroniser).
 - Si tu veux sync temps réel (create/update/delete directement), tu peux appeler les fonctions create/update/delete à chaque action (déjà fournies).
 - Pour afficher les erreurs à l'utilisateur, attrape les erreurs et affiche-les (ex: dans #message-connexion pour auth).
*/

/* ======= Exemple rapide de patch (ajouterRevenu) =======
function ajouterRevenu() {
  const nom = document.getElementById('revenu-nom').value;
  const montant = parseFloat(document.getElementById('revenu-montant').value);
  if (nom && montant > 0) {
    const donnees = obtenirDonneesMois(moisActuel.mois, moisActuel.annee);
    const newItem = { nom, montant };
    donnees.revenus.push(newItem);
    document.getElementById('revenu-nom').value = '';
    document.getElementById('revenu-montant').value = '';
    mettreAJourAffichage();
    // sauvegarde locale
    localStorage.setItem('donneesParMois', JSON.stringify(donneesParMois));
    // et tentative d'envoi au serveur (ne bloque pas l'UI)
    _afterAddLocalItem(newItem, 'revenu').catch(e => console.warn(e));
  }
}
*/

/* Fin du bundle JS d'intégration */

