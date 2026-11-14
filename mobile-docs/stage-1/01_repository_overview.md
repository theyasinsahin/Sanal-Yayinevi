# 01 — Repository Overview

Stage 1 static analysis of `/Users/fixie/Projects/Sanal-Yayinevi` (git branch `main`, HEAD `c815286`). Product name in code and UI: **Betik** (“Sanal Yayınevi” — virtual publishing house and crowdfunding platform). UI language: **Turkish only**.

## 1. Layout

Single git repository, **two independent npm packages** (no workspace tooling; the root `package-lock.json` is an empty stub).

```text
Sanal-Yayinevi/
├── Client/                 React 18 SPA (Create React App 5) + Capacitor Android wrapper
│   ├── src/                application code (pages, components, hooks, graphql, utils, context, config)
│   ├── public/             index.html, manifest.json, service-worker.js, fonts, icons, images, social-share images
│   ├── android/            generated Capacitor Android project (appId com.betik.app)
│   ├── e2e/                9 Playwright specs
│   ├── scripts/            bundle-size and Google-callback build checks
│   ├── capacitor.config.ts, vercel.json, playwright.config.cjs, .env.example
├── Server/                 Node.js GraphQL API
│   ├── index.js            entry point (Express + Apollo Server + graphql-ws)
│   ├── src/config          env loading, DB, SMTP, pubsub, startup validation, iyzico
│   ├── src/graphql         typedefs/*.graphql (28 files), resolvers/*.js (28 modules), schema.js, loaders.js
│   ├── src/models          Mongoose models (52 collections)
│   ├── src/services        business logic (+ services/print/* for print funding)
│   ├── src/routes          4 Express routers (Google callback, print assets/callbacks, legacy payment, share previews)
│   ├── src/security        rate limits, GraphQL budget, HTML sanitiser, search/pagination guards, WS security
│   ├── src/utils           access rules (book/chapter/profile/quote), auth, validation helpers
│   ├── src/emails          e-mail templates
│   ├── src/scripts         seeds, migrations, sandbox tools, doctor, benchmarks (never run in Stage 1)
│   ├── src/data            classification seed, printed-catalogue import manifests (JSON/CSV)
│   └── tests/              59 Jest test files (mongodb-memory-server)
├── docs/                   ~40 existing Markdown documents (Turkish) + security/ + performance/
├── docker/                 Dockerfiles, bootstrap, checks, Android builder scripts
├── compose.yaml            dev stack: mongo (replica set), mongo-init, seed, server, client
├── compose.test.yaml, compose.android.yaml
├── dev                     bash wrapper around docker compose (init/up/down/seed/test/android …)
├── .devcontainer/, .github/workflows/ (docker-checks.yml, android-build.yml)
├── email-previews/         rendered e-mail samples (html/txt)
├── README.md
└── mobile-docs/            ← this documentation (only directory written during Stage 1)
```

## 2. Technology stack (VERIFIED from manifests)

| Area | Technology |
|---|---|
| Runtime | Node.js **26.x**, npm 11.x (`.node-version`, `engines`) |
| Backend | Express 4, `@apollo/server` 5, `graphql` 16, `graphql-ws` 6 + `ws` 8, `graphql-subscriptions` (in-memory PubSub), DataLoader |
| Database | MongoDB (replica set required) via Mongoose 8 |
| Auth | `jsonwebtoken` (HS256), `bcryptjs`, `google-auth-library` |
| Mail | `nodemailer` (Gmail service or custom SMTP) |
| Payments | `iyzipay` SDK (sandbox only) + internal mock provider |
| Security | `sanitize-html`, custom rate limiting, `compression`, `cors`, `express-validator` (dependency present) |
| Frontend | React 18.3, `react-router-dom` 6.27 (data router), `@apollo/client` 3.13, `graphql-ws` |
| UI libs | MUI icons/material, `react-icons`, pure CSS (CSS variables) |
| Editor | `react-quill` 2 (Quill) |
| Other FE | `dompurify`, `@react-oauth/google`, `react-easy-crop`, `react-intersection-observer`, `react-masonry-css`, `react-swipeable`, `three` / `@react-three/*` |
| Mobile wrapper | Capacitor 8 (`@capacitor/android`) — a WebView shell around the same React build |
| Tests | Jest (server, client via CRA), Playwright (e2e) |
| Hosting (INFERRED from config) | Frontend on **Vercel** (`Client/vercel.json`), backend on **Render** (`RENDER_GIT_COMMIT`, rewrite target `*.onrender.com`) |

## 3. Entry points

| Component | Entry | Start command (not run in Stage 1) |
|---|---|---|
| Backend | `Server/index.js` | `npm --prefix Server start` (`node index.js`), dev: `nodemon` |
| Frontend | `Client/src/index.js` → `App.js` | `npm --prefix Client start` (CRA dev server, port 3000) |
| Dev stack | `./dev up` → `compose.yaml` | Docker: Mongo replica set + seed + server (5000) + client (3000) |

## 4. Configuration

