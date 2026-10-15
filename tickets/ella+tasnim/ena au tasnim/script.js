/* =====================================================
   SESAME – script.js
   JavaScript vanilla : aucune bibliothèque, aucun backend.
   Les données sont enregistrées dans le navigateur (localStorage).

   Plan du fichier :
   1. Outils généraux (sécurité, dates, notifications visuelles)
   2. Icônes SVG
   3. Mise en page commune (logo, sidebar, barre supérieure, recherche)
   4. Données d'exemple (actualités, événements)
   5. Page « Accueil »
   6. Pages « Actualités » et « Événements »
   7. Page « Mes tickets »
   8. Page « Assistant IA »
   9. Page « Mon profil »
   10. Démarrage
   ===================================================== */

/* =====================================================
   1. OUTILS GÉNÉRAUX
   ===================================================== */

/** Lit une valeur JSON dans localStorage (avec une valeur par défaut en cas d'erreur). */
function lireStockage(cle, valeurParDefaut) {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? JSON.parse(brut) : valeurParDefaut;
  } catch (erreur) {
    return valeurParDefaut;
  }
}

/** Écrit une valeur JSON dans localStorage. */
function ecrireStockage(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch (erreur) {
    console.warn("Sauvegarde locale impossible :", erreur);
  }
}

/**
 * Protège l'affichage : transforme les caractères spéciaux en texte inoffensif.
 * Indispensable quand on affiche ce que l'utilisateur a tapé via innerHTML.
 */
