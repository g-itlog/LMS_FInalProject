# Validation report

Verification date: **16 October 2026 (Asia/Singapore)**. The latest checks include explicit login after OTP registration on web and student Flutter. Native-testing limitations remain explicit.

| Check | Result | Scope |
| --- | --- | --- |
| API, startup, provisioning, invitations, analytics, and Vercel adapter tests | **90 passed** | Original workflows plus loopback student-bearer CORS, registration without sessions, explicit password login, admin permissions, provisioning, suspension, history protection, publication, audit logs, single-use invitations, report calculations/exports, and Vercel rewrite query normalization |
| React production build | **Passed** | Vite compiles deployable assets in client/dist |
| Vercel configuration check | **Passed locally** | Repository-root config, shared Express function, API-first routing, output directory, 3 MB limit |
| React lint | **Passed** | Source and test linting; generated Playwright reports are excluded |
| Web authentication validation unit tests | **5 passed** | Required fields, email rules, registration strength and UTF-8 limits, login compatibility, instructor-code presence |
| Browser end-to-end tests | **21 passed** | Real Edge workflows for admins, reports/charts/CSV downloads, invitations, students, instructors, validation, publication, grading, uploads, keyboard controls, and phone layouts |
| Flutter tests | **31 passed** | Existing student/API/rendering tests plus registration returning to login, token non-persistence, live validation, password rules, mode reset, and narrow-phone large-text checks |
| Flutter analysis | **Passed ? no issues** | Latest student learning/authentication source and tests |
| Flutter browser build | **Passed with deployed API default** | Current JavaScript browser build, analysis, and 31 widget/API tests passed. Optional WebAssembly dry run remains incompatible with secure-storage web dependencies; no WebAssembly or Android/iOS build is claimed |
| Hosted feature deployment | **Requires user deployment** | The expanded web/backend/Flutter source is verified locally; this update has not been pushed or deployed by the assistant. Email verification/recovery additionally requires private SMTP settings and a real inbox delivery check |
| Android APK/device execution | **Not verified** | Android SDK/emulator/device setup is still required |
| iOS build/device execution | **Not verified** | Requires macOS, Xcode, and signing |

## Dashboard layout verification

The latest dashboard layout uses the full course-column width for a single course, with a horizontal course card on larger screens and a stacked card on phones. The review banner is more compact; the heading action, notice board, and teaching tools use consistent alignment and spacing. Styles are scoped to the learning dashboard.

React lint, production build, and Vercel configuration checks passed. Six targeted Edge workflows passed: the new sparse instructor dashboard case plus all five existing student/instructor workflows. The single-course regression checks 320, 390, 768, 1024, 1440, 1920, and 2160px widths for full-width course cards and no horizontal overflow. Desktop and phone screenshots were inspected. The prior 21-test browser suite result above predates this new layout case; no full 22-test rerun is claimed. The update remains local until pushed/deployed.

## Flutter inbox and deadline-extension connection

Plain flutter run previously selected localhost:8000 for browser requests. The running local service returned an older health response and the reported inbox/extension requests returned API endpoint not found. Flutter now defaults on all platforms to https://lmsfinalproject-seven.vercel.app/api; local development remains available through an explicit API_BASE_URL override.

The deployed service's preflight probe also rejected localhost:5174. The updated middleware permits the fixed localhost/127.0.0.1 port 5174 preview origins only for mobile-authentication requests and Authorization-based requests/preflights. It grants no cookie credentials to otherwise unconfigured origins. The new integration case verifies preview login, inbox and extension GETs, mark-all-read shared with student web, unauthenticated denial, blocked web-auth preflights, and absent CORS grants for unrelated origins. Full backend results: 90 passed. Flutter analysis, 31 tests, and JavaScript web compilation passed. This middleware update must be pushed/deployed before hosted preview use; no production deployment was performed. The prior 21 browser workflows passed during registration verification.

## Registration requires explicit login

After OTP verification and successful account creation, students/instructors on web and students in Flutter return to login with the registered email prefilled, a blank password, and a success message. The API creates no registration session or cookie and returns no bearer token. Tests verify unauthenticated dashboard denial, incorrect-password rejection, and successful explicit login. Flutter also ignores a legacy registration token rather than persisting it. Instructor invitations are still consumed atomically on account creation.

The browser suite also verifies opening Forgot password immediately after registration. Focusing an untouched blank password no longer inserts a validation error when leaving the field, which previously moved the recovery link during a click. Edited fields still validate as typed; untouched required fields validate on submit. SMTP inbox delivery and hosted deployment remain separate acceptance checks.

## Server coverage

