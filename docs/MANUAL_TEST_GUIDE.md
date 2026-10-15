# Knowhere to Grow — manual acceptance checklist

Use this checklist after Vercel reports the latest deployment as **Ready**. Tick a box only when its expected result occurs. These are manual tests for you to perform; this document does not claim they have already passed on your deployed app.

The website is https://lmsfinalproject-seven.vercel.app/login. The hosted API is https://lmsfinalproject-seven.vercel.app/api. React and Flutter send requests to this shared Express API; MongoDB Atlas stores accounts, courses, learning records, sessions, and GridFS attachments. Your PC's local backend does not need to run when testing the hosted API. Refresh or navigate back to a screen to see changes made by another user; the app does not stream changes live.

## 1. Prepare the test

- [ ] Open https://lmsfinalproject-seven.vercel.app/api/health. Expect JSON containing `status: "ok"`, `database: "connected"`, and `maxAttachmentBytes: 3145728`.
- [ ] Use separate browser profiles or different browsers for admin, instructor, and student. Separate tabs in the same profile share a login session. Incognito windows of the same browser may also share their incognito session.
- [ ] Use disposable accounts and a course named **QA Classroom**, code **QA 101**. Reuse a different code such as **QA 102** on a repeat run, because course codes are unique even for archived courses. Perform deletion tests only on this test content.
- [ ] Prepare a real PDF or TXT file smaller than 3 MB and another file larger than 3 MB. Keep your account details and invitation codes in a private note, outside screenshots and project source.

Suggested new account emails are `qa.instructor@example.com`, `qa.student1@example.com`, and `qa.student2@example.com`. These are examples to register yourself, not existing accounts. Choose passwords you can remember for these disposable accounts: 8–72 characters, with uppercase, lowercase, and a number, and no more than 72 UTF-8 bytes.

For each failed test, record: account role, screen URL, exact action, expected result, actual error, and a screenshot. Browser Developer Tools → Network can show the failed `/api` request and response. Omit cookies, authorization headers, passwords, and invitation values from reports.

## 2. Admin login and directories

- [ ] Sign in using your provisioned administrator account. Your own initial credentials are stored privately in `.local-admin-credentials.txt` if you have not changed the password since provisioning. Expect **School overview** and the admin navigation.
- [ ] Open **Users**, **Courses**, **Invitation codes**, **Activity log**, and **My profile**. Each page should load without the earlier `Unrecognized key: "path"` error.
- [ ] Confirm overview counts agree with the relevant lists. Overview course counts distinguish active courses; archived courses remain visible through the archive filter.
- [ ] Search Users by name or email. Select role and account-status filters, then clear them. Expect matching records and recovery to the complete list.
- [ ] Confirm role badges differ: Student blue, Instructor purple, Administrator gold. Active is green and Suspended is red.
- [ ] Check pagination where more than 12 directory records exist. With fewer records, a second page is not expected.

## 3. Single-use instructor invitations

- [ ] In **Invitation codes**, select **Create invitation**, enter a label such as `QA Instructor 1`, leave the custom code blank, and save. Expect a new active invitation with a generated 24-character code.
- [ ] Copy it. In a separate signed-out browser/profile, open Register, choose **I'm an instructor**, and register your new QA instructor with that code after email OTP verification. Expect a success message on login with the registered email prefilled and password empty. Enter the correct password to open the instructor dashboard; an incorrect password must leave the user signed out.
- [ ] Refresh the admin invitation page. Expect the invitation to disappear from **Unused invitations**.
- [ ] Select **Used history**. Expect a used receipt with no visible code, copy button, edit button, or reactivation button.
- [ ] Try registering another instructor with a different unused email and the consumed code. Expect rejection and no new instructor account. An already-registered email is rejected as a duplicate independently of code validity.
- [ ] Try creating a new invitation using that consumed value as a custom code. Expect a duplicate-value error; used values cannot be reissued.
- [ ] Create a second invitation and **deactivate it before use**. Attempt instructor signup with it. Expect rejection. The test instructor already registered with the first code should still be able to log in.
- [ ] Edit the unused invitation's label and replace its value with a different custom value of 16–128 letters, numbers, underscores, or hyphens. Expect its inactive state to remain unchanged.
- [ ] Reactivate this unused invitation. Its old value must fail; its replacement value may register exactly one additional instructor, after which it is consumed too.
- [ ] Try an incorrect invitation or leave it blank. Expect validation/rejection without creating an instructor.

