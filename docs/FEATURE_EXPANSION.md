# Feature expansion implementation plan

Requested: instructor/student/admin features on web, and the same student features in Flutter. Notifications are an in-app inbox only, as confirmed by the project owner. Preserve existing uncommitted reports, documentation, and other work. Do not seed or change production learning records during implementation/testing. Do not push/deploy until requested.

Existing: assignment CRUD/deadlines/max points/submissions/grading; student text/file uploads/feedback; account management, course oversight, invitation codes, reports, admin logs. Extend rather than replace these workflows.

Missing work to implement and verify:

- [x] Secure multiple-choice quizzes, question management, publication/deadlines, attempt limits, server grading, review policies, instructor results.
- [x] Student-confirmed lecture completion and course progress; instructor roster progress; admin report progress.
- [x] Shared in-app notifications for materials, deadlines, course notices, and audience-targeted school announcements, with synchronized read states.
- [x] Admin enrollment monitoring, instructor-owned course and student enrollment detail lists, course metadata editing/archival, school announcements.
- [x] Important teaching/enrollment/assessment actions added to activity logs without secrets.
- [x] React screens/route guards/responsive styles for all additions.
- [x] Flutter student screens using the same endpoints/rules, including quizzes, review, progress, and inbox. No instructor/admin Flutter screens.
- [x] Meaningful API/security, browser workflows, and Flutter API/widget tests; lint/build/analyze; updated feature/parity matrix and documentation/source package.

Contracts/decisions: quiz choices have one correct answer; questions/points become immutable after an accepted attempt; student responses never receive the answer key before permitted review. Attempt submission is atomic with attempt-limit enforcement and question revision checks. Policies: immediately after submission, only after closing date, or never (score still visible). Quizzes are archived on deletion and attempts retained. No timed-attempt or offline submission claim. Lecture completion is student-confirmed, not inferred video watching. Course progress counts current lectures, submitted assignments, and attempted published quizzes equally. Notifications are retrieved in-app, not delivered when the app is closed. Date-based existing analytics must distinguish current progress from period activity. Student web and Flutter must expose identical underlying features and records.

Verified: 66 server tests, 17 Edge browser flows, 5 React validation tests, 25 Flutter tests, React lint/build, Vercel configuration check, Flutter analysis and JavaScript web build. Native Android/iOS verification remains outside the completed automated checks, as documented in TEST_REPORT.md. No production learning data was changed and no push/deployment was performed.

Email-auth follow-up: OTP public signup and password recovery implemented. Latest verification is 78 backend tests, 19 browser flows and 27 Flutter tests; SMTP credentials and live provider delivery remain pending. See EMAIL_SETUP.md.
