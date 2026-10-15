# Classroom LMS

A learning management system for students and instructors, built with **MongoDB, Express, React, and Node.js**, plus a **Flutter student app**. The web and mobile apps use the same backend and records.

Source repository: [g-itlog/LMS_FInalProject](https://github.com/g-itlog/LMS_FInalProject). See [GitHub and deployment notes](docs/GITHUB_AND_DEPLOYMENT.md) before importing the project into Vercel, including API routing, private environment variables, and the attachment-size limit.

## Project folders

| Folder | Purpose |
| --- | --- |
| `client` | React, React Router, hooks, Axios, Bootstrap, responsive web interface |
| `server` | Express REST API, MongoDB driver, GridFS uploads, JWT sessions and validation |
| `server/scripts` | Shared development launcher, database seeding, test server, documentation builders, and source packager |
| `mobile` | Flutter Android/iOS student application |
| `docs` | Chapter 1, system flowchart, feature mapping, testing evidence, screenshots, presentation |
| `backup/original-template.zip` | Original unused source, preserved locally and excluded from submission/Git |

## Start the web application

Requirements: Node.js 22.20+ and a reachable MongoDB instance or Atlas cluster.

```powershell
npm run setup
```

The local `server/.env` has already been configured. On another machine, copy `server/.env.example` to `server/.env`, enter your database URI, set a random `JWT_SECRET` of at least 32 characters, and set a private `INSTRUCTOR_INVITE_CODE`. Never put database credentials in the client or Flutter app.

```powershell
npm run dev
```

Open **http://localhost:5173**. The API listens on port **8000**. Vite proxies `/api` to Express. Two separate terminals can also run `npm run dev` inside `server` and `client`.

To start only the backend from the `server` folder, run `npm run server`, `npm start`, or `node server.js`. From the project root, `npm run server` also starts only the backend. Run one backend instance at a time; `npm run dev` from the root already starts it.

All project helper scripts live in `server/scripts`. From inside `server`, `npm run dev:all` starts both the API and web client; `npm run dev` starts only the API with file watching. From the project root, `npm run dev` still starts both.

For a production-style local run:

```powershell
npm run build
npm start
```

Open **http://localhost:8000**. Express serves both the built React app and API. For a deployed HTTPS server set `NODE_ENV=production`, configure `CLIENT_ORIGINS` with the exact public origin, and configure trusted proxy settings only for your deployment. Browser and API should share one origin. HTTPS is required for production cookies and mobile traffic.

## Demonstration accounts

Demo data is seeded into the separate `classroom_lms` database. Existing template databases are untouched. The new application uses collections prefixed with `lms_`.

- Instructor: `instructor@classroom.test`
- Student: `student@classroom.test`
- The generated demo password and instructor invitation code are in **`server/.local-credentials.txt`**. This private local file is ignored by Git; **exclude it and `.env` from submissions**.

`npm run seed` adds missing sample data without changing existing passwords or overwriting course content. `DEMO_PASSWORD` is required in `server/.env` when seeding. Demo accounts are for local presentations; remove or disable them before public use.

The sample catalog has 12 courses. Eight additional courses cover Python foundations, responsive HTML/CSS, JavaScript, data structures, cybersecurity, software testing, Git, and containers. Each includes an official reading link, a downloadable TXT practice worksheet, an assignment worth 100 points, and a pinned welcome announcement. New assignments initially allow 14 days and accept late submissions; instructors can edit these settings. These courses are available under **Explore courses** and are not automatically added to students' enrolled courses.

To add only those eight courses to an existing database, run `npm run seed:courses` from the root or `server` folder. It uses the existing `instructor@classroom.test` account by default; optionally set `COURSE_INSTRUCTOR_EMAIL` to another existing instructor's email. Reruns preserve existing content edits, grades, and enrollment, and skip archived or conflicting courses.

## Student and instructor workflows

Students register, browse published courses, join courses, read materials and announcements, submit text and/or attachments, and see grades and feedback. The dashboard tracks upcoming unsubmitted assignments and a weighted overall grade using only graded work. A score of zero is a valid grade.

Instructors register using the private invitation code, create and publish courses, manage materials, assignments and announcements, view enrolled students, and grade submissions with written feedback. Only the owning instructor can manage a course. Published courses are visible in the student catalog; draft courses stay private. Unpublishing closes new enrollment while preserving enrolled students’ access.

Deleting a course archives it: content becomes inaccessible while database records remain available for recovery. Deleting an assignment permanently removes its submissions, grades, and attachments. Other deleted resources are removed permanently. There is no recovery UI.

Assignments use local time in forms and UTC in API/database storage. Late work is rejected unless the instructor enables late submissions. Students can replace ungraded work; graded work is locked. Maximum points cannot be reduced below a saved grade. Attachments are limited to 20 MB with an extension allowlist and basic content-signature validation. Downloaded files are always served as attachments and require authorization. File signatures are not malware scanning.

## Flutter student app

See [`mobile/README.md`](mobile/README.md). The mobile API rejects instructor login and registration. Student tokens live in platform secure storage; browser JWTs live in HTTP-only cookies. Logout revokes the server session. Password changes revoke other sessions.

For a Flutter browser preview on this PC, leave the API running, open a terminal in `mobile`, and run `flutter run -d chrome` or `flutter run -d edge`. The configured preview port is 5174 and the browser API defaults to `http://localhost:8000/api`. Browser attachments and downloads are supported. Flutter browser preview uses student bearer authentication and the secure-storage web implementation; the React web client continues to use HTTP-only cookies.

```powershell
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api
```

`10.0.2.2` reaches the PC backend from the Android emulator. On a physical phone use the PC’s LAN IP with both devices on the same network, or an HTTPS deployed API. Open port 8000 in the PC firewall for LAN testing. Never use `localhost` to address the PC from a phone.

To open the React website from a physical phone on your LAN, add its exact browser origin (for example `http://192.168.1.10:5173`) to `CLIENT_ORIGINS` and restart the API. Flutter uses bearer authentication and does not need a browser origin entry.

Android Studio is installed on the development PC, but the Android SDK is missing. Dart analysis, Flutter widget/API tests, and the Flutter web build pass; Android bundle/APK compilation and a physical-device run still require Android SDK setup. Browser preview gives you a runnable target on this PC while you prepare an Android emulator/device. iOS builds require macOS and Xcode.

## Verification

```powershell
npm test
npm --prefix client run lint
npm run build
npm run test:e2e
cd mobile
flutter analyze
flutter test
```

API tests use an isolated temporary MongoDB process. Browser tests start an isolated server on port 8001 and use installed Microsoft Edge; they never change your Atlas records. The first test run may need to download MongoDB. To use Chromium elsewhere, install Playwright Chromium and change `channel` in `client/playwright.config.js`. Flutter screenshot tests render real widgets using credential-free demo fixtures; they are not device screenshots. Test fixtures contain only seeded demonstration accounts, never session tokens or real student work.

## Submission materials

See [`docs/FEATURE_MATRIX.md`](docs/FEATURE_MATRIX.md), [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md), and the generated PDFs in `docs`. Documentation is on US Letter paper with a 1-inch top, right and bottom margin and a 1.5-inch left margin. Replace institution/team placeholders in the documentation and presentation before submission. The professor did not specify a bottom margin, so 1 inch is used.

Create a clean source ZIP using `npm run package:source` from the project root or the `server` folder. It excludes credentials, dependencies, build caches, backups, and runtime files. Generate documentation PDFs, source screenshots, and the presentation with `npm run docs` from the root or `npm run docs:build` inside `server`, after installing the client dependencies; Microsoft Edge is used for printing. The underlying helpers are in `server/scripts` and resolve paths independently of your terminal's working directory.

## Delimitations

This is an academic LMS: no payments, library circulation, video conferencing, push notifications, quizzes, attendance, password-reset email, third-party SSO, or offline submission queue. Course enrollment is self-service for published courses. Roles cannot be changed through profile editing. This project implements an LMS, rather than a Library Management System, following the requested student/instructor scope. Confirm the project title with your professor if needed.

Security design follows [Express guidance](https://expressjs.com/en/advanced/best-practice-security/). Mobile platform setup follows [Flutter’s Android instructions](https://docs.flutter.dev/platform-integration/android/setup).
