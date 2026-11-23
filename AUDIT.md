# Sesame News — Full Project Audit

Audit date: 2026-11-23 · Branch: `prod` (with uncommitted work) · Scope: database, backend (Express + Sequelize + Socket.IO), back-office (`sesame-superadmin`, React/Vite), user app (`sesame-user`, Expo/React Native + web), tooling and repo.

Severity legend: 🔴 Critical (security hole or data loss) · 🟠 High (real bug or broken feature) · 🟡 Medium (design flaw, tech debt that will bite) · ⚪ Low (polish, consistency)

---

## ✅ Resolution status (updated 2026-11-24)

All three apps were rebuilt to address every finding below. Verified with 54 automated tests (Backend 39 incl. realtime + LLM path, admin 8, mobile 7), lint in all three apps, `expo-doctor`, the admin production build, the API Docker image, an Android release build on a real phone, Android push notifications on a real phone, and manual checks in the browser (admin + student web app, desktop and phone sizes).

**Where things are now**
- API: `Backend/src/` (routes / services / middleware), schema in `Backend/migrations/`, OpenAPI at `/api/v1/openapi.json`, tests in `Backend/tests/`.
- Back-office: `sesame-superadmin/src/` (routed pages, UI kit, React Query, one socket).
- Student app: `sesame-user/src/` (React Navigation tabs + stacks, push, offline cache, dark mode).
- Tooling: root `package.json` scripts, `docker-compose.yml`, `.github/workflows/ci.yml`, rewritten `Readme.md`.

**Decisions applied before delivery (2026-11-24)**
1. Secrets and junk (`chats.txt`, the old SQL dump, `Backend/node_modules`, old uploads) purged from the whole git history.
2. `GC` field removed (migration `20261124000000-remove-gc`).
3. Licence: proprietary, all rights reserved (`LICENSE`).
4. App identity: `sesame.news`, store name "Sesame News".
5. Voice questions removed (no speech-to-text provider); the text assistant stays and is disabled until `LLM_MODEL` / `LLM_API_KEY` are set.
6. iOS: not built (no Mac / Apple developer account); iPhone users use the web version.
7. Demo accounts for every role: `npm run db:seed:demo` (see README).
8. Deployment stays local for now; the database and uploads are not deployed anywhere.

**Still open**
- The AI assistant needs a model name and API key (`Backend/.env`).
- Production hosting (HTTPS API, real `CORS_ORIGINS`, real API URLs in `sesame-user/eas.json`).
- Statistics aggregate the period's rows in memory (medians need individual values); fine at university scale.

---

## 0. TL;DR — fix these first

1. 🔴 **There is no authorization on the API.** Almost every route (`/users`, `/user/:id`, `/createnews`, `/news/:id`, `/categorie/:id`, `/ticket/:id`, `/tickets`, `/ticket-statistics`, `/users/import-csv`, …) is open to anyone who can reach port 3000. The "login" only matters for the ticket-chat routes and `/mytickets`.
2. 🔴 **Anyone can become (or take over) a super admin.** `POST /registersuperAdmin` is public ([authSuperAdmin.js:9](Backend/Auth/authSuperAdmin.js:9)), and `PUT /superAdmin/:id` changes any admin's login/password without auth ([authSuperAdmin.js:59](Backend/Auth/authSuperAdmin.js:59)).
3. 🔴 **`GET /users` returns every user's bcrypt password hash** ([routes-user.js:44](Backend/routes/routes-user.js:44)) — no `attributes: { exclude: ['password'] }`.
4. 🔴 **Deleting a category deletes every student in it** (and all news targeting it): `categorie.hasMany(user, { onDelete: 'cascade' })` ([categories.js:12](Backend/models/categories.js:12)) — confirmed by the FK `ON DELETE CASCADE` in the SQL dump.
5. 🔴 **Upload filter lets stored-XSS files through** ([upload.js:16-20](Backend/middleware/upload.js:16)): `ext || mime` with `mimetype.startsWith('image/')` accepts `.svg` (JavaScript-capable) or any extension sent with an `image/*` MIME, and serves it from `/uploads`. The raw `originalname` is used in the filename.
6. 🔴 **Secrets and junk in git**: `Backend/node_modules` (4,769 files) is committed, 52 MB of uploaded media is committed, the SQL dump contains real login tokens + password hashes, `chats.txt` contains personal e-mail addresses and private AI-chat links, JWT secret `"JMA"` is hard-coded.
7. 🟠 **News feed loads one article per request** — `const size = 1` in `/newssparuser` ([routes-news.js:118](Backend/routes/routes-news.js:118)).
8. 🟠 **"Upcoming events" returns past events first** — `/newsupcoming` has no `date >= now` filter and sorts ascending with `limit 30` ([routes-news.js:159-183](Backend/routes/routes-news.js:159)). Once you have 30 past events, future events never come back.
9. 🟠 **Every unknown route hangs forever** — the trailing middleware in [server.js:41-46](Backend/server.js:41) sets headers but never calls `next()` or sends a response, so no 404 is ever returned.
10. 🟠 **The phone app can't see the events calendar** — `NewsSidebar` only renders when `width >= 1024` ([NewsScreen.js:187](sesame-user/src/screens/NewsScreen.js:187)), i.e. never on a phone.

