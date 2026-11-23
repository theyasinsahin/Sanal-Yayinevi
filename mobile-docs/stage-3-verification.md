# Betik Flutter — Comprehensive Runtime Verification & Bug Fixing

## Mission

You are acting as a senior Flutter engineer, mobile QA automation engineer, and integration testing specialist.

The Betik Flutter mobile application has been implemented, but much of its functionality remains unverified.

**Your mission is to systematically execute the application, verify its functionality against the existing React website, identify and fix defects, and establish an evidence-based assessment of mobile readiness.**

This is a continuation of Stage 3, not a new application implementation or architecture redesign.

You are authorized to work autonomously until all achievable verification and necessary corrective work is complete.

Do not stop for routine approval.

---

## 1. Project Locations

Project root:

`/Users/fixie/Projects/Sanal-Yayinevi/`

Flutter application:

`/Users/fixie/Projects/Sanal-Yayinevi/Client/mobile/`

Original React application:

`/Users/fixie/Projects/Sanal-Yayinevi/Client/`

Original Node.js backend:

`/Users/fixie/Projects/Sanal-Yayinevi/Server/`

Documentation:

`/Users/fixie/Projects/Sanal-Yayinevi/mobile-docs/`

### Permitted project write locations

- `Client/mobile/` — Flutter implementation, tests, assets, and configurations.
- `mobile-docs/stage-3/` — verification records, screenshots, test evidence, and updated implementation documentation.

Existing Stage 1 and Stage 2 documentation must remain unchanged.

Temporary isolated runtime environments may be created outside the original project.

The existing React application and Node.js backend are strictly read-only.

Do not modify existing web application files, backend source, GraphQL schemas, database definitions, or repository-level configuration.

Do not commit or push changes.

---

## 2. Mandatory Context Review

Before testing, read the relevant existing documentation.

### Stage 1 — Technical reference

Use the Stage 1 documentation in `mobile-docs/` to understand:

- Backend GraphQL contracts.
- Authentication.
- Database and domain models.
- Business rules.
- Client-side calculations.
- Feature inventory.
- Reader/editor compatibility requirements.

Do not repeat the full repository investigation.

### Stage 2 — Behavioral reference

Read `mobile-docs/stage-2/`, particularly:

- `coverage_matrix.md`
- User journeys.
- Feature-specific behavior documents.
- Navigation and roles.
- UI patterns.
- Reader/editor behavior.
- Validation and error states.
- Screenshots.
- Known bugs and discrepancies.

Stage 2 is the main reference for what the website actually does.

### Stage 3 — Implementation reference

Read `mobile-docs/stage-3/`, especially:

- `README.md`
- `feature_parity_matrix.md`
- `implementation_progress.md`
- `testing_and_validation.md`
- `known_issues_and_blockers.md`
- `reader_editor_compatibility.md`
- `auth_and_platform_config.md`

Use the actual existing documentation filenames where they differ.

Inspect the current Flutter implementation and its tests.

**Do not trust implementation status as evidence of runtime correctness.**

---

## 3. Current Baseline

The previous Stage 3 report recorded:

### Implementation

171 tracked features:

- 167 implemented.
- 2 not started.
- 2 not applicable to native mobile.

### Verification of implemented features

- 30 verified.
- 56 partially verified.
- 79 not verified.
- 2 blocked by missing external credentials.

### Testing

- 157 unit/widget tests passing.
- 163 static GraphQL documents validated against the backend schema.
- 2 dynamically constructed GraphQL documents not statically validated.
- 10 live API tests passing.
- One iPhone 17 simulator end-to-end journey passing.
- Android debug build successful.
- iOS simulator and unsigned release builds successful.

### Major verification gaps

These include:

- Settings forms.
- Quote interactions.
- Writing sessions.
- Printed-book workflows.
- Print applications.
- Checkout.
- Administrative write operations.
- Native editor keyboard interactions.
- Touch text selection.
- Android runtime behavior.

These figures are your starting baseline, not a target to manipulate.

Your objective is to reduce the verification gap through genuine testing and corrective work.

---

## 4. Execution Strategy

Organize your work into logical verification batches.

Recommended sequence:

1. Runtime environment and device readiness.
2. Authentication and navigation.
3. Reading and discovery.
4. Authoring and native rich-text editing.
5. Social interactions and messaging.
6. Writing sessions and gamification.
7. Printed books and funding.
8. Publisher functionality.
9. Administration.
10. Settings and account lifecycle.
11. Cross-platform and visual verification.
12. Regression testing and final reporting.

