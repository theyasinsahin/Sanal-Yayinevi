# Stage 1 — Complete Repository Forensics for Flutter Migration

## Mission

You are acting as a senior software architect, reverse engineer, and technical analyst.

We have an existing React web application backed by Node.js. Our objective is to build a separate Flutter mobile application for Android and iOS that reproduces the existing product's functionality while reusing the existing Node.js backend.

The migration consists of three independent stages:

1. **Repository Forensics (CURRENT):** Deeply inspect the existing codebase and document its architecture, APIs, database schemas, business logic, integrations, and functionality.
2. **Behavioral Reconnaissance:** Run the existing website in a controlled local environment and exhaustively explore its actual behavior and user flows.
3. **Flutter Implementation:** Create a new Flutter application in a separate directory, reusing the existing backend and preserving the existing product behavior.

Each stage requires explicit approval before proceeding to the next.

**Your assignment is Stage 1 only. Analysis and documentation. No implementation.**

---

## 1. Project Locations and Boundaries

Project root:

`/Users/fixie/Projects/Sanal-Yayinevi/`

Documentation directory:

`/Users/fixie/Projects/Sanal-Yayinevi/mobile-docs/`

All documentation generated during this stage MUST be written exclusively inside `mobile-docs/`.

The project already contains documentation. You may read existing documentation as reference material, but you must not modify, overwrite, rename, or delete it.

Before writing anything, inspect the existing `mobile-docs/` directory and avoid filename conflicts.

The React frontend and Node.js backend must remain completely untouched.

### Absolute protection rules

You MUST NOT:

- Modify, delete, rename, move, or format existing application files.
- Modify existing documentation, including files already inside `mobile-docs/`.
- Install, update, or remove dependencies inside the existing project.
- Modify configuration files, environment variables, or database schemas.
- Execute scripts that modify application state or databases.
- Run development servers or the website during Stage 1.
- Run builds, migrations, seeders, or other potentially mutating operations.
- Commit, push, reset, clean, or otherwise modify Git state.
- Create Flutter application code.
- Write files outside `mobile-docs/`.

You MAY:

- Read all relevant project source files.
- Inspect existing documentation.
- Inspect Git history and configuration through read-only operations.
- Examine package manifests, schemas, migrations, and tests.
- Use read-only source searches and static analysis.
- Create new Markdown documentation files inside `mobile-docs/`.

Do not assume a command is safe simply because it appears to be an inspection command. Consider its possible side effects.

If an operation might modify protected files, do not execute it.

### Autonomy

You may independently choose:

- Analysis techniques.
- Investigation order.
- Documentation organization.
- Cross-reference conventions.
- Technical recommendations.

Do not interrupt for routine decisions.

Stop and ask only when:

- A required action risks modifying protected files.
- A critical ambiguity cannot be resolved through further inspection.
- Essential information is inaccessible.
- A destructive operation appears necessary.
- A major blocker prevents meaningful progress.

Document ordinary uncertainties and continue investigating.

---

## 2. Repository Discovery

Begin by inspecting the entire project structure.

Do not assume the frontend and backend are organized conventionally.

Identify:

- Repository roots and directory hierarchy.
- Frontend and backend locations.
- Monorepo or multi-repository organization.
- Frameworks and runtime versions.
- Package managers and dependency manifests.
- Application entry points.
- Configuration and environment variable requirements.
- Development, build, testing, and deployment architecture.
- External services and integrations.
- Shared utilities and libraries.
- Existing documentation and tests.
- Generated, legacy, unused, and experimental code.

Distinguish active application code from unrelated or obsolete code where evidence permits.

Document how the system is organized and how its major components interact.

Do not spend excessive time analyzing irrelevant generated files, dependencies, or superficial coding-style details.

---

## 3. Node.js Backend Analysis

This section is particularly important because the Flutter application must reuse the existing backend without modifying it.

### 3.1 API inventory

Discover and document every identifiable API endpoint.

For each endpoint, extract:

- HTTP method and route.
- Route parameters and query parameters.
- Request body structure.
- Request headers and content types.
- Authentication requirements.
- Authorization and role restrictions.
- Validation rules.
- Response structure.
- HTTP status codes.
- Error responses.
- Pagination, filtering, sorting, and searching behavior.
- File upload or download behavior.
- Relevant controller and service implementations.

Document WebSocket, SSE, and other real-time communication mechanisms separately where appropriate.

Include API versioning, middleware behavior, and compatibility assumptions.

Provide request and response examples only when they can be grounded in source code.

Do not invent endpoint behavior.

### 3.2 Business logic

Inspect:

- Controllers and services.
- Domain rules.
- Calculations and transformations.
- State transitions.
- Permissions and role-dependent behavior.
- Background jobs and scheduled tasks.
- Transactions and consistency requirements.
- External API integrations.
- Server-side validation.
- Error handling.
- Important side effects.