The original suites verify registration, bcrypt password hashing, JWT/session revocation, cookie security, CORS/origin checks, role checks, course ownership, enrollment, materials, file validation/download, assignment submissions, grading/feedback, announcements, profile/password updates, course archival, expanded catalog behavior, startup port detection, and Vercel function initialization/retry/reuse. Attachment boundary tests accept exactly 3 MB and reject oversized uploads without persisting them.

Three additional Vercel regression tests cover the catch-all rewrite parameter `path` in both the request URL and the platform's pre-parsed query object. The function adapter removes only this reserved query parameter when running on Vercel; search, pagination, role/status filters, repeated values, and other parameters remain intact. Ordinary Node requests are unchanged. Real database integration checks Users, Courses, Activity, and Invitations with injected routing metadata, verifies filters, and confirms that unknown query/body fields, invalid pagination, unauthenticated access, and non-admin access are still rejected.

Eight admin API tests verify unauthenticated/non-admin denial, blocked public admin signup, blocked administrator mobile login/bearer access, actual overview counts, safe directory responses, student/instructor account creation, strict field validation, protection of administrator accounts, teaching-history role protection, immediate suspension of web/mobile sessions, reactivation, catalog publication, archived-course protection, and attributed activity logs without credentials.

The provisioning command is executed against an isolated database and private temporary credentials file. Its generated password signs in to the web admin API, is absent from command output, cannot authenticate through mobile, and is never overwritten. Reusing an existing email is rejected without modifying that account or retaining a failed credentials file.

Nine invitation tests verify admin-only access, secure generation and custom codes, multiple simultaneously active single-use codes, replacement/deactivation/reactivation before use, retained access for existing instructors, environment migration without resurrection, operation without the environment variable after migration, invalid/duplicate input handling, and activity-log secrecy. Successful registration removes the code from the unused list and deletes its plaintext value. Used receipts cannot be edited, reactivated, or recreated with the same value. A concurrent test using two different instructor emails proves only one account is created. A forced duplicate-email insertion inside the transaction proves failure rolls back code consumption and its audit event. Historical multi-use records with previous successful uses are retired on migration. These tests and the instructor registration/browser fixtures use isolated MongoDB replica sets, matching Atlas transaction support.

## Browser coverage

Seven analytics API/calculation tests verify Philippine midnight boundaries, inclusive end dates, zero-filled dates, zero grades, weighted rather than simple-average scores, archived-course exclusion, unpublished-course inclusion, current enrollment counts versus period activity, resubmission semantics, missing assessment totals, search/pagination independence, complete CSV exports, spreadsheet-formula escaping, strict query validation, and admin-only access. No personal account fields are exposed in report output.

Two added browser workflows verify the new report page, preset/custom dates, exact chart values against the API, keyboard date selection, course search without losing focus, course/daily CSV contents, empty periods, invalid range errors, API-error retry, and failed CSV messages followed by successful download retry. The responsive admin workflow also covers Reports at 1440px, 768px, 390px, and 320px and records desktop/phone screenshots. Student navigation excludes reports and rejects direct access to the report route.

Five admin workflows cover all admin pages and profile at 1440px, 768px, 390px, and 320px; narrow account/course modals; user creation/editing/suspension/reactivation; protected administrator accounts; searchable logs; course inspection/publication; student route exclusion; invitation creation/copy/edit/deactivation/reactivation before use; successful instructor signup; disappearance from the unused list; read-only used history without code/copy/edit controls; and rejection of a second instructor using the consumed code.

Three authentication workflows verify immediate field errors, error correction, password checklist updates and UTF-8 boundaries, focus on the first invalid field, blocked invalid requests, ordinary credential checking, instructor-code behavior, and clearing fields on login/register navigation.

The five original workflows verify course catalog pagination/search/enrollment/download, student submissions and profile/logout, instructor grading and content CRUD, bundled fonts, mobile drawer keyboard/focus behavior, and the original workspace pages at phone/tablet/desktop widths. The browser test server uses a temporary MongoDB database and simulates Vercel's injected `path` query parameter on every API request. The fixture disables secure cookies only for its loopback HTTP transport; production retains secure cookies. Its aggregate IP limit is raised only in that isolated test configuration because all simulated users share loopback; production retains 180 requests/minute and the sign-in limit remains enabled.

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

## Learning feature expansion verification

Eight isolated replica-set API tests cover quiz ownership/enrollment/role checks, private answer keys, forged-score rejection, exact answer validation, concurrent attempts across web cookies and mobile bearer tokens, zero and weighted scores, locked questions, revisions, closing dates, after-close review, best scores, shared completion marks, assignment participation, inbox audience restrictions, changed announcements/deadlines, read-state synchronization, notification pagination, school message deletion, enrollment monitoring, course metadata validation/archive/restore, learning analytics, and attributed logs without credentials or answer keys. Repeated quiz attempts and completion requests do not inflate progress.

