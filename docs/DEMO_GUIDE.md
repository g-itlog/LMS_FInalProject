# Presentation and demonstration guide

Suggested duration: 10–12 minutes. Use the private local credentials file; do not project passwords, `.env`, invitation codes, or database connection strings.

1. **Problem and users (1 minute).** Explain fragmented resource sharing, scattered submission channels, and delayed feedback. Identify students and instructors. State that the native Flutter app is for students only.
2. **Architecture (1 minute).** React/Axios and Flutter/HTTP both call Express. MongoDB holds academic records, JWT sessions, and GridFS attachments. No direct database access from either client.
3. **Instructor workflow (3 minutes).** Create/publish a course; add a PDF or link; create an assignment and deadline; post a pinned announcement. Explain that another instructor cannot modify this course.
4. **Student workflow (2 minutes).** Register/sign in, join the published course, open its resources, and submit text plus an attachment. Show upcoming work and announcements. Use Flutter on a real configured emulator/device after SDK setup.
5. **Feedback loop (1 minute).** Review the exact submission as its instructor. Save a score and constructive feedback. Refresh the student app to show the same grade.
6. **Security and testing (1 minute).** Show role protection, session revocation, validation, and test results. Explain bcrypt hashing rather than reversible password encryption. Explain ownership and enrollment checks beyond simply hiding buttons.
7. **Scope and limitations (1 minute).** Self-enrollment, maximum 20 MB files, no offline submissions or password-reset email. Be explicit about Android/iOS device verification status.

## Likely defense questions

**Why Flutter if the required web stack is MERN?** The web application and backend remain MERN. Flutter is an additional student client using the same REST API.

**Why the native MongoDB driver instead of Mongoose?** MERN requires MongoDB, not a specific object mapper. The official driver handles collections, indexes, and GridFS; Zod validates API input.

**How do you protect private work?** The server authenticates every protected request, verifies enrollment/course ownership, and checks the submission owner for downloads. Students never receive other students’ submissions.

**What happens at the deadline?** The server compares UTC timestamps. Late work is rejected unless allowed; accepted late work receives a late indicator. Local UI times convert to UTC before saving.

**How is the overall grade computed?** Sum earned points on graded submissions, divide by sum of maximum points for those same assignments, then multiply by 100. Ungraded and unsubmitted work are not included. It is a progress summary, not an official institutional final grade.

**What does delete do?** Courses are archived and inaccessible but retained for recovery. Assignment deletion removes associated submissions/grades/files. Resource/announcement deletion is permanent.

**Can logout invalidate a copied JWT?** Yes. Every request verifies its persisted session ID, so logout deletes the session; a copied token from that session is rejected even before its signed expiry.

**Does file validation guarantee files are safe?** No. The API enforces size, allowed extensions, and basic signatures; files download as attachments. Antivirus scanning is outside the academic scope.
