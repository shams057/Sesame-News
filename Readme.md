# Sesame News

Plateforme de communication et de support de l’Université SESAME (projet Certix).

Licence : propriétaire, tous droits réservés (voir `LICENSE`).

| Dossier | Rôle | Stack |
|---|---|---|
| `Backend/` | API REST `/api/v1` + temps réel (Socket.IO) | Node 20+, Express 5, Sequelize 6, MySQL 8 |
| `sesame-superadmin/` | Back-office du personnel | React 19, Vite, TanStack Query |
| `sesame-user/` | Application étudiante « Sesame News » (Android + web ; iOS prévu) | Expo SDK 57, React Native 0.86 |

## Fonctionnalités

**Étudiants** : fil d’actualités (épinglées, ciblées par catégorie, recherche, filtres, pièces jointes images/vidéos/documents, liens cliquables), agenda des événements (calendrier mensuel, ajout à son agenda), demandes aux services (conversation en temps réel, pièces jointes, fermeture/réouverture, note de satisfaction), assistant IA (réponses sourcées à partir des actualités), notifications push (Android), mode hors connexion, changement de mot de passe. Les utilisateurs iPhone utilisent la version web.

**Personnel** : file de tickets par service (filtres, recherche, non-lus par agent, priorités, assignation, transfert, notes internes, alerte sans réponse), statistiques (créés / fermés sur la période, délais de 1ʳᵉ réponse et de résolution, satisfaction, par service et par agent, export CSV et PDF), actualités (brouillons, programmation, épinglage, ciblage multi-catégories, événements, jusqu’à 10 pièces jointes), étudiants (import CSV, mots de passe temporaires, désactivation), catégories, services, équipe et rôles.

## Rôles et sécurité

- **Étudiant** : uniquement ses propres données et les actualités qui le concernent (déterminé côté serveur par sa session).
- **Agent** : back-office ; s’il est rattaché à un service, il ne voit que les tickets de ce service.
- **Administrateur principal** (`owner`) : gère l’équipe, les services et les suppressions définitives.

Ce qui change selon le rôle :

| Fonction | Étudiant | Agent rattaché à un service | Agent sans service | Administrateur principal |
|---|---|---|---|---|
| Fil d’actualités (selon sa catégorie), agenda, demandes, assistant | ✅ | — | — | — |
| File de tickets et statistiques | — | son service uniquement | tous les services | tous les services |
| Actualités, étudiants, catégories, réponses types | — | ✅ | ✅ | ✅ |
| Services, équipe et rôles, suppression de tickets | — | lecture seule | lecture seule | ✅ |

Il n’existe pas de rôle « enseignant » : le personnel est représenté par les agents des services et départements.

Chaque route vérifie la session (JWT signé + session révocable en base) et le rôle. Il n’existe aucune inscription publique : le premier administrateur est créé en ligne de commande, les étudiants par le personnel (mot de passe temporaire à changer à la première connexion).

## Prérequis

- Node.js **20 ou plus** (22 recommandé)
- MySQL 8 (XAMPP/WAMP, Docker, ou serveur local)
- Pour Android : Android Studio + SDK, ou un téléphone en débogage USB

## Démarrage rapide (développement)

```bash
npm run install:all
```

### 1. Base de données et API

```bash
cd Backend
cp .env.example .env
```

Dans `.env` : renseignez `DB_*`, et générez `JWT_SECRET` :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Créez la base vide `sesame_news` (phpMyAdmin ou `CREATE DATABASE sesame_news CHARACTER SET utf8mb4;`), puis :

```bash
npm run db:setup
```

```bash
npm run create-admin -- votre.login
```

Ou, pour tester avec les comptes de démonstration (refusé si `NODE_ENV=production`) :

```bash
npm run db:seed:demo
```

```bash
npm run dev
```

L’API écoute sur http://localhost:3000 (santé : `/health`, documentation OpenAPI : `/api/v1/openapi.json`).

> Le schéma est géré **uniquement** par les migrations (`Backend/migrations`). Toute modification de modèle = une nouvelle migration (`npx sequelize-cli migration:generate --name …`). L’ancien fichier `sesame_news.sql` n’est plus utilisé.

### 2. Back-office

```bash
cd sesame-superadmin
cp .env.example .env.local
npm run dev
```

Ouvrez http://localhost:5173.

### 3. Application étudiante

```bash
cd sesame-user
cp .env.example .env.local
```

Version web (le plus simple) :

```bash
npx expo start --web
```

Téléphone Android en USB (l’app garde `localhost` grâce au renvoi de port) :

```bash
adb reverse tcp:3000 tcp:3000
```

```bash
npx expo run:android
```

Téléphone en Wi-Fi : mettez l’IP de votre ordinateur dans `EXPO_PUBLIC_API_URL` (ex. `http://192.168.1.10:3000`) et ajoutez l’origine web correspondante dans `CORS_ORIGINS` du backend si besoin.

