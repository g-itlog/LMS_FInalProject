# Assignment deadline extensions

Students use **Request Deadline Extension** from a web course's Assignments tab or a Flutter assignment screen. Instructor review stays on the web. Both student clients use the same requests, decisions, deadlines, and in-app inbox read states.

## Student flow

1. Open an enrolled course and assignment. Choose **Request Deadline Extension**.
2. Enter a reason of 10–2,000 characters and a requested date/time. It must be in the future, later than your current effective deadline, and within the next 365 days. Web uses your local date/time; Flutter has date and time pickers. The backend stores UTC dates.
3. Send the request. The instructor receives an in-app notification containing your name, assignment, reason, original class deadline, and requested deadline. **Pending does not grant extra time.** Continue following your existing deadline until approval.
4. Open the same screen to see Pending, Approved, or Rejected history and any instructor comment. There can be only one pending request per student per assignment, including simultaneous requests from web and Flutter.
5. An approval appears in your inbox and updates your effective deadline. A rejection appears with the instructor's comment and does not change any deadline. After rejection, you can send a new request if your work is still eligible.

Requests can be made before or after the original deadline, including for submitted but ungraded work. An extension does not unlock graded submissions. Existing late-submission settings continue to apply while a request is pending or rejected.

## Instructor flow

1. Open **Inbox → Deadline extension requested → View extension request**, or open the assignment and choose **Review deadline extensions**.
2. Read the student's reason, original class deadline at request, that student's deadline at request, requested deadline, and current effective student deadline. History is filtered by status and paginated at 12 requests per page.
3. Add an optional comment, up to 2,000 characters. Choose **Approve** or **Reject** and confirm.
4. Approval defaults to **This student only**. To change the assignment's class deadline, explicitly select **Whole class** and confirm that scope. A class extension affects all current and future enrollments. A longer individual extension is preserved.
5. Rejection records the decision/comment without changing the class deadline or an existing individual extension. Decisions are final records; the same request cannot be approved/rejected again.

If another change already moved the relevant deadline beyond the requested date, or the requested date has passed, approval is rejected. Refresh and reject the stale request with an explanation, or manage the class assignment deadline separately. A request whose student's work has been graded cannot be approved to reopen it. Only the instructor who owns the course can decide.

## Deadline and privacy rules

The effective student deadline is the later of the current class deadline and an approved individual deadline. Student dashboards, assignment lists and filters, course details, deadline reminders, submission forms, and backend upload checks use this value. The class deadline stays unchanged for individual approvals. The backend checks current permissions/deadlines again after file upload and removes a newly uploaded file if the final check fails.

Each new or updated submission saves the deadline used at that submission and whether it was late. Approval does not silently rewrite a previous submission's historical late flag; an allowed resubmission uses the new deadline. Grading and assignment maximum scores are unchanged.

Students see only their own request reasons and comments. The course instructor can see requests from that course. Other classmates receive only the class deadline update when a whole-class extension is approved; private reasons, requester names, and comments are excluded from that notification. Instructor pending notifications disappear once reviewed. Student status changes create a new unread notification identity. Read states sync between web and Flutter after refresh.

Requests, deadline changes and audit events commit together in MongoDB transactions. A partial unique index prevents duplicate pending requests. Concurrent decisions serialize on the assignment and only one can succeed. Important extension actions appear in the admin system activity log without private reason/comment text. Atlas already supports the required transactions; no additional environment variables are needed for this feature.

Deleting an assignment removes its related extension requests and individual deadlines with its submissions. Archiving a course blocks extension reads/writes and removes its learner/instructor notifications while retaining database history for restoration.

## Acceptance checklist

- [ ] Enroll two disposable students in a test course. Create an assignment with late submissions disabled.
- [ ] Student A requests more time with a reason and future date. Confirm the instructor inbox shows the assignment, reason and both deadlines; neither student's deadline changes yet.
- [ ] Reject with a comment. Read the rejection/comment on student web and Flutter; confirm the deadline is unchanged.
- [ ] Request again and approve **This student only**. Confirm A's dashboard, assignment and reminder use the new date, B retains the class deadline, and A can submit before the new deadline without being marked late.
- [ ] Approve a separate request for **Whole class**. Confirm both students use the new class deadline, except anyone whose individual extension is later. Confirm classmates cannot read the requester's reason/comment.
- [ ] Mark the status notification read on one client and refresh the other. Confirm synchronized read state.
- [ ] Try blank/short reasons, past/earlier dates, duplicate pending requests, a second decision, an unenrolled student and another instructor. Expect validation/access/conflict errors without deadline changes.
- [ ] Confirm graded work remains locked and archived/deleted assignments cannot be used to submit new requests.

Automated API, Edge browser and Flutter widget/API coverage is recorded in TEST_REPORT.md. Physical Android/iOS device behavior remains a separate smoke test.