The environment invitation is imported once into this list. Restarting or redeploying does not restore used/deactivated codes. Successful signup consumes a code and creates its account in one transaction. Failed signup leaves it unused. Existing instructors keep their accounts when an invitation is consumed or deactivated.

## 4. Student registration and authentication

- [ ] Register QA Student 1 using the student option and email OTP. Expect login with the email prefilled and password empty, without an instructor invitation. Confirm protected pages are unavailable until the student enters the correct password and signs in.
- [ ] Register QA Student 2 in another session for privacy/publication checks. A fresh account should have no enrolled courses until it joins one.
- [ ] While editing registration fields, try a blank/one-character name, malformed email, and weak password. Expect relevant inline feedback and blocked invalid submission. Correcting a field should clear its error.
- [ ] Check the password show/hide control on Login and Register. Expect one visible toggle per password field, with masking restored when hidden.
- [ ] Try registering an existing email. Expect rejection rather than a duplicate account.
- [ ] Try an incorrect password on Login. Expect a credential error and no authenticated dashboard.
- [ ] Refresh after successful sign-in. Expect the authenticated session to remain valid.
- [ ] Sign out, then open a protected route directly or use Back and refresh. Expect protected data to require login again.

Live field validation checks formatting and password requirements. Whether an email is already registered, a password is correct, or an invitation is valid is checked by the server when submitting. Space repeated failed logins rather than exhausting the shared limit of 30 authentication attempts per 15 minutes.

## 5. Instructor creates the test classroom

- [ ] As the QA instructor, open **My courses → Create course**.
- [ ] Enter title `QA Classroom`, course code `QA 101`, category `Testing`, and a description of at least 10 characters. Choose a course color and leave **Publish course and allow student enrollment** unchecked.
- [ ] Save. Expect the draft in the instructor's course list. Refresh and reopen it to verify persistence.
- [ ] As a student, search **Explore courses** for `QA 101`. Expect the draft to be absent.
- [ ] As the instructor, open the classroom's **Settings → Edit course**, enable publishing, and save. Refresh student Explore courses; expect the course to appear.
- [ ] Edit its description and verify the saved change from a fresh page load.
- [ ] Attempt a second course with the same code. Expect rejection; do not reuse a course code from an earlier archived QA course.

## 6. Learning material and announcements

- [ ] In the instructor classroom's **Learning materials** tab, use **Add material** to upload your small real TXT/PDF with a title. Expect it to appear and remain after refresh.
- [ ] Create a second material using a normal HTTPS resource link. A file or resource link is required.
- [ ] Edit a material's title/description. Replace an uploaded attachment and verify the newer file downloads. Leaving its file picker empty during an edit retains the existing attachment.
- [ ] Try uploading a file larger than 3 MB. Expect rejection without saving the oversized file. Empty files, unsupported extensions, and files whose contents do not match the extension are also rejected.
- [ ] Create an announcement with a title and message, then pin it. Expect it in the course's Announcements tab, with pinned notices ordered first.
- [ ] Edit the announcement and verify the revised message after refresh.

Allowed attachment extensions: `.pdf`, `.txt`, `.csv`, `.docx`, `.pptx`, `.xlsx`, `.zip`, `.png`, `.jpg`, `.jpeg`, `.mp4`. Use an actual document of the claimed type; renaming a TXT file to PDF is not a valid PDF upload.

## 7. Enrollment and student content access