---

## 1. Repository & project hygiene

| # | Sev | Finding |
|---|---|---|
| 1.1 | 🔴 | `Backend/node_modules` is tracked (4,769 files). The working tree currently shows them all as deleted — someone ran a clean install. Commit the deletion and keep `node_modules` ignored. Native modules like `bcrypt` built on Windows won't run on Linux anyway. |
| 1.2 | 🔴 | `Backend/uploads/` is tracked (14 files, ~52 MB incl. `.mp4`s). User-generated content does not belong in git. Two more untracked uploads are sitting in the tree. |
| 1.3 | 🔴 | `sesame_news.sql` contains live JWTs (`tokensuperadmins`, `tokenusers`) and bcrypt hashes for `admin`, `nouveau`, `jean`, `user`. Because tokens never expire and the secret is `"JMA"`, anyone with the repo can mint or reuse admin tokens. Ship a schema + seed script with throwaway credentials instead. |
| 1.4 | 🔴 | `chats.txt` holds personal e-mail addresses and links to private Grok conversations. Remove it from the repo **and from history** (`git filter-repo`), it's personal data. |
| 1.5 | 🟡 | Root `.gitignore` is broken: `/start`, and lines like `~/Documents/.../MediaCard.css` (tilde is not expanded by git; these lines would have ignored *source files* if they worked). `sesame-user/.gitignore` also ends with a stray `start`. |
| 1.6 | 🟡 | Root `package-lock.json` is an empty stub with no `package.json` — delete it or create a real root workspace (`npm workspaces`) with scripts like `dev:all`. |
| 1.7 | 🟡 | You're working directly on `prod` with 11 modified files uncommitted. Branches: `main`, `prod`, `feature/TicketChat`, `feature/superadmin-dashboard`, `integration/ticketchat-reports`. Adopt: feature branch → PR → `main` → tag/deploy to `prod`. |
| 1.8 | ⚪ | Commit messages like `fx`, `fx`, `fx`, `new cards` make history useless. Use conventional messages (`fix(news): page size`). |
| 1.9 | 🟡 | **Zero tests** across all three apps. Backend `npm test` literally exits 1. No CI. |
| 1.10 | 🟡 | No `.env` / `.env.example`. DB credentials live in `config/config.json` (root, no password, same for dev/test/prod). |
| 1.11 | 🟡 | No Docker / docker-compose. Onboarding requires XAMPP + phpMyAdmin manual import. A `docker-compose.yml` with MySQL + backend would make setup one command. |
| 1.12 | ⚪ | `sesame-user/AGENTS.md` says "Use Expo Router; routes live in `src/app/`" — the project doesn't use Expo Router at all. Either migrate or fix the doc, otherwise AI tools will generate wrong code. |
| 1.13 | ⚪ | `sesame-user/LICENSE` exists, nothing else has one; `package.json` author `JMA`, license `ISC`. Decide one licence for the repo. |

### README
- 🟡 Says Node **v16+** — Express 5, Vite 8, React 19, RN 0.86 / Expo 57 need **Node 20+**.
- 🟡 Recommends `npm install -g expo-cli` — deprecated; use `npx expo`.
- ⚪ "PDF Export Dependencies" section asks to install `jspdf` / `jspdf-autotable` manually — they're already in `package.json`.
- ⚪ ADB instructions are Windows-only; no macOS/Linux equivalent.
- ⚪ No description of what the app *does*, the roles, the architecture, the API, the env vars, or the default credentials.
- 🟡 The README's DB step imports `sesame_news.sql`, but **that dump has no `tickets` or `ticketMessages` tables** — they only appear because `server.js` runs `sync()`. The dump and the models disagree in other places too (see §2).

---

## 2. Database (MySQL via Sequelize)

### 2.1 Schema management
- 🟠 **No migrations.** `sequelize-cli` is installed but there's no `migrations/` or `seeders/`. Schema evolves through:
  - `sequelize.sync({ force: false })` (never alters existing tables),
  - a hand-written `ensureNewsDateColumn()` patch in `server.js`,
  - `ticket.sync({ alter: true })` + `ticketMessage.sync({ alter: true })` **on every boot** ([server.js:100](Backend/server.js:100)). `alter: true` in production is dangerous (it can drop/re-create columns and accumulate duplicate indexes).
  → Move to real migrations (`npx sequelize-cli migration:generate`) and remove all `sync` calls from startup.