Trace meaningful operations across the backend layers.

Identify logic that the Flutter application must understand or respect.

### 3.3 Database architecture

Determine the actual database technology and persistence mechanisms.

Extract:

- Schemas, tables, and collections.
- Fields and data types.
- Primary and foreign keys.
- Relationships and cardinality.
- Indexes.
- Unique constraints.
- Enumerations.
- Default values.
- Relevant migrations.
- ORM or query-layer behavior.
- Important data lifecycle rules.

Where useful, document entity relationships and domain mappings.

Use source-defined schemas and migrations as evidence. Do not assume the live database exactly matches them.

Do not access production data or perform database writes.

### 3.4 Authentication and security

Analyze:

- Login and registration.
- Session management.
- Token creation and validation.
- Token refresh and expiration.
- Logout behavior.
- Password reset and account recovery.
- Authorization checks.
- Role and permission handling.
- Cookie-based authentication.
- CORS and CSRF dependencies.
- Browser-specific security assumptions.
- Storage and transmission of sensitive information.

Identify anything that might prevent Flutter from safely communicating with the existing backend.

Do not recommend weakening security controls to make mobile integration easier.

---

## 4. React Frontend Analysis

Inspect the complete React application.

### 4.1 Application architecture

Identify:

- Routing architecture.
- Pages and screens.
- Layouts.
- Navigation patterns.
- Reusable components.
- State management.
- Context providers and hooks.
- Forms.
- Client-side validation.
- API clients and request handling.
- Loading states.
- Error states.
- Empty states.
- Internationalization.
- Responsive behavior.
- Browser storage usage.

Document the relationships between major frontend modules.

### 4.2 Complete feature inventory

Discover every identifiable user-facing feature.

Do not restrict the analysis to major pages.

Include small interactions and less obvious functionality such as:

- Conditional buttons.
- Dropdown menus.
- Modals and dialogs.
- Confirmation prompts.
- Search and filtering.
- Sorting and pagination.
- Form validation.
- Keyboard interactions.
- Notifications.
- File uploads.
- Download actions.
- Role-specific UI.
- Hidden or conditional sections.
- Error and retry actions.
- Navigation shortcuts.
- Dynamic content updates.

For each feature, document:

1. A stable feature identifier.
2. Feature name and purpose.
3. Entry point.
4. Relevant page or component.
5. User inputs.
6. Business rules.
7. API dependencies.
8. State changes.
9. Validation requirements.
10. Success behavior.
11. Failure behavior.
12. Permission requirements.
13. Relevant source files.
14. Any uncertainty requiring runtime verification.

This inventory will become the foundation of Stage 2 behavioral testing and Stage 3 Flutter implementation tracking.

Do not claim runtime behavior has been verified through static inspection.

### 4.3 Frontend/backend responsibility mapping

For every significant feature, identify whether its logic is:

- Entirely frontend-side.
- Entirely backend-side.
- Shared across both.
- Dependent on browser APIs.
- Dependent on external services.

Pay special attention to functionality implemented in React that Flutter will need to reproduce independently.

---

## 5. End-to-End Code Tracing

Do not stop at route lists or component names.

Trace significant user operations through the actual implementation.

Example:

React UI → event handler → frontend service → HTTP request → backend route → controller → business service → database operation → API response → UI update.

For each significant feature, establish this chain wherever source evidence permits.

Identify:

- Where input validation occurs.
- Where business rules are enforced.
- Where state changes happen.
- Which components depend on the results.
- How errors propagate.
- Which assumptions are implicit.

If a chain cannot be fully traced, document the missing link.

---

## 6. Flutter Compatibility Assessment

Evaluate the existing system from the perspective of a future Flutter application targeting Android and iOS.

The mobile application must reuse the existing Node.js backend.

Identify:

- APIs directly reusable by Flutter.
- Browser-specific dependencies.
- Authentication compatibility issues.
- Session and token storage requirements.
- Cookie-related limitations.
- Browser storage dependencies.
- File and media handling requirements.
- Real-time communication requirements.
- Deep linking considerations.
- Platform permissions.
- Device-specific integration needs.
- Potential API limitations.
- Features that cannot be faithfully reproduced without backend changes.

You may propose Flutter-native implementation approaches.

However:

- Do not implement them.
- Do not redesign existing business flows.
- Do not change backend contracts.
- Do not silently substitute different product behavior.
- Do not assume a browser-based interaction must be copied visually when a native equivalent preserves its functionality.

The objective is functional and behavioral fidelity, not a mechanical translation of React components into Dart.

If an existing feature appears impossible to reproduce under the backend constraints, document the blocker clearly.

---

## 7. Evidence and Traceability

Every important technical finding must be traceable to the repository.

Reference:

- Relative source file paths.
- Relevant functions or classes.
- Components.
- Route definitions.
- Database schema definitions.
- Line numbers where useful and reasonably stable.