function echapperHtml(texte) {
  return String(texte)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Date longue (ex. 12 octobre 2026). */
function formaterDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Date courte (ex. 15/04/2025). */
function formaterDateCourte(iso) {
  return new Date(iso).toLocaleDateString("fr-FR");
}

/** Heure courte (ex. 10:45). */
function formaterHeure(date) {
  return new Date(date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Date courte + heure (ex. 15/04/2025 10:45). */
function formaterDateHeureCourte(iso) {
  return formaterDateCourte(iso) + " " + formaterHeure(iso);
}

/** Date + heure lisibles (ex. 12 oct. 2026, 14:30), utilisées dans les notifications. */
function formaterDateHeure(iso) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

/** Retire accents et majuscules pour comparer des textes (utile pour la recherche et le chatbot). */
function normaliser(texte) {
  return String(texte).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Retourne les initiales d'un nom (ex. « Ella Gharrech » → « EG »). */
function initiales(nom) {
  return nom.split(" ").filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join("");
}

/**
 * Affiche un message de confirmation temporaire en bas à droite.
 * type : "info" (par défaut), "succes" ou "erreur".
 */
function afficherToast(message, type = "info") {
  const zone = document.getElementById("toasts");
  if (!zone) return;
  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.textContent = message;
  zone.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("sortie");
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/* ---------- Notifications (cloche de la barre supérieure) ---------- */
const CLE_NOTIFS = "sesame_notifications";

function chargerNotifications() {
  return lireStockage(CLE_NOTIFS, [
    { message: "Bienvenue sur le portail étudiant SESAME (version démo).", date: new Date().toISOString(), lue: false }
  ]);
}

/** Ajoute une notification dans la cloche (appelée après chaque action importante). */
function ajouterNotification(message) {
  const liste = chargerNotifications();
  liste.unshift({ message: message, date: new Date().toISOString(), lue: false });
  ecrireStockage(CLE_NOTIFS, liste.slice(0, 15));
  mettreAJourCloche();
}

function mettreAJourCloche() {
  const pastille = document.getElementById("pastille-notifs");
  const menu = document.getElementById("liste-notifs");
  if (!pastille || !menu) return;
  const liste = chargerNotifications();
  const nonLues = liste.filter((n) => !n.lue).length;
  pastille.textContent = nonLues;
  pastille.classList.toggle("cachee", nonLues === 0);
  menu.innerHTML = liste.length
    ? liste.map((n) => `<div class="notif-item">${echapperHtml(n.message)}<small>${formaterDateHeure(n.date)}</small></div>`).join("")
    : '<div class="notif-item">Aucune notification.</div>';
}

/* =====================================================
   2. ICÔNES SVG (style homogène : traits arrondis)
   ===================================================== */
const ICONES = {
  accueil: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  actualites: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  evenements: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  tickets: '<path d="M4 8a2 2 0 002-2h12a2 2 0 002 2v2a2 2 0 000 4v2a2 2 0 00-2 2H6a2 2 0 00-2-2v-2a2 2 0 000-4z" transform="rotate(-20 12 12)"/><path d="M10 9l4 6" transform="rotate(-20 12 12)" stroke-dasharray="1.5 2.5"/>',
  assistant: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4M9 13h.01M15 13h.01M9 16.5h6"/><circle cx="12" cy="3.5" r="1"/>',
  profil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  deconnexion: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  recherche: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  cloche: '<path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8z"/><path d="M10 20a2 2 0 004 0"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  envoyer: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
  aide: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01"/>',
  valider: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  fermer: '<path d="M18 6L6 18M6 6l12 12"/>',
  horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lieu: '<path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  document: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  base: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  livre: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5M9 8h6"/>',
  outil: '<path d="M14.7 6.3a4 4 0 005 5L21 13l-8 8-4-4 8-8z" transform="scale(.85) translate(2 0)"/><path d="M3 21l4-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  dossier: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  chevronBas: '<path d="M6 9l6 6 6-6"/>',
  chevronDroite: '<path d="M9 6l6 6-6 6"/>',
  retour: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  etincelle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'
};

/** Retourne le code HTML d'une icône SVG à partir de son nom. */
function icone(nom) {
  return `<svg class="icone" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nom] || ""}</svg>`;
}

/* =====================================================
   3. MISE EN PAGE COMMUNE (logo + sidebar + barre supérieure)
   Chaque page HTML contient deux zones vides que ce code remplit :
   <aside id="zone-sidebar"> et <div id="zone-topbar">.
   Ainsi, la navigation est écrite une seule fois pour toutes les pages.
   ===================================================== */

const PAGES = [
  { id: "accueil", libelle: "Accueil", fichier: "index.html", icone: "accueil" },
  { id: "actualites", libelle: "Actualités", fichier: "actualites.html", icone: "actualites" },
  { id: "evenements", libelle: "Événements", fichier: "evenements.html", icone: "evenements" },
  { id: "tickets", libelle: "Mes tickets", fichier: "tickets.html", icone: "tickets" },
  { id: "assistant", libelle: "Assistant IA", fichier: "assistant.html", icone: "assistant" }
];
const PAGE_PROFIL = { id: "profil", libelle: "Mon profil", fichier: "profil.html", icone: "profil" };

const CLE_PROFIL = "sesame_profil";
/* Profil d'exemple. Il est modifiable depuis la page « Mon profil ». */
const PROFIL_PAR_DEFAUT = {
  nom: "Ella Gharrech",
  statut: "Étudiante",
  email: "ella.gharrech@exemple.tn",
  filiere: "Licence en Informatique",
  niveau: "2ème année",
  matricule: "ETU-2026-0142",
  telephone: "+216 00 000 000"
};

function chargerProfil() {
  return Object.assign({}, PROFIL_PAR_DEFAUT, lireStockage(CLE_PROFIL, {}));
}

/**
 * Logo : on essaie d'afficher « logo.png » (le vrai logo SESAME à placer à côté des fichiers).
 * S'il est introuvable, on affiche un logo de remplacement aux couleurs SESAME.
 * classe : "logo-fixe" (en haut à gauche sur ordinateur) ou "logo-mobile" (dans le menu mobile).
 */
function creerLogo(classe) {
  const zone = document.createElement("a");
  zone.className = classe;
  zone.href = "index.html";
  zone.setAttribute("aria-label", "SESAME – Accueil");
  const fallback = `
    <div class="logo-fallback">
      <div class="logo-rond">S</div>
      <div><strong>SESAME</strong><small>School of High-Tech, AI &amp; Management</small></div>
    </div>`;
  zone.innerHTML = fallback; // affichage immédiat pendant le chargement
  const img = new Image();
  img.alt = "Logo SESAME";
  img.onload = () => { zone.innerHTML = ""; zone.appendChild(img); };
  img.src = "Logo-SESAME.png"; // si le fichier est absent, le logo de remplacement reste affiché
  return zone;
}

function lienNavigation(page, pageCourante) {
  const actif = page.id === pageCourante;
  return `<a href="${page.fichier}" class="${actif ? "actif" : ""}" ${actif ? 'aria-current="page"' : ""}>${icone(page.icone)}<span>${page.libelle}</span></a>`;
}

function construireSidebar() {
  const sidebar = document.getElementById("zone-sidebar");
  if (!sidebar) return;
  sidebar.className = "sidebar";
  sidebar.id = "sidebar";
  const pageCourante = document.body.dataset.page;

  // Logo fixe en haut à gauche (fond blanc) + copie dans le menu mobile
  document.body.appendChild(creerLogo("logo-fixe"));
  sidebar.appendChild(creerLogo("logo-mobile"));

  const nav = document.createElement("nav");
  nav.className = "nav";
  nav.setAttribute("aria-label", "Navigation principale");
  nav.innerHTML =
    `<div class="nav-haut">${PAGES.map((p) => lienNavigation(p, pageCourante)).join("")}</div>
     <div class="nav-bas">
       ${lienNavigation(PAGE_PROFIL, pageCourante)}
       <button type="button" id="btn-deconnexion">${icone("deconnexion")}<span>Déconnexion</span></button>
     </div>`;
  sidebar.appendChild(nav);

  // Déconnexion simulée : il n'y a pas de vrai compte ni de serveur.
  document.getElementById("btn-deconnexion").addEventListener("click", () => {
    if (confirm("Se déconnecter ? (Simulation : aucune session réelle n'existe dans cette démo.)")) {
      afficherToast("Déconnexion simulée. Vos tickets restent enregistrés dans ce navigateur.", "info");
      setTimeout(() => { window.location.href = "index.html"; }, 1400);
    }
  });
}

/**
 * Recherche globale : on compte les résultats dans les tickets, les actualités
 * et les événements, puis on ouvre la page qui en contient le plus (avec ?q=mot).
 */
function lancerRechercheGlobale(motSaisi) {
  const mot = normaliser(motSaisi.trim().replace(/^#/, ""));
  const compter = (liste, champs) => liste.filter((x) => normaliser(champs(x)).includes(mot)).length;
  const resultats = [
    { page: "tickets.html", nb: compter(chargerTickets(), (t) => t.sujet + " " + t.id) },
    { page: "actualites.html", nb: compter(ACTUALITES, (a) => a.titre + " " + a.resume + " " + a.categorie) },
    { page: "evenements.html", nb: compter(EVENEMENTS, (e) => e.titre + " " + e.description + " " + e.categorie + " " + e.lieu) }
  ];
  const meilleur = resultats.reduce((a, b) => (b.nb > a.nb ? b : a)); // en cas d'égalité : tickets d'abord
  window.location.href = meilleur.page + (mot ? "?q=" + encodeURIComponent(motSaisi.trim()) : "");
}

function construireTopbar() {
  const zone = document.getElementById("zone-topbar");
  if (!zone) return;
  zone.className = "topbar";
  const profil = chargerProfil();
  const q = new URLSearchParams(window.location.search).get("q") || "";
  zone.innerHTML = `
    <button type="button" class="burger" id="btn-burger" aria-label="Ouvrir le menu">${icone("menu")}</button>
    <form class="recherche-globale" id="form-recherche-globale" role="search">
      ${icone("recherche")}
      <input type="search" id="recherche-globale" placeholder="Rechercher sur le site…" aria-label="Recherche sur le site" value="${echapperHtml(q)}">
    </form>
    <div class="topbar-droite">
      <button type="button" class="btn-icone" id="btn-cloche" aria-label="Notifications">
        ${icone("cloche")}<span class="pastille cachee" id="pastille-notifs">0</span>
      </button>
      <div class="menu-notifs" id="menu-notifs"><h3>Notifications</h3><div id="liste-notifs"></div></div>
      <a href="profil.html" class="profil-mini" aria-label="Mon profil">
        <div class="avatar">${echapperHtml(initiales(profil.nom))}</div>
        <div><strong>${echapperHtml(profil.nom)}</strong><small>${echapperHtml(profil.statut)}</small></div>
        ${icone("chevronBas")}
      </a>
    </div>`;

  // Menu mobile
  document.getElementById("btn-burger").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("ouverte");
  });

  document.getElementById("form-recherche-globale").addEventListener("submit", (e) => {
    e.preventDefault();
    lancerRechercheGlobale(document.getElementById("recherche-globale").value);
  });

  // Cloche : ouvre le menu et marque les notifications comme lues.
  const menu = document.getElementById("menu-notifs");
  document.getElementById("btn-cloche").addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("ouvert");
    if (menu.classList.contains("ouvert")) {
      const liste = chargerNotifications().map((n) => Object.assign(n, { lue: true }));
      ecrireStockage(CLE_NOTIFS, liste);
      document.getElementById("pastille-notifs").classList.add("cachee");
    }
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) menu.classList.remove("ouvert");
  });
  mettreAJourCloche();
}

/* =====================================================
   4. DONNÉES D'EXEMPLE (fictives, à remplacer par de vraies données)
   ===================================================== */
const ACTUALITES = [
  { id: 1, titre: "Ouverture de la période de réinscription", date: "2026-10-08", categorie: "Scolarité", resume: "Exemple : la période de réinscription est ouverte. Consultez l'administration pour connaître les dates exactes." },
  { id: 2, titre: "Nouveau laboratoire d'intelligence artificielle", date: "2026-10-05", categorie: "Campus", resume: "Exemple : un espace dédié aux projets d'IA et de data science accueille les étudiants." },
  { id: 3, titre: "Partenariat avec des entreprises technologiques", date: "2026-09-29", categorie: "Carrière", resume: "Exemple : de nouvelles opportunités de stages et de projets en entreprise." },
  { id: 4, titre: "Calendrier des examens du premier semestre", date: "2026-09-22", categorie: "Scolarité", resume: "Exemple : le calendrier sera publié sur les canaux officiels de l'école." },
  { id: 5, titre: "Concours de projets étudiants", date: "2026-09-15", categorie: "Vie étudiante", resume: "Exemple : présentez votre projet devant un jury d'enseignants et de professionnels." },
  { id: 6, titre: "Bibliothèque : nouveaux horaires", date: "2026-09-10", categorie: "Campus", resume: "Exemple : les horaires d'ouverture évoluent pour mieux accompagner les révisions." }
];

const EVENEMENTS = [
  { id: 1, titre: "Journée d'intégration des nouveaux étudiants", date: "2026-10-21", heure: "09:00", lieu: "Campus SESAME", categorie: "Vie étudiante", description: "Exemple : rencontre avec les équipes pédagogiques et visite du campus." },
  { id: 2, titre: "Conférence : l'IA dans l'entreprise", date: "2026-10-28", heure: "14:00", lieu: "Amphithéâtre", categorie: "Conférence", description: "Exemple : retours d'expérience de professionnels sur l'usage de l'IA." },
  { id: 3, titre: "Atelier CV et entretien d'embauche", date: "2026-11-04", heure: "10:30", lieu: "Salle B12", categorie: "Carrière", description: "Exemple : conseils pratiques pour préparer ses candidatures." },
  { id: 4, titre: "Hackathon SESAME", date: "2026-11-14", heure: "08:30", lieu: "Laboratoire d'innovation", categorie: "Compétition", description: "Exemple : 24 heures pour concevoir un prototype en équipe." },
  { id: 5, titre: "Forum des stages et de l'emploi", date: "2026-11-25", heure: "09:30", lieu: "Hall principal", categorie: "Carrière", description: "Exemple : rencontrez des entreprises qui recrutent des stagiaires." }
];

const CLE_INSCRIPTIONS = "sesame_inscriptions_evenements";

/** Lit le mot recherché dans l'adresse de la page (?q=...), normalisé. */
function motRecherchePage() {
  const q = new URLSearchParams(window.location.search).get("q") || "";
  return { brut: q.trim(), norme: normaliser(q.trim().replace(/^#/, "")) };
}

/* =====================================================
   5. PAGE « ACCUEIL »
   ===================================================== */
function initialiserAccueil() {
  const zone = document.getElementById("accueil-actus");
  if (!zone) return;

  // Statistiques des tickets (même source de données que la page Mes tickets)
  const tickets = chargerTickets();
  document.getElementById("accueil-total").textContent = tickets.length;
  document.getElementById("accueil-ouverts").textContent = tickets.filter((t) => t.statut === "ouvert").length;
  document.getElementById("accueil-fermes").textContent = tickets.filter((t) => t.statut === "ferme").length;

  // 3 dernières actualités – format "liste-riche"
  zone.innerHTML = ACTUALITES.slice(0, 3).map((a) => {
    const d = new Date(a.date);
    const jour = d.getDate();
    const mois = d.toLocaleDateString("fr-FR", { month: "short" });
    return `
    <div class="item-riche">
      <div class="date-bloc-riche"><b>${jour}</b><span>${mois}</span></div>
      <div class="item-corps">
        <strong>${echapperHtml(a.titre)}</strong>
        <div class="item-meta"><span class="tag-mini">${echapperHtml(a.categorie)}</span></div>
      </div>
    </div>`;
  }).join("");

  // 3 prochains événements – format "liste-riche"
  document.getElementById("accueil-events").innerHTML = EVENEMENTS.slice(0, 3).map((e) => {
    const d = new Date(e.date);
    const jour = d.getDate();
    const mois = d.toLocaleDateString("fr-FR", { month: "short" });
    return `
    <div class="item-riche">
      <div class="date-bloc-riche"><b>${jour}</b><span>${mois}</span></div>
      <div class="item-corps">
        <strong>${echapperHtml(e.titre)}</strong>
        <div class="item-meta">
          <span class="tag-mini">${echapperHtml(e.categorie)}</span>
          ${echapperHtml(e.heure)} &middot; ${echapperHtml(e.lieu)}
        </div>
      </div>
    </div>`;
  }).join("");
}


/* =====================================================
   6. PAGES « ACTUALITÉS » ET « ÉVÉNEMENTS »
   ===================================================== */
function initialiserActualites() {
  const conteneur = document.getElementById("liste-actualites");
  if (!conteneur) return;
  const barre = document.getElementById("filtres-actualites");
  const categories = ["Toutes"].concat([...new Set(ACTUALITES.map((a) => a.categorie))]);
  const recherche = motRecherchePage();

  function afficher(categorieChoisie) {
    barre.innerHTML = categories.map((c) =>
      `<button type="button" class="btn petit ${c === categorieChoisie ? "" : "secondaire"}" data-categorie="${echapperHtml(c)}">${echapperHtml(c)}</button>`).join("");
    const liste = ACTUALITES
      .filter((a) => categorieChoisie === "Toutes" || a.categorie === categorieChoisie)
      .filter((a) => !recherche.norme || normaliser(a.titre + " " + a.resume + " " + a.categorie).includes(recherche.norme));
    conteneur.innerHTML = liste.length ? liste.map((a) => `
      <article class="carte carte-actu survol">
        <div class="visuel">${icone("actualites")}</div>
        <span class="etiquette">${echapperHtml(a.categorie)}</span>
        <h3>${echapperHtml(a.titre)}</h3>
        <p>${echapperHtml(a.resume)}</p>
        <div class="meta">${formaterDate(a.date)}</div>
      </article>`).join("") : '<div class="etat-vide" style="grid-column:1/-1">Aucune actualité ne correspond à votre recherche.</div>';
  }
  barre.addEventListener("click", (e) => {
    const bouton = e.target.closest("button[data-categorie]");
    if (bouton) afficher(bouton.dataset.categorie);
  });
  afficher("Toutes");
}

function initialiserEvenements() {
  const conteneur = document.getElementById("liste-evenements");
  if (!conteneur) return;
  const recherche = motRecherchePage();

  function afficher() {
    const inscrits = lireStockage(CLE_INSCRIPTIONS, []);
    const liste = EVENEMENTS.filter((ev) => !recherche.norme ||
      normaliser(ev.titre + " " + ev.description + " " + ev.categorie + " " + ev.lieu).includes(recherche.norme));
    conteneur.innerHTML = liste.length ? liste.map((ev) => {
      const participe = inscrits.includes(ev.id);
      return `
      <article class="carte carte-actu survol">
        <div class="visuel">${icone("evenements")}</div>
        <span class="etiquette">${echapperHtml(ev.categorie)}</span>
        <h3>${echapperHtml(ev.titre)}</h3>
        <p>${echapperHtml(ev.description)}</p>
        <div class="meta">${icone("horloge")} ${formaterDate(ev.date)} à ${echapperHtml(ev.heure)}<br>${icone("lieu")} ${echapperHtml(ev.lieu)}</div>
        <button type="button" class="btn petit ${participe ? "secondaire" : ""}" style="margin-top:14px" data-evenement="${ev.id}">
          ${participe ? "Annuler ma participation" : "Je participe"}
        </button>
      </article>`;
    }).join("") : '<div class="etat-vide" style="grid-column:1/-1">Aucun événement ne correspond à votre recherche.</div>';
  }

  conteneur.addEventListener("click", (e) => {
    const bouton = e.target.closest("button[data-evenement]");
    if (!bouton) return;
    const id = Number(bouton.dataset.evenement);
    let inscrits = lireStockage(CLE_INSCRIPTIONS, []);
    const evenement = EVENEMENTS.find((x) => x.id === id);
    if (inscrits.includes(id)) {
      inscrits = inscrits.filter((x) => x !== id);
      afficherToast("Participation annulée.", "info");
    } else {
      inscrits.push(id);
      afficherToast("Participation enregistrée dans ce navigateur (simulation).", "succes");
      ajouterNotification("Vous participez à : " + evenement.titre);
    }
    ecrireStockage(CLE_INSCRIPTIONS, inscrits);
    afficher();
  });
  afficher();
}

/* =====================================================
   7. PAGE « MES TICKETS »
   ===================================================== */
// Nouvelle clé de stockage (v2) : les anciens tickets de test ne sont pas repris.
const CLE_TICKETS = "sesame_tickets_v2";

/** Icône et couleur du cercle selon la catégorie du ticket. */
const CATEGORIES_TICKET = {
  "Administratif": { icone: "document", couleur: "" },
  "Financier": { icone: "base", couleur: "turquoise" },
  "Inscription": { icone: "profil", couleur: "rose" },
  "Pédagogique": { icone: "livre", couleur: "violet" },
  "Technique": { icone: "outil", couleur: "orange" },
  "Autre": { icone: "aide", couleur: "" }
};

function infoCategorie(categorie) {
  return CATEGORIES_TICKET[categorie] || CATEGORIES_TICKET["Autre"];
}

/** Tickets d'exemple affichés au tout premier chargement (3 ouverts, 5 fermés). */
function ticketsInitiaux() {
  return [
    { id: "TK-008", sujet: "Attestation d'inscription", categorie: "Administratif", description: "Je souhaite obtenir une attestation d'inscription pour l'année universitaire en cours. Merci de me préciser les documents nécessaires.", statut: "ouvert", dateCreation: "2025-04-15T09:50:00", dateMiseAJour: "2025-04-15T10:45:00" },
    { id: "TK-007", sujet: "Frais universitaires", categorie: "Financier", description: "Demande de précisions sur les frais universitaires.", statut: "ferme", dateCreation: "2025-04-10T14:20:00", dateMiseAJour: "2025-04-11T09:10:00" },
    { id: "TK-006", sujet: "Problème d'inscription", categorie: "Inscription", description: "Je n'arrive pas à finaliser mon inscription en ligne.", statut: "ouvert", dateCreation: "2025-04-05T11:05:00", dateMiseAJour: "2025-04-05T11:05:00" },
    { id: "TK-005", sujet: "Relevé de notes", categorie: "Administratif", description: "Demande d'un relevé de notes pour un dossier.", statut: "ferme", dateCreation: "2025-03-28T16:30:00", dateMiseAJour: "2025-03-30T10:00:00" },
    { id: "TK-004", sujet: "Emploi du temps incomplet", categorie: "Pédagogique", description: "Un cours manque dans mon emploi du temps du semestre.", statut: "ferme", dateCreation: "2025-03-20T08:45:00", dateMiseAJour: "2025-03-21T15:20:00" },
    { id: "TK-003", sujet: "Accès à la plateforme", categorie: "Technique", description: "Je n'arrive plus à me connecter à la plateforme pédagogique.", statut: "ouvert", dateCreation: "2025-03-12T13:10:00", dateMiseAJour: "2025-03-12T13:10:00" },
    { id: "TK-002", sujet: "Certificat de scolarité", categorie: "Administratif", description: "Demande d'un certificat de scolarité pour une démarche personnelle.", statut: "ferme", dateCreation: "2025-03-02T09:00:00", dateMiseAJour: "2025-03-04T11:40:00" },
    { id: "TK-001", sujet: "Changement de coordonnées", categorie: "Administratif", description: "Je souhaite mettre à jour mon adresse e-mail et mon numéro de téléphone.", statut: "ferme", dateCreation: "2025-02-20T10:30:00", dateMiseAJour: "2025-02-21T09:15:00" }
  ];
}

/** Charge les tickets (ou crée les tickets d'exemple la première fois). */
function chargerTickets() {
  const tickets = lireStockage(CLE_TICKETS, null);
  if (tickets === null) {
    const initiaux = ticketsInitiaux();
    ecrireStockage(CLE_TICKETS, initiaux);
    return initiaux;
  }
  return tickets;
}

function sauvegarderTickets(tickets) {
  ecrireStockage(CLE_TICKETS, tickets);
}

/** Génère un identifiant unique : TK-<numéro suivant sur 3 chiffres>. */
function genererIdentifiant(tickets) {
  const numeros = tickets.map((t) => parseInt(String(t.id).replace("TK-", ""), 10)).filter((n) => !isNaN(n));
  const suivant = numeros.length ? Math.max(...numeros) + 1 : 1;
  return "TK-" + String(suivant).padStart(3, "0");
}

// État de l'écran (filtre choisi et ticket sélectionné)
let filtreStatut = "tous";
let ticketSelectionne = null;

/** Met à jour automatiquement les 3 cartes de statistiques. */
function mettreAJourStatistiques() {
  const tickets = chargerTickets();
  document.getElementById("stat-total").textContent = tickets.length;
  document.getElementById("stat-ouverts").textContent = tickets.filter((t) => t.statut === "ouvert").length;
  document.getElementById("stat-fermes").textContent = tickets.filter((t) => t.statut === "ferme").length;
}

function badgeStatut(statut) {
  return statut === "ouvert"
    ? '<span class="badge ouvert">Ouvert</span>'
    : '<span class="badge ferme">Fermé</span>';
}

/** Affiche la liste des tickets selon la recherche et le filtre actifs. */
function afficherTickets() {
  const conteneur = document.getElementById("liste-tickets");
  if (!conteneur) return;
  const motCle = normaliser(document.getElementById("recherche-tickets").value.trim().replace(/^#/, ""));

  const tickets = chargerTickets()
    .filter((t) => filtreStatut === "tous" || t.statut === filtreStatut)
    .filter((t) => !motCle || normaliser(t.sujet).includes(motCle) || normaliser(t.id).includes(motCle))
    .sort((a, b) => new Date(b.dateCreation) - new Date(a.dateCreation));

  if (tickets.length === 0) {
    conteneur.innerHTML = '<div class="etat-vide"><strong>Aucun ticket trouvé.</strong><br>Modifiez votre recherche ou votre filtre, ou créez un nouveau ticket.</div>';
  } else {
    conteneur.innerHTML = tickets.map((t) => {
      const cat = infoCategorie(t.categorie);
      return `
      <article class="carte ticket ${t.id === ticketSelectionne ? "selectionne" : ""}" data-action="details" data-id="${echapperHtml(t.id)}">
        <div class="ticket-icone ${cat.couleur}">${icone(cat.icone)}</div>
        <div style="min-width:0">
          <div class="ticket-meta"><span class="ticket-id">#${echapperHtml(t.id)}</span> · ${formaterDateCourte(t.dateCreation)}</div>
          <h3>${echapperHtml(t.sujet)}</h3>
          <p>${echapperHtml(t.description)}</p>
        </div>
        ${badgeStatut(t.statut)}
        <button type="button" class="chevron" data-action="details" data-id="${echapperHtml(t.id)}" aria-label="Afficher les détails de ${echapperHtml(t.id)}">${icone("chevronBas")}</button>
      </article>`;
    }).join("");
  }
  mettreAJourStatistiques();
  afficherDetails(ticketSelectionne);
}

/** Remplit le panneau de détails avec le ticket sélectionné. */
function afficherDetails(id) {
  const panneau = document.getElementById("panneau-details");
  if (!panneau) return;
  const ticket = chargerTickets().find((t) => t.id === id);

  if (!ticket) {
    ticketSelectionne = null;
    panneau.innerHTML = `<div class="vide">${icone("tickets")}<p>Sélectionnez un ticket pour afficher son contenu complet.</p></div>`;
    return;
  }
  const estOuvert = ticket.statut === "ouvert";
  panneau.innerHTML = `
    <button type="button" class="btn-retour" data-action="retour">${icone("retour")} Retour à la liste</button>
    <div class="detail-titre"><h2>#${echapperHtml(ticket.id)}</h2>${badgeStatut(ticket.statut)}</div>
    <div class="detail-ligne">${icone("evenements")}<span>Date de création : ${formaterDateCourte(ticket.dateCreation)}</span></div>
    <div class="detail-ligne">${icone("dossier")}<span><strong>Objet : ${echapperHtml(ticket.sujet)}</strong></span></div>
    <div class="detail-ligne">${icone("document")}<div><strong>Description :</strong><p class="detail-description">${echapperHtml(ticket.description)}</p></div></div>
    <div class="detail-ligne">${icone("horloge")}<span>Catégorie : ${echapperHtml(ticket.categorie)}</span></div>
    <hr class="detail-separateur">
    <div class="detail-ligne">${icone("horloge")}<span>Dernière mise à jour : ${formaterDateHeureCourte(ticket.dateMiseAJour)}</span></div>
    <div class="boite-info">${icone("info")}<p>${estOuvert
      ? "Votre demande est en cours de traitement. Vous serez notifié dès qu'il y aura une réponse."
      : "Cette demande est clôturée. Vous pouvez la rouvrir si besoin."}</p></div>
    <button type="button" class="btn ${estOuvert ? "danger" : ""}" data-action="basculer" data-id="${echapperHtml(ticket.id)}">
      ${estOuvert ? "Fermer le ticket" : "Rouvrir le ticket"}
    </button>
    <p class="note-simulation">Simulation : le changement de statut est enregistré uniquement dans ce navigateur, aucune administration n'est contactée.</p>`;
}

/** Simule la fermeture ou la réouverture d'un ticket. */
function basculerStatut(id) {
  const tickets = chargerTickets();
  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) return;
  ticket.statut = ticket.statut === "ouvert" ? "ferme" : "ouvert";
  ticket.dateMiseAJour = new Date().toISOString();
  sauvegarderTickets(tickets);
  const message = ticket.statut === "ferme" ? `Ticket #${id} fermé.` : `Ticket #${id} rouvert.`;
  afficherToast(message, "succes");
  ajouterNotification(message);
  afficherTickets();
}

/* ---------- Fenêtre « Nouveau ticket » ---------- */
function ouvrirModale() {
  document.getElementById("form-ticket").reset();
  document.querySelectorAll("#form-ticket .champ").forEach((c) => c.classList.remove("invalide"));
  document.getElementById("modale-ticket").classList.add("ouvert");
  document.getElementById("ticket-sujet").focus();
}
function fermerModale() {
  document.getElementById("modale-ticket").classList.remove("ouvert");
}

/** Vérifie un champ du formulaire ; affiche l'erreur s'il est vide ou trop court. */
function validerChamp(idChamp, longueurMin) {
  const champ = document.getElementById(idChamp);
  const valide = champ.value.trim().length >= longueurMin;
  champ.closest(".champ").classList.toggle("invalide", !valide);
  return valide;
}

function creerTicket(evenement) {
  evenement.preventDefault();
  const sujetOk = validerChamp("ticket-sujet", 5);
  const categorieOk = validerChamp("ticket-categorie", 1);
  const descriptionOk = validerChamp("ticket-description", 15);
  if (!(sujetOk && categorieOk && descriptionOk)) {
    afficherToast("Veuillez corriger les champs indiqués.", "erreur");
    return;
  }
  const tickets = chargerTickets();
  const maintenant = new Date().toISOString();
  const nouveau = {
    id: genererIdentifiant(tickets),
    sujet: document.getElementById("ticket-sujet").value.trim(),
    categorie: document.getElementById("ticket-categorie").value,
    description: document.getElementById("ticket-description").value.trim(),
    statut: "ouvert",
    dateCreation: maintenant,
    dateMiseAJour: maintenant
  };
  tickets.push(nouveau);
  sauvegarderTickets(tickets);
  fermerModale();
  ticketSelectionne = nouveau.id;
  // On revient sur « Tous » pour que le nouveau ticket soit visible.
  filtreStatut = "tous";
  document.querySelectorAll("#filtres-tickets button").forEach((b) => b.classList.toggle("actif", b.dataset.filtre === "tous"));
  document.getElementById("recherche-tickets").value = "";
  afficherTickets();
  afficherToast(`Ticket #${nouveau.id} créé avec succès.`, "succes");
  ajouterNotification(`Nouveau ticket créé : ${nouveau.sujet}`);
}

function initialiserTickets() {
  if (!document.getElementById("liste-tickets")) return;

  // Recherche venant de la barre supérieure (?q=...)
  const recherche = motRecherchePage();
  if (recherche.brut) document.getElementById("recherche-tickets").value = recherche.brut;

  document.getElementById("recherche-tickets").addEventListener("input", afficherTickets);

  document.getElementById("filtres-tickets").addEventListener("click", (e) => {
    const bouton = e.target.closest("button[data-filtre]");
    if (!bouton) return;
    filtreStatut = bouton.dataset.filtre;
    document.querySelectorAll("#filtres-tickets button").forEach((b) => b.classList.toggle("actif", b === bouton));
    afficherTickets();
  });

  // Un seul écouteur pour : ouvrir un ticket, revenir à la liste, fermer / rouvrir.
  document.querySelector(".page-tickets").addEventListener("click", (e) => {
    const element = e.target.closest("[data-action]");
    if (!element) return;
    const action = element.dataset.action;
    if (action === "details") {
      ticketSelectionne = element.dataset.id;
      afficherTickets();
      // Sur petit écran, le panneau est sous la liste : on y fait défiler la page.
      if (window.innerWidth <= 1180) document.getElementById("panneau-details").scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (action === "retour") {
      ticketSelectionne = null;
      afficherTickets();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (action === "basculer") {
      basculerStatut(element.dataset.id);
    }
  });

  document.getElementById("btn-nouveau-ticket").addEventListener("click", ouvrirModale);
  document.getElementById("btn-annuler-ticket").addEventListener("click", fermerModale);
  document.getElementById("btn-fermer-modale").addEventListener("click", fermerModale);
  document.getElementById("modale-ticket").addEventListener("click", (e) => {
    if (e.target.id === "modale-ticket") fermerModale();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerModale(); });
  document.getElementById("form-ticket").addEventListener("submit", creerTicket);

  // Sur grand écran, on affiche d'emblée le ticket le plus récent dans le panneau.
  if (window.innerWidth > 1180) {
    const plusRecent = chargerTickets().slice().sort((a, b) => new Date(b.dateCreation) - new Date(a.dateCreation))[0];
    if (plusRecent) ticketSelectionne = plusRecent.id;
  }
  afficherTickets();
}

/* =====================================================
   8. PAGE « ASSISTANT IA »
   Assistant de DÉMONSTRATION : il reconnaît des mots-clés et renvoie des
   réponses prédéfinies. Ce n'est PAS une vraie IA et ses réponses ne sont
   PAS des informations officielles.
   ===================================================== */

const AVERTISSEMENT_OFFICIEL = "Réponse de démonstration, non officielle. Pour une information fiable, consultez les sources officielles de SESAME ou l'administration.";

const QUESTIONS_FREQUENTES = [
  "Quels documents faut-il pour une attestation d'inscription ?",
  "Comment consulter les frais universitaires ?",
  "Comment s'inscrire à l'université ?",
  "Où trouver mon emploi du temps ?",
  "Comment obtenir un relevé de notes ?",
  "Comment contacter l'administration ?",
  "Comment suivre mes demandes ?"
];

/**
 * Règles de l'assistant : une liste de mots-clés (sans accents) et la réponse associée.
 * La règle qui contient le plus de mots-clés dans la question est choisie.
 * Une réponse = texte d'introduction, puces (facultatif), suite (facultatif), lien (facultatif).
 * « officiel : true » ajoute l'avertissement sous la réponse.
 */
const REGLES_ASSISTANT = [
  {
    motsCles: ["attestation", "documents", "pieces", "papiers", "certificat"],
    reponse: "Pour obtenir une attestation d'inscription, vous aurez généralement besoin de :",
    puces: ["Une copie de votre carte d'étudiant", "Une pièce d'identité en cours de validité", "Le formulaire de demande (si nécessaire)"],
    suite: "Si vous avez un cas particulier, je vous conseille de contacter directement le service de scolarité pour confirmer la liste exacte des documents.",
    officiel: true,
    lien: { texte: "Créer un ticket", href: "tickets.html" }
  },
  {
    motsCles: ["frais", "scolarite", "paiement", "payer", "tarif", "cout", "mensualite"],
    reponse: "Les frais universitaires peuvent varier selon votre situation (niveau d'études, type de formation, etc.). Je ne peux pas vous donner de montants ni d'échéances : ils doivent être confirmés par l'école.",
    suite: "Pour obtenir les informations exactes et à jour, consultez le site officiel de SESAME ou contactez le service financier.",
    officiel: true
  },
  {
    motsCles: ["inscrire", "inscription", "candidature", "admission", "rejoindre"],
    reponse: "De manière générale, l'inscription commence par une candidature, suivie de la constitution d'un dossier et de sa validation par l'administration. Les conditions, les dates et les pièces à fournir doivent être vérifiées sur les canaux officiels de SESAME.",
    officiel: true
  },
  {
    motsCles: ["emploi du temps", "planning", "horaire"],
    reponse: "Votre emploi du temps est normalement publié par l'école sur ses outils officiels (plateforme pédagogique ou affichage). En cas d'erreur ou de cours manquant, vous pouvez signaler le problème via un ticket.",
    officiel: true,
    lien: { texte: "Signaler un problème", href: "tickets.html" }
  },
  {
    motsCles: ["releve", "notes", "resultat", "bulletin", "examen"],
    reponse: "Un relevé de notes se demande généralement auprès de la scolarité. Précisez le semestre ou l'année concernée dans votre demande. Les délais et la procédure exacte sont à confirmer auprès de l'administration.",
    officiel: true,
    lien: { texte: "Faire une demande", href: "tickets.html" }
  },
  {
    motsCles: ["contacter", "contact", "administration", "telephone", "mail", "email", "joindre", "secretariat"],
    reponse: "Pour joindre l'administration, utilisez les coordonnées officielles de l'école (site web, e-mail ou téléphone). Vous pouvez aussi déposer une demande dans « Mes tickets » pour garder une trace de votre échange.",
    officiel: true,
    lien: { texte: "Ouvrir Mes tickets", href: "tickets.html" }
  },
  {
    motsCles: ["suivre", "suivi", "demande", "ticket", "reclamation"],
    reponse: "Toutes vos demandes sont regroupées dans la page « Mes tickets » : vous pouvez les rechercher, filtrer les ouverts ou fermés, et consulter le détail de chacune.",
    officiel: false,
    lien: { texte: "Voir mes tickets", href: "tickets.html" }
  },
  {
    motsCles: ["bonjour", "salut", "hello", "bonsoir", "salam"],
    reponse: "Bonjour ! Je suis l'assistant de démonstration de SESAME. Posez-moi une question sur les documents, les frais, l'emploi du temps ou le suivi de vos demandes.",
    officiel: false
  },
  {
    motsCles: ["merci"],
    reponse: "Avec plaisir ! N'hésitez pas si vous avez une autre question.",
    officiel: false
  }
];

const REPONSE_PAR_DEFAUT = {
  reponse: "Je n'ai pas de réponse prédéfinie pour cette question. Essayez avec d'autres mots, choisissez une question fréquente, ou contactez directement l'administration. Vous pouvez aussi créer un ticket.",
  officiel: false,
  lien: { texte: "Créer un ticket", href: "tickets.html" }
};

/** Cherche la meilleure réponse prédéfinie à partir des mots-clés. */
function reponseDemo(question) {
  const texte = normaliser(question);
  let meilleure = null;
  let meilleurScore = 0;
  REGLES_ASSISTANT.forEach((regle) => {
    const score = regle.motsCles.filter((mot) => texte.includes(mot)).length;
    if (score > meilleurScore) { meilleurScore = score; meilleure = regle; }
  });
  const regle = meilleure || REPONSE_PAR_DEFAUT;
  return { texte: regle.reponse, puces: regle.puces, suite: regle.suite, officiel: regle.officiel, lien: regle.lien };
}

/* ---------- Préparation pour une vraie API d'IA (plus tard) ----------
   IMPORTANT : ne mettez JAMAIS de clé API dans ce fichier : tout visiteur pourrait la lire.
   Le bon schéma est le suivant :
     navigateur  →  VOTRE serveur (qui garde la clé secrète)  →  service d'IA
   Pour brancher une vraie IA :
     1. créer un petit serveur qui reçoit { question } et renvoie { reponse } ;
     2. mettre utiliserApi à true et indiquer l'adresse de ce serveur dans urlApi.
   Le reste de l'interface n'aura pas besoin de changer. */
const CONFIG_ASSISTANT = {
  utiliserApi: false,
  urlApi: "/api/assistant" // adresse de VOTRE serveur (exemple, inexistante dans cette démo)
};

/** Point d'entrée unique pour obtenir une réponse (démo locale ou API). */
async function demanderAssistant(question) {
  if (CONFIG_ASSISTANT.utiliserApi) {
    const reponse = await fetch(CONFIG_ASSISTANT.urlApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question })
    });
    if (!reponse.ok) throw new Error("Erreur du serveur : " + reponse.status);
    const donnees = await reponse.json();
    return { texte: donnees.reponse, officiel: true };
  }
  return reponseDemo(question);
}

/* ---------- Affichage du chat ---------- */

/**
 * Ajoute une bulle de message dans la conversation, avec l'heure d'envoi.
 * options : { puces: [...], suite: "...", lien: {texte, href}, officiel: true/false }
 */
function ajouterMessage(auteur, texte, options = {}) {
  const zone = document.getElementById("messages");
  const message = document.createElement("div");
  message.className = "message " + auteur;

  const avatar = document.createElement("div");
  avatar.className = "mini-avatar";
  avatar.innerHTML = icone(auteur === "etudiant" ? "profil" : "assistant");

  const colonne = document.createElement("div");
  colonne.className = "col";
  const bulle = document.createElement("div");
  bulle.className = "bulle";

  // textContent partout : le texte tapé par l'étudiant ne peut pas injecter de HTML.
  const paragraphe = document.createElement("p");
  paragraphe.textContent = texte;
  bulle.appendChild(paragraphe);

  if (options.puces && options.puces.length) {
    const liste = document.createElement("ul");
    options.puces.forEach((p) => {
      const li = document.createElement("li");
      li.textContent = p;
      liste.appendChild(li);
    });
    bulle.appendChild(liste);
  }
  if (options.suite) {
    const suite = document.createElement("p");
    suite.textContent = options.suite;
    bulle.appendChild(suite);
  }
  if (options.lien) {
    const lien = document.createElement("a");
    lien.className = "lien-aide";
    lien.href = options.lien.href;
    lien.textContent = options.lien.texte + " →";
    bulle.appendChild(lien);
  }
  if (options.officiel) {
    const note = document.createElement("span");
    note.className = "avertissement";
    note.textContent = AVERTISSEMENT_OFFICIEL;
    bulle.appendChild(note);
  }

  const heure = document.createElement("span");
  heure.className = "heure";
  heure.textContent = formaterHeure(new Date());

  colonne.appendChild(bulle);
  colonne.appendChild(heure);
  message.appendChild(avatar);
  message.appendChild(colonne);
  zone.appendChild(message);
  zone.scrollTop = zone.scrollHeight;
  return message;
}

/** Envoie la question de l'étudiant puis affiche la réponse de l'assistant. */
async function envoyerQuestion(question) {
  const texte = question.trim();
  if (!texte) return;
  ajouterMessage("etudiant", texte);

  // Indicateur « l'assistant écrit… »
  const zone = document.getElementById("messages");
  const indicateur = document.createElement("div");
  indicateur.className = "message assistant";
  indicateur.innerHTML = `<div class="mini-avatar">${icone("assistant")}</div><div class="col"><div class="bulle"><span class="frappe"><span></span><span></span><span></span></span></div></div>`;
  zone.appendChild(indicateur);
  zone.scrollTop = zone.scrollHeight;

  try {
    const [reponse] = await Promise.all([
      demanderAssistant(texte),
      new Promise((resolve) => setTimeout(resolve, 650)) // petite pause pour un rendu naturel
    ]);
    indicateur.remove();
    ajouterMessage("assistant", reponse.texte, { puces: reponse.puces, suite: reponse.suite, officiel: reponse.officiel, lien: reponse.lien });
  } catch (erreur) {
    indicateur.remove();
    ajouterMessage("assistant", "Désolé, une erreur est survenue. Veuillez réessayer plus tard.");
    console.error(erreur);
  }
}

function initialiserAssistant() {
  const formulaire = document.getElementById("form-chat");
  if (!formulaire) return;
  const champ = document.getElementById("champ-question");

  // Panneau « Questions fréquentes »
  document.getElementById("faq-liste").innerHTML = QUESTIONS_FREQUENTES.map((q) =>
    `<button type="button" data-question="${echapperHtml(q)}"><span>${echapperHtml(q)}</span>${icone("chevronDroite")}</button>`).join("");

  // Clic sur une question fréquente : elle est envoyée automatiquement dans le chat.
  document.getElementById("faq-liste").addEventListener("click", (e) => {
    const bouton = e.target.closest("button[data-question]");
    if (bouton) envoyerQuestion(bouton.dataset.question);
  });

  formulaire.addEventListener("submit", (e) => {
    e.preventDefault();
    const question = champ.value;
    champ.value = "";
    envoyerQuestion(question);
    champ.focus();
  });

  // Message d'accueil
  ajouterMessage("assistant",
    "Bonjour ! Je suis l'assistant virtuel de démonstration de SESAME. Je peux vous orienter sur les documents, les frais, l'emploi du temps ou le suivi de vos demandes.",
    { suite: "Choisissez une question fréquente ou écrivez la vôtre." });
}

/* =====================================================
   9. PAGE « MON PROFIL »
   ===================================================== */
function initialiserProfil() {
  const formulaire = document.getElementById("form-profil");
  if (!formulaire) return;
  const profil = chargerProfil();

  function afficherResume(p) {
    document.getElementById("profil-avatar").textContent = initiales(p.nom);
    document.getElementById("profil-nom").textContent = p.nom;
    document.getElementById("profil-filiere").textContent = p.filiere + " · " + p.niveau;
    document.getElementById("profil-matricule").textContent = p.matricule;
    document.getElementById("profil-email").textContent = p.email;
    document.getElementById("profil-telephone").textContent = p.telephone;
  }
  afficherResume(profil);

  // Remplit le formulaire avec les valeurs actuelles
  ["nom", "email", "telephone"].forEach((cle) => { document.getElementById("champ-" + cle).value = profil[cle]; });

  formulaire.addEventListener("submit", (e) => {
    e.preventDefault();
    const nom = document.getElementById("champ-nom").value.trim();
    const email = document.getElementById("champ-email").value.trim();
    const telephone = document.getElementById("champ-telephone").value.trim();
    const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    document.getElementById("champ-nom").closest(".champ").classList.toggle("invalide", nom.length < 3);
    document.getElementById("champ-email").closest(".champ").classList.toggle("invalide", !emailValide);
    if (nom.length < 3 || !emailValide) {
      afficherToast("Veuillez corriger les champs indiqués.", "erreur");
      return;
    }
    const miseAJour = Object.assign({}, chargerProfil(), { nom: nom, email: email, telephone: telephone });
    ecrireStockage(CLE_PROFIL, miseAJour);
    afficherResume(miseAJour);
    // Met à jour le nom en haut de page sans recréer toute la barre (évite de doubler les écouteurs).
    const nomHaut = document.querySelector(".profil-mini strong");
    const avatarHaut = document.querySelector(".profil-mini .avatar");
    if (nomHaut) nomHaut.textContent = miseAJour.nom;
    if (avatarHaut) avatarHaut.textContent = initiales(miseAJour.nom);
    afficherToast("Profil mis à jour dans ce navigateur.", "succes");
    ajouterNotification("Votre profil a été mis à jour.");
  });

  document.getElementById("btn-reinitialiser").addEventListener("click", () => {
    if (confirm("Effacer les tickets, notifications et modifications enregistrés dans ce navigateur ?")) {
      [CLE_TICKETS, CLE_NOTIFS, CLE_PROFIL, CLE_INSCRIPTIONS].forEach((cle) => localStorage.removeItem(cle));
      afficherToast("Données de démonstration réinitialisées.", "succes");
      setTimeout(() => window.location.reload(), 900);
    }
  });
}

/* =====================================================
   10. DÉMARRAGE : s'exécute quand la page est chargée
   ===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  construireSidebar();
  construireTopbar();
  // Chaque fonction ne fait rien si les éléments de sa page sont absents.
  initialiserAccueil();
  initialiserActualites();
  initialiserEvenements();
  initialiserTickets();
  initialiserAssistant();
  initialiserProfil();
});