- 🟡 **Model ↔ DB drift**: `user.categorieId` is `allowNull: false` in the model but `DEFAULT NULL` in the dump. The dump has no `date` in the `news` INSERT, no ticket tables, etc. The SQL file is a snapshot of nobody's real schema.

### 2.2 Tables & columns

**`users`**
- 🔴 `categorieId` FK cascades on category delete → students get deleted.
- 🟠 `categorieId` is `allowNull: false` in the model, but the admin form says "Catégorie (optionnel)" and the CSV import writes `categorieId: row.categorieid || null` → both fail with a Sequelize `notNull` error. Since the CSV loop has no transaction, a failure **mid-file aborts the import after some users are already inserted**.
- 🟡 `firstname` / `lastname` are `VARCHAR(15)` — too short for real names ("Mohamed-Amine", "Ben Abdallah-Kilani"). Use 100.
- 🟡 `login` is not `UNIQUE` at DB level — uniqueness is only checked in JS (`count` then `create`), which races.
- 🟡 `GC` is a boolean with no documented meaning anywhere, and nothing in the app uses it for logic. Rename to something explicit or remove.
- 🟡 No `email`, `role`, `isActive`, `lastLoginAt`, `mustChangePassword`. You can't disable an account without deleting it (and deleting it cascades into news/tokens and orphans tickets).

**`categories`**
- 🟡 `libelle VARCHAR(20)` — "Département licence Informatique" doesn't fit.
- 🟡 Seed data is `'Nouveau libelle'` and `'Informatique'` — test junk.
- 🟠 **Conceptual overlap**: "categories" (user groups) and "departments" (ticket routing, hard-coded list of 13 strings) are two different taxonomies for the same university structure. See §6.

**`news`**
- 🟡 `titre VARCHAR(50)` — short for news headlines; the admin input has no `maxLength`, so long titles fail with a raw SQL error.
- 🟡 `path TEXT` — one attachment per news. The mobile code already supports `item.media[]` (carousel), but the DB can't store multiple media. Add a `newsMedia` table.
- 🟡 `userId` FK on `news` — users never author news; dead column + dead cascade.
- 🟡 `all` + single `categorieId` — a news item can target *everyone* or *exactly one* category. Targeting two categories requires duplicating the news. Use a `newsCategories` join table.
- 🟡 `date` is a single datetime for "event date". No end date, no location, no all-day flag, no time zone handling (see 3.7).
- ⚪ No `publishedAt`, `status` (draft/published), `pinned`, or `expiresAt`.

**`superAdmins`**
- 🟡 No unique `login`, no name/email, no role levels.

**`TokenUser` / `TokenSuperAdmin`**
- 🟠 `token VARCHAR(255)` with **no index** — every authenticated request does `findOne({ where: { token } })` → full table scan.
- 🟠 Rows are added on every login and only deleted on explicit logout → unbounded growth; no `expiresAt`.
- 🟡 Tokens stored in plaintext. If you keep DB-backed sessions, store a SHA-256 of the token.

**`tickets`**
- 🟡 `department VARCHAR(60)` free string — no FK, no table, values validated against a JS array duplicated in 4 files.
- 🟡 No `assignedToId`, `priority`, `category`, `firstResponseAt`, `resolvedById`. `openedAt` duplicates `createdAt`.
- 🟡 No index on `status`, `department`, `userId`, `createdAt` — all used in filters/stats.
- 🟠 `userId` nullable + `SET NULL` → tickets created anonymously or by admins have no owner (see 3.5).

**`ticketMessages`**
- 🟡 `senderName` is denormalised (fine for history), but `adminReadAt` is a single column → one admin reading a conversation marks it read for **all** admins.
- 🟡 No index on `(ticketId, senderRole, adminReadAt)` / `(ticketId, senderRole, userReadAt)` — the unread queries scan.
- ⚪ No attachments in ticket chat (students often need to send a screenshot/document).

---

## 3. Backend (Express 5 / Sequelize / Socket.IO)

### 3.1 Architecture
- 🟡 Everything is mounted on `/` with no prefix or versioning (`/api/v1`). Route names are inconsistent: `/createnews`, `/newssall`, `/newssparuser`, `/news/:id`, `/createticket`, `/myticket/:id`, `/registersuperAdmin`, `/loginuser`… Pick REST: `GET/POST /api/news`, `GET /api/news/feed`, `POST /api/auth/login`, etc.
- 🟡 No layering: routes talk to models directly, mix validation, business logic and response formatting. Introduce `controllers/` + `services/` + `validators/`.
- 🟡 `routes-categorie.js` and `routes-user.js` each create a **second and third** `new Sequelize(config.development)` connection pool that's never used ([routes-user.js:12](Backend/routes/routes-user.js:12), [routes-categorie.js:11](Backend/routes/routes-categorie.js:11)). Remove; also unused `Op`, `QueryTypes` imports.
- 🟡 `ticketChatRoutes.getParticipant` is exported from a router file and reused by `server.js` for sockets — put auth helpers in `middleware/auth.js`.
- ⚪ Comments refer to "Autoriser les requêtes Angular" — there's no Angular.
- ⚪ Mixed promise styles (`.then` chains vs `async/await`), mixed French/English messages, mixed indentation.

