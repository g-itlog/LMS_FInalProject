# Web administration — Knowhere to Grow

The administrator workspace uses the same responsive React application, session cookies, typography, navigation, and colors as the student and instructor workspaces. Administrators sign in on `/login` and land on **School overview**. Flutter remains student-only.

## Create the first administrator

1. Push and deploy the updated application through the existing Vercel project.
2. On your PC, make sure `server/.env` points to the same Atlas cluster and `MONGO_DB_NAME` used by Vercel. The ordinary local API does not need to be running.
3. From the repository root, run the following with a **new, unused email address** and your preferred display name:

   ```powershell
   npm run admin:create -- --email "admin@your-school.edu" --name "School Administrator"
   ```

4. Open the generated `.local-admin-credentials.txt` in the repository root privately. It contains the email and randomly generated initial password. The command does not print the password in the terminal.
5. Sign in at `https://lmsfinalproject-seven.vercel.app/login`. The account is stored in Atlas, so it also works with your local web application when it uses the same database.
6. Use **My profile → Password & security** to set your preferred strong password. Keep or remove the private credentials file according to your own password-storage practice. It is excluded from GitHub, Vercel uploads, and source ZIPs.

The command refuses to overwrite an existing credentials file or an existing account. It never promotes, resets, or changes an existing student/instructor account. To create another administrator, preserve the existing credentials privately and move the local file out of the project first; then run the command using a different unused email. A custom `--credentials-file` location is also supported; keep any such file private and out of version control.

No `ADMIN_PASSWORD` or other new Vercel environment variable is required. Public registration and the admin user-creation API cannot create administrator accounts. Provisioning requires trusted access to the server command and database credentials.

## Workspace capabilities

| Area | Capabilities |
| --- | --- |
| Overview | Counts of students, instructors, admins, suspended accounts, active/published courses, enrollments, materials, assignments, announcements, and submitted/graded/pending work; recent accounts, submissions, and admin actions |
| Reports & analytics | Overview graphs, school-wide daily activity, date-range reporting, current grading status, weighted scores, course activity ranking, searchable/paginated course reports, and daily/course CSV downloads |
| Users | Search by name, email, or department; role/status filters; server-side pagination; account details and record counts; create student/instructor accounts; edit name, email, department, and eligible roles; suspend/reactivate accounts |
| Courses | Search by title/code/category; active/published/unpublished/archived filters; server-side pagination; instructor details and record counts; course overview with recent assignments, submissions, and announcements; publish/unpublish active courses |
| Invitation codes | Searchable/paginated unused codes; generate or specify single-use codes; edit labels or replace unused code values; copy codes privately; deactivate/reactivate unused codes; read-only used history |
| Activity log | Searchable, paginated record of account changes, course publication, invitation management, and invitation consumption, with actor, target, details, and timestamp |
| My profile | Update the signed-in administrator's profile and password |

New instructor accounts created by an administrator do not require the public instructor invitation code. The administrator sets an initial password and shares the sign-in details privately with the account owner; this application does not email credentials.

## Read and export analytics

The Overview page now displays a 30-day activity chart, current account-role distribution, and grading progress across active courses. Move across the activity graph or use its keyboard-accessible date slider to inspect exact values. **View daily data** provides the same values as a table.

Open **Reports & analytics** for the last 7, 30, or 90 days, or apply custom dates spanning at most 366 inclusive calendar days. All boundaries use **Asia/Manila (UTC+8)**, regardless of your device's time zone. A generated timestamp identifies when the report was requested. Use **Refresh** to fetch current records.

New accounts include all roles and account statuses. Enrollment activity counts course memberships, not unique people. Course activity includes published and unpublished courses and excludes archived courses. The course table's enrollment and assignment counts are current totals; submission, review, late, and score figures use the reporting window. Course search filters the table and Course CSV, while charts and summary totals remain school-wide.

Each student has one current submission per assignment. Resubmission moves that record to its latest submission date; reports do not invent an attempt history. Graded and pending figures show the current status of those dated submissions, not the number of grading actions in the window. Weighted score is total earned points divided by total possible points across valid scored submissions. It includes zero grades and excludes ungraded or invalid assessment totals. A dash means no denominator is available. These reports are operational views of current records, not immutable historical snapshots. Current learning participation is reported separately.

**Daily CSV** exports every day in the period, including zero-activity days. **Course CSV** exports every matching active course across all pages, retaining the selected dates and course search. Both include the reporting boundaries and time zone, protect spreadsheet cells against formula execution, and require an administrator cookie session. Neither export contains student names, emails, invitation values, or passwords. Reports and graphs are web-admin features; Flutter remains student-only.