Reorder these batches based on dependencies where appropriate.

### Autonomy

Proceed continuously between batches.

Do not request user approval after each batch.

Maintain reliable progress records so work can continue without repeating completed investigations.

If an individual feature is blocked by missing credentials or backend functionality, document it and continue with independent features.

Do not abandon the entire mission because one feature cannot be tested.

---

## 5. Runtime Environment

Reuse the Stage 2 isolated environment approach where practical.

Stage 2 successfully ran:

- Node.js 26.13.
- React frontend.
- Existing GraphQL backend.
- MongoDB replica set.
- Disposable seeded database.
- Local mail sink.
- Mock payment provider.
- Isolated upload handling.

Stage 2 setup instructions are in its documentation.

The original runtime processes were stopped after that stage.

Establish a fresh, safe test environment.

### Requirements

- Use disposable data.
- Keep the original application source untouched.
- Never connect to production or staging databases.
- Do not use production credentials.
- Do not use the repository's original `.env` containing possible live integration credentials.
- Keep payments sandbox-only.
- Avoid sending real emails or messages.
- Use local mocks for external communication where possible.
- Do not expose development services publicly.

Ensure the backend, mobile client, and device emulators can communicate reliably.

Account for Android emulator and iOS simulator networking differences.

If the backend binds to all interfaces, restrict network exposure through the surrounding test environment where feasible without modifying backend source.

Do not skip runtime testing merely because environment setup requires work.

---

## 6. Android and iOS Runtime Validation

**Both platforms must be tested.**

Previous work validated iOS runtime behavior but only compiled the Android application.

That is insufficient.

### Android

Establish a working Android emulator environment.

Run the actual Flutter application.

Verify:

- Startup.
- Authentication.
- Navigation.
- API connectivity.
- Screen rendering.
- Forms.
- Keyboard interactions.
- Scrolling.
- Dialogs.
- Back navigation.
- Rich-text editing.
- Important user journeys.
- Platform-specific functionality.

Investigate and fix Android-specific defects.

### iOS

Run the application on an available iOS simulator.

Expand validation beyond the previously tested journey.

Verify the same important behaviors, emphasizing:

- Navigation.
- Keyboard behavior.
- Text selection.
- Editor interactions.
- Modal presentation.
- Safe areas.
- File selection.
- Platform-specific functionality.

Use the documented `DEVELOPER_DIR` workaround if necessary rather than making unnecessary system-wide Xcode changes.

### Physical devices

If physical devices are unavailable, do not block all work.

Clearly distinguish emulator/simulator verification from physical-device verification.

Never claim physical-device testing unless it actually occurred.

---

## 7. Systematic Feature Verification

Use the existing Stage 3 feature parity matrix as the master checklist.

Every tracked feature must have an accurate final implementation status and verification status.

### Priority

First address:

1. The 79 implemented but unverified features.
2. The 56 partially verified features.
3. Previously verified features affected by code changes.
4. The remaining blocked and unimplemented functionality where feasible.

Do not blindly trust the 30 existing VERIFIED entries; review their evidence and retest when changes could affect them.

### For every feature

1. Locate the Flutter implementation.
2. Identify its expected behavior using Stage 1 and Stage 2 documentation.
3. Establish the necessary test account and initial data.
4. Navigate to the actual mobile screen.
5. Exercise the primary interaction.
6. Observe intermediate states.
7. Verify the result in the UI.
8. Verify backend effects where relevant.
9. Test meaningful validation and failure behavior.
10. Record the evidence and outcome.
11. Fix mobile implementation defects.
12. Rerun the affected scenario after correction.

Do not mark a feature VERIFIED based solely on code inspection, unit tests, compilation, or the presence of a working screen.

### Verification standards

Use:

**VERIFIED**

The relevant functional scenario was executed successfully, including meaningful backend effects where applicable.

**PARTIALLY VERIFIED**

Some meaningful functionality was exercised, but important paths remain untested.

**NOT VERIFIED**

Implementation exists, but no sufficient runtime evidence is available.

**FAILED**

The tested behavior did not meet the expected contract and remains broken.

**BLOCKED**

Verification requires an unavailable external prerequisite or an explicitly prohibited change.

Record which platform and environment produced the evidence.

Do not inflate VERIFIED counts by testing only a trivial part of a complex feature.

For complex features, maintain scenario-level results.

---

## 8. Test Real User Journeys

Individual screens are not enough.