### 3.2 Authentication & authorization (🔴 main problem)
- 🔴 **No auth middleware exists.** The only protected endpoints are `/mytickets`, `/myticket/:id`, `/ticket-chat/*`, `/tickets/:id/messages*`. Everything else — including user CRUD, CSV import, news CRUD, ticket edit/delete, statistics — is public.
- 🔴 `POST /registersuperAdmin` public; `PUT /superAdmin/:id` public → full admin takeover.
- 🔴 `POST /registeruser` public — anyone can create student accounts and pick their own `categorieId` (and therefore see category-restricted news).
- 🔴 **JWT is never verified.** `jwt.sign(..., "JMA")` is called, but no route ever calls `jwt.verify`. The JWT is just used as a random opaque string looked up in the DB. So: no expiry, the hard-coded secret is meaningless *and* leaked, and the `role` claim (`"S-A"`, `"UsEr"`) is never checked. Pick one model:
  - **Stateless JWT**: `jwt.verify` with `process.env.JWT_SECRET`, `expiresIn: '15m'` + refresh token, check `role` in middleware; **or**
  - **DB sessions**: random 32-byte token (`crypto.randomBytes`), hashed in DB, with `expiresAt`.
- 🟠 The back-office decodes the JWT **client-side** to get `superAdminId` ([utils/token.js](sesame-superadmin/src/utils/token.js)) and sends it in the news form; the server trusts `superAdminId` / `userId` from the body ([routes-news.js:43](Backend/routes/routes-news.js:43)). Authorship must come from the authenticated session.
- 🟠 Logout puts the token in the URL path (`DELETE /logoutuser/:token`) → tokens end up in access logs/proxies. Use the `Authorization` header.
- 🟡 Login error messages reveal whether the login exists (`'This user does not exist!'` vs `'Authentication failed pwd'`) → user enumeration. Return one generic message.
- 🟡 No rate limiting on login (brute force), no account lockout, no password policy, no "change password requires current password".
- 🟡 `/newssparuser?userId=X` and `/newsupcoming?userId=X` trust `userId` from the query — the user can read any category's news by changing the number. Derive the user from the token.
- 🟡 `/chat` takes `userId` from the body without auth — once an LLM is plugged in, this is an open, billable endpoint.

### 3.3 Security (other)
- 🔴 File upload ([upload.js](Backend/middleware/upload.js)):
  - `ext || mime` should be `ext && mime`, and use an explicit allow-list of MIME types (not `startsWith('image/')`, which admits `image/svg+xml`).
  - The regex `/jpeg|jpg|png|gif|pdf|mp4|doc|docx/` is unanchored — `x.pdf.html`'s extname is `.html` (fails ext), but its mime can be faked to pass.
  - `Date.now() + '-' + file.originalname` — use a random name + the validated extension; never trust `originalname`.
  - Destination `'uploads/'` is relative to the **current working directory**, while static serving uses `__dirname/uploads`. Starting the server from the repo root writes files where they're not served.
  - Old files are never deleted on news update/delete → orphaned files pile up.
  - Serve uploads with `Content-Disposition`/`X-Content-Type-Options: nosniff`, ideally from a separate origin or object storage.
- 🟠 Errors leak internals: `res.status(400).send(err)` sends the whole Sequelize error (SQL, table names). `createnews` even echoes `req.body` back.
- 🟡 `cors()` with no options + manual `Access-Control-Allow-*: *` + Socket.IO `origin: '*'`. Restrict to your admin/web origins.
- 🟡 No `helmet`, no request size limits on JSON, no input validation library (use `zod`/`joi`/`express-validator`).
- 🟡 `console.log('BODY =>', req.body)` / `('FILE =>')` in every news create/update — logs user content; use a logger (`pino`) with levels.
- 🟡 CSV import (`/users/import-csv`) is unauthenticated and creates accounts with **plain-text passwords from a CSV file** — that CSV is a credentials leak waiting to happen. Better: import without passwords, generate one-time invite/reset links.