- **Server:** environment variables, loaded by `Server/src/config/environment.js` from `Server/.env` (development) or `Server/.env.prod` (production), plus optional `Server/.env.print.local`; Docker dev mode injects variables from compose and **strips external-integration variables** unless `DEV_EXTERNAL_INTEGRATIONS=true`. Full name list: `05_authentication_security.md` §11. Startup validation: `Server/src/config/startup.js`.
- **Client (build-time):** `REACT_APP_API_URL`, `REACT_APP_WS_URL`, `REACT_APP_GOOGLE_LOGIN_URI`, `REACT_APP_PUBLIC_WEB_URL`, `REACT_APP_GOOGLE_CLIENT_ID`, `REACT_APP_CLOUDINARY_CLOUD_NAME`, `REACT_APP_CLOUDINARY_UPLOAD_PRESET`, `REACT_APP_DOCKER_DEV`, `REACT_APP_DEV_INTEGRATIONS`, `REACT_APP_PERFORMANCE_DEBUG` (`Client/.env.example`, `Client/src/config/*.js`). `config/integrations.js` contains built-in fallback values for the Google client ID and Cloudinary cloud/preset used when no env value is supplied outside Docker dev.
- No `.env` files with secrets were opened or copied.

## 5. Build, test, deploy

- **CI:** `.github/workflows/docker-checks.yml` (lint/test/build inside Docker), `android-build.yml` (manual Capacitor build).
- **Tests:** server `Server/tests/*.test.js` (59 files: auth, security controls, follow requests, mentions, messaging, sessions, quotes, reading points, print funding, iyzico, admin…), client unit tests next to sources (`*.test.jsx`), Playwright e2e (`Client/e2e`). They are a valuable behavioural reference for Stage 2/3.
- **Deploy:** not defined in the repo beyond `vercel.json`; production environment configuration is **UNKNOWN**.

## 6. External services

Google Identity (login), Cloudinary (image hosting/upload/transform), SMTP/Gmail (transactional e-mail), iyzico sandbox (payments), an external ISBN lookup source (server-side). Details: `09_integrations_realtime.md`.

## 7. Existing documentation (read-only reference)

`docs/` holds feature notes written by the team, e.g. `follow-requests.md`, `user-mentions.md`, `reading-points.md`, `reading-resume.md`, `quote-privacy.md`, `chapter-visibility.md`, `book-autosave.md`, `session-access.md`, `session-covers.md`, `social-sharing.md`, `readable-urls.md`, `registration-conversion.md`, `work-classification.md`, `printed-books.md`, `printed-reading-library.md`, `print-funding*.md`, `publisher-portal.md`, `admin-management.md`, `docker-development.md`, `local-development.md`, `server-startup.md`, `testing.md`, `google-login-production-fix.md`, `security/*`. These were used as orientation only (titles and selected passages); **all findings in `mobile-docs/` are taken from source code**. Recorded discrepancies:

| Document claim | Source code |
|---|---|
| Root `README.md`: “Gerçekçi sayfa çevirme efekti” (page-flip reader) | The reader (`Client/src/pages/BookReader`) is a vertical scrolling chapter view; no page-flip component is used. `utils/htmlPageSplitter` is only used to compute `pageCount` in the dashboard. |
| Root `README.md`: admin panel “grafiklerle desteklenen” (charts) | Admin overview shows counters and lists; no chart library is used. |
| Root `README.md`: “Füturistik UI… Glassmorphism” | Styling only; not relevant to behaviour. |

## 8. Generated, legacy, unused and experimental code

| Item | Classification | Evidence |
|---|---|---|
| `Client/android/` | Generated Capacitor project (WebView wrapper). An Android app **already exists in this form**; the Flutter app replaces/augments it. | `capacitor.config.ts`, `docker/android.sh` |
| `Client/public/service-worker.js`, `InstallPrompt` | PWA support, browser-only | `src/serviceWorkerRegistration.js` |
| Legacy donation flow: `Transaction` model, `initializePayment`, `/api/payment/callback`, `/payment/success|failure`, `BackersSection`, `Book.fundingTarget/currentFunding/printConfig` | **Legacy, disabled** | `Server/src/routes/paymentRoutes.js`, `services/transactionService.js` |
| `Book.status` (6-value enum), `Book.genreId`, `Book.tags`, `User.isPremium`, `User.savedAuthors` | Legacy fields kept for compatibility | models + resolvers |
| GraphQL operations never called by the client (26) | Unused by web | `06_frontend_architecture.md` §8 |
| Client gql documents never imported (`GOOGLE_AUTH`, `INITIALIZE_PAYMENT`, `DELETE_QUOTE_MUTATION`, `TOGGLE_QUOTE_COMMENT_LIKE_MUTATION`, `TOGGLE_PARAGRAPH_COMMENT_LIKE`, `ADD_READING_MINUTES`, `EDIT_MESSAGE`, `GET_CHAPTER_BY_ID`, `GET_COMMENT_BY_ID`) | Dead client code | repository search |
| `three`, `@react-three/*`, `react-masonry-css`, `react-swipeable`, `react-easy-crop`, `utils/cropImage.js`, `components/Books/CostCalculatorModal` | Present in dependencies/tree; no usage found in the pages read (**INFERRED unused or decorative**; `PersonalFoxes` may use some) | imports of read files |
| `Server/src/scripts/*` | Operational/one-off tooling (seeds, migrations, sandbox, benchmarks) | `package.json` scripts |
| `Server/src/data/printed-catalog/*.json|csv` (≈46k lines) | Import data, not code | file names |
| `docs/security/*.json`, `docs/performance/*.json` | Audit artefacts | — |