- [ ] As QA Student 1, open **Explore courses**, search for `QA 101`, and open it before joining. Expect the public course preview and **Join course**, without its learning content.
- [ ] Select **Join course**. Expect the classroom in **My courses**, with its materials, assignments, and announcements available.
- [ ] Open the uploaded material and download it. Expect the correct, readable file. Open the resource link and verify its destination.
- [ ] Read the pinned/revised announcement in the classroom and the Announcements page.
- [ ] Search/filter available course/activity lists and verify dropdown arrows, selection, empty results, and clearing filters.
- [ ] As the instructor, open the course's **Students** tab. Expect QA Student 1 and an updated enrolled-student count.
- [ ] Keep QA Student 2 unenrolled initially. A link to a material file must not grant that student access merely because its URL is known.

## 8. Assignments, submissions, and grading

- [ ] As instructor, create `QA Assignment 1` with clear instructions of at least 10 characters, maximum points `100`, a deadline tomorrow in your local time, and **Accept late submissions** off.
- [ ] As QA Student 1, refresh the dashboard and Assignments page. Expect the assignment and its correct deadline. Course/status filters should narrow the list correctly.
- [ ] Open the assignment, enter a response, attach a small valid file, and submit. Expect a saved submission receipt; reload and confirm it persists.
- [ ] Before grading, edit the response and use **Update submission**. Expect the replacement to be visible to the instructor. An existing attachment is retained if no replacement file is selected.
- [ ] Test another assignment with text only and another with a file only. Both should work. Submitting neither text nor an attachment should fail.
- [ ] As instructor, choose **Review submissions** for QA Assignment 1. Expect the correct student, latest response, attachment, and submission time. Download the submitted file.
- [ ] Save grade `90` and written feedback `Good work. Add more detail to your explanation.` Expect success.
- [ ] As the student, refresh **Grades & feedback** and open the assignment. Expect `90 / 100` and the exact saved feedback.
- [ ] Try replacing the now-graded submission. Expect it to be locked. The instructor can still update its grade/feedback.
- [ ] Try a grade below zero, above `100`, or with no written feedback. Expect rejection. A grade of `0` with feedback is valid and must display as zero.
- [ ] After restoring a valid grade, try reducing assignment maximum points below that saved score. Expect rejection.
- [ ] If checking the dashboard's overall grade, count only graded assignment points. For example, `90/100` and `40/50` produce `130/150 × 100 = 86.67%`, subject to display rounding; ungraded work is excluded. This is a point summary, not a school-specific grading conversion.

## 9. Deadlines and privacy

- [ ] Create a separate assignment with a deadline five minutes in the past and late submissions off. Expect student submission controls to be closed and submission to fail.
- [ ] Enable **Accept late submissions** for that assignment. Submit as the student. Expect success with a Late indicator. The deadline is still displayed.
- [ ] Join QA Student 2 to the course. That student must not see QA Student 1's written submission, attachment, grade, or feedback.
- [ ] If testing with a second instructor registered through its own invitation, open the QA instructor's course link while signed in as that other instructor. Expect access denial; instructors manage only their own courses.
- [ ] As a student, directly open `/admin/users` or another `/admin/*` web route. Expect return to the student workspace and no admin controls. Protected APIs independently deny non-admin access.
- [ ] In a signed-out browser, open a copied material/submission download URL. Expect authentication to be required.

## 10. Flutter against the deployed backend

From the project root:

```powershell
cd mobile
flutter pub get
flutter devices
flutter run -d YOUR_ANDROID_DEVICE_ID --dart-define=API_BASE_URL=https://lmsfinalproject-seven.vercel.app/api
```

Replace `YOUR_ANDROID_DEVICE_ID` with the actual Android ID from `flutter devices`. Connect a phone with USB debugging enabled and authorize the PC, or start an Android emulator. If no Android device appears, finish Android SDK/emulator setup and check `flutter doctor`. The deployed API requires no local `npm start`.

For a Flutter browser preview instead:

```powershell
flutter run -d chrome --web-port=5174 --dart-define=API_BASE_URL=https://lmsfinalproject-seven.vercel.app/api
```