### 3.4 Correctness bugs
- 🟠 [server.js:41-46](Backend/server.js:41): trailing middleware never responds → unknown routes hang. Replace with a proper 404 handler + an error-handling middleware `(err, req, res, next)`.
- 🟠 `/newssparuser` page size **1** → one HTTP request per news item while scrolling.
- 🟠 `/newsupcoming` returns past events (no `date >= startOfToday`), ascending, capped at 30.
- 🟠 `/users` / `/tickets` pagination accepts only `page > 0`, while news accepts `page >= 0` — harmless today, but inconsistent; pick one helper.
- 🟠 CSV parser splits on `,` — any quoted field containing a comma (`"Ben Ali, Jr"`) shifts all columns. Use `csv-parse`. Also N+1: one `findOne` + one `bcrypt.hash` per row, sequential, no transaction.
- 🟠 `registeruser` / `registersuperAdmin` return **HTTP 500** for "account already exists" (should be 409), and return the created row **including the password hash**.
- 🟡 Server startup: if the DB connection fails, the error is logged but the process stays alive without listening → looks "up" to a process manager. Exit with code 1.
- 🟡 Port hard-coded to `3000`; use `process.env.PORT`.
- 🟡 `express.static('/uploads')` mounted twice ([server.js:16](Backend/server.js:16) and [:38](Backend/server.js:38)).
- 🟡 `PUT /news/:id` and `PUT /user/:id` return `[1]` (affected rows), not the updated entity; `update` with `id` that doesn't exist returns 200.

### 3.5 Tickets — logic & design
- 🔴 `GET/PUT/DELETE /ticket/:id` and `GET /tickets` are public → any student (or anyone) can read, close, rewrite or delete any ticket.
- 🟠 `POST /createticket` works **without a token** → anonymous tickets with `userId = null`, signed "Étudiant". It also trusts `status`, `openedAt`, `closedAt` from the client.
- 🟠 Tickets created from the **back-office** go through the same `/createticket`, the admin token isn't a `TokenUser`, so they're created with `userId = null` — an ownerless ticket nobody can be notified about. Either drop "create ticket" from admin, or require choosing the student.
- 🟡 `PUT /myticket/:id` lets the student set any status including `in_progress` — a student should only be able to close/reopen.
- 🟡 No ticket assignment, no per-department staff, no SLA/first-response tracking, no internal notes. Today "departments" are just labels; **every super admin sees every ticket** (see §6 misconceptions).
- 🟡 `DEPARTMENTS` array duplicated in: `routes-ticket.js`, `TicketsPage.jsx`, `TicketStatsPage.jsx`, `NewTicketModal.js`. Move to a DB table and serve it via `GET /departments`.

### 3.6 Statistics endpoint (`/ticket-statistics`) — wrong numbers
- 🟠 "Ouverts" = `status !== 'closed'` → counts `in_progress` as open; the UI never shows "en cours".
- 🟠 The card "Fermés — Clôturés pendant la période" is wrong: it counts tickets **created** in the period that are **currently** closed, not tickets closed in the period.
- 🟠 Timeline puts closed tickets on their **creation** date bucket, not `closedAt`.
- 🟠 Category classification regex `/wifi|wi-fi|ent|moodle|.../` — `ent` matches *paiement*, *document*, *urgent*, *comment*, *rendez-vous*… so finance tickets get classified as IT ([routes-ticket.js:114](Backend/routes/routes-ticket.js:114)). Use `\bent\b` or, better, a real `category` column chosen by the student.
- 🟡 Day keys use `toISOString()` (UTC) while period starts use local midnight → tickets near midnight land on the wrong day.
- 🟡 Loads all tickets in memory and aggregates in JS; fine at 500 tickets, not at 50,000. Use `GROUP BY` queries.
- 🟡 Missing the metrics that matter for support: average/median time to first response, average resolution time (you have `openedAt`/`closedAt`!), backlog age, tickets per agent.
- ⚪ "semester" = last 180 days, "year" = last 365 days — label says "6 derniers mois", fine, but academic semesters would be more useful.

### 3.7 Dates & time zones
- 🟡 Admin sends `datetime-local` values with no offset (`2026-12-01T14:00`); Node parses them in the **server's** local TZ; Sequelize stores in UTC (`+00:00`); the mobile app displays in device TZ. If the server ever runs in UTC (any cloud host), every event shifts by 1h. Send ISO strings with offset from the client (`new Date(value).toISOString()`), and set `timezone` explicitly in Sequelize config.