Notifications push (Android) — projet EAS `sesame-etudiant` (compte `shams057`), identifiant d’application `sesame.news` :

1. `sesame-user/google-services.json` : fichier Firebase contenant l’app Android `sesame.news` (projet Firebase `sesame-news`). `app.config.js` l’utilise automatiquement s’il contient bien `sesame.news`, sinon la build se fait sans push.
2. Clé de compte de service Firebase (FCM V1) : téléversée sur Expo avec `npx eas-cli credentials -p android` → Google Service Account → FCM V1. **Ne jamais la mettre dans le dépôt** (elle est dans `.gitignore`).
3. Les push ne fonctionnent que dans un *development build* ou une build de production (`npx expo run:android` ou EAS), pas sur le web.

Tester l’envoi vers un étudiant connecté sur un téléphone :

```bash
npm --prefix Backend run test-push -- login.etudiant
```

## Assistant IA

L’assistant utilise n’importe quelle API compatible OpenAI. Il reste désactivé (l’application l’indique clairement) tant que ces variables de `Backend/.env` gardent leurs valeurs par défaut :

```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=YOUR_MODEL_NAME
LLM_API_KEY=YOUR_API_KEY
```

Il répond uniquement à partir des actualités visibles par l’étudiant (recherche par mots-clés), cite ses sources, et l’historique est conservé par étudiant. Limite : 20 questions / minute / étudiant.

## Comptes de démonstration

Créés par `npm run db:seed:demo` (développement uniquement) :

| Rôle | Identifiant | Mot de passe | Espace |
|---|---|---|---|
| Administrateur principal | `admin` | `Admin12345!` | Back-office |
| Agent, tous services | `agent.general` | `Agent1234!` | Back-office |
| Agent Service Scolarité | `agent.scolarite` | `Agent1234!` | Back-office |
| Agent Service Stage | `agent.stage` | `Agent1234!` | Back-office |
| Agent Département licence Informatique | `agent.informatique` | `Agent1234!` | Back-office |
| Agent Département Management | `agent.management` | `Agent1234!` | Back-office |
| Agent Département Prépa Ingénieur | `agent.prepa` | `Agent1234!` | Back-office |
| Agent Département FTA | `agent.fta` | `Agent1234!` | Back-office |
| Agent Service IT | `agent.it` | `Agent1234!` | Back-office |
| Agent Service Qualité | `agent.qualite` | `Agent1234!` | Back-office |
| Agent Service Coopération Internationale | `agent.cooperation` | `Agent1234!` | Back-office |
| Agent Service Marketing | `agent.marketing` | `Agent1234!` | Back-office |
| Agent Service Admission | `agent.admission` | `Agent1234!` | Back-office |
| Agent Service Finance | `agent.finance` | `Agent1234!` | Back-office |
| Agent Service Student Success | `agent.studentsuccess` | `Agent1234!` | Back-office |
| Étudiant · Licence Informatique | `amine.benali`, `sarra.trabelsi`, `youssef.gharbi` | `Etudiant1234!` | App / web |
| Étudiant · Management | `lina.mansour` | `Etudiant1234!` | App / web |

## Docker

```bash
cp Backend/.env.example .env.docker
```

Renseignez au minimum `DB_PASSWORD`, `JWT_SECRET`, `SEED_ADMIN_LOGIN` et `SEED_ADMIN_PASSWORD`, puis :

```bash
docker compose --env-file .env.docker up --build
```

API sur http://localhost:3000, back-office sur http://localhost:8080. Les migrations s’appliquent au démarrage.

## Qualité

```bash
npm test
```

```bash
npm run lint
```

- Backend : Jest + Supertest sur une base MySQL de test (`DB_NAME_TEST`, recréée à chaque exécution).
- Back-office : Vitest + Testing Library.
- Mobile : jest-expo, `npx expo lint`, `npx expo-doctor`.
- CI GitHub Actions (`.github/workflows/ci.yml`) : lint + tests des trois applications à chaque push/PR.

## Production

- `NODE_ENV=production`, `JWT_SECRET` unique et long, `CORS_ORIGINS` limité aux domaines réels, HTTPS devant l’API.
- Builds mobiles via EAS (`eas.json` : `development`, `preview`, `production`) ; mettez la vraie URL d’API dans chaque profil. Le trafic HTTP en clair n’est autorisé qu’en développement.
- Sauvegardez la base et le dossier `Backend/uploads/` (fichiers déposés, jamais versionnés).

## Workflow Git

Branche par fonctionnalité → pull request vers `main` (CI verte) → déploiement depuis `prod`. Messages de commit explicites (`fix(tickets): …`). Ne versionnez jamais `node_modules`, `.env`, `uploads/`, ni de dump de base contenant des données réelles.