Use the 15 documented Stage 2 journeys as a reference and reproduce them through Flutter wherever possible.

Prioritize complete workflows such as:

- Register → verify email → login → edit profile.
- Create book → write chapter → save → publish.
- Read chapter → bookmark → comment → quote.
- Follow user → approve request → message.
- Create or join writing session → post → interact.
- Submit printed-book application → review → approve.
- Start funding campaign → mock checkout → payment history.
- Publisher review and management.
- Administrator review and moderation.
- Change password/email → logout → log in again.

Verify state changes persist across screen navigation, refreshes, and app restarts where relevant.

Test different user roles.

Do not test privileged functionality using an account that bypasses the intended permission model.

Check that unauthorized users cannot perform restricted operations.

---

## 9. Native Editor and Reader — High Priority

These are especially important because the mobile implementation must remain compatible with the existing website.

### Native editor

Test with real device or simulator interactions, not only programmatic controller changes.

Exercise:

- Typing through the on-screen keyboard.
- Cursor movement.
- Text selection.
- Copy and paste.
- Bold, italic, headings, lists, and other supported formatting.
- Long text.
- Multiline content.
- Empty paragraphs.
- Undo/redo where supported.
- Embedded content.
- Saving.
- Reopening.
- Editing existing website-created chapters.
- Loading and editing Flutter-created chapters on the website where safe.

Ensure formatting is not unintentionally lost.

Test read-edit-save-read round trips.

Do not silently convert incompatible documents into destructive edits.

### Reader

Test:

- Chapter rendering.
- Chapter navigation.
- Paragraph comments.
- Bookmarks.
- Quote creation through actual text selection.
- Reading progress.
- Read/unread state.
- Scroll behavior.
- Long chapter rendering.
- HTML with headings, lists, quotes, and images.

### Paragraph indexing decision

**Preserve the actual React website algorithm.**

The reported implementation counts top-level `<p>` elements for paragraph numbering.

Verify this against the current source and existing compatibility fixtures.

If confirmed, preserve it exactly.

Do not change indexing to count every top-level HTML element merely because an earlier document described it differently.

Such a change could invalidate existing bookmarks and paragraph comments.

Record the verified contract accurately in Stage 3 documentation.

### Page counts

Retain the existing website's page-count algorithm.

Test edge cases against the original JavaScript implementation.

Do not substitute display-based pagination for backend-compatible page counts.

---

## 10. Settings, Administration, and Publisher Workflows

These areas received little or no runtime verification during Stage 3.

They must not be ignored simply because their screens already exist.

### Settings

Exercise all implemented account and preferences forms.

Verify:

- Loading existing values.
- Editing.
- Client validation.
- Backend validation.
- Successful updates.
- Error feedback.
- State persistence.
- Cancellation.
- Authentication-sensitive actions.

### Administration

Use an isolated administrator account.

Exercise relevant:

- Management screens.
- Approval and rejection actions.
- Revision requests.
- Moderation.
- Status transitions.
- Role changes where supported.
- Audit information.
- Forms and confirmation dialogs.

Use disposable records for destructive actions.

### Publisher

Test complete publisher journeys and state transitions, including relevant printed-book and approval workflows.

Verify both successful operations and relevant failure/permission cases.

---

## 11. Payments and External Services

Payment and external integrations require careful separation between testable behavior and unavailable credentials.

### Payments

Investigate how the existing Stage 2 sandbox implements mock checkout.

Attempt to verify the complete mobile payment journey using that existing mock infrastructure.

Test where feasible:

- Checkout initiation.
- Amount calculation in kuruş.
- Idempotency keys.
- Success.
- Failure.
- Retry.
- Cancellation.
- Payment history.
- Refund handling.
- Pending payment recovery.

**Never initiate real financial transactions.**

If the current Flutter payment flow cannot work with the existing mock environment, investigate whether the problem is in the mobile implementation or an actual integration limitation.

Fix mobile defects where possible.

Document genuine external integration blockers without inventing success.

### Google sign-in

Google sign-in remains in scope for Android and iOS.

However:

- Do not invent OAuth credentials.
- Do not bypass authentication.
- Do not modify the backend.
- Do not add Sign in with Apple to the backend without authorization.
- Do not silently remove the Google sign-in requirement.

Test what can be tested locally.

Document remaining platform configuration and App Store compliance concerns.

### Uploads

Test image selection, image preparation, and upload requests where possible using isolated configurations.

Do not send actual user files to production services.

Distinguish client-side upload defects from missing Cloudinary credentials.

