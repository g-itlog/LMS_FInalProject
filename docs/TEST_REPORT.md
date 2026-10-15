# Validation report

Verification date: **15 October 2026 (Asia/Singapore)**.

| Check | Result | Scope |
| --- | --- | --- |
| API, startup, provisioning, invitations, and Vercel adapter tests | **48 passed** | Original teaching workflows plus admin role isolation, secure provisioning, suspension/session revocation, history protection, publication, audit logs, and transactional single-use invitation lifecycle/migration/concurrency |
| React production build | **Passed** | Vite compiles deployable assets in client/dist |
| Vercel configuration check | **Passed locally** | Repository-root config, shared Express function, API-first routing, output directory, 3 MB limit |
| React lint | **Passed** | Source and test linting; generated Playwright reports are excluded |
| Web authentication validation unit tests | **5 passed** | Required fields, email rules, registration strength and UTF-8 limits, login compatibility, instructor-code presence |
| Browser end-to-end tests | **13 passed** | Real Edge workflows for admins, invitation codes, students, instructors, login/registration validation, publication, grading, uploads, keyboard controls, and phone layouts |
| Flutter tests | **21 passed** | Existing student/API/rendering tests plus live validation, password rules, mode reset, and narrow-phone large-text checks |
| Flutter analysis | **Passed ? no issues** | Latest student authentication source and tests |
| Flutter browser build | **Passed for current student source** | JavaScript browser preview; a browser build does not verify Android/iOS plugins |
| Hosted admin deployment | **Requires user deployment** | Updated source has not been pushed or deployed by the assistant; no production administrator was automatically created |
| Android APK/device execution | **Not verified** | Android SDK/emulator/device setup is still required |
| iOS build/device execution | **Not verified** | Requires macOS, Xcode, and signing |

## Server coverage

The original suites verify registration, bcrypt password hashing, JWT/session revocation, cookie security, CORS/origin checks, role checks, course ownership, enrollment, materials, file validation/download, assignment submissions, grading/feedback, announcements, profile/password updates, course archival, expanded catalog behavior, startup port detection, and Vercel function initialization/retry/reuse. Attachment boundary tests accept exactly 3 MB and reject oversized uploads without persisting them.

Eight admin API tests verify unauthenticated/non-admin denial, blocked public admin signup, blocked administrator mobile login/bearer access, actual overview counts, safe directory responses, student/instructor account creation, strict field validation, protection of administrator accounts, teaching-history role protection, immediate suspension of web/mobile sessions, reactivation, catalog publication, archived-course protection, and attributed activity logs without credentials.

The provisioning command is executed against an isolated database and private temporary credentials file. Its generated password signs in to the web admin API, is absent from command output, cannot authenticate through mobile, and is never overwritten. Reusing an existing email is rejected without modifying that account or retaining a failed credentials file.

Nine invitation tests verify admin-only access, secure generation and custom codes, multiple simultaneously active single-use codes, replacement/deactivation/reactivation before use, retained access for existing instructors, environment migration without resurrection, operation without the environment variable after migration, invalid/duplicate input handling, and activity-log secrecy. Successful registration removes the code from the unused list and deletes its plaintext value. Used receipts cannot be edited, reactivated, or recreated with the same value. A concurrent test using two different instructor emails proves only one account is created. A forced duplicate-email insertion inside the transaction proves failure rolls back code consumption and its audit event. Historical multi-use records with previous successful uses are retired on migration. These tests and the instructor registration/browser fixtures use isolated MongoDB replica sets, matching Atlas transaction support.

## Browser coverage

Five admin workflows cover all admin pages and profile at 1440px, 768px, 390px, and 320px; narrow account/course modals; user creation/editing/suspension/reactivation; protected administrator accounts; searchable logs; course inspection/publication; student route exclusion; invitation creation/copy/edit/deactivation/reactivation before use; successful instructor signup; disappearance from the unused list; read-only used history without code/copy/edit controls; and rejection of a second instructor using the consumed code.

Three authentication workflows verify immediate field errors, error correction, password checklist updates and UTF-8 boundaries, focus on the first invalid field, blocked invalid requests, ordinary credential checking, instructor-code behavior, and clearing fields on login/register navigation.

The five original workflows verify course catalog pagination/search/enrollment/download, student submissions and profile/logout, instructor grading and content CRUD, bundled fonts, mobile drawer keyboard/focus behavior, and the original workspace pages at phone/tablet/desktop widths. The browser test server uses a temporary MongoDB database. Its aggregate IP limit is raised only in that isolated test configuration because all simulated users share loopback; production retains 180 requests/minute and the sign-in limit remains enabled.

## Flutter coverage

Student-only API endpoints, bearer headers, secure token persistence, rejection of a non-student response, expired-token clearing, multipart uploads from bytes, oversized-file rejection, dashboard/course/material/submission/grade/profile rendering, deadline navigation, and narrow-phone large-text layouts are tested. The added authentication tests cover as-you-type errors, blank fields remaining quiet before interaction, password requirements and UTF-8 limits, a single show/hide control, blocked invalid submissions, server credential errors, successful student registration, and clearing credentials/errors on form changes.

Flutter screenshots are widget-renderer output with demo fixtures, not emulator or physical-device captures. Native file-picker, installed file-viewer, secure-storage, and device-download behavior still require an Android/iOS smoke test. No admin screens or admin role selection were added to Flutter.

## Before the final demonstration

1. Push the reviewed source and confirm the Vercel deployment succeeds.
2. Create a private administrator against the same Atlas database following ADMIN_GUIDE.md.
3. Sign in as admin on the website; create/copy an invitation and register a test instructor in a separate browser session.
4. Confirm the consumed invitation is absent from the unused list and a second signup with it fails. Create another unused code, deactivate it, and verify signup fails. Suspend/reactivate a test account and verify sign-in behavior.
5. Test course publication and inspect the corresponding admin activity records.
6. Verify the hosted health endpoint, student/instructor login, material upload/download, submission, and grading with local servers stopped.
7. Configure the Flutter API_BASE_URL to the deployed HTTPS /api URL and complete native device testing.
8. Replace bracketed institution/team details in Chapter 1 and the presentation before submission.

## Reproducibility

Use npm --prefix server test, npm --prefix client test, npm --prefix client run test:e2e, npm --prefix client run lint, npm run build, and flutter test --no-pub in mobile. API/browser tests use isolated databases; the new tests do not modify Atlas. Private provisioning credentials, environment files, dependencies, and caches are excluded from the source ZIP. Existing dependency audit results predate this admin addition; no new dependency was added by the admin implementation.