Two additional Edge workflows exercise instructor quiz creation/question editing, student taking/scoring/permitted review at 320px, lecture completion, instructor results/progress, targeted school announcements, durable inbox read state, enrollment search, admin course edits, and new administration pages at 1440/768/390/320px. New screenshots show student quiz/progress, instructor progress, and enrollment monitoring. All 19 browser workflows pass together against the Vercel rewrite fixture.

Four new Flutter tests exercise actual HTTP-client serialization of selected answers and revision, score and permitted-review rendering, restricted answer review, lecture completion and undo with progress refresh, inbox read state, and failed-inbox retry at 320px. All 30 Flutter tests pass. Flutter analysis is clean; the JavaScript browser build succeeds with the deployed HTTPS API base configured. The installed secure-storage plugin produces a WebAssembly compatibility warning during the optional dry run; no WebAssembly target is claimed. No Android/iOS device run is claimed.

See [LEARNING_GUIDE.md](LEARNING_GUIDE.md) for exact student parity, progress definitions, notification behavior, and manual cross-device acceptance checks.

## SMTP OTP and recovery verification

Twelve added backend tests cover strict email/purpose/code inputs, mandatory registration proof, 10-minute expiry, keyed code storage, five-guess lockout, resends and persistent rate limits, wrong-purpose/email grants, one-time and concurrent verification, delivery failures without credential exposure, transactional instructor invitations, generic reset responses, student-only mobile eligibility, strong passwords, reset replay/concurrency, session revocation, and invalidation after admin email changes. Existing registration fixtures seed verified grants; the dedicated suite exercises request/verify/consume endpoints with fake mail delivery.

Two additional Edge flows verify code-gated account creation, wrong/short codes, resend cooldown, forgot-password navigation, code verification before new-password entry, live password/confirmation validation, old-password rejection and new-password login at phone width. Existing instructor invitation browser tests now complete email verification first. Two added Flutter tests verify OTP errors/resend timing and the complete student recovery form; existing registration tests exercise request/verify/register sequencing. A test clock controls only the UI resend timer; the backend enforces actual expiry/cooldown independently.

Latest rerun on 16 October 2026: 88 server tests, 30 Flutter tests, and 5 React validation tests passed. All 21 browser scenarios passed across the initial run and one targeted rerun: the first admin layout check encountered a missing dist/index.html while a concurrent production build replaced that directory; it passed after the build finished. Run builds before browser tests. Web lint/build, Vercel configuration checks, and Flutter analysis passed. Flutter browser compilation had passed in the preceding feature verification; it was not repeated for the private SMTP configuration change.

Brevo SMTP connection, TLS, and authentication passed using the private local configuration. This check sent no email and does not verify the sender or inbox delivery. Actual registration/recovery emails, Vercel environment setup/redeployment, and native Android/iOS execution still require acceptance checks. Existing account/database passwords were not changed, and this update has not been pushed/deployed. Follow EMAIL_SETUP.md for provider and hosted inbox acceptance checks.

## Deadline extension verification

Ten new isolated replica-set API tests verify strict reason/date/body validation, student enrollment and course ownership, one pending request under concurrent web/mobile submissions, original/current/requested deadline snapshots, instructor-only pending notices, rejection comments and unchanged deadlines, one-student approval without changing classmates, dashboard/course/mobile effective deadline parity, actual text/file upload under the approved deadline, late classification and submission-time deadline snapshots, whole-class approval for current/future enrollments, protection of longer individual grants, privacy of reasons/comments, competing decisions, graded-work locking, stale requests, status filtering/history pagination, assignment cleanup, archival access denial, and audit privacy.

Two new Edge workflows verify a 320px request/history dialog, invalid reasons, instructor inbox links, rejection comments, subsequent individual approval and submission reopening, explicit whole-class confirmation, and a second student receiving the class deadline without private request details. Three new Flutter tests verify reason/date validation, native date/time picker selection and UTC serialization, pending/rejected history with comments, and refreshing an approved individual deadline when returning to the submission form.

The complete suite passes: 88 backend tests, 21 browser workflows, 30 Flutter tests and 5 React validation tests. Web production build/lint, Flutter analysis and JavaScript browser compilation pass. Screenshots and source/documentation packages are refreshed. No production learning records were modified and no commit/push/deployment was performed. Android/iOS physical-device verification remains unclaimed. See DEADLINE_EXTENSIONS.md for user instructions and manual acceptance checks.
