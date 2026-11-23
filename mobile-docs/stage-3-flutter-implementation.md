# Stage 3 — Complete Flutter Mobile Application Implementation

## Mission

You are acting as a senior Flutter engineer, software architect, mobile UI/UX engineer, integration engineer, and QA engineer.

Your mission is to build a **complete, production-oriented Flutter mobile application** for Betik (Sanal Yayınevi), targeting Android and iOS.

Betik is an existing Turkish-language platform for writing, publishing, reading, and interacting with books and other users.

The existing application consists of:

- A React web frontend.
- A Node.js backend.
- A GraphQL API.
- A MongoDB database.

The mobile application must become an additional client of the existing backend.

**This is a full product migration, not a demonstration, prototype, or minimum viable product.**

The goal is to reproduce the functionality, user journeys, business rules, and product identity of the existing website while delivering a proper Flutter mobile experience.

You have considerable technical autonomy, but you must respect the constraints throughout this specification.

---

# 1. Project Locations

Project root:

`/Users/fixie/Projects/Sanal-Yayinevi/`

Existing React frontend:

`/Users/fixie/Projects/Sanal-Yayinevi/Client/`

Existing Node.js backend:

`/Users/fixie/Projects/Sanal-Yayinevi/Server/`

New Flutter application:

`/Users/fixie/Projects/Sanal-Yayinevi/Client/mobile/`

Documentation root:

`/Users/fixie/Projects/Sanal-Yayinevi/mobile-docs/`

Stage 3 documentation:

`/Users/fixie/Projects/Sanal-Yayinevi/mobile-docs/stage-3/`

**All persistent Flutter application code, assets, tests, and platform configuration must live inside `Client/mobile/`.**

**All new Stage 3 documentation, progress records, and review evidence must live inside `mobile-docs/stage-3/`.**

The directory name `Client` is case-sensitive for the purpose of this specification. Do not create a parallel lowercase `client` directory.

---

# 2. Mandatory Documentation Review

## CRITICAL REQUIREMENT

**Before making architectural decisions or implementing any functionality, thoroughly study the existing Stage 1 and Stage 2 documentation inside `mobile-docs/`.**

These documents are the foundation of this implementation.

Do not skim them.

Do not treat them as optional references.

Do not rely on assumptions about how a typical publishing application works.

### Stage 1 — Repository Forensics

Stage 1 documented the existing application's technical implementation.

Read all relevant Stage 1 documents, including:

- Repository overview.
- System architecture.
- Backend GraphQL API.
- Database schemas.
- Authentication and security.
- Frontend architecture.
- Complete feature inventory and domain-specific files.
- Business rules.
- Integrations and real-time functionality.
- Mobile compatibility.
- Unknowns and risks.
- Coverage and Stage 2 preparation.

Stage 1 identified:

- 217 GraphQL operations and HTTP routes combined.
- 52 Mongoose models.
- 156 user-facing features across 21 domains.
- 51 web routes across 35 screens.
- Important client-side business rules and compatibility requirements.

These figures are historical analysis results, not substitutes for inspecting the actual documentation.

Pay particular attention to the exact API contracts, data structures, authentication flows, and frontend-computed values.

### Stage 2 — Behavioral Reconnaissance

Stage 2 documented how the website actually behaves.

Read all relevant documentation under:

`mobile-docs/stage-2/`

This includes:

- Feature coverage matrix.
- Domain behavior documentation.
- User journeys.
- Navigation and role behavior.
- UI patterns.
- Reader and editor interactions.
- Validation and errors.
- Mobile behavior notes.
- Known bugs and discrepancies.
- Unresolved scenarios.
- Screenshots and visual evidence.

Stage 2 exercised the existing website through real browser interactions.

It recorded:

- 114 verified Stage 1 features.
- 35 partially verified features.
- 2 blocked features.
- 5 untested features.
- 15 additional discovered features.
- 15 documented end-to-end user journeys.
- 211 screenshots across 22 domains.

You must incorporate the additional Stage 2 features into the implementation scope.

Inspect representative and feature-specific screenshots directly. Do not merely read filenames or assume the textual descriptions capture every visual detail.

Use the screenshots to understand layout, component hierarchy, navigation, UI states, spacing, typography, and product identity.

### Documentation authority

Use the following approach when evidence disagrees:

1. Stage 2's observed runtime behavior establishes what the existing website actually did during testing.
2. Stage 1 and the actual source code establish technical implementation, API contracts, and data rules.
3. Existing source code may be inspected to resolve ambiguities.
4. Unverified behaviors must remain explicitly identified as unverified until investigated.

Do not assume a feature is nonexistent merely because Stage 2 could not exercise it.

Do not blindly reproduce known security defects or accidental application bugs.

Distinguish intended product behavior from implementation defects.

If a significant discrepancy requires a product decision, document it and escalate when necessary.

**The source of truth is the existing product and its documented behavior, not your personal preference for how a publishing application should work.**

---

# 3. Non-Negotiable Technology Requirements

The mobile application MUST use:

- Flutter.
- Dart.
- Android as a supported target.
- iOS as a supported target.
- The existing Node.js GraphQL backend.
- The existing backend business rules and data contracts.

The rich-text editor MUST be implemented using a native Flutter solution.

React Native is prohibited.

Do not build the mobile application as a React website inside a WebView.

Do not create a Capacitor application.

Do not replace Flutter functionality with embedded web pages merely to avoid implementing native interfaces.

A platform-native browser or external authentication/payment flow may be appropriate where required by a third-party service, but this does not authorize replacing the application's actual screens or rich-text editor with WebViews.

The objective is a real Flutter application.

---

# 4. Strict Source Protection

The original React frontend and Node.js backend must remain untouched.

## Permitted persistent write locations

1. `Client/mobile/`
2. `mobile-docs/stage-3/`

Do not persistently modify any other project location.

You MUST NOT:

- Modify existing React source files.
- Modify existing Node.js source files.
- Modify GraphQL schemas or backend resolvers.
- Modify existing database schemas.
- Modify existing project configuration.
- Modify existing dependencies or lockfiles outside `Client/mobile/`.
- Modify Stage 1 or Stage 2 documentation.
- Rename, move, delete, or format original application files.
- Change existing web functionality.
- Commit, push, reset, clean, or otherwise manipulate repository history.
- Modify the existing Capacitor application.
- Modify project-level Git configuration or ignore rules.
- Introduce new application code outside `Client/mobile/`.

You MAY:

- Read the original application.
- Inspect its existing source code.
- Read all existing documentation.
- Create and modify files inside `Client/mobile/`.
- Create and modify Stage 3 documentation inside `mobile-docs/stage-3/`.
- Install Flutter dependencies for the new project.
- Generate Android and iOS platform files inside the new Flutter project.
- Build, analyze, and test the new mobile application.
- Create isolated temporary runtime environments outside the original project.

Ordinary external tool caches are acceptable, but must not be used as a way to modify protected project content.

Do not use the original database for destructive testing.

If integration testing requires a backend, use the isolated environment approach established during Stage 2 or an equivalently safe disposable environment.

Before modifying files, verify their paths.

If an operation could modify protected project content, do not execute it.

---

# 5. Execution Autonomy

You are authorized to execute the entire Stage 3 implementation autonomously.

**Do not stop after every milestone to request approval.**

You may independently:

- Choose Flutter packages.
- Design application architecture.
- Organize source files.
- Choose state management.
- Choose navigation infrastructure.
- Design reusable components.
- Implement features.
- Add tests.
- Refactor new Flutter code.
- Fix mobile implementation defects.
- Choose practical solutions to ordinary technical problems.
- Prioritize development order.
- Perform routine dependency and tooling operations within permitted boundaries.

However, technical autonomy does not include product redesign.

You may change implementation details, but not silently change established functionality, user flows, permission rules, or backend contracts.

### Escalation conditions

Ask for a decision only when:

- A required feature is impossible under the backend constraints.
- A major product behavior must change.
- A serious security or privacy issue requires a decision.
- A destructive or externally visible action requires authorization.
- Essential credentials or configuration cannot be safely substituted.
- A third-party platform restriction creates a significant blocker.
- A critical technical ambiguity cannot be resolved through investigation.
- A necessary operation would violate protected-directory boundaries.

For ordinary obstacles, investigate alternatives and continue.

For a blocker affecting only one feature, document it and continue implementing independent features.

Do not abandon the entire project because one integration is unavailable.

Do not hide blockers behind placeholders or claim an incomplete feature works.

---

# 6. Implementation Strategy

Use an internal, milestone-based implementation process.

The milestones are execution checkpoints, not user approval gates.