### 3.8 Real-time (Socket.IO)
- ✅ Good: socket handshake requires a token, users join `user:<id>`, admins join `superadmins`, room join checks ticket ownership.
- 🟡 Each message is emitted to both the `ticket:<id>` room and the user/admin room → clients receive duplicates (the client dedupes by id, but it's wasted traffic).
- 🟡 No events for news (new news published → no live update / no push).
- 🟡 Socket auth relies on the same un-expiring tokens.

### 3.9 AI assistant (`/chat`, `/chat/voice`)
- 🟠 Both are **placeholders** that echo the question back. The UI presents it as a working "assistant de l'Université SESAME". Either hide it behind a feature flag or wire the LLM/RAG.
- 🟡 `/chat/voice` exists in the backend but nothing in the app calls it.
- 🟡 No auth, no rate limit, no history persistence, no guardrails, no source citations (for a RAG on university info, show the source document).

---

## 4. Back-office (`sesame-superadmin`, React 19 + Vite)

### 4.1 Architecture & data layer
- 🟠 `baseURL: 'http://localhost:3000'` hard-coded ([api/axios.js:4](sesame-superadmin/src/api/axios.js:4)) and again in [NewsPage.jsx:20](sesame-superadmin/src/components/NewsPage.jsx:20). Use `import.meta.env.VITE_API_URL`.
- 🟠 **No 401 handling**: `AuthContext` trusts any token in `localStorage` (`isAuthenticated: !!token`) and never validates it. With a revoked/invalid token you see the dashboard and every call fails silently. Add `GET /me` at startup and an axios response interceptor that logs out on 401.
- 🟡 `loading` in `AuthContext` is set `false` in a `useEffect` immediately — it does nothing.
- 🟡 Navigation is a `useState` switch inside `/dashboard`, not routes. Refreshing the page always returns to "Actualités", there are no shareable URLs (`/tickets?status=open`), and the browser Back button leaves the app. Use nested routes: `/news`, `/users`, `/tickets`, `/tickets/:id`, `/stats`.
- 🟡 Data fetching is hand-rolled in every page (`useEffect` + `useState` + try/catch). Adopt TanStack Query: caching, refetch, loading/error states, invalidation after mutations.
- 🟡 `TicketsPage` both **polls every 20 s** and listens to a socket — and re-creates the socket connection every time a filter or the page changes (the socket `useEffect` depends on `fetchTickets`). Keep one socket for the whole app (context) and drop polling.
- 🟡 `TicketsPage.jsx` is 687 lines; `NewsPage.jsx` 492; `Sidebar.jsx` 393 (mostly inline styles). Split into components (Table, Filters, Modal, StatusBadge…).
- ⚪ `index.html`: `lang="en"` for a French UI, title `sesame-superadmin`.

### 4.2 Missing features
- 🟠 **No category management screen**, although the backend has full CRUD and the `users` model **requires** a category. A fresh install cannot create its first user from the UI.
- 🟡 No super-admin management (list/invite/disable admins).
- 🟡 No search anywhere (users by name/login, news by title, tickets by title/ID).
- 🟡 Users table doesn't show the category; no sorting; no bulk actions; no "reset password" flow.
- 🟡 CSV import: no template download, no preview, no per-row error report (the API returns `skipped` but the UI only shows "N importés").
- 🟡 News: no draft/preview, no scheduling, no multiple attachments, no rich text, no "pin", no view count; the list shows `createdAt` but not who published it.
- 🟡 Tickets: no assignment, no internal notes, no canned replies, no ticket detail page (only a modal), no SLA indicator.
- 🟡 Stats: no export to CSV/Excel, the PDF export has no charts.

### 4.3 UI / UX problems
- 🟠 **Status changes by clicking the badge** cycle `open → in_progress → closed → open`. One misclick reopens a closed ticket; there's no confirmation and no undo. Use an explicit dropdown/menu.
- 🟡 Duplicated page headers: Dashboard prints "Gestion Utilisateurs" and then `UsersPage` prints "Gestion des utilisateurs"; same with "Historique Tickets" + "Historique des Tickets". The stats page has a third header style.
- 🟡 Message color is guessed from text: `msg.includes('succès')` / `msg.includes('supprim')` — so **"Actualité supprimée" (a success) is displayed in red**, and every Users-page message (even errors) is blue. Use `{type, text}` toasts.
- 🟡 `window.confirm` / `alert()` for destructive actions and errors — inconsistent with the custom modals elsewhere.
- 🟡 Modals: Users modal doesn't close on overlay click while News/Tickets ones do; none close on `Escape`; no focus trap; no `role="dialog"`/`aria-modal`; focus isn't returned to the trigger.
- 🟡 Users form uses placeholders as labels (inaccessible; the label disappears when typing) — News form uses proper labels. Inconsistent.
- 🟡 No form-level validation matching DB limits (`maxLength` 50 title, 15 names, 20 category).
- 🟡 **Not responsive**: fixed sidebar (244 px), `padding: 40px 48px`, wide tables with no horizontal scroll container on small screens.
- 🟡 Styling is three systems at once: inline style objects (most files), `App.css`/`index.css` with CSS variables, and `TicketStatsPage.css` with Google Material Symbols loaded from a CDN only for that page. Buttons have 3+ visual styles (gradient with shadow, flat primary, pastel). Pick one approach (CSS modules or Tailwind) and a small component library (Button, Input, Modal, Badge, Table).
- 🟡 Hot-linked logo from `universitesesame.com` on login and sidebar — breaks offline or if that URL changes; ship it in `/public`.
- ⚪ Icons are a mix of hand-pasted SVGs and Material Symbols.
- ⚪ Pagination shows "Page 1 / 1" with disabled buttons on Users even when there's one page (News hides it). Inconsistent.
- ⚪ No dark mode, no loading skeletons (just text), no empty-state CTAs.

---

## 5. User app (`sesame-user`, Expo 57 / RN 0.86 / web)

### 5.1 Architecture & data layer
- 🟠 `BASE_URL = 'http://localhost:3000'` hard-coded ([api/axios.js:5](sesame-user/src/api/axios.js:5)); only works via `adb reverse` or on web. Use `EXPO_PUBLIC_API_URL` + `app.config.js`.
- 🟡 The axios interceptor is empty; every call adds `Authorization` by hand — and some don't (`/chat`). Put the token in the interceptor once.
- 🟡 No 401 handling → expired/revoked session = broken screens instead of a redirect to login.
- 🟡 Token in `AsyncStorage` (unencrypted). Use `expo-secure-store` on native.
- 🟡 Navigation: React Navigation is installed, but the Stack only holds `Login`; tabs are a `useState`. Android hardware Back exits the app from any tab; no deep links (e.g. open a ticket from a notification). Use Expo Router (as AGENTS.md says) or real Tab + Stack navigators.
- 🟡 Three separate socket connections can be open at once (App, TicketsScreen, TicketChatModal). One shared socket via context.
- ⚪ `NewsScreen` accepts `showHeader` but never uses it; `LinkifiedText.js` is never used (dead code).
- ⚪ `app.json`: package `com.anonymous.sesameuser`, name `sesame-user`, `usesCleartextTraffic: true` — fine for dev, not for a store build. No `eas.json`.

### 5.2 News feed
- 🟠 Page size 1 (backend) → janky infinite scroll, 1 request per card.
- 🟠 **Non-image attachments are rendered as images.** `mediaForNews` marks everything that isn't a video as `type: 'image'` ([NewsScreen.js:45](sesame-user/src/screens/NewsScreen.js:45)), but the admin can upload PDF/DOC/DOCX → students see a broken image. Add a "document" card with an open/download button.
- 🟡 URLs in descriptions aren't clickable (`LinkifiedText` exists but isn't wired).
- 🟡 Title and description are concatenated into one Instagram-style caption (`titre — description`) → no headline hierarchy, long articles become a wall of text. There is no news detail screen.
- 🟡 The Instagram pattern (username "sesame", blue "verified" ✓ badge, fixed 468×520 card) is a cosmetic copy that doesn't fit official university announcements; text-only news still reserve a media-sized card on web.
- 🟡 No category filter, no search, no "new since last visit", no bookmarks.
- 🟡 **No push notifications** (no `expo-notifications`) — for a news + support-ticket app this is the #1 missing feature: students won't know a news item or a ticket reply arrived unless the app is open.
- 🟡 No offline cache: opening the app without network shows nothing.