Browser preview additionally requires `http://localhost:5174` in the Vercel API's `CLIENT_ORIGINS`, preserving the production origin and any other required origins, then a redeploy. For example:

```text
CLIENT_ORIGINS=https://lmsfinalproject-seven.vercel.app,http://localhost:5174
```

This browser-origin requirement is specific to the browser preview; native Flutter uses student bearer sessions. Always include `/api` in `API_BASE_URL`. Stop and rerun Flutter after changing the dart define; hot reload does not switch the compiled API URL.

- [ ] Log in as QA Student 1. Expect the same enrolled course, assignment/submission, saved grade, feedback, and announcements as on the website.
- [ ] Verify the mobile **Home**, **Courses → Enrolled**, **Courses → Explore**, **Assignments**, **Updates**, and **Profile** navigation. Open graded assignments to read their grades and feedback; the dashboard also summarizes graded work.
- [ ] Open and download a learning material. On Android/iOS, verify the installed file viewer opens it. Browser preview uses the browser's download behavior and does not verify native plugins.
- [ ] Create a separate, ungraded `QA Mobile Assignment` from instructor web. Submit a response and a file from Flutter, then open it in the instructor web review. Expect the same work.
- [ ] Grade that mobile submission on web, then return to/refresh Flutter. Expect the saved grade and feedback.
- [ ] Register another student through Flutter. Expect successful student signup with no admin/instructor option. Confirm the account appears in the web admin directory.
- [ ] Try instructor and administrator credentials in Flutter. Expect rejection. Those roles are web-only.
- [ ] Verify live auth-field errors, the password eye control, login/register switching, profile editing, and logout.
- [ ] Test poor/no connectivity. Expect a retryable failure rather than a false success. Restore connectivity and refresh; the app has no offline submission queue.

Native Android/iOS file picker, secure storage, downloads, and installed viewers require an actual device/emulator test. A successful browser preview does not prove those native integrations. iOS compilation requires macOS/Xcode/signing; Vercel serves the API and website rather than producing the mobile installer.

## 11. Remaining admin controls

- [ ] In Users, inspect the QA accounts and their learning-record counts. Search and filter by role/status.
- [ ] Use **Create account** to create a separate disposable student or instructor with an initial password. Expect that person to log in without public registration; an admin-created instructor does not consume an invitation.
- [ ] Edit a disposable account's name, email, or department and confirm persistence. Email or role changes revoke that account's sessions, so sign in again using its updated details.
- [ ] Change a disposable, unused account's role before it owns courses, enrollments, or submissions. Expect success. Attempt that role change on an account with learning history; expect it to be blocked.
- [ ] Keep QA Student 1 logged into web and Flutter, then suspend that account in admin Users. On each client's next protected request/refresh, expect the session to fail. New sign-ins must fail as well; course and grade records remain stored.
- [ ] Reactivate QA Student 1. Expect a new login to succeed, with its prior records intact. Revoked old sessions must not be restored.
- [ ] Inspect an administrator in Users. Expect protection from directory editing, suspension, and demotion. Admins edit their own profile/password through My profile.
- [ ] In admin Courses, inspect QA 101 and its counts/recent activity, then unpublish it. Existing enrolled students should retain access; a fresh unenrolled student should no longer find it in Explore courses. Republish to reopen enrollment.
- [ ] Open Activity log. Expect invitation management/consumption, user changes, suspension/reactivation, and publication actions with actor and timestamp, and no invitation values or passwords. Important teaching, enrollment, quiz, and lecture-completion actions are also recorded.

Course detail previews in admin show the latest 10 assignments/submissions and five announcements; counts describe the full history. Admin oversight does not grant the instructor's content/grade editing tools.

## 12. Profiles and session behavior

Before moving on, test **Reports & analytics** as admin. Confirm the overview's account graph matches the user counts; select 7/30/90-day and custom periods; inspect chart dates with the slider and daily table; search the course report; and download Daily CSV and Course CSV. Empty periods should show zero activity and dashes for rates/scores without denominators. The search affects only the course table/export. Verify that current enrollments/assignments remain labelled as current totals while submission metrics follow the dates. Confirm students/instructors cannot access reports. See `ADMIN_GUIDE.md` for complete metric definitions.

