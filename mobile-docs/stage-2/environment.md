# Stage 2 — Isolated runtime environment

## Why not the documented Docker path

The host (macOS, Apple Silicon) has no Docker, Colima, Podman or MongoDB installed, and the `./dev` script assumes Linux/WSL (`stat -c`, `/mnt` checks, Docker socket). The stack was therefore run directly with Node 26.13.0 from an isolated copy.

## Layout

Everything lives in the session scratch directory, outside the repository:

`/private/tmp/claude-501/-Users-fixie-Projects-Sanal-Yayinevi/da3a8a37-f2fd-4c88-b219-374b3c08d76c/scratchpad/betik-sandbox/`

| Path | Content |
|---|---|
| `app/Server`, `app/Client` | `rsync` copies of the originals (without `Client/android`); `npm ci` was run only here |
| `mongo-bin/`, `data/mongo/` | MongoDB 8.0.34 binary (downloaded by `mongodb-memory-server`) and its data files |
| `data/mail/` | Every e-mail the application sent, as JSON |
| `data/tls/` | Self-signed certificate for the local mail sink |
| `data/state/` | Browser sign-in states per role |
| `pw-browsers/` | Playwright Chromium (headless shell 156) |
| `tools/` | Launchers, seed runner, Playwright helper, run scripts (copied to `evidence/scripts/`) |
| `env.sh` | Generated configuration, mode 0600 |
| `logs/` | Service logs and `events.jsonl` (1,568 recorded browser events) |

The scratch directory can be cleared by a reboot. Everything needed to rebuild it is in `evidence/scripts/`.

## Services

| Service | Address | Notes |
|---|---|---|
| MongoDB replica set `rs0` | `127.0.0.1:27055`, database `betik_stage2` | New, empty, single node; no existing volume reused |
| Mail sink | `127.0.0.1:2555` | STARTTLS with a self-signed certificate trusted through `NODE_EXTRA_CA_CERTS`; accepts any login; stores and never relays |
| API (`node index.js`) | port 5055 | `NODE_ENV=development`, `PRINT_SYSTEM_ENABLED=true`, `PRINT_PAYMENTS_MODE=SANDBOX` (mock provider), `REGISTRATION_GATE_ENABLED=true` |
| Web (`react-scripts start`) | `127.0.0.1:3055` | `REACT_APP_API_URL=http://localhost:5055` |

Port 5000 is taken by macOS Control Center, hence 5055/3055.

**Exposure note.** The web server and both data services listen on loopback only. The API listens on all interfaces because `index.js` passes no host outside its own print-sandbox mode and the source was not altered. While running it is reachable from the local network, with disposable data only.

## Configuration and secrets

- All secrets (`JWT_SECRET`, sandbox webhook secret, address key, seed password) were generated fresh with `openssl rand`. None is written in this documentation.
- The repository root `.env` was **not** used. It has `DEV_EXTERNAL_INTEGRATIONS=true` and non-empty SMTP, Google and Cloudinary values of unknown ownership, so reading them into the sandbox would have risked real e-mails and uploads.
- `BETIK_DOCKER_DEV` was left unset because that mode insists on the Docker hostname `mongo:27017`.

## Seed data

1. `tools/seed.mjs` — the same steps as `Server/src/scripts/seedDevelopment.js`, without its Docker-hostname assertion and with a check that the target is the sandbox database. Result: 4 users, 3 books, 4 chapters, 1 tariff.
2. `seedClassification()` from the application's own service — 27 formats, 45 genres, 46 narrative features, 4 audiences, 7 warnings.
3. `Server/src/scripts/seedBadges.js` — 10 badges.
4. One direct repair in the sandbox database: a description for the seeded draft book (see D-01 in `discrepancies_and_bugs.md`).

Steps 2–4 were needed because the development seed alone leaves the product partly unusable.

## Seeded accounts (verified by UI login)

| E-mail | Username | Role |
|---|---|---|
| `admin@betik-dev.invalid` | `dev_admin` | ADMIN |
| `author@betik-dev.invalid` | `dev_author` | USER (owns the seeded books) |
| `reader@betik-dev.invalid` | `dev_reader` | USER |
| `publisher@betik-dev.invalid` | `dev_publisher` | PUBLISHER |

A fifth account (`stage2_user`) was registered through the UI, used for the destructive account tests and deleted.

## External integrations

| Integration | Handling | Result |
|---|---|---|
| SMTP | Local mail sink via the application's own `SMTP_HOST/PORT` settings | Registration, reset, e-mail change, contact and newsletter fully exercised; 5 mails captured |
| Cloudinary | Synthetic cloud name; the browser's upload request is intercepted by the test harness and answered with a `res.cloudinary.com/betik-sandbox-mock/...` URL; images served from a local PNG | Upload-dependent flows reachable; nothing left the machine |
| Google sign-in | Not configured | Blocked |
| iyzico | Not configured; built-in mock provider used | Mock flow exercised |
| Open Library (ISBN lookup) | Not called (only an invalid ISBN was tried, rejected before any lookup) | Not exercised |

## Browser automation

Playwright 1.64 (from the copied Client's dev dependencies), Chromium headless, locale `tr-TR`, time zone `Europe/Istanbul`.

| Viewport | Size |
|---|---|
| Desktop | 1440 × 900 |
| Tablet | 834 × 1112, touch |
| Mobile | 393 × 852, touch, mobile emulation, 2× scale |

Each run recorded console errors, failed requests, GraphQL operation names, mutation variables (passwords masked), WebSocket frames and native dialogs.

## Protection check

`git status` in the original repository shows only `mobile-docs/` as untracked, before and after. No file under `Client/`, `Server/` or `mobile-docs/Stage1/` was created or changed. No commit was made.

## Stopping and removing the sandbox

Stop the four processes (`node index.js`, `react-scripts start`, `tools/mongo.cjs`, `tools/smtp.cjs`) and delete the `betik-sandbox` directory. Nothing else was installed on the machine.
