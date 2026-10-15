# Quizzes, progress, inbox, and school administration

Student web and Flutter use the same backend, course memberships, attempt records, completion marks, assignment grades, and notification read states. Instructors and administrators use the web only. No additional hosting service or environment variable is required for these additions; MongoDB Atlas supplies the transaction support already used by single-use invitations.

## Instructor workflow

1. Open an owned course and select **Quizzes → Create quiz**. Enter a title, instructions, and one or more questions. Each question has 2–6 distinct options, one correct option, 1–100 points, and an optional explanation. A quiz supports 1–100 questions and 1–10 attempts per student.
2. Set an optional closing date in your local time and choose answer review: immediately after submission, after closing, or scores only. After-close review requires a closing date. Publish when ready. Drafts stay private until published.
3. Use **Edit quiz** to manage questions before the first accepted attempt. Questions and points lock after that attempt to keep scores comparable. Instructions, availability, review policy, and attempt limit can still change, but the limit cannot go below an existing attempt number. A changed quiz must be reloaded before a student submits it.
4. **View attempts** shows each student, submission time, attempt number, score, and answer review. **Archive quiz** stops attempts and retains score/attempt history. Archived quizzes remain available to students who already attempted them, while the course is accessible.
5. Select **Progress** in the course to see each enrolled student's lecture completions, submitted assignments, attempted quizzes, participation percentage, and best quiz scores.

Assignment creation, deadlines, maximum points, text/file submissions, submission review, and grades with written feedback continue to use the course's **Assignments** tab. Important successful teaching and learning changes appear in the administrator's system activity log without answer keys, response text, feedback text, passwords, or invitation values.

## Student web and Flutter workflow

1. Join a published course, then open **Quizzes** inside that course. Web also has a school-wide Quizzes navigation entry for enrolled courses.
2. Read instructions, points, closing date, review policy, and attempt limit. Start an available attempt, select one answer per question, and confirm submission. Each accepted attempt is final. The backend calculates the score; neither app can submit its own score.
3. Review your own attempts. The score is always visible. Correct answers and explanations appear only when the instructor's review policy permits. After-close review becomes available when the configured date passes; refresh the view then.
4. Open **Progress** in the course. Read/watch a learning material under **Materials**, then mark it complete in Progress. You may undo the mark. The same mark appears after refresh on the other client.
5. Course progress counts each current material, assignment, and published non-archived quiz as one unit. A material counts when you mark it complete, an assignment when you submit, and a quiz after one accepted attempt. Repeated attempts do not add units. The best score is shown separately. Completion measures participation, not a passing grade or measured video watch time. Adding/removing content can change the denominator and percentage. Empty courses show no completed units.
6. Student assignment lists include **Upcoming** and **Overdue** filters. Graded submissions remain locked, and late submissions follow the instructor's setting.
7. Open the bell/**Inbox**. Flutter uses the bell in the home app bar. Read school updates, enrolled-course announcements, new materials, and deadline reminders. Use **Mark as read** or **Mark all as read**; read state is shared across clients. Pull to refresh in Flutter; reopen or refresh the web view for new records.

## Notification rules

This is an in-app inbox, as requested. It does not send operating-system push notifications while closed. The inbox derives current eligible notifications from database records and stores read receipts per user. It works on Vercel without a scheduled background process.

Assignment reminders appear for unsubmitted assignments due within seven days and become overdue reminders after the deadline. An accepted submission clears that assignment's reminders. A changed deadline creates a new reminder identity. Published quizzes that are still open appear in the inbox, with a seven-day deadline reminder until the first attempt. Course archival removes learner access and its notifications. Deleted materials/announcements disappear from the current inbox. School/course announcement edits create a new unread version. Existing course resources can appear when a student first joins; this inbox is not an immutable historical delivery log. Lists paginate at 20 notifications.

## Administrator workflow

- **Users:** filter instructors or students, open an account, and inspect instructor-created courses or student enrollment details. Account editing and suspension rules remain in `ADMIN_GUIDE.md`.
- **Courses:** view all course records, edit title/code/category/description/color/publication, publish/unpublish, archive, or restore. Instructor ownership stays intact. Archiving blocks learner access while retaining memberships and work. Restoring returns the course as unpublished; existing enrolled students and its instructor regain access, and publication reopens catalog enrollment.
- **Enrollments:** search students or courses, filter active/archived/all courses, and inspect membership date plus lecture/assignment/quiz progress. This monitors self-service enrollment; it does not force-enroll or remove students.
- **School announcements:** create, edit, or delete a message for students, instructors, or both. Messages appear in the chosen audience's inbox; student messages appear on both web and Flutter.
- **Reports & analytics:** inspect current learning units, lecture completions, completed student/quiz pairs, and quiz attempts. Current progress and per-course progress are independent of the selected submission-report dates. Archived courses are excluded from school totals. Course CSV includes current progress. Existing assignment score metrics continue to describe assignments rather than silently mixing quiz scores into a single grade.
- **Activity log:** search important account, invitation, enrollment, course, material, assignment, grading, quiz, completion, and school-announcement actions by actor/target/detail, with timestamps.

## Cross-device acceptance checks

Use disposable content and separate browser profiles. Do not publish test school announcements to real users.

- [ ] Create an instructor quiz with two questions and a two-attempt limit. Confirm student web/Flutter see identical instructions and points.
- [ ] Submit once on web, refresh Flutter, and confirm the receipt and remaining attempt count. Submit the second attempt in Flutter; refresh web and the instructor's attempts/progress roster. Confirm score and best-score consistency.
- [ ] Try a third attempt, a closed quiz, and an unenrolled student's request. Expect rejection. Confirm restricted review hides correct answers and after-close review appears only after closing.
- [ ] Edit questions after an attempt. Expect locked controls/server rejection. Edit instructions instead and confirm a previously loaded quiz requires refresh before submission.
- [ ] Mark a lecture complete on Flutter, refresh web Progress, undo on web, and refresh Flutter. Confirm both states match.
- [ ] Submit an assignment from either client and verify its overdue/upcoming reminder clears on both. Grade it as the owner and read the same feedback on both clients.
- [ ] Post a student-only school announcement. Confirm both student inboxes receive it and an instructor inbox does not. Mark read on one client and refresh the other. Edit and confirm a new unread version; delete and confirm removal.
- [ ] Inspect Users, Enrollments, Reports, course editing/archive/restore, and Activity log. Confirm retained history and progress values match source records. Verify non-admin web and all Flutter users cannot access admin APIs.

Automated evidence is recorded in `TEST_REPORT.md`. Physical Android/iOS plugin behavior still needs a native device smoke test.

Assignment deadline extensions are available on student web and Flutter, with owner review, private comments, individual or explicit whole-class approval, shared effective deadlines, and in-app notices. Follow [DEADLINE_EXTENSIONS.md](DEADLINE_EXTENSIONS.md) for the complete workflow and acceptance checklist.
