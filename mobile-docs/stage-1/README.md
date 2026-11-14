# Betik (Sanal Yayınevi) — Mobile Migration Documentation

**Stage 1 — Repository Forensics.** Evidence-based technical map of the existing React web application and Node.js backend, prepared as the foundation for a Flutter (Android + iOS) client that reuses the backend unchanged.

- Specification: `stage-1-repository-forensics.md` (authoritative, untouched).
- Method: static source inspection only. Nothing was run, built, installed or modified outside this directory.
- Status: Stage 1 complete. **Stage 2 (behavioural reconnaissance) and Stage 3 (Flutter implementation) have not been started and require explicit approval.**

## Evidence classification used in every document

| Tag | Meaning |
|---|---|
| **VERIFIED** | Directly established by repository source (default when no tag is shown and a source path is cited) |
| **INFERRED** | Strongly suggested by evidence, not conclusively established |
| **UNKNOWN** | Cannot be determined from the repository |

Runtime behaviour is never claimed as verified; items needing a runtime check are marked “Verify”.
Source references are repository-relative paths (`Server/src/...`, `Client/src/...`), with line numbers where stable. No secrets, credentials or user data are reproduced; environment variables are listed by name only.

## Documents

| # | File | Contents |
|---|---|---|
| 01 | `01_repository_overview.md` | Layout, stack, entry points, configuration, tests, existing docs, legacy/unused code |
| 02 | `02_system_architecture.md` | Runtime topology, backend and frontend layering, cross-cutting flows, module map |
| 03 | `03_backend_api.md` | Complete API inventory: 210 GraphQL operations + 7 HTTP routes, auth, arguments, limits |
| 04 | `04_database_schema.md` | MongoDB/Mongoose: 52 models, fields, indexes, relationships, lifecycle rules |
| 05 | `05_authentication_security.md` | JWT, registration, Google, roles, visibility rules, CORS/CSRF, limits, error contract |
| 06 | `06_frontend_architecture.md` | Bootstrap, routing table, state, forms, browser-API inventory, FE-only logic to port |
| 07 | `07_feature_inventory.md` | Index of 156 features with stable IDs → `07a` … `07f` |
| 07a | `07a_features_auth_shell_discovery.md` | Auth, app shell, notifications, discovery |
| 07b | `07b_features_books_reading.md` | Book detail, comments, reader |
| 07c | `07c_features_writing_sessions.md` | Authoring, writing sessions |
| 07d | `07d_features_social_profile.md` | Profile, follow, settings, quotes, messaging, sharing, leaderboard |
| 07e | `07e_features_printed_funding_community.md` | Printed catalogue, print funding, community pages |
| 07f | `07f_features_admin_publisher.md` | Publisher portal, administration |
| 08 | `08_business_rules.md` | Rules tagged backend/frontend, state machines, 12 end-to-end traces |
| 09 | `09_integrations_realtime.md` | WebSocket subscriptions, polling inventory, Google, Cloudinary, SMTP, iyzico, Open Library |
| 10 | `10_mobile_compatibility.md` | Flutter compatibility: reusable APIs, limitations, deep links, permissions, blockers |
| 11 | `11_unknowns_and_risks.md` | Open product questions, unknowns, risks, observed defects |
| 12 | `12_coverage_and_stage2_prep.md` | What was read and how deeply; Stage 2 prerequisites, test targets, destructive actions |

## Key facts at a glance

| Item | Value |
|---|---|
| Product | Betik — write, publish and read books online; quotes, comments, sessions, messaging, points; printed-book catalogue; sandbox crowdfunding for printing |
| Language | Turkish only |
| Backend | Node.js 26, Express 4, Apollo Server 5 (GraphQL), graphql-ws, Mongoose 8 / MongoDB replica set |
| Frontend | React 18 (CRA), Apollo Client 3, React Router 6; Capacitor Android wrapper exists |
| API | 104 queries, 102 mutations, 4 subscriptions, 7 HTTP routes (217 total) |
| Auth | Stateless JWT (HS256, 24 h, no refresh) in `Authorization: Bearer` |
| Database entities | 52 Mongoose models (collections) |
| Features | 156 (`F-<DOMAIN>-<NN>`) across 21 domains |
| Roles | `USER`, `PUBLISHER`, `ADMIN` (+ per-user session-creation approval) |

## Suggested reading order

Engineers new to the project: 01 → 02 → 05 → 03 → 07 (index, then domain files) → 08 → 10 → 11.
Stage 2 planning: 12 (Part B) → 07 “Verify” items → 11.
Stage 3 planning: 10 → 06 §9 → 08 → 03.