## Manage instructor invitation codes

For **Enrollments**, **School announcements**, course metadata editing/archive/restore, and current learning-progress metrics, follow [the expanded learning and administration guide](LEARNING_GUIDE.md). Course ownership and grading remain with the instructor. System activity now includes important teaching and student-learning actions as well as administration.

Open **Invitation codes** in the admin sidebar. Choose **Create invitation**, enter a recognizable label, and optionally enter a custom code. Leaving the custom-code field empty generates a secure 24-character code. Custom codes must contain 16–128 letters, numbers, underscores, or hyphens. Multiple codes can be active at the same time; each active code can register exactly one instructor through the ordinary web registration form.

Copy the code from its card and share it privately with one intended instructor. Codes are case-sensitive. The unused list displays code values so authorized administrators can copy them; these values are never returned by public/student/instructor endpoints or written into activity-log details.

Use **Deactivate** if an unused code leaks. Registrations using it will be rejected. **Edit invitation** can change an unused invitation's label or replace its code; the old value immediately stops working and the activation status is retained. **Reactivate** is available only before use and should be used only when the code is still private.

Successful instructor registration consumes the code and creates the account in one MongoDB transaction. The code disappears from **Unused invitations**, its plaintext value is removed from storage, and a receipt appears under **Used history**. Used invitations cannot be copied, edited, reactivated, or recreated with the same value. Only a hash, label, timestamps, recipient account ID, and other audit metadata remain. Two simultaneous registrations with the same code can create only one instructor. A failed account insertion rolls the transaction back and leaves the code available. MongoDB Atlas or a local replica set is required for these transactions.

Existing instructor accounts retain access after code consumption or deactivation. To block an account, suspend it in **Users**. Previously managed multi-use invitations with a recorded successful use are retired automatically during migration and cannot be reused.

Your existing `INSTRUCTOR_INVITE_CODE` is imported once as **Original instructor invitation** on the first invitation-list request or instructor signup. The database becomes authoritative: deactivation or editing persists across cold starts, and the old environment value cannot recreate or reactivate it. The environment variable may remain configured for compatibility; changing it after migration does not override the managed list. A fresh database with no environment code starts with an empty list and the administrator creates codes in the web interface.

Suspension revokes all existing web/mobile sessions and blocks new sign-ins. Reactivation allows fresh sign-ins; previous sessions remain revoked. Learning records are retained. Changing a user's email or role also revokes that user's sessions.

A role change is allowed only before an account has owned courses, enrollments, or submissions, including archived teaching history. Use a separate account for the other role if records already exist. All administrator accounts are protected from directory edits, suspension, and demotion. An administrator can edit their own profile/password through the ordinary profile page.

Unpublishing removes a course from the enrollment catalog while retaining access for students already enrolled. Archived courses remain inspectable. Restore a course first to regain existing learning access; it returns as unpublished and can then be published for new enrollments. Instructors continue to manage their own learning content and grades. Course detail previews are explicitly limited to the latest 10 assignments/submissions and five announcements; counts cover the complete course history.

## Permissions and verification

- `/api/admin/*` requires an authenticated administrator cookie session; role and account status are checked against the database on each request.
- Students/instructors cannot access admin APIs or admin web routes.
- Administrator login through `/api/mobile/auth/login` is rejected. Administrator JWTs presented as mobile bearer credentials are also rejected.
- Public signup cannot assign `admin`, and profile updates cannot change roles or suspension status.
- User-directory responses and activity logs omit password hashes, passwords, JWTs, and invitation codes.
- Admin commands are recorded in `lms_admin_activity`. Important successful teaching, enrollment, quiz, and completion actions are also attributed in this log; ownership and enrollment rules still apply.

Run `npm --prefix server test` for the API/provisioning/security tests and `npm --prefix client run test:e2e` for real browser admin workflows against an isolated database. Production demo seeding does not create a default administrator. The browser test server's administrator exists only in its temporary test database.

See the [quiz, progress, inbox, and school administration guide](LEARNING_GUIDE.md) for the new workflows, shared student web/Flutter behavior, metric definitions, and acceptance checklist.

Email verification and Forgot password are available on web and student Flutter. Public registration now needs an emailed OTP before creating the account. Configure the six private SMTP variables and perform a real inbox check using [EMAIL_SETUP.md](EMAIL_SETUP.md). Existing accounts remain usable.

Assignment deadline extensions are available on student web and Flutter, with owner review, private comments, individual or explicit whole-class approval, shared effective deadlines, and in-app notices. Follow [DEADLINE_EXTENSIONS.md](DEADLINE_EXTENSIONS.md) for the complete workflow and acceptance checklist.
