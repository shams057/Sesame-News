# Sesame News

Plateforme de communication et de support de l’Université SESAME (projet Certix) : actualités et agenda pour les étudiants, demandes (tickets) adressées aux services, assistant IA, notifications push.

Licence : propriétaire, tous droits réservés (voir `LICENSE`).

Ce document est le **guide de reprise** du projet : il permet à une nouvelle personne d’installer, lancer, tester et faire évoluer l’ensemble à partir de zéro.

---

## Sommaire

1. [Vue d’ensemble](#1-vue-densemble)
2. [Rôles et permissions](#2-rôles-et-permissions)
3. [Prérequis](#3-prérequis)
4. [Installation pas à pas](#4-installation-pas-à-pas)
5. [Comptes de démonstration](#5-comptes-de-démonstration)
6. [Application Android](#6-application-android)
7. [Notifications push](#7-notifications-push)
8. [Assistant IA](#8-assistant-ia)
9. [Travailler sur le projet](#9-travailler-sur-le-projet)
10. [Dépannage](#10-dépannage)
11. [Mise en production](#11-mise-en-production)

---

## 1. Vue d’ensemble

| Dossier | Rôle | Technologies |
|---|---|---|
| `Backend/` | API REST `/api/v1` + temps réel (Socket.IO) | Node.js 20+, Express 5, Sequelize 6, MySQL 8 |
| `sesame-superadmin/` | Back-office du personnel (navigateur) | React 19, Vite, TanStack Query |
| `sesame-user/` | Application étudiante « Sesame News » (Android + navigateur) | Expo SDK 57, React Native 0.86, React Navigation |

```
 Étudiants (Android / web) ─┐                         ┌─ MySQL (sesame_news)
                            ├──► API Backend :3000 ───┤
 Personnel (back-office) ───┘     REST + Socket.IO     └─ Backend/uploads/ (fichiers)
                                        │
                                        └──► Expo Push ──► Firebase (FCM) ──► téléphones Android
```

**Étudiants** : fil d’actualités (épinglées, ciblées par classe, recherche, filtres « non lus » et « enregistrés », pièces jointes), agenda des événements (ajout à son agenda), demandes aux services (conversation en temps réel, pièces jointes, fermeture/réouverture, note de satisfaction), assistant IA, notifications push, mode hors connexion, changement de mot de passe. Les utilisateurs iPhone utilisent la version web (pas de build iOS pour le moment).

**Personnel** : file de tickets, statistiques (export CSV/PDF), actualités, étudiants (import CSV, mots de passe temporaires), classes, services, réponses types, équipe — selon le rôle ci-dessous.

---

## 2. Rôles et permissions

Deux rôles côté personnel :

- **Super administrateur** (`owner`) : a accès à **toutes** les actions.
- **Administrateur de service** (`agent`) : rattaché à un service/département ; ne voit et ne fait que ce qui concerne son service. Un administrateur de **département** gère en plus les étudiants des classes de son département.

Classes d’étudiants et département de rattachement (créées par les migrations, modifiables dans **Classes**) :

| Département | Classes |
|---|---|
| Département ING | Cycle Préparatoire, Cycle Ingénieurs |
| Département FTA | FTA (Formation Temps Aménagé) |
| Département Informatique | LIM (Licence Informatique Multimédia), LGLSI (Licence Génie Logiciel et Systèmes Intelligents), LBIS (Licence Business Information System) |
| Département Management | LSG (Licence Sciences de Gestion) |

| Fonction | Super administrateur | Administrateur de service |
|---|---|---|
| Tickets (file, répondre, fermer / rouvrir, notes internes, assignation, transfert) | tous les services | **tickets adressés à son service uniquement** |
| Statistiques et exports | tous les services | **son service uniquement** |
| Réponses types | toutes | globales + celles de son service |
| Actualités | créer, modifier, supprimer | **consultation seule** |
| Étudiants | tous : créer, modifier, changer de classe, supprimer, importer | **uniquement ceux des classes de son département** : créer, modifier, réinitialiser le mot de passe, activer/désactiver, importer (dans l’une de ses classes). Ne peut **ni changer un étudiant de classe ni supprimer**. Service sans classe (Scolarité, IT…) : aucun accès aux étudiants |
| Classes (et leur département) | gérer | consultation seule |
| Services | gérer | consultation seule |
| Équipe (comptes du back-office) | gérer, attribuer le service | voit les super admins et les collègues de son service |
| Supprimer un ticket | ✅ | — |

**Étudiant** (application) : uniquement ses données et les actualités destinées à tous ou à sa classe.

Il n’existe pas de rôle « enseignant » ni d’inscription publique : le premier super administrateur est créé en ligne de commande, les étudiants par le personnel (mot de passe temporaire à changer à la première connexion). Toutes ces règles sont appliquées **par l’API** (le back-office ne fait que masquer les boutons) et couvertes par `Backend/tests/permissions.test.js`.

---

## 3. Prérequis

| Outil | Version | Utilisé pour |
|---|---|---|
| Node.js | **20 ou plus** (22 recommandé) | les trois applications |
| MySQL | 8 | base de données — via XAMPP/WAMP, un serveur MySQL, ou Docker |
| Git | récent | récupérer le code |
| Docker (optionnel) | récent | MySQL en une commande, ou toute la pile |
| JDK | 17 | build Android |
| Android Studio (SDK + platform-tools) | récent | build Android, `adb` |
| Un téléphone Android avec le **débogage USB** activé | — | tester l’application native |

Vérifier :

```bash
node -v
```

```bash
mysql --version
```

---

## 4. Installation pas à pas

### 4.1 Récupérer le code et les dépendances

```bash
git clone https://github.com/shams057/Sesame-News.git
```

```bash
cd Sesame-News && npm run install:all
```

### 4.2 Base de données MySQL

**Option A — MySQL déjà installé (XAMPP, WAMP, serveur local)** : démarrez MySQL, puis créez une base vide (phpMyAdmin ou en ligne de commande) :

```sql
CREATE DATABASE sesame_news CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**Option B — Docker** (MySQL sur le port 3307, n’entre pas en conflit avec XAMPP) :

```bash
docker run -d --name sesame-mysql -e MYSQL_ROOT_PASSWORD=devroot -e MYSQL_DATABASE=sesame_news -p 127.0.0.1:3307:3306 mysql:8.4
```

Après un redémarrage de l’ordinateur : `docker start sesame-mysql`.

### 4.3 API (Backend)

```bash
cd Backend && cp .env.example .env
```

Dans `Backend/.env`, renseignez au minimum :

| Variable | Exemple | Rôle |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | `127.0.0.1`, `3306` (ou `3307` avec Docker), `root`, `…`, `sesame_news` | connexion MySQL |
| `JWT_SECRET` | 96 caractères aléatoires (commande ci-dessous) | signature des sessions |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:8081` | origines web autorisées |

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Créer les tables et les services (départements) :

```bash
npm run db:setup
```

Puis **au choix** :

```bash
npm run create-admin -- votre.login
```

(crée un super administrateur ; le mot de passe est demandé de façon masquée — ajoutez `--agent` pour un administrateur de service)

```bash
npm run db:seed:demo
```

(crée tous les comptes de démonstration du §5 et des actualités/tickets d’exemple — refusé si `NODE_ENV=production`)

Lancer l’API :

```bash
npm run dev
```

Vérification : http://localhost:3000/health doit répondre `{"status":"ok","database":"up"}`. Documentation de l’API : http://localhost:3000/api/v1/openapi.json.

### 4.4 Back-office

Dans un autre terminal :

```bash
cd sesame-superadmin && cp .env.example .env.local && npm run dev
```

Ouvrir http://localhost:5173 et se connecter avec un compte du personnel.

### 4.5 Application étudiante (version web)

Dans un autre terminal :

```bash
cd sesame-user && cp .env.example .env.local && npx expo start --web
```

Ouvrir http://localhost:8081 et se connecter avec un compte étudiant.

Raccourcis disponibles depuis la racine : `npm run dev:backend`, `npm run dev:admin`, `npm run dev:user`.

---

## 5. Comptes de démonstration

Créés par `npm run db:seed:demo` (développement uniquement — ne jamais utiliser ces mots de passe sur un vrai serveur).

| Rôle | Identifiant | Mot de passe | Étudiants gérés |
|---|---|---|---|
| Super administrateur | `admin` | `Admin12345!` | tous |
| Admin Service Scolarité | `agent.scolarite` | `Agent1234!` | — |
| Admin Service Stage | `agent.stage` | `Agent1234!` | — |
| Admin Département Informatique | `agent.informatique` | `Agent1234!` | LIM, LGLSI, LBIS |
| Admin Département Management | `agent.management` | `Agent1234!` | LSG |
| Admin Département ING | `agent.ing` | `Agent1234!` | Cycle Préparatoire, Cycle Ingénieurs |
| Admin Département FTA | `agent.fta` | `Agent1234!` | FTA |
| Admin Service IT | `agent.it` | `Agent1234!` | — |
| Admin Service Qualité | `agent.qualite` | `Agent1234!` | — |
| Admin Service Coopération Internationale | `agent.cooperation` | `Agent1234!` | — |
| Admin Service Marketing | `agent.marketing` | `Agent1234!` | — |
| Admin Service Admission | `agent.admission` | `Agent1234!` | — |
| Admin Service Finance | `agent.finance` | `Agent1234!` | — |
| Admin Service Student Success | `agent.studentsuccess` | `Agent1234!` | — |
| Étudiants · LIM / LGLSI / LBIS | `amine.benali`, `sarra.trabelsi`, `youssef.gharbi` | `Etudiant1234!` | — |
| Étudiante · LSG | `lina.mansour` | `Etudiant1234!` | — |
| Étudiants · Cycle Préparatoire / Cycle Ingénieurs | `omar.haddad`, `meriem.jlassi` | `Etudiant1234!` | — |
| Étudiant · FTA | `karim.saidi` | `Etudiant1234!` | — |

Pour voir les permissions à l’œuvre : comparez `admin` et `agent.it` (tickets du seul Service IT, actualités en lecture seule, aucun étudiant), et `agent.informatique` (gère uniquement les étudiants de LIM, LGLSI et LBIS, et les tickets adressés au Département Informatique).

---

## 6. Application Android

L’identifiant de l’application est `sesame.news` et son nom « Sesame News ». L’URL de l’API est **intégrée au moment du build** (`EXPO_PUBLIC_API_URL`).

### 6.1 Préparer le téléphone

1. Paramètres → À propos du téléphone → appuyer 7 fois sur « Numéro de build ».
2. Options pour les développeurs → activer le **débogage USB**.
3. Brancher le téléphone, accepter l’autorisation, puis vérifier :

```bash
adb devices
```

### 6.2 Build de développement (rechargement à chaud)

```bash
adb reverse tcp:3000 tcp:3000 && adb reverse tcp:8081 tcp:8081
```

```bash
cd sesame-user && npx expo run:android
```

Le premier build compile tout le code natif (5 à 30 minutes) ; les suivants sont rapides.

### 6.3 Build final (APK de production)

Avec l’API sur l’ordinateur et le téléphone branché en USB (garder `adb reverse tcp:3000 tcp:3000`) :

```bash
cd sesame-user && APP_ENV=production EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo prebuild -p android --clean && cd android && ./gradlew assembleRelease
```

Pour des téléphones en Wi-Fi, remplacez `http://localhost:3000` par l’adresse IP locale de l’ordinateur (ex. `http://192.168.1.10:3000`). Avec une API en `https://`, le trafic HTTP en clair est automatiquement interdit.

L’APK est produit dans `sesame-user/android/app/build/outputs/apk/release/app-release.apk`. Installation :

```bash
adb install -r sesame-user/android/app/build/outputs/apk/release/app-release.apk
```

Ne versionnez pas les APK (`releases/` et `*.apk` sont ignorés par Git) : publiez-les comme pièce jointe d’une *release* GitHub. Le dossier `sesame-user/android/` est **généré** (`expo prebuild`) : ne le modifiez pas à la main, configurez tout dans `sesame-user/app.config.js`.

---

## 7. Notifications push

Chaîne : API → service Expo Push → Firebase Cloud Messaging → téléphone. Les notifications sont envoyées quand une actualité est publiée, quand le personnel répond à un ticket et quand le statut d’un ticket change. Elles ne fonctionnent que dans une application Android installée (pas dans la version web).

**Configuration actuelle** (appartient au compte du développeur d’origine) :

- Projet EAS `sesame-etudiant` sur le compte Expo `shams057` (identifiant dans `sesame-user/app.config.js`).
- Projet Firebase `sesame-news`, application Android `sesame.news` → `sesame-user/google-services.json` (versionné, ce n’est pas un secret).
- Clé de compte de service Firebase (FCM V1) téléversée sur Expo pour `sesame.news`. **Cette clé est un secret : elle n’est jamais dans le dépôt.**

**Pour reprendre la main**, deux possibilités :

1. Se faire **inviter** sur le compte Expo (organisation) et sur le projet Firebase par le développeur d’origine ; rien d’autre à changer.
2. Ou recréer les vôtres :
   1. Firebase : créer un projet, ajouter une application Android `sesame.news`, télécharger `google-services.json` dans `sesame-user/`.
   2. Firebase → Paramètres du projet → Comptes de service → « Générer une nouvelle clé privée » (fichier JSON à garder hors du dépôt).
   3. Dans `sesame-user/` : `npx eas-cli@latest login`, puis `npx eas-cli@latest init` et mettre le nouvel identifiant de projet dans `app.config.js` (`extra.eas.projectId` et `owner`).
   4. `npx eas-cli@latest credentials -p android` → profil **production** → Google Service Account → FCM V1 → *Upload a new service account key* → chemin du fichier JSON.
   5. Rebuilder l’application (§6.3).

Tester l’envoi vers un étudiant connecté sur un téléphone :

```bash
npm --prefix Backend run test-push -- amine.benali
```

---

## 8. Assistant IA

L’assistant utilise n’importe quelle API compatible OpenAI. Il reste désactivé (l’application l’indique clairement) tant que ces variables de `Backend/.env` gardent leurs valeurs par défaut :

```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=YOUR_MODEL_NAME
LLM_API_KEY=YOUR_API_KEY
```

Il répond uniquement à partir des actualités visibles par l’étudiant, cite ses sources, et l’historique est conservé par étudiant (limite : 20 questions / minute / étudiant).

---

## 9. Travailler sur le projet

### Tests et qualité

```bash
npm test
```

```bash
npm run lint
```

- Backend : Jest + Supertest sur une base MySQL de test (`DB_NAME_TEST`, recréée automatiquement à chaque exécution — l’utilisateur MySQL doit pouvoir créer des bases).
- Back-office : Vitest + Testing Library. Mobile : jest-expo, `npx expo lint`, `npx expo-doctor`.
- **GitHub Actions** (`.github/workflows/ci.yml`) : à chaque push ou pull request, GitHub installe les trois applications sur une machine propre et lance lint + tests (avec une base MySQL temporaire). Une coche verte signifie que rien n’est cassé ; une croix rouge bloque un changement défectueux avant qu’il n’arrive sur `main`.

### Modifier la base de données

Le schéma est géré **uniquement** par les migrations (`Backend/migrations/`) : toute modification de modèle = une nouvelle migration, puis mettre à jour `Backend/src/models/index.js`.

À noter pour une base existante : les migrations `20261125000000-classes-per-department` et `20261125000001-retire-old-classes` renomment « Département Prépa Ingénieur » en « Département ING » et « Département licence Informatique » en « Département Informatique », créent les classes officielles, puis déplacent les étudiants et les actualités des anciennes classes (Licence Informatique → LIM, Management → LSG, Ingénieure → Cycle Ingénieurs) avant de les supprimer. Vérifiez ensuite dans **Étudiants** que chacun est dans la bonne classe (le super admin peut changer un étudiant de classe, aussi en masse).

```bash
cd Backend && npx sequelize-cli migration:generate --name description-du-changement
```

```bash
npm run db:migrate
```

### Repères dans le code

| Besoin | Où |
|---|---|
| Routes de l’API, règles de permissions | `Backend/src/routes/` (`users.js`, `news.js`, `tickets.js`…), `Backend/src/middleware/auth.js` |
| Logique métier (tickets, statistiques, assistant, push) | `Backend/src/services/` |
| Variables d’environnement (validées au démarrage) | `Backend/src/config/env.js`, `Backend/.env.example` |
| Documentation de l’API | `Backend/scripts/build-openapi.js` → `npm --prefix Backend run docs` |
| Pages du back-office | `sesame-superadmin/src/pages/`, composants communs `src/components/ui/` |
| Écrans de l’application | `sesame-user/src/screens/`, navigation `src/navigation/RootNavigator.js` |
| Identité, permissions et plugins de l’app | `sesame-user/app.config.js`, profils de build `sesame-user/eas.json` |

### Git

Branche par fonctionnalité → pull request vers `main` (CI verte) → `prod` pour la version livrée. Messages de commit explicites. Ne versionnez jamais `node_modules`, `.env`, `Backend/uploads/`, un APK, une clé Firebase ni un dump de base contenant des données réelles.

---

## 10. Dépannage

| Symptôme | Cause / solution |
|---|---|
| L’API s’arrête avec « Invalid environment configuration » | Une variable de `Backend/.env` manque ou est invalide (souvent `JWT_SECRET` trop court) : le message indique laquelle. |
| « Database not initialised: run `npm run db:setup` » | Les migrations n’ont pas été appliquées sur cette base. |
| « Cannot connect to the database » | MySQL arrêté (XAMPP, ou `docker start sesame-mysql`) ou mauvais `DB_PORT`/mot de passe. |
| `Port 3000 / 5173 / 8081 is already in use` | Une instance tourne déjà : fermez-la ou réutilisez-la. |
| Téléphone : « Connexion impossible. Vérifiez votre réseau. » | Refaire `adb reverse tcp:3000 tcp:3000` (à refaire après chaque débranchement / redémarrage d’`adb`), ou rebuilder avec la bonne IP dans `EXPO_PUBLIC_API_URL`. |
| Build de dev : écran rouge « Unable to load script » | Metro n’est pas joignable : `adb reverse tcp:8081 tcp:8081` puis recharger. |
| Build Android : `No matching client found for package name` | `google-services.json` ne contient pas `sesame.news` : le régénérer depuis Firebase (§7). |
| Push : `InvalidCredentials` dans `test-push` | La clé FCM V1 n’est pas associée à `sesame.news` sur Expo (§7, étape 4). |
| Push accepté mais rien sur le téléphone | Notifications de l’app désactivées, mode « Ne pas déranger », ou optimisation de batterie. |
| Le back-office renvoie à la connexion | Session expirée ou révoquée (changement de mot de passe, compte désactivé) : se reconnecter. |
| Après un redémarrage de l’ordinateur | Relancer MySQL, l’API, puis `adb reverse` pour le téléphone. |

---

## 11. Mise en production

Le projet tourne actuellement **en local**. Pour un déploiement :

- Serveur avec HTTPS devant l’API, `NODE_ENV=production`, `JWT_SECRET` unique, `CORS_ORIGINS` limité aux vrais domaines, sauvegardes de la base et de `Backend/uploads/`.
- `docker-compose.yml` fournit MySQL + API + back-office (`docker compose --env-file .env.docker up --build`, après avoir copié `Backend/.env.example` en `.env.docker` et renseigné `DB_PASSWORD`, `JWT_SECRET`, `SEED_ADMIN_LOGIN`, `SEED_ADMIN_PASSWORD`). Les migrations s’appliquent au démarrage.
- Mettre la vraie URL d’API dans `sesame-user/eas.json` (profils `preview` et `production`) et rebuilder l’application.
- Ne jamais lancer `npm run db:seed:demo` sur un serveur réel ; créer le super administrateur avec `npm run create-admin`.
