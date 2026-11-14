Stage 1 final report

Stage 1 is complete: the repository analysis is written up as 19 Markdown files in mobile-docs/. Nothing was run, built or installed, the spec file is unchanged, and git status shows only the untracked mobile-docs/ directory. Not every file was read at full depth — see item 10.

1. Executive summary

Betik ("Sanal Yayınevi") is a Turkish-only platform for writing, publishing and reading books online. It adds comments, paragraph comments, quotes, follow requests, direct messages, themed writing sessions, points and badges, a printed-book catalogue, and a sandbox-only crowdfunding flow for printing. The backend is a single GraphQL API, not REST, with stateless JWT auth and no cookie dependency for its core, so a Flutter client can reuse it unchanged for nearly everything.

2. Documentation structure

All files are in /Users/fixie/Projects/Sanal-Yayinevi/mobile-docs/:
- README.md — index and conventions
- 01_repository_overview.md, 02_system_architecture.md
- 03_backend_api.md, 04_database_schema.md, 05_authentication_security.md
- 06_frontend_architecture.md
- 07_feature_inventory.md — index for the domain files 07a to 07f
- 08_business_rules.md, 09_integrations_realtime.md
- 10_mobile_compatibility.md, 11_unknowns_and_risks.md, 12_coverage_and_stage2_prep.md

3. Architecture

- Backend (Server/): Node 26, Express 4, Apollo Server 5, graphql-ws for subscriptions, Mongoose 8. Layers are typedefs → thin resolvers → services → models. Real-time events use an in-process PubSub, and a 15-second in-process worker handles print-funding maintenance.
- Frontend (Client/): React 18 (Create React App), Apollo Client, React Router 6, with 51 routes over 35 screens. State lives in the Apollo cache plus four small contexts. A Capacitor Android WebView wrapper (com.betik.app) already exists.

4. Database

MongoDB, with a replica set required because several domains use transactions. Main entities are User, Book, Chapter, Comment, ParagraphComment, Quote, Bookmark, ReadingProgress, Session, SessionEntry, Conversation, Message, FollowRequest, Notification, UserScore, Genre and ClassificationTerm, plus 17 print-funding models. Most user content is soft-deleted.

5. API endpoints

217 in total: 104 queries, 102 mutations, 4 subscriptions and 7 HTTP routes. The GraphQL counts were produced by a script over the schema files. The web client references 184 of the 210 GraphQL operations.

6. Features

156 features with stable IDs (F-<DOMAIN>-<NN>) across 21 domains.

7. Database entities

52, counted as one per Mongoose model registration (one collection each); embedded sub-schemas are not counted.

8. Main risks

- No refresh token: the JWT lasts 24 hours, so mobile users must sign in again daily. Invalid tokens are silently treated as guest rather than returning 401.
- No push notifications: the backend has no device-token or FCM/APNs support; the web relies on polling.
- Masked errors: most business errors are thrown without a code and are replaced by a generic message in production mode, so the app cannot depend on error text.
- Reader and editor fidelity: chapter content is Quill-flavoured HTML. Bookmarks and paragraph comments address paragraphs by a client-computed index, and pageCount is computed client-side at 1200 characters per page. Flutter must reproduce both exactly.
- Google sign-in: a mobile-compatible googleAuth(token) mutation exists, but it needs Android/iOS OAuth clients in the same Google project. Offering it on iOS likely triggers Apple's Sign in with Apple requirement, which the backend lacks.
- Links point at the web: shared links, password-reset e-mails and the payment return all target the web client. Opening them in the app needs association files on the web host.
- Inconsistent contracts: date encodings, pagination styles and error conventions are mixed across the API.

9. Open questions and blockers

Nothing blocks Stage 2. Before Stage 3 these need your decision:
- Are the admin panel and publisher portal in mobile scope?
- Should Google sign-in be offered on iOS?
- Is the checkout flow in mobile scope?
- Does the Flutter app replace the Capacitor wrapper and reuse its application id?
- Is a WebView-hosted Quill editor acceptable, or must the editor be native?

Production configuration, hostnames, and Google and Cloudinary account details are not in the repository and need input from whoever owns deployment. 11_unknowns_and_risks.md also lists ten existing web defects (for example, the register page's terms link points to a route that does not exist) so that any deviation is an explicit choice.

10. Coverage

- Read in full: server entry point and config, all 28 schema files, all resolvers, routes, security modules, all models, utils, and 20 services; on the client, bootstrap, routing, contexts, and the core logic hooks and utils.
- Read condensed (imports and styling stripped, long lines truncated): about 20 of the 35 screens and their main components, including all reader, authoring, session, profile, quotes, messaging and funding screens.
- Read by rule-bearing lines only: 12 further services, print-funding internals, admin services and admin pages.
- Not read: tests, CSS, generated Android code, most static/marketing components, and most existing docs/.

Gaps that matter: per-screen GraphQL field selections are not transcribed, recommendation weights are not recorded, and some render conditions were truncated (these are marked "Verify"). Details are in 12_coverage_and_stage2_prep.md, Part A.

11. Readiness for Stage 2

Ready, with one decision needed first. The Docker dev stack seeds four role accounts and enables the mock payment sandbox, but SMTP, Google login and Cloudinary are off by default. That means new registration, password reset and book creation (a cover upload is mandatory) cannot be exercised unless those integrations are enabled or test data is prepared another way. Also, the dev script assumes a Linux/WSL environment, so whether it runs on this Mac is untested. Part B of 12_coverage_and_stage2_prep.md lists prerequisites, personas, prioritised checks and the destructive actions to isolate.

Stopping here; Stage 2 has not been started.