- [ ] Update each role's name, department/program, and bio where available. Refresh or log in again and verify persistence. Personal profile screens do not change the email or account role; the admin directory handles eligible account changes.
- [ ] For a disposable student logged in on web and Flutter, change its password in one client using the correct current password and matching new passwords. Expect the current client to remain authenticated while the other client's session fails on its next request.
- [ ] Verify the old password fails and the new password signs in. A wrong current password or mismatched confirmation must fail.
- [ ] Sign out explicitly. Expect server-session revocation. A previously downloaded device file is still a local file; signing out does not erase existing downloads.

## 13. Responsive and usability checks

- [ ] Check React at desktop width, tablet width, and approximately 390 px and 320 px phone widths. Use a physical phone for touch testing as well as browser device emulation.
- [ ] Check the navigation drawer, close button, Escape key, keyboard focus, forms, modals, tables/cards, file buttons, role badges, and dropdown arrows. Expect no full-page horizontal overflow or clipped primary actions.
- [ ] Search for a nonsense term. Expect a clear empty result, then correct recovery after clearing it. Check Previous/Next only on lists with enough records.
- [ ] Reload a nested route such as a course or `/admin/users`. Expect the correct page rather than a hosting 404.
- [ ] Stop your local Node/Vite servers and reopen the deployed website and Flutter app configured for the deployed API. Expect both to continue working while the hosted services and network are available.

## 14. Delete only the QA content, last

- [ ] Delete the QA announcement and a QA material. Refresh as the student; expect them to disappear and the removed material's download to become unavailable.
- [ ] Delete a disposable QA assignment. Its submissions, grades, and attachments are permanently removed. This operation has no recovery UI.
- [ ] In the QA course Settings, choose **Delete course** and confirm. Expect it to leave instructor/student active views and block content access. Course deletion archives its records rather than deleting the full history.
- [ ] In admin Courses, select the archived filter and find that course. Expect it to remain inspectable and require Restore course before publication; restored courses are unpublished and retain prior learning records.
- [ ] Suspend disposable test accounts you no longer need. Admin user management does not provide account deletion.

## 15. Automated checks, separately

Run from the repository root after installing dependencies:

```powershell
npm test
npm --prefix client test
npm --prefix client run lint
npm run build
npm run test:e2e
```

Then, from `mobile`:

```powershell
flutter analyze
flutter test
```

The last verified automated results are documented in `TEST_REPORT.md`: 88 server/startup/adapter tests, 5 React validation tests, 21 browser workflows, and 30 Flutter tests. API/browser tests use temporary databases and do not erase your Atlas data. Browser tests use installed Edge and port 8001; close another test server using that port first. Initial MongoDB/test or Flutter dependency downloads may require internet access. The browser harness simulates Vercel's catch-all query parameter, including the previously failing admin pages.

Automated test success does not verify your latest Vercel deployment, the configured database/network permissions, or native device plugins. Complete the hosted and device checklist above.

This version has no live video, attendance, push notifications, or offline submission queue. Test the features described here rather than expecting those additional systems.

See the [quiz, progress, inbox, and school administration guide](LEARNING_GUIDE.md) for the new workflows, shared student web/Flutter behavior, metric definitions, and acceptance checklist.

Email verification and Forgot password are available on web and student Flutter. Public registration now needs an emailed OTP before creating the account. Configure the six private SMTP variables and perform a real inbox check using [EMAIL_SETUP.md](EMAIL_SETUP.md). Existing accounts remain usable.

Assignment deadline extensions are available on student web and Flutter, with owner review, private comments, individual or explicit whole-class approval, shared effective deadlines, and in-app notices. Follow [DEADLINE_EXTENSIONS.md](DEADLINE_EXTENSIONS.md) for the complete workflow and acceptance checklist.