### 5.3 Events calendar
- 🟠 Only rendered when `width >= 1024` → **invisible on every phone**, which is the primary target of a mobile app. Give it its own tab/screen or a collapsible section above the feed.
- 🟠 Depends on `/newsupcoming`, which returns past events first (see 3.4).
- 🟡 No "add to calendar" (`expo-calendar` / `.ics`), no reminders.

### 5.4 Tickets
- ✅ Good: list with stats, filters, search, detail view, live status updates, unread dot, chat modal.
- 🟡 Ticket description `maxLength` 1000 on mobile vs no limit on admin vs DB `TEXT`; title 100 vs DB 150. Align.
- 🟡 No attachments (screenshot of the error, document).
- 🟡 After creating a ticket the modal shows a success view, but `onCreated` switches the tab after 600 ms, unmounting it — the user barely sees the confirmation.
- 🟡 Student can close/reopen freely; consider "reopen within N days" or a satisfaction rating on close.

### 5.5 AI chat
- 🟠 Presented as a working assistant but backed by a placeholder echo.
- 🟡 FAB uses a "＋" glyph — universally read as "create", not "chat/assistant". Use a chat/sparkle icon and a label.
- 🟡 Message ids are `${messages.length}-…` taken from a stale closure → duplicate keys when sending quickly.
- 🟡 History lost on close; no voice input though the backend has an endpoint.

### 5.6 UI / UX general
- 🟡 Nav icons are Unicode glyphs (`▤`, `▣`, `◌`) — render differently per platform/font. Use `@expo/vector-icons`.
- 🟡 "Quitter" logs out immediately, no confirmation; no profile screen, no change-password.
- 🟡 `userInterfaceStyle: "light"` only; no dark mode.
- 🟡 Two color sources: `theme/colors.js` and local `COLORS` in `TicketsScreen.js`.
- 🟡 Accessibility is partial: some `accessibilityLabel`s exist (good), but many touch targets are <44 px, and the unread state is color-only (red dot).
- ⚪ Login subtitle says "consulter les actualités" — the app also does tickets and chat.
- ⚪ Hot-linked remote logo (same as admin).

---

## 6. Misconceptions (design-level)