You must continue autonomously between them.

Suggested progression:

1. Documentation synthesis and technical architecture.
2. Flutter project initialization.
3. Application foundation and design system.
4. Backend communication and authentication.
5. Core product features.
6. Authoring and reader.
7. Social features and real-time interactions.
8. Writing sessions and gamification.
9. Printed books and crowdfunding.
10. Publisher and administration functionality.
11. Cross-feature integration.
12. Testing, validation, optimization, and completion review.

You may reorganize milestones based on actual dependencies.

Prefer vertical feature slices when practical: a real functioning screen connected to its API is more useful than twenty disconnected mock screens.

Keep the application runnable and structurally coherent throughout development.

### No artificial stopping point

Do not stop after creating project scaffolding.

Do not stop after implementing authentication.

Do not stop after building a few example screens.

Do not declare Stage 3 complete merely because the application compiles.

**Continue until all achievable functionality is implemented and verified, with genuine blockers explicitly documented.**

If execution context becomes limited, preserve an accurate checkpoint in the documentation so work can resume without losing decisions or progress.

---

# 7. Architecture Requirements

Design a maintainable Flutter application suitable for a substantial existing product.

Choose well-supported, reasonably maintained Flutter packages that work on Android and iOS.

Verify package compatibility with the available Flutter and Dart versions.

Do not blindly select packages because they are popular.

Avoid unnecessary architectural complexity.

A clean separation between the following concerns is expected:

- Presentation.
- Application state.
- Domain and business behavior.
- Backend communication.
- Data models and serialization.
- Authentication and secure storage.
- Navigation.
- Shared components and utilities.

You may choose feature-oriented organization, layered architecture, or another maintainable structure.

Do not introduce excessive boilerplate, abstract factories, or pointless layers.

Do not reinvent functionality already handled reliably by established Flutter libraries.

### State management

Choose an appropriate state management solution.

Use it consistently.

Handle:

- Authentication state.
- Current user and roles.
- API loading states.
- Error states.
- Shared application state.
- Cache updates.
- Navigation-related state.
- Real-time updates.
- Local form state.

Avoid uncontrolled global mutable state.

### Navigation

Implement a coherent native navigation architecture.

Preserve the existing product's navigation possibilities while adapting them appropriately for mobile.

Support:

- Authenticated and guest navigation.
- Nested screens.
- Back navigation.
- Deep links where supported.
- Role-dependent destinations.
- Navigation from notifications.
- Navigation to books, chapters, profiles, conversations, and other entities.

Do not mechanically reproduce desktop menus when native navigation is more appropriate.

Preserve functionality and information architecture.

---

# 8. GraphQL and Backend Integration

The existing Node.js backend is the only application backend.

Do not introduce a new backend.

Do not introduce an intermediary service that changes application business logic.

Do not connect Flutter directly to MongoDB.

Use the existing GraphQL API.

Implement:

- Queries.
- Mutations.
- Subscriptions.
- Authentication headers.
- Relevant HTTP routes.
- Pagination.
- Filtering and sorting.
- Upload handling.
- Error handling.
- Real-time updates.
- Cache invalidation and synchronization.

Use Stage 1 documentation and actual backend definitions to obtain precise contracts.

Do not invent API operations, fields, or response shapes.

Do not assume all GraphQL operations have identical error or pagination conventions.

Where the backend uses inconsistent conventions, adapt the Flutter client appropriately rather than modifying the backend.

### API configuration

Use configurable development and production endpoints.

Do not hardcode machine-specific development addresses into application logic.

Account for Android emulator, iOS simulator, and physical-device networking differences.

Do not ship development endpoints as production defaults.

Never embed backend secrets or privileged service credentials into the mobile application.

### Error handling

Handle GraphQL, HTTP, connectivity, and authentication failures appropriately.

Prefer structured error information when available.

Where the backend exposes only message text, handle known cases carefully and provide safe fallback behavior.

Do not depend on arbitrary error strings when a more reliable contract exists.

Preserve meaningful Turkish feedback.

Do not fabricate successful operations after API failures.

---

# 9. Authentication and User Accounts

Implement the existing account functionality, including:

- Registration.
- Login.
- Logout.
- E-mail verification.
- Password recovery.
- Password changes.
- E-mail changes.
- Account settings.
- Account deactivation/reactivation.
- Account deletion.
- Role-dependent access.

Follow the exact existing backend contracts.

### JWT handling

Stage 1 identified a 24-hour JWT without a refresh-token mechanism.

Implement secure token storage using an appropriate mobile solution.

Do not store authentication credentials in ordinary plaintext preferences.

Handle token expiration and invalid authentication states gracefully.

Do not invent refresh-token functionality.

Do not modify backend authentication behavior.

### Google sign-in

**Google sign-in is explicitly in scope for BOTH Android and iOS.**

Implement the appropriate native Google authentication integration and use the existing backend `googleAuth(token)` mutation.

Verify the actual token type and server-side expectations.

Do not assume a Google access token and Google ID token are interchangeable.

Support platform-specific configuration without embedding secrets.

If OAuth client configuration is missing, implement everything that can be safely completed and document the exact configuration needed.

Do not fake successful authentication.

### iOS platform requirements

Investigate current Apple App Review requirements relating to third-party authentication.

Google sign-in on iOS may create an additional authentication compliance requirement.

Do not assume the existing backend supports Sign in with Apple.

Do not modify the backend to add Apple authentication.

If compliance cannot be achieved within the existing backend constraints, document the precise issue as a release blocker and request a product decision when necessary.

Continue implementing unaffected functionality.

---

# 10. Product Scope — ALL Features

**All existing product areas are in scope.**

Do not exclude features because they appear uncommon, administrative, complicated, or desktop-oriented.

Use the complete Stage 1 and Stage 2 feature inventories as the authoritative scope checklist.

The following domains are explicitly included.

## Reading and discovery

- Home and feed.
- Book discovery.
- Search.
- Filtering and sorting.
- Genres and classification.
- Book details.
- Chapters.
- Reading progress.
- Bookmarks.
- Comments and paragraph comments.
- Quotes.
- Relevant reading settings.
- All documented reader interactions.

## Writing and publishing

- Author dashboards.
- Book creation.
- Book editing.
- Chapter creation and editing.
- Hidden and published chapters.
- Rich-text editing.
- Draft management.
- Cover management.
- Publishing workflows.
- Book completion.
- Author-side management actions.

## Social functionality

- Profiles.
- Following and follow requests.
- Social interactions.
- Reposts.
- Direct messaging.
- Conversations.
- Notifications.
- User activity.
- Role-specific social features.

## Writing sessions

- Session discovery.
- Session creation where authorized.
- Access requests.
- Approvals.
- Private access codes.
- Participation.
- Live posting.
- Session interaction.
- Session management.
- Closing and related workflows.

## Gamification

- Points.
- Scores.
- Badges.
- User achievements.
- Related progress indicators.

## Printed books and funding

- Printed-book catalogue.
- Printed-book details.
- Related interactions.
- Print applications.
- Funding campaigns.
- Payment flows.
- Payment history.
- Mock/sandbox-compatible verification.
- Refund and retry flows where supported.
- Relevant administrative and publisher actions.

## Publisher functionality

Implement the existing publisher portal and its authorized workflows.

## Administration

Implement the existing administrative interface and workflows using mobile-appropriate navigation and layouts.

This includes relevant:

- Management screens.
- Approval queues.
- Moderation actions.
- Review and revision flows.
- Audit information.
- Role-protected operations.

Do not create a separate mobile backend for privileged features.

Respect the existing backend authorization model.

Do not rely on hiding buttons as the only permission enforcement.

### Small features matter

Do not omit:

- Confirmation dialogs.
- Secondary actions.
- Conditional menus.
- Validation.
- Empty states.
- Error recovery.
- Loading states.
- Search refinements.
- Pagination.
- Minor settings.
- Hidden or role-dependent controls.
- Recently discovered Stage 2 interactions.

A feature is not complete merely because its primary screen exists.

---

# 11. Native Flutter Rich-Text Editor

This is a major technical requirement.

**The editor must be native Flutter.**

Do not use a WebView-hosted Quill editor.

Choose a native Flutter editor package or construct an appropriate native Flutter editing layer using supported Flutter capabilities.

The solution must preserve the existing backend content representation.

Stage 1 and Stage 2 identified Quill-flavoured HTML content and several important client-computed behaviors.

Investigate:

- Existing HTML structure.
- Supported formatting operations.
- Paragraph boundaries.
- Headings and lists.
- Text styling.
- Links.
- Embedded images.
- Newlines and empty paragraphs.
- Content serialization.
- Content deserialization.
- Save and reload behavior.
- Long-form content.
- Existing embedded base64 images.

### Compatibility is mandatory

A chapter written on the website must be readable and editable in Flutter without unintentionally destroying its content.

A chapter written or edited in Flutter must remain compatible with the existing website.

Formatting must survive reasonable read-edit-save-read round trips.

Do not silently discard unsupported formatting.

When exact compatibility is uncertain, investigate the existing implementation and build focused tests.

If a particular construct cannot be safely round-tripped with the chosen editor, document the limitation instead of silently corrupting content.

### Native authoring experience

Implement mobile-appropriate editing controls.

Preserve the functional capabilities of the web editor while adapting interactions for touch devices.

Handle the software keyboard, selection, formatting toolbar, scrolling, and save feedback properly.

Do not substitute a plain text field for rich-text editing.

---

# 12. Reader Compatibility

The reader must remain compatible with the existing content and backend data contracts.

Stage 1 and Stage 2 identified important client-side behaviors.

### Paragraph indexing

Bookmarks and paragraph comments reference paragraph positions computed from chapter HTML.

The existing behavior uses top-level HTML element positions.

Flutter must reproduce the relevant indexing semantics so that content references created on either platform remain valid.

Do not invent a new paragraph identifier scheme.

Test against representative HTML fixtures.

### Page count

The web application computes chapter page counts client-side using its existing character-based calculation.

Find and reproduce the actual algorithm and its edge cases.

Do not substitute a screen-size-based page count if the backend expects the existing value.

### Reading behavior

Preserve:

- Chapter navigation.
- Reading progress.
- Per-chapter resume behavior.
- Bookmarks.
- Paragraph comments.
- Text selection.
- Quote creation.
- Relevant reading settings.
- Reader progress indicators.
- Read/unread chapter state.

Do not invent cross-device scroll-position synchronization where the backend does not support it.

### Copy protection

Stage 2 did not conclusively establish copy-protection behavior.

Investigate the existing implementation and documented uncertainty.

Do not invent restrictions based on assumptions.

Escalate only if a material product or security decision is required.

---

# 13. Mobile UI and Design

The application should feel like Betik, not like an unrelated generic Flutter template.

Use Stage 2 screenshots and UI documentation to understand the existing design.

Preserve recognizable:

- Branding.
- Colors.
- Typography hierarchy.
- Content presentation.
- Iconography where appropriate.
- User interaction semantics.
- Information hierarchy.
- Product terminology.

At the same time, implement a genuinely mobile-appropriate interface.

### Design principles

- Prefer touch-friendly interactions.
- Avoid unnecessary navigation depth.
- Adapt desktop-only layouts.
- Support small screens.
- Respect safe areas.
- Handle keyboard insets.
- Support appropriate scrolling.
- Use readable typography.
- Avoid horizontal overflow.
- Maintain visual consistency.
- Handle loading, empty, success, and error states deliberately.

Do not copy desktop UI problems merely for pixel parity.

Do not arbitrarily redesign established product workflows.

### Responsive behavior

Support practical Android and iOS screen sizes.

Account for different aspect ratios, text scaling, and platform UI conventions.

Admin and publisher interfaces may require more complex responsive layouts, but they remain in scope.

### Language

The existing product is Turkish-language.

Preserve Turkish user-facing text and terminology.

Use appropriate localization infrastructure instead of scattering uncontrolled strings throughout the application.

Do not invent English-only interfaces.

---

# 14. Real-Time Functionality

Investigate and implement existing GraphQL subscription behavior where supported.

Stage 1 identified `graphql-ws` and in-process backend PubSub.

Stage 2 observed that some updates are immediate while others require refresh or polling.

Reproduce the actual supported behavior.

Handle:

- Connection establishment.
- Reconnection.
- Authentication.
- Subscription cleanup.
- Background and foreground transitions.
- Cache synchronization.
- Duplicate events.
- Relevant polling where subscriptions are unavailable.

Do not invent backend events.

Do not assume the backend supports mobile push notifications.

If push notifications require backend changes, document the limitation.

An in-app notification interface is still in scope.

---

# 15. Payments and External Integrations

The application contains printed-book funding and payment-related workflows.

Implement the mobile-compatible portions of the existing system without modifying its backend.

Preserve:

- Amount representations.
- Currency handling.
- Client-generated idempotency keys.
- Payment state transitions.
- Confirmation behavior.
- Retry behavior.
- Failure handling.
- History and refund flows.

Stage 2 used mock payments.

Use sandbox or disposable configurations for testing.

Never initiate real financial transactions without explicit authorization.

Investigate current Android and iOS platform rules for the specific types of goods and transactions involved.

Do not assume that web checkout mechanics can be transferred unchanged into a mobile application.

Do not bypass platform policies.

If an existing payment integration lacks the required native or compliant mobile flow, document the blocker and implement everything that can safely be completed.

The backend must remain unchanged.

### Other integrations

Handle existing integrations such as:

- Cloudinary uploads.
- SMTP-dependent account flows.
- Google authentication.
- External links.
- Sharing.
- Existing web-targeted notification URLs.

Use supported mobile-native integrations when possible.

Do not hardcode secrets or production credentials.

Do not fabricate successful integration results when an external service is unavailable.

---

# 16. Existing Bugs and Behavioral Discrepancies

Stage 2 documented existing website bugs and differences from Stage 1 assumptions.

Read these findings carefully.

Do not automatically reproduce every defect.

Use the following principles:

1. Preserve intended user-facing product behavior.
2. Preserve backend compatibility.
3. Do not introduce security vulnerabilities merely for behavioral parity.
4. Do not silently redesign workflows.
5. Document intentional deviations from known web defects.
6. Escalate major ambiguous decisions.

For example, Stage 2 identified an author dashboard that could be opened by another member even though the backend rejected writes.

Do not intentionally introduce unauthorized access simply because the web UI exposed an unintended screen.

Respect server-side authorization and avoid exposing inappropriate controls.

Record significant differences in the Stage 3 decision log.

---

# 17. Testing Requirements

Testing is part of implementation, not an optional final activity.

Use appropriate Flutter testing tools.

At minimum, establish:

- Static analysis.
- Formatting checks.
- Unit tests.
- Widget tests.
- Relevant integration tests.
- Backend contract verification where practical.

### Critical tests

Prioritize:

- Authentication and token lifecycle.
- GraphQL serialization.
- Error handling.
- Navigation.
- Role-based behavior.
- Form validation.
- Reader paragraph indexing.
- Page-count compatibility.
- Rich-text HTML round trips.
- Book and chapter creation.
- Saving and publishing.
- Messaging state.
- Session state transitions.
- Payment amount and idempotency handling.

Use realistic fixtures derived from actual data contracts.

Do not introduce arbitrary mock models that differ from the backend simply to make tests pass.

### Android and iOS validation

Check the available toolchain.

Where supported, run:

- `flutter analyze`
- `flutter test`
- Android build verification.
- iOS build verification.

Run the application on available Android emulators and iOS simulators where possible.

Verify major user journeys against the isolated backend.

If a toolchain, emulator, signing configuration, or credential is unavailable, report exactly what could and could not be validated.

Do not equate compilation with runtime correctness.

Do not falsely claim a feature was tested on a physical device.

### Regression testing

After major changes, rerun relevant tests and address regressions.

Do not accumulate known failing tests and declare success.

Do not suppress analyzer errors or test failures merely to produce a clean-looking report.

---

# 18. Feature Parity Tracking

Create a feature-level implementation matrix based on Stage 1 and Stage 2.

It must include:

- All 156 original Stage 1 features.
- All 15 additional Stage 2 discoveries.
- Any further features discovered during implementation.

Preserve existing stable feature identifiers.

For each feature record:

- Feature ID.
- Feature name.
- Domain.
- Relevant web behavior reference.
- Relevant API dependency.
- Flutter implementation location.
- Implementation status.
- Verification status.
- Test or evidence reference.
- Known limitations.

### Implementation statuses

Use clear statuses such as:

- NOT STARTED
- IN PROGRESS
- IMPLEMENTED
- BLOCKED
- DEFERRED BY EXPLICIT DECISION

### Verification statuses

Track verification independently:

- VERIFIED
- PARTIALLY VERIFIED
- NOT VERIFIED
- FAILED
- BLOCKED

Do not mark a feature VERIFIED merely because code exists.

A feature should be considered implemented only when its relevant user-facing workflow and backend integration actually exist.

Avoid inflated completion percentages.

Distinguish code completion from demonstrated functional parity.

---

# 19. Stage 3 Documentation

Create and maintain documentation under:

`mobile-docs/stage-3/`

Suggested structure:

```text
stage-3/
├── README.md
├── architecture.md
├── technical_decisions.md
├── feature_parity_matrix.md
├── implementation_progress.md
├── backend_integration.md
├── auth_and_platform_config.md
├── reader_editor_compatibility.md
├── testing_and_validation.md
├── known_issues_and_blockers.md
├── release_readiness.md
└── evidence/
```

Adapt the structure when useful.

Do not create unnecessary documentation files.

Do not duplicate all Stage 1 or Stage 2 documentation.

Cross-reference existing documents.

### Architecture documentation

Explain:

- Selected packages and why.
- Project structure.
- State management.
- Navigation.
- API integration.
- Authentication handling.
- Editor strategy.
- Platform-specific considerations.
- Important tradeoffs.

### Progress documentation

Maintain a reliable record of:

- Completed domains.
- Partially implemented features.
- Remaining work.
- Current blockers.
- Test results.
- Important decisions.
- Next actionable tasks.

Update progress as implementation proceeds.

Do not wait until the very end to document critical architectural decisions.

### Documentation is not implementation

Avoid spending excessive effort writing architecture reports while leaving the actual Flutter application unfinished.

Documentation should support implementation, validation, and maintainability.

**Writing that a feature is implemented does not make it implemented.**

---

# 20. Quality Standards

The Flutter application must be maintainable and technically sound.

Follow these principles:

- Prefer clear, idiomatic Dart.
- Use consistent naming.
- Keep widgets reasonably focused.
- Avoid massive monolithic screens.
- Avoid unnecessary abstractions.
- Centralize shared concerns.
- Reuse components appropriately.
- Separate network contracts from UI presentation.
- Use strongly typed data models where useful.
- Handle nullability correctly.
- Dispose controllers and subscriptions.
- Avoid uncontrolled resource leaks.
- Handle async errors.
- Avoid blocking the UI thread.
- Use secure storage for sensitive credentials.
- Avoid hardcoded secrets.
- Keep dependencies manageable.
- Make behavior testable.

Do not introduce complicated architecture solely to appear sophisticated.

Do not substitute temporary hacks for straightforward maintainable solutions.

At the same time, do not overengineer small features.

### Performance

Pay attention to:

- Long book chapters.
- Large HTML documents.
- Embedded images.
- Large feeds.
- Pagination.
- Scrolling performance.
- Network request efficiency.
- Cache behavior.
- Repeated widget rebuilding.
- Memory usage.
- App startup.

Optimize based on identifiable risks and observed behavior.

Do not prematurely optimize everything.

---

# 21. Completion Criteria

Stage 3 is not complete merely because the Flutter project exists.

Completion requires:

1. A real Flutter application under `Client/mobile/`.
2. Android and iOS platform targets.
3. Existing GraphQL backend integration.
4. Implemented authentication flows.
5. All achievable documented product features.
6. Native Flutter rich-text editing.
7. Compatible reader behavior.
8. Social and messaging functionality.
9. Sessions and gamification.
10. Printed-book and funding functionality.
11. Publisher functionality.
12. Administrative functionality.
13. Mobile-appropriate navigation and UI.
14. Error, loading, and empty states.
15. Feature parity documentation.
16. Relevant automated tests.
17. Build validation where tools permit.
18. Runtime verification where tools permit.
19. Explicit documentation of unresolved blockers.
20. Confirmation that protected application files remain unchanged.

Do not conceal missing functionality.

Do not use static mock screens as substitutes for functional implementation.

Do not invent successful network responses.

Do not label an application production-ready if critical security, platform, or integration issues remain unresolved.

If all features cannot be completed under the existing constraints, complete all independent feasible work and report the remaining limitations accurately.

---

# 22. Final Validation

Before finishing, perform a systematic review.

### Repository protection

Verify that no protected source files were modified.

Confirm all persistent application changes are under `Client/mobile/` and all Stage 3 documentation changes are under `mobile-docs/stage-3/`.

### Feature parity

Compare implementation against the full Stage 1 and Stage 2 feature inventories.

Account for every feature.

### Backend compatibility

Verify that Flutter uses existing API contracts.

Check important serialization, authentication, and client-computed values.

### Visual consistency

