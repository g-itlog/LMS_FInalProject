# Validation report

Verification date: **15 October 2026 (Asia/Singapore)**.

| Check | Result | Scope |
| --- | --- | --- |
| API, startup, and Vercel adapter tests | **30 passed** | Existing API/catalog/startup checks plus serverless initialization/reuse/retry, secure production-cookie auth, origin checks, and a 3 MB upload/download boundary |
| React production build | **Passed** | Vite compiles deployable assets in `client/dist` |
| Vercel configuration check | **Passed locally** | Repository-root config, API-first routing, shared function entry, output directory, and attachment limit; hosted deployment still requires a live smoke test |
| React lint | **Passed** | ESLint and React Hooks checks |
| Browser end-to-end tests | **5 passed** | Microsoft Edge; student/instructor workflows, catalog enrollment/download, keyboard navigation, and six workspace pages at 320px, 390px, 768px, and 1280px |
| Flutter analysis | **Passed — no issues** | Dart source and test analysis |
| Flutter tests | **15 passed** | API/security-storage tests, attachment upload/size checks, phone rendering, earliest-deadline navigation, and login/dashboard/course layouts at 320px with 1.3× text scaling |
| Flutter browser build | **Passed** | JavaScript web build with bundled rendering resources; student browser preview available on port 5174 |
| Flutter browser runtime | **Passed** | Actual browser rendering, real student login, Atlas dashboard access, and secure session restoration after reload |
| JavaScript dependency audits | **0 vulnerabilities** | Root tools, client, and server audited after compatible fixes |
| Live Atlas API verification | **Passed** | Database ping/index creation; non-overwriting demo seeding; real mobile student login, dashboard/course/catalog reads, server logout |
| Android application bundle compilation | **Blocked by environment** | Build attempted; Flutter reports Android SDK could not be found |
| Android APK/device execution | **Not verified** | Android SDK/emulator/device setup still required |
| iOS build/device execution | **Not verified** | Requires macOS, Xcode, and signing |

## API test coverage

1. Authentication required; malformed NoSQL-style login input rejected.
2. Registration normalizes email, hashes passwords, excludes credentials from response, sets HTTP-only cookie.
3. Duplicate account and weak password rejection.
4. Instructor invitation required; second instructor and independent student identities.
5. Students cannot create courses; instructors can.
6. Ownership, malformed IDs, foreign browser origins, and missing-origin cookie writes rejected.
7. Course search safely escapes regular-expression characters and returns pagination metadata.
8. Enrollment required for submissions; duplicate joins do not duplicate enrollment.
9. Materials upload/edit/download, unauthenticated and unenrolled file access, unsafe URLs, fake PDF signatures.
10. Announcement create/update and instructor ownership.
11. Text/file submissions, replacement before grading, password-free review responses, student work privacy.
12. Student/other-instructor grading rejected, excessive points rejected, zero grade accepted, feedback visible, graded work locked.
13. Late work rejected or accepted according to instructor policy.
14. Mobile instructor registration/login rejected; student bearer login, dashboard, logout, and revocation verified.
15. Profile role escalation prevented; password rotation revokes other sessions.
16. Material/announcement/assignment deletion; course archival hides all related learning access.
17. Browser logout revokes the session.

Three additional catalog tests verify all eight added courses through student bearer authentication, enrollment, private worksheet download, submission, and instructor grading; repeatable seeding that preserves edits/deadlines/grades/files; and protection for archived courses and courses belonging to another instructor.

Four startup tests verify recognition of a healthy LMS API and Vite frontend, rejection of an unrelated service on an occupied port, and detection of an available port. Manual runtime checks confirmed that repeated root/client development commands reuse the running LMS without starting duplicate processes. The updated API also connected to Atlas and reported the `classroom_lms` database through its startup log and health endpoint.

Five Vercel adapter tests verify configured/platform origins, shared cold/warm initialization, retry after failed initialization, database cleanup on app initialization failure, and real MongoDB-backed production-cookie registration, protected reads, rejected foreign-origin writes, logout, and revocation. A further workflow test accepts and downloads an attachment of exactly 3 MB, rejects oversized instructor/student uploads, and confirms rejected uploads leave no stored file.

## Browser test coverage

The student test signs in, navigates courses/materials, submits an assignment, views a grade, switches to phone dimensions, checks horizontal overflow, opens/closes navigation, updates a profile, and signs out. Browser JavaScript errors are collected and asserted absent.

The instructor test signs in, reviews and grades that student submission, creates/publishes a course, creates/edits/deletes a learning material, and deletes the course. Each test captures relevant screenshots using seeded demonstration data in an isolated database.

The catalog test verifies both pages of the 12-course catalog, searches for Python, joins the course, downloads its actual TXT worksheet, submits its assignment, and checks the catalog at phone width. The live Atlas catalog was also checked: all eight additions are published, all worksheet downloads succeed, and all pre-existing records were compared and confirmed unchanged.

Two responsive workspace tests cover both roles across overview, courses, assignments, grades, announcements, and profile at four widths. They verify bundled font loading, the closed drawer's inert state, focus on opening, Escape dismissal with focus restoration, and the student's next-assignment action. The narrow assignment and grade views use labeled cards rather than a table that requires horizontal scrolling. All five browser tests run through the shared serverless adapter against an isolated MongoDB database; the student workflow also checks the 3 MB validation before submitting work normally.

## Flutter test coverage

Six tests verify the student auth endpoint, bearer header, secure token persistence, rejection of an instructor response, expired-token clearing, auth form validation, multipart attachment upload from browser-provided bytes, and oversized-file rejection. Seven rendering/layout tests cover login, dashboard and bottom navigation, materials, assignment form, grade/feedback, profile, and a narrow 320px screen with 1.3× text scaling.

Two additional widget tests verify selection and navigation to the earliest unsubmitted future assignment, plus login, dashboard, and course-list rendering at 320px with 1.3× text scaling. Screenshots load the same bundled Public Sans and Lora fonts as the application.

Flutter screenshots are actual native widget renderer output generated by tests with demo-only fixtures read from the shared API. They are **not physical-device or emulator screenshots**. File picker integration, platform secure-storage plugins, external URL launch, and installed file-viewer behavior still need a device smoke test.

## Manual final demonstration checklist

1. Install Android SDK through Android Studio, review/accept its licenses, and connect a device/emulator.
2. Run the API, configure the Flutter API URL for that device, and build/run the app.
3. Sign in as the demo instructor on the web and demo student in Flutter.
4. Upload a real PDF in a course, download/open it from the phone, and verify its contents.
5. Create an assignment; attach a document using the phone file picker and submit it.
6. Grade that exact submission on the web; refresh the phone and verify grade and feedback.
7. Verify mobile instructor login is rejected, and a signed-out token no longer works.
8. Change placeholder institution/team information in Chapter 1 and the presentation.

## Reproducibility

Commands are documented in the root README. Test databases are temporary and never use `server/.env`/Atlas. The live verification used only seeded demo accounts and did not change existing template records. The source ZIP excludes secrets and runtime caches. Dependency audit results reflect the installed lockfiles on the verification date and should be rerun before deployment.