### Other integrations

Verify external links, sharing, notification navigation, and email-dependent workflows wherever safe.

---

## 12. Visual and Interaction Verification

Stage 2 produced 211 screenshots across desktop, mobile, and tablet viewports.

Stage 3 produced 18 iOS simulator screenshots, only some of which were visually reviewed.

Use these existing materials.

### Requirements

- Inspect relevant Stage 2 screenshots.
- Capture updated Flutter screenshots.
- Compare corresponding screens directly.
- Evaluate navigation, visual hierarchy, typography, spacing, colors, and interaction states.
- Identify missing controls.
- Identify overflowing or clipped elements.
- Check safe areas.
- Check scrolling.
- Check keyboard obstruction.
- Check touch-target usability.
- Check long Turkish text and empty states.

Prioritize representative screens across all domains rather than producing hundreds of redundant images.

Save new evidence under:

`mobile-docs/stage-3/evidence/`

Use descriptive filenames and include platform/device information.

### Visual fidelity

The Flutter application should retain Betik's recognizable product identity while using suitable native mobile patterns.

Do not force pixel-perfect copies of desktop layouts.

Fix genuine mobile usability problems.

Avoid arbitrary redesigns.

A screen that looks good but has missing or nonfunctional controls is not complete.

---

## 13. Bug Fixing Rules

You are authorized to fix defects in the Flutter application.

When a test fails:

1. Reproduce the failure.
2. Identify whether the cause is Flutter, backend behavior, test data, or an external dependency.
3. Compare expected behavior against Stage 1/2 evidence.
4. Implement the smallest maintainable correction inside `Client/mobile/`.
5. Add or update relevant automated tests.
6. Rerun the failing scenario.
7. Check for related regressions.
8. Update the verification record.

Do not rewrite entire modules without a demonstrated need.

Do not perform sweeping architecture refactors during verification.

Do not modify backend behavior to make Flutter tests pass.

Do not weaken security or authorization.

Do not patch test fixtures to conceal actual mobile defects.

If a defect belongs to the original backend or website, record it clearly and preserve compatibility where possible.

### No fake fixes

Do not:

- Replace backend calls with hardcoded success results.
- Add static placeholder data to simulate functioning screens.
- Disable failing tests without justification.
- Suppress runtime errors.
- Remove features to make the verification matrix look better.
- Mark a failing feature as VERIFIED.

Correctness matters more than a perfect report.

---

## 14. Regression and Automated Testing

The current baseline contains 157 passing unit/widget tests.

Preserve existing working tests and extend coverage where useful.

Run:

- `dart format`
- `flutter analyze`
- `flutter test`
- Relevant integration tests.
- Android build verification.
- iOS build verification.

Perform these checks after meaningful groups of fixes and again before completion.

### GraphQL verification

The previous stage validated 163 static GraphQL documents and skipped two dynamically constructed ones.

Investigate the dynamic operations.

Validate their actual generated requests against the existing GraphQL schema where possible.

Do not modify backend schemas.

Test important request and response structures using the isolated backend.

### Test quality

Automated tests should verify meaningful behavior.

Avoid tests that merely assert a widget exists while ignoring whether its interactions work.

Use real GraphQL interactions when testing integration behavior.

Use mocks appropriately for isolated unit tests, but do not count mocked tests as proof of end-to-end backend compatibility.

---

## 15. Documentation and Evidence

Update the existing Stage 3 documentation.

Do not create a parallel, competing feature matrix.

The existing `feature_parity_matrix.md` remains the authoritative implementation and verification tracker.

For each verified scenario, record:

- Feature ID.
- Tested behavior.
- Platform.
- Test environment.
- User role.
- Initial conditions.
- Expected outcome.
- Actual outcome.
- Verification status.
- Evidence reference.
- Relevant bug or fix, if any.

Maintain a concise verification progress log.

Record important defects and corrective changes.

Update the existing Stage 3 documentation for:

- Reader/editor compatibility.
- Testing results.
- Platform readiness.
- Known issues.
- Remaining blockers.

Do not rewrite Stage 1 or Stage 2 documentation.

Do not create excessive reports when a focused update to an existing file is sufficient.

---

## 16. Progress and Coverage Discipline

Work autonomously through the feature inventory.

At the end of each logical batch:

1. Update verified and partial counts.
2. Record newly discovered defects.
3. Record fixes and regression results.
4. Identify remaining untested scenarios.
5. Continue to the next batch.

Do not repeatedly re-test already verified functionality without a reason.