1. **"We use JWT, so we're authenticated."** — The JWT is never verified, has no expiry, uses a public secret, and no route checks roles. Authentication ≠ authorization; currently there is neither on most routes.
2. **"The front-end hides the admin pages, so users can't do admin things."** — Security must be enforced on the API. Anyone with `curl` can do everything the admin can.
3. **"Categories are just labels."** — They're wired with `ON DELETE CASCADE` to users and news, so they behave like owners. Deleting a label deletes people.
4. **"Departments route tickets."** — There is no notion of department staff, assignment or queues. All admins see everything; "department" is a filter label.
5. **"`sync({ alter: true })` is our migration system."** — It isn't safe and doesn't version anything. The SQL dump is out of sync with the models.
6. **"The SQL dump is a seed."** — It's a production-like snapshot with real tokens and hashes.
7. **"Stats are computed from the DB, so they're correct."** — The aggregation logic itself mislabels metrics (open vs in progress, closed-in-period vs closed-now, regex categories).
8. **"Upcoming events"** returns the oldest dated items — the filter for "upcoming" is done client-side on a server-truncated list.
9. **"It's a mobile app"** — but key features (calendar, events) only show on ≥1024 px web, and the most important mobile capability (push) is absent.
10. **"The AI assistant exists"** — It's a stub; shipping it visible sets wrong expectations.
11. **"Client sends who the author is"** — `superAdminId`/`userId` from the body is trusted.

---

## 7. Improvement roadmap

### Phase 1 — Security & data safety (do before anyone else uses it)
1. Add `middleware/auth.js`: `requireAuth`, `requireRole('superadmin')`, `requireRole('user')`; derive identity from the token; apply to every route. Remove public `registersuperAdmin` (use a CLI seed script).
2. Real token handling: `JWT_SECRET` from env, `jwt.verify`, `expiresIn`, refresh tokens (or hashed DB sessions with `expiresAt` + index).
3. Exclude `password` from all user responses (`defaultScope: { attributes: { exclude: ['password'] } }`).
4. Change category FKs to `ON DELETE RESTRICT` (or `SET NULL`) and block deleting non-empty categories.
5. Fix upload: MIME allow-list AND extension check, random filenames, absolute path, `nosniff`, delete replaced/removed files, size limits per type.
6. `helmet`, restricted CORS, `express-rate-limit` on `/login*`, validation with `zod`, central error handler, 404 handler.
7. Purge `node_modules`, `uploads`, `chats.txt`, real tokens from git history; rotate every credential in the dump; add proper `.gitignore`s and `.env.example`.

### Phase 2 — Correctness
1. Feed page size 10–20; `/newsupcoming` filter `date >= startOfToday`.
2. Fix stats semantics (open / in progress / closed-in-period by `closedAt`), word-boundary or real category field, add avg resolution time.
3. Fix CSV import: real parser, transaction, per-row errors, optional category, no plaintext passwords.
4. Render non-image attachments as documents in the app; wire `LinkifiedText`.
5. Calendar accessible on phones.
6. Time zones: send ISO with offset; configure Sequelize TZ.

### Phase 3 — Structure
1. Sequelize migrations + seeders; drop `sync` at runtime.
2. `/api/v1` prefix, REST naming, controllers/services split, OpenAPI (Swagger) docs.
3. Admin: React Router per section, TanStack Query, single socket context, shared UI kit, category & admin management screens.
4. Mobile: Expo Router (or proper navigators), axios interceptor with token + 401 logout, `expo-secure-store`, env-based API URL, shared socket context, `@expo/vector-icons`.
5. Single source of truth for departments (DB table + endpoint).

### Phase 4 — Features
- Push notifications (`expo-notifications`) for new news, ticket replies, status changes.
- Ticket assignment, priority, internal notes, attachments, SLA, satisfaction rating.
- News: multiple media, multi-category targeting, drafts/scheduling, pinning, detail screen, search & filters.
- Profile & password change for students; password reset flow.
- Real RAG assistant with sources, rate limiting, and persisted history — or hide it until ready.

### Phase 5 — Quality & delivery
- Tests: Jest + Supertest for the API (start with auth and ownership checks), Vitest + Testing Library for admin, Jest/RNTL for mobile.
- ESLint/Prettier on backend; lint + test in GitHub Actions on every PR.
- Docker Compose (MySQL + API), `.env.example`, updated README (Node 20+, architecture diagram, roles, default dev credentials created by a seed script).
- Logging (`pino`), health endpoint (`/health`), graceful shutdown.
- EAS build profiles, real app id/name/icons.

---

## 8. What's already good

- Ticket chat is the most mature part: ownership checks in `findAccessibleTicket`, socket handshake auth, room-scoped events, read receipts, message length limits, sanitized `publicMessage` output.
- Admin and mobile UIs are visually coherent within each page, with loading/empty/error states on most lists.
- Mobile ticket screen has search, filters, stats and live status updates; several components already carry accessibility labels/roles.
- Media sharing on mobile handles web share, native share and fallbacks thoughtfully.
- Code comments (in French) explain intent in the newer files.
