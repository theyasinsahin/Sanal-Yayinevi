# Unresolved, inaccessible and untested scenarios

## Blocked by a missing prerequisite

| Scenario | Why | What would unblock it |
|---|---|---|
| Google sign-in / sign-up (F-AUTH-03) | No OAuth client in the sandbox; the root `.env` values were deliberately not used | A development Google client ID and approval to use it |
| Service worker and install prompt (F-NAV-09) | Dev server registers none | A production build served locally |
| Real Cloudinary upload, crop dialog, avatar and session-cover upload | Uploads were intercepted to keep data on the machine | A development Cloudinary preset and approval |
| iyzico sandbox checkout form | Mock provider used | iyzico sandbox keys |
| ISBN lookup success | Calls Open Library | Approval for that outbound request |
| Production error masking and rate-limit responses | `NODE_ENV=development`; limits not provoked on purpose | A production-mode run and a deliberate limit test |

## Not tested

| Feature | Scenario |
|---|---|
| F-FOLLOW-04 | Remove a follower |
| F-MSG-08 | Share a book or quote into a chat |
| F-MSG-09 | Attachment bubbles |
| F-FUND-08 | Legacy backers avatars (no data) |
| F-ADM-09 | Production tracking (needs a funded campaign) |

## Partly tested — what remains

| Area | Remaining |
|---|---|
| Registration | Message for a wrong code; visible result for an already used username/e-mail; resend after the countdown; "registration intent" replay after sign-up (F-AUTH-10) |
| Session lifecycle | Natural token expiry; logout on a second device |
| Notifications | Opening every notification type; effect of each notification preference |
| Feed | Cursor paging and "load more" with many books; tag filter; narrative-feature and audience filters; genre onboarding submit |
| Book card | Share from the card |
| Reader | Private and spoiler quotes, selection over 1000 characters, selection across formats/paragraphs, touch selection, copy protection (S-01), idle/background reading time, new-chapter notification for followed books |
| Editor | Rich paste, undo/redo, very large images, simultaneous editing in two tabs |
| Image upload | Everything after the file chooser |
| Sessions | Cover upload, reject/revoke of access, followers-only as follower, entry length limit |
| Profile | Avatar and username change, profile share dialog, unfollow, reject request |
| Messaging | Starting a chat from the search box, "followers only" audience, reconnect after network loss |
| Leaderboard | Period tabs with differing data; live score refresh on screen |
| Points | Each award rule in isolation, including the publish award |
| Printed books | Reject paths, editing/removing a rating, adding chapters to a claimed printed book |
| Funding | Application revision/reject/cancel, campaign close, goal reached, production and delivery states, partial failure cases, interest button confirmation, combined donation + copies |
| Admin | Stale-revision conflict, user role change, archive/restore of users and books, genre editing, tariff creation |
| Share | Profile dialog, native share sheet, story image download, opening external targets |
| Responsive | Tablet-specific layouts were captured but not reviewed screen by screen; landscape not captured |
| Accessibility | Keyboard order, screen-reader labels and contrast were not assessed |

## Open questions for the product owner

1. Should the app block copying in the reader? The website did not appear to (S-01).
2. Is changing the e-mail without verifying the new address intended (S-04)?
3. Should book authors or admins be able to remove comments from the book page (S-07)?
4. Is the always-request follow model intended for public profiles (S-03)?
5. Are admin, publisher and the print-application workspace in scope for mobile?
6. Is the dashboard access for non-owners (B-03) known?

## Data left in the sandbox

Two public digital books (one with an open sandbox campaign), two approved printed books, three sessions (one closed), comments, quotes, messages, notifications, one refunded and several failed/cancelled sandbox payments, one deleted and four seeded users. The seeded draft book was deleted during testing; `tools/seed.mjs` recreates it.
