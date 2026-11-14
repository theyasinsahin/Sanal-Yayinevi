# Stage 2 — Behavioural reconnaissance of the Betik website

Status: **complete as far as the sandbox allowed** (14 November 2026). Stage 3 has not been started.

The React site and Node API were run from an isolated copy with disposable data and explored through real browser sessions (Playwright/Chromium) as guest, member, author, publisher and admin, at desktop, tablet and mobile sizes.

## Result in numbers

| | |
|---|---|
| Stage 1 features | 156 |
| VERIFIED | 114 |
| PARTIAL | 35 |
| BLOCKED | 2 |
| FAILED | 0 |
| NOT TESTED | 5 |
| Newly identified features | 15 |
| Application bugs recorded | 13 |
| Screenshots | 211 (desktop, mobile, tablet) |
| Recorded browser events | 1,568 |

"Verified" means the main path was exercised in the running site; limitations are listed per feature in the matrix.

## Documents

| File | Content |
|---|---|
| `environment.md` | How the sandbox was built, what was mocked, protection check |
| `coverage_matrix.md` | Every Stage 1 feature with scenario, status, evidence, limitation; new features |
| `user_journeys.md` | 15 end-to-end journeys and what persists across reloads |
| `navigation_and_roles.md` | Navigation, page hierarchy, guards, role capabilities |
| `reader_and_editor.md` | Content format, saving, paragraph index, bookmarks, quotes, progress |
| `validation_and_errors.md` | Form rules, confirmations, access and network errors |
| `ui_patterns.md` | Visual identity, components, responsive changes |
| `mobile_behavior_notes.md` | Phone behaviour today and compatibility-critical rules |
| `discrepancies_and_bugs.md` | Bugs, differences from Stage 1, seed and environment problems |
| `unresolved_scenarios.md` | Blocked, untested and partly tested items; open questions |
| `domains/observations_by_domain.md` | Detailed raw record per domain (texts, mutations, states) |
| `screenshots/<domain>/…__<viewport>.png` | Visual evidence |
| `evidence/scripts/` | Sandbox launchers and the 69 run scripts (no secrets) |
| `PROGRESS.md` | Work log |

## Most important findings

1. The product works end to end in the sandbox, including the mock print-funding flow.
2. Three seed gaps make a fresh development database partly unusable (author profile error, no classification options, no badges).
3. Any member can open another author's writing dashboard for a public book; the server refuses the writes.
4. Real-time updates cover new chat messages (open chat) and new session entries only.
5. Reader resume is per chapter; paragraph indices are positions of top-level HTML elements.
6. Chapter images are stored as base64 inside the chapter HTML.

## Protection

Nothing under `Client/`, `Server/` or `mobile-docs/Stage1/` was changed. No commit was made. The repository's root `.env` was not used.
