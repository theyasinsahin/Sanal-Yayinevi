# Stage 2 — Exhaustive Website Behavioral Reconnaissance

## Mission

You are acting as a senior QA engineer, product behavior analyst, and mobile migration specialist.

Your objective is to run and systematically explore the existing React website, documenting its complete user-facing behavior so that a separate Flutter application can faithfully reproduce the product on Android and iOS.

The application is Betik (Sanal Yayınevi), a Turkish-language online writing, publishing, and reading platform backed by a Node.js GraphQL API.

This is **Stage 2 of a three-stage migration process**:

1. Repository Forensics — COMPLETED.
2. Behavioral Reconnaissance — CURRENT STAGE.
3. Flutter Implementation — NOT AUTHORIZED.

Stage 1 documentation already exists in `mobile-docs/`. Read it and use its feature inventory, architectural findings, API contracts, risks, and coverage notes as your starting point.

**Do not repeat Stage 1. Your job is to observe and document the running product.**

---

## 1. Project Paths

Project root:

`/Users/fixie/Projects/Sanal-Yayinevi/`

Existing React frontend:

`/Users/fixie/Projects/Sanal-Yayinevi/Client/`

Existing Node.js backend:

`/Users/fixie/Projects/Sanal-Yayinevi/Server/`

Documentation directory:

`/Users/fixie/Projects/Sanal-Yayinevi/mobile-docs/`

All persistent documentation and visual evidence generated during this stage must be stored under `mobile-docs/`.

Create a dedicated `stage-2/` subdirectory to avoid interfering with Stage 1 documentation.

Do not modify existing documentation.

---

## 2. Non-Negotiable Protection Rules

The existing React frontend and Node.js backend are strictly protected.

You MUST NOT:

- Modify, delete, rename, move, or format original application source files.
- Modify original package manifests, lockfiles, or configuration files.
- Install dependencies into the original application directories.
- Run builds or development commands that generate files inside the original application directories.
- Modify existing documentation.
- Modify the original database or any production/staging data.
- Run destructive operations against non-disposable resources.
- Commit, push, or modify Git history.
- Implement Flutter code.
- Change existing application behavior or business logic.

You MAY:

- Read the original application and Stage 1 documentation.
- Create isolated temporary working copies of the application.
- Install dependencies inside isolated copies.
- Configure disposable runtime environments.
- Create disposable databases and test accounts.
- Execute the application in isolation.
- Perform test interactions against disposable data.
- Capture screenshots and other visual evidence.
- Write Stage 2 documentation under `mobile-docs/stage-2/`.

If isolation cannot be established safely, stop and ask before proceeding.

Do not assume that localhost, development mode, or a Docker container automatically guarantees isolation.

---

## 3. Runtime Environment Preparation

First, inspect the existing development and Docker configuration.

Determine how to run the React frontend, Node.js backend, MongoDB replica set, and required supporting services on macOS.

The existing development scripts may assume Linux or WSL. Adapt the isolated environment as necessary without changing original application files.

### Requirements

- Use an isolated working copy outside the protected application directories.
- Use disposable test data.
- Avoid connections to production or staging databases.
- Do not reuse unknown existing MongoDB volumes.
- Do not use real payment credentials.
- Do not expose the local test environment publicly.
- Do not copy production secrets into the isolated environment.
- Ensure the original repository remains unchanged.

Before executing state-changing application operations, verify that the backend is connected exclusively to disposable resources.

You may create temporary configuration files and environment variables inside the isolated working copy.

If Docker or another runtime dependency is unavailable, investigate practical alternatives.

Ask for assistance only when an essential prerequisite cannot be resolved safely.

### Seeded accounts

Use the existing development seed configuration where possible.

Stage 1 identified four seeded role accounts.

Discover their roles and verify that they work in the isolated environment.

Do not print passwords or tokens into documentation.

If additional accounts or data are needed, create them exclusively inside the disposable environment.

### External integrations

Prefer existing mock or sandbox services.

SMTP, Google login, and Cloudinary may be unavailable by default.

Do not modify the backend to simulate missing integrations.

Instead:

1. Determine whether a safe existing test configuration can enable the integration.
2. Use existing seed data or supported mock mechanisms when possible.
3. Exercise all accessible portions of the feature.
4. Record any remaining coverage limitations.

Never use real financial transactions or external communications without explicit approval.

---

## 4. Browser-Based Exploration

You must interact with the running website using actual browser automation or an equivalent browser-capable environment.

Reading source code, inspecting DOM structure, or listing routes is not a substitute for interacting with the application.

Use browser tools capable of:

- Navigating between pages.
- Clicking controls.
- Filling forms.
- Submitting data.
- Observing UI transitions.
- Inspecting rendered content.
- Capturing screenshots.
- Testing responsive layouts.
- Observing browser console errors and network failures.

You may use Playwright or another appropriate tool.

Choose the most practical reliable approach.

Do not modify application source code to make automation easier.

### Exploration philosophy

Treat the website as an unfamiliar product.

Discover what users can actually do.

Do not assume a feature works merely because its source code exists.

