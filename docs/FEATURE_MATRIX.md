# Rubric and feature map

Project: **Knowhere to Grow — A MERN Learning Management System with a Flutter Student Application**

The professor’s list offered Library Management System as an example. This implementation follows the requested learning management scope. Confirm the final project title with the adviser.

| Requirement | Implementation | Evidence |
| --- | --- | --- |
| MongoDB, Express, React, Node | Native MongoDB Node driver, Express REST API, React/Vite client | `server/src`, `client/src` |
| React Router, hooks, Axios, Bootstrap | Protected router, auth context, state/effect hooks, Axios API client, Bootstrap forms and utilities | `App.jsx`, `auth.jsx`, `hooks.js`, `api.js`, `main.jsx` |
| Registration, login, logout | Two web roles; invitation-protected instructor registration; student-only mobile auth | API tests 1–4, 14, 17 |
| Password encryption | Bcrypt salted password hashing, 12 rounds; passwords/hashes excluded from responses | API test 2 |
| JWT authentication | HS256 JWT, issuer/audience/expiry checks, persisted revocable sessions | `server/src/security.js` |
| Protected routes and middleware | Server authentication, role checks, course ownership, enrollment checks | API tests 5, 6, 8, 11, 12, 14 |
| Input validation | Zod schemas, scalar types, limits, URL scheme restriction, MongoDB ID validation | API tests 1, 3, 6, 9, 12 |
| Secure API access | Helmet headers, explicit CORS, browser origin checks for writes, request/auth rate limits, no-store responses | `server/src/app.js` |
| Responsive dashboard and navigation | Sidebar, mobile drawer, responsive cards, phone-width layouts | Browser test 1; web screenshots |
| Profile page | Name, bio, department, password update; role/email protected | API test 15; browser test 1 |
| Course CRUD | Instructor owns and manages courses, publishes/drafts, deletes by archival | API tests 5–8, 16; browser test 2 |
| Materials CRUD and upload | File and/or URL resources, descriptions, replacement, deletion | API test 9; browser test 2 |
| Student enrollment | Browse published catalog and join; duplicate joining is idempotent | API test 8 |
| Assignment CRUD | Instructions, deadline, points, late-submission setting | API tests 8, 13, 16 |
| Submission and downloads | Text and/or file, replace before grading, authorized GridFS download | API tests 9, 11, 13 |
| Grading and written feedback | Instructor review; 0–max points, required feedback, edit grades | API test 12; browser test 2 |
| Announcements CRUD | Course notices, optional pinning, enrolled-student visibility | API tests 10, 16 |
| Search | Course title/code/category; assignment, grade, and announcement search | API test 7; `ActivityPage.jsx` |
| Pagination | API course pagination, web activity pagination, mobile course pagination | `courses.js`, `Courses.jsx`, `ActivityPage.jsx`, `home_screen.dart` |
| Flutter student app | Student auth, dashboard, courses, materials, submissions, grades, notices, profile/logout; browser preview for local testing | `mobile/lib`; 13 Flutter tests and successful web build |
| Mobile shares backend | Bearer tokens sent to same API; student role enforced at login and API auth | API test 14; Flutter API tests; live Atlas read/write-session verification |
| Documentation | Chapter 1 with sections 1.1–1.5, flowchart, source/system screenshots, presentation, setup/test documentation | `docs` |

## Additional features

- Database-backed session revocation and password-change session rotation.
- Student work privacy enforced even between students in the same course.
- Durable MongoDB GridFS uploads without a separate file-hosting account.
- Course publication control and recoverable course archival.
- Late-submission policy and explicit late indicators.
- Weighted grade summary; zero grades handled correctly.
- Browser end-to-end tests and Flutter phone/text-scaling layout tests.

## Remaining platform verification

Flutter source analysis, 13 automated tests, and the JavaScript web build pass. The student app can run in Chrome/Edge on port 5174 for local testing. Android bundle compilation was attempted and stopped because the machine does not have an Android SDK. No APK, emulator run, physical-device file-picker/download run, or iOS build is claimed. Complete Android SDK setup and configure `API_BASE_URL` for the target phone before the mobile demonstration.