Use these classifications:

**VERIFIED:** Directly established by repository evidence.

**INFERRED:** Strongly suggested by available evidence but not conclusively established.

**UNKNOWN:** Cannot be determined from available evidence.

Never present inferred or unknown behavior as verified.

If documentation and implementation disagree, prioritize the actual source code and record the discrepancy.

Do not copy secrets, credentials, private keys, access tokens, or real user data into the reports.

Configuration variable names and their purposes may be documented without exposing their values.

---

## 8. Documentation Structure

Write all generated documentation inside:

`/Users/fixie/Projects/Sanal-Yayinevi/mobile-docs/`

Use Markdown.

Prefer focused documents over one enormous report.

Suggested organization:

```text
mobile-docs/
├── stage-1-repository-forensics.md
├── README.md
├── 01_repository_overview.md
├── 02_system_architecture.md
├── 03_backend_api.md
├── 04_database_schema.md
├── 05_authentication_security.md
├── 06_frontend_architecture.md
├── 07_feature_inventory.md
├── 08_business_rules.md
├── 09_integrations_realtime.md
├── 10_mobile_compatibility.md
├── 11_unknowns_and_risks.md
└── references/
```

This is a suggested structure, not a rigid requirement.

The existing prompt file and any other existing files must remain untouched.

Inspect the directory first and choose nonconflicting filenames. If `README.md` or another suggested filename already exists, preserve it and create an appropriately named alternative.

Split unusually large documents by domain when useful.

Avoid duplicated content. Cross-reference related documents.

### Documentation quality requirements

**API inventory:** Provide endpoint-level details, contracts, authentication requirements, and source references.

**Database:** Document schemas, relationships, constraints, and relevant domain mappings.

**Feature inventory:** Use stable identifiers suitable for tracking runtime verification and Flutter implementation coverage.

**Business rules:** Distinguish backend-enforced rules from frontend-only behavior.

**Mobile compatibility:** Distinguish confirmed limitations from possible concerns.

**Unknowns:** Record unresolved questions, impact, and the evidence needed to resolve them.

Documentation should be detailed enough that another engineer unfamiliar with the project can understand the existing system and plan the Flutter implementation.

---

## 9. Completeness and Coverage

This must be a thorough repository investigation, not a superficial overview.

Inspect all relevant application-owned source code.

Use a systematic coverage checklist to avoid overlooking modules, components, endpoints, or database entities.

For large repositories:

- Work in logical batches.
- Maintain progress in newly created documentation files.
- Continue systematically across modules.
- Track inspected and uninspected areas.
- Avoid repeating completed investigations unnecessarily.

Do not sacrifice correctness for speed.

Do not spend excessive effort on irrelevant generated files or third-party dependency internals.

Do not declare completion while important application areas remain uninspected.

If an area cannot be inspected, report the coverage gap explicitly.

### Stage 2 preparation

As part of the findings, identify:

- Features requiring runtime verification.
- User roles and permissions that should be tested.
- Important state transitions.
- Forms and validation scenarios.
- Error and edge cases.
- Local runtime prerequisites.
- External dependencies.
- Potentially destructive user actions that Stage 2 must isolate.

Do not run any of these tests during Stage 1.

---

## 10. Final Deliverables

When the analysis is complete, provide a final report containing:

1. A concise executive summary of the existing system.
2. The generated documentation structure.
3. The discovered frontend and backend architecture.
4. The database technology and main entities.
5. The number of discovered API endpoints.
6. The number of identified features.
7. The number of database entities, using a clear counting definition.
8. Important architectural and mobile compatibility risks.
9. Unresolved questions and blockers.
10. An explicit coverage assessment.
11. A readiness assessment for Stage 2.

Counts must be based on documented findings, not guesses.

If any significant area remains uninspected, clearly state what remains and why.

---

## 11. Stop Condition

After completing Stage 1:

**STOP.**

Do not:

- Run the website.
- Start a development server.
- Modify the React frontend.
- Modify the Node.js backend.
- Modify existing documentation.
- Create the Flutter application.
- Begin Stage 2.
- Begin Stage 3.

Wait for explicit authorization before proceeding.

---

## 12. Execution Instructions

Begin by:

1. Reading this entire specification.
2. Inspecting the project structure.
3. Identifying the React frontend and Node.js backend boundaries.
4. Inspecting existing documentation.
5. Verifying the permitted `mobile-docs/` output location.
6. Establishing a systematic analysis and coverage plan.
7. Performing the full repository investigation.
8. Producing the required documentation.
9. Verifying coverage and completeness.
10. Presenting the final summary and stopping.

Work autonomously through routine technical decisions.

Investigate deeply, document accurately, and preserve the existing application completely.

**Your objective is to create an exhaustive, evidence-based technical map of the existing system that can serve as the foundation for a faithful Flutter implementation.**