Do not stop after verifying only the easiest screens.

Prioritize high-risk workflows, complex interactions, and previously unexecuted functionality.

Use browser/source inspection only to resolve uncertainties about expected behavior, not as a replacement for mobile runtime execution.

Do not waste time performing a second complete Stage 1 repository analysis.

---

## 17. Completion Criteria

The mission is complete when:

1. All reasonably testable features have been systematically exercised.
2. Previously unverified features have been tested or have a specific documented blocker.
3. Partial features have received meaningful additional verification.
4. Android runtime testing has been performed where tooling allows.
5. iOS runtime testing has been expanded.
6. Major user journeys have been exercised.
7. Reader and editor interactions have been tested on a simulator or device.
8. Significant Flutter defects have been fixed and retested.
9. Appropriate automated tests and build checks pass.
10. Visual comparisons have been performed.
11. The feature parity matrix accurately reflects runtime evidence.
12. Remaining blockers and release requirements are clearly documented.
13. Protected source files remain unchanged.

There is no requirement to manufacture 100% verification coverage.

A feature that genuinely requires external credentials, unsupported backend functionality, or unavailable hardware may remain BLOCKED with a clear explanation.

However, do not use missing credentials as an excuse to skip unrelated testable behavior.

Do not declare completion while significant feasible verification work remains untouched.

---

## 18. Final Report

When the verification pass is complete, provide:

### A. Verification results

A before-and-after comparison of:

- Verified.
- Partially verified.
- Not verified.
- Failed.
- Blocked.

Use the same feature counting rules as the existing matrix.

Explain any change in tracked feature totals.

### B. Platform validation

Report:

- Android runtime results.
- iOS runtime results.
- Emulator/simulator configurations.
- Build results.
- Physical-device testing, if actually performed.

### C. Bug fixes

Summarize:

- Defects discovered.
- Defects fixed.
- Important regressions resolved.
- Outstanding defects.

### D. Functional coverage

Report the status of:

- Authentication.
- Reading.
- Native editing.
- Writing and publishing.
- Social functionality.
- Messaging.
- Sessions.
- Gamification.
- Printed books.
- Funding and checkout.
- Publisher functionality.
- Administration.
- Settings.

### E. Compatibility

Report:

- GraphQL integration.
- HTML serialization.
- Paragraph indexing.
- Page-count logic.
- Authentication behavior.
- Real-time functionality.
- Payment integration.

### F. Remaining work

Distinguish:

- Missing external configuration.
- Backend limitations.
- Mobile implementation defects.
- Platform compliance issues.
- Untested physical-device behavior.
- Production deployment requirements.

### G. Repository safety

Confirm whether the original React frontend, Node.js backend, and Stage 1/2 documentation remain unchanged.

Do not claim a clean verification result without evidence.

---

## 19. Execution Authority and Stop Conditions

You have authorization to:

- Run and test the Flutter application.
- Run Android emulators and iOS simulators.
- Use disposable local backend infrastructure.
- Create test accounts and disposable data.
- Fix Flutter implementation defects.
- Add or update Flutter tests.
- Update Stage 3 documentation.
- Make routine technical decisions.

You do not have authorization to:

- Modify the React frontend.
- Modify the Node.js backend.
- Change original database schemas.
- Use production credentials.
- Execute real payments.
- Send real external communications.
- Alter Git history.
- Commit or push.
- Deploy to production.
- Publish the mobile application.
- Add new backend authentication capabilities.
- Make major unapproved product changes.

Continue autonomously until all achievable verification and corrective work is complete.

Request user intervention only when a genuine blocking decision is required.

For isolated blockers, document them and continue.

---

# FINAL DIRECTIVE

**The Flutter application has already been written. Your job is to prove that it works, discover where it does not, and fix those problems.**

Use:

- Stage 1 documentation for technical contracts.
- Stage 2 documentation for expected behavior and visual reference.
- Stage 3 documentation for implementation status and existing test evidence.
- The actual React website when behavior needs clarification.
- The existing Node.js GraphQL backend through an isolated runtime.
- Android and iOS simulators for real mobile verification.

Keep all changes inside the permitted directories.

Do not redesign or rewrite the application unnecessarily.

Do not confuse successful compilation with functional correctness.

Do not confuse a screen rendering with its feature working.

Do not inflate verification results.

Execute systematically, fix responsibly, verify thoroughly, and document accurately.

**We are no longer trying to build Betik. We are trying to establish that Betik Mobile actually works.**

Begin.