Do not assume an interaction is unimportant because it is visually small.

Prioritize actual user-facing behavior rather than internal implementation details.

---

## 5. Feature-by-Feature Investigation

Stage 1 identified 156 features across 21 domains.

Use `07_feature_inventory.md` and its domain-specific documents as the initial checklist.

For every identified feature:

1. Navigate to its entry point.
2. Establish the required user role and initial state.
3. Perform the intended interaction.
4. Observe intermediate UI states.
5. Record the successful outcome.
6. Test relevant validation and error behavior.
7. Inspect related navigation and secondary controls.
8. Capture useful visual evidence.
9. Record differences between expected and observed behavior.
10. Mark the verification status.

Discover and document additional features not captured in Stage 1.

Assign stable identifiers to newly discovered features without changing existing Stage 1 identifiers.

### Verification statuses

Use:

- VERIFIED — Successfully exercised in the running website.
- PARTIAL — Some behavior exercised, but important paths remain untested.
- BLOCKED — Cannot be exercised because of a documented prerequisite or limitation.
- FAILED — The feature was exercised but did not behave as intended.
- NOT TESTED — No meaningful runtime interaction was performed.

Never mark a feature VERIFIED based solely on source inspection.

For complex features, track individual scenarios rather than applying one blanket status.

---

## 6. User Roles and Journeys

Explore the application from every available user role.

Include guest users and all seeded authenticated roles.

Test role-specific visibility, permissions, navigation, and functionality.

Investigate complete user journeys, including:

- Account access and profile management.
- Book discovery and browsing.
- Reading books and chapters.
- Reading progress and bookmarks.
- Writing and editing content.
- Publishing workflows.
- Comments and paragraph comments.
- Quotes.
- Following and social interactions.
- Direct messaging.
- Notifications.
- Writing sessions.
- Points, badges, and gamification.
- Printed-book catalogue.
- Print-funding and sandbox checkout.
- Publisher-specific functionality.
- Administrative functionality where safely accessible.

These are starting points, not an exhaustive list.

Use the actual application to discover further journeys.

### Cross-feature workflows

Pay special attention to workflows spanning multiple screens or domains.

For example:

Create content → save draft → edit → publish → view as reader → interact → return to author dashboard.

Test transitions between features, not just isolated screens.

Document state persistence across navigation and reloads.

---

## 7. Micro-Interaction Coverage

Inspect small and easily overlooked interactions.

Examples:

- Hover and focus behavior.
- Dropdown opening and closing.
- Modal dismissal.
- Confirmation and cancellation.
- Disabled button states.
- Form field validation.
- Empty input handling.
- Loading indicators.
- Toast messages.
- Search debouncing.
- Sorting and filtering.
- Pagination.
- Expandable sections.
- Tab switching.
- Keyboard shortcuts.
- Browser back and forward.
- Unsaved-change warnings.
- Conditional controls.
- Hidden menus.
- Contextual actions.
- Error recovery.
- Retry behavior.
- Scroll-dependent interactions.

Not every desktop-specific interaction requires a literal mobile equivalent.

Document its functional purpose so Stage 3 can reproduce the behavior using appropriate Flutter patterns.

---

## 8. Reader and Editor Investigation

The reader and editor are particularly important.

Stage 1 identified several compatibility-sensitive behaviors:

- Quill-flavoured HTML content.
- Client-computed paragraph indices.
- Paragraph comments.
- Bookmarks.
- Client-side page counting using 1200 characters per page.

Investigate these carefully.

### Reader

Explore:

- Book and chapter navigation.
- Reading position persistence.
- Paragraph interactions.
- Bookmarks.
- Comments.
- Text selection and quotes.
- Pagination or scrolling.
- Reading settings.
- Empty and malformed content.
- Long chapters.
- Navigation between reading and other features.

### Editor

Explore:

- Content creation.
- Rich-text formatting.
- Saving and editing.
- Draft behavior.
- Publishing.
- Validation.
- Unsaved changes.
- Cover images.
- Error handling.
- Long-form content.

Record both the visible interactions and the resulting behavior.

Do not redesign the editor or reader.

Do not decide whether Flutter should use a native editor or WebView during this stage.

Collect evidence needed for that later decision.

---

## 9. Responsive and Visual Documentation

Capture screenshots of meaningful UI states.

Include:

- Main screens.
- Navigation structures.
- Forms.
- Modals.
- Menus.
- Loading states.
- Empty states.
- Error states.
- Role-specific interfaces.
- Reader and editor.
- Important responsive layouts.

Explore at least:

- Desktop viewport.
- Typical mobile viewport.
- Intermediate tablet-sized viewport where useful.

Record viewport dimensions with screenshots.

Do not generate hundreds of redundant screenshots.

Prefer screenshots that capture distinct behaviors or design patterns.

Store evidence under:

`mobile-docs/stage-2/screenshots/`

Use descriptive filenames and organize by feature domain where appropriate.

### Visual analysis

Document:

- Page hierarchy.
- Navigation patterns.
- Component relationships.
- Typography and spacing patterns.
- Color usage.
- Important interaction states.
- Responsive transformations.
- Mobile usability issues.
- Consistent design patterns.

The future Flutter application should preserve Betik's identity while using mobile-appropriate UI conventions.

Do not treat the existing mobile-responsive website as automatically equivalent to an ideal native mobile interface.

---

## 10. Error and Edge-Case Investigation

Test realistic edge cases safely.

Examples:

- Empty forms.
- Invalid inputs.
- Duplicate actions.
- Missing required fields.
- Unauthorized navigation.
- Expired or invalid sessions where safely reproducible.
- Empty search results.
- Invalid routes.
- Deleted or unavailable content.
- Network errors where safely simulated.
- Long text.
- Special characters.
- Repeated navigation.
- Interrupted workflows.

Avoid unnecessary combinatorial explosion.

Prioritize cases that affect business behavior, user experience, or mobile compatibility.

Do not attempt destructive security testing, load testing, or attacks against the application.

---

## 11. Controlled State Changes

Runtime testing may create, update, or delete disposable data.

This is permitted only inside the verified isolated environment.

Before destructive actions:

- Confirm the target is disposable.
- Understand the expected impact.
- Avoid irreversible external effects.
- Prefer test-specific records.
- Record important state transitions.

For messaging, email, payments, or other externally visible actions, use local mocks or sandboxes.

Do not send real messages, emails, or payments to third parties.

If a feature cannot be tested without such an action, document the limitation and ask before proceeding.

---

## 12. Documentation Output

Create:

`mobile-docs/stage-2/`

Suggested structure:

```text
stage-2/
├── README.md
├── environment.md
├── coverage_matrix.md
├── user_journeys.md
├── navigation_and_roles.md
├── ui_patterns.md
├── reader_and_editor.md
├── validation_and_errors.md
├── mobile_behavior_notes.md
├── discrepancies_and_bugs.md
├── unresolved_scenarios.md
├── domains/
│   └── ...
└── screenshots/
    └── ...
```

Adapt this structure when useful.

Avoid unnecessary fragmentation.

### Coverage matrix

For each feature, record:

- Feature ID.
- Feature name.
- User role.
- Tested scenario.
- Verification status.
- Observed behavior.
- Evidence reference.
- Relevant limitations.

### User journeys

Document complete workflows with:

- Preconditions.
- Entry point.
- User actions.
- Intermediate states.
- Success outcome.
- Failure outcome.
- Navigation transitions.
- Relevant screenshots.

### Discrepancies

Clearly distinguish:

- Existing application bugs.
- Behavior that differs from Stage 1 expectations.
- Environment-related failures.
- Missing test data.
- Integration limitations.
- Unverified behavior.

Do not silently correct existing product behavior.

---

## 13. Progress and Coverage Management

This investigation may be extensive.

Work systematically.

Maintain a progress record so the investigation can continue across long sessions without losing completed work.

Prioritize:

1. Core user journeys.
2. All identified features.
3. Role-specific behavior.
4. Cross-feature workflows.
5. Micro-interactions.
6. Validation and edge cases.
7. Responsive and visual states.

Use Stage 1's coverage notes to identify features requiring additional attention.

Do not spend excessive time on backend implementation details unless needed to understand an observed behavior.

Do not repeatedly test the same scenario without a reason.

If time or environment limitations prevent full coverage, document exactly what remains.

Never fabricate successful tests.

---

## 14. Final Report

When the investigation is complete, provide:

1. A concise summary of the running application.
2. The isolated environment configuration.
3. The number of Stage 1 features verified, partially verified, blocked, failed, and not tested.
4. Newly discovered features.
5. Major user journeys successfully exercised.
6. Significant bugs or behavioral discrepancies.
7. Important mobile implementation considerations.
8. Visual evidence coverage.
9. Remaining inaccessible or untested scenarios.
10. An assessment of readiness for Stage 3.

Include the location of generated documentation.

Do not claim complete behavioral coverage unless the evidence supports it.

---

## 15. Stop Condition

After completing Stage 2:

**STOP.**

Do not:

- Modify the original React frontend.
- Modify the original Node.js backend.
- Change existing product flows.
- Implement Flutter.
- Begin Stage 3.
- Modify Stage 1 documentation.

Wait for explicit authorization.

---

## 16. Execution Instructions

1. Read this entire specification.
2. Read the relevant Stage 1 documentation.
3. Establish a safe isolated runtime environment.
4. Verify disposable database and service connections.
5. Start the application.
6. Verify seeded accounts.
7. Establish a browser automation workflow.
8. Systematically explore all user roles and features.
9. Capture visual and behavioral evidence.
10. Document complete user journeys and edge cases.
11. Reconcile observed behavior against Stage 1's feature inventory.
12. Verify coverage and record remaining gaps.
13. Present the final report and stop.

Work autonomously through routine technical decisions.

Ask only when a genuine blocker, unsafe operation, or significant product decision requires authorization.

**Your mission is to discover how Betik actually behaves so the future Flutter application can reproduce it faithfully, without modifying the existing product.**