Compare representative Flutter screens against the Stage 2 visual evidence.

Confirm recognizable product identity and practical mobile usability.

### Tests

Run available static analysis, tests, and build checks.

Report failures rather than concealing them.

### Platform readiness

Identify any missing:

- OAuth configuration.
- iOS signing.
- Android signing.
- Push notification infrastructure.
- Universal link or App Link configuration.
- App Store compliance requirements.
- Payment integration requirements.
- External service credentials.

Differentiate an unfinished feature from a completed feature awaiting deployment configuration.

---

# 23. Final Report

When implementation and validation are complete, provide a final report containing:

## Application

- Flutter application location.
- Architecture summary.
- Main dependencies and technical choices.
- Android and iOS build status.

## Implementation

- Total tracked features.
- Implemented features.
- Verified features.
- Partially verified features.
- Blocked features.
- Unimplemented features.
- Major completed domains.

## Testing

- Static analysis results.
- Automated test results.
- Android validation.
- iOS validation.
- Runtime integration verification.

## Compatibility

- Reader/editor HTML compatibility.
- Paragraph indexing.
- GraphQL compatibility.
- Authentication.
- Real-time behavior.
- Payment and external integrations.

## Limitations

- Missing credentials.
- Backend limitations.
- Platform compliance concerns.
- Known bugs.
- Any explicit deviations from the existing website.
- Remaining work before production release.

## Safety

Confirm whether the original React frontend, Node.js backend, and existing documentation remained unchanged.

Never claim a completed or verified status without supporting evidence.

---

# 24. Stop Conditions

You are authorized to complete all of Stage 3 autonomously.

Do not stop at ordinary milestone boundaries.

Do not request approval for routine implementation decisions.

Stop and request input only for a genuine blocker requiring user intervention.

After completing all achievable implementation work and final validation:

**STOP.**

Do not:

- Modify the existing React application.
- Modify the existing Node.js backend.
- Modify original database schemas.
- Rewrite earlier documentation.
- Commit or push changes without authorization.
- Deploy to production.
- Publish to Google Play or the App Store.
- Execute real financial transactions.
- Send production communications.

Production deployment and store publication are outside this stage.

---

# 25. Execution Order

Begin by performing the following:

1. Read this entire specification.
2. Inspect the project directory structure and establish protected paths.
3. Read Stage 1 documentation thoroughly.
4. Read Stage 2 documentation thoroughly.
5. Inspect relevant Stage 2 screenshots.
6. Build a complete feature parity checklist.
7. Identify API contracts and critical compatibility requirements.
8. Inspect the available Flutter, Android, and iOS development tools.
9. Select a maintainable application architecture.
10. Document the initial architecture and major technical decisions.
11. Initialize the Flutter application inside `Client/mobile/`.
12. Implement the shared application foundation.
13. Implement the product functionality in logical milestones.
14. Integrate all achievable features with the existing backend.
15. Add and execute relevant automated tests.
16. Verify behavior against Stage 1 and Stage 2 findings.
17. Validate Android and iOS builds where possible.
18. Address implementation defects and regressions.
19. Reconcile every tracked feature with its actual implementation status.
20. Produce the final report and stop.

Keep working autonomously through the implementation.

Use the existing documentation continuously, not only during initial planning.

Whenever you implement a feature, consult its relevant Stage 1 technical references and Stage 2 behavioral evidence.

Whenever you are uncertain how a feature should behave, investigate the existing web implementation before inventing a solution.

Whenever you complete a domain, update the feature parity matrix and relevant tests.

Avoid long periods of architectural planning without producing functioning code.

---

# FINAL DIRECTIVE

**Build the complete Betik mobile application in Flutter.**

The original React website is the behavioral reference.

Stage 1 documentation is the technical reference.

Stage 2 documentation is the user-experience and functional reference.

The existing Node.js GraphQL backend is the integration target.

`Client/mobile/` is the implementation location.

`mobile-docs/stage-3/` is the documentation location.

All functionality is in scope, including administration, publisher workflows, and print funding.

Google sign-in is required on Android and iOS.

The rich-text editor must be native Flutter.

Execute the implementation autonomously.

Make sound technical decisions, preserve product behavior, respect protected boundaries, test thoroughly, and report genuine limitations.

**Do not merely create an application that resembles Betik. Create a Flutter client that actually works with Betik's existing system.**

Begin.
