import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  ClipboardList,
  ExternalLink,
  FileText,
  Megaphone,
  Pencil,
  Pin,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "./auth";
import { api, message } from "./api";
import { useResource } from "./hooks";
import {
  Badge,
  Button,
  Confirm,
  Empty,
  ErrorState,
  Field,
  FileDownload,
  Loading,
  Modal,
  assignmentStatus,
  formatDate,
} from "./ui";
import { Editor } from "./Editors";
import { QuizHub, CourseProgress } from "./Learning";
import Extensions from "./Extensions";

export default function CourseDetail() {
  const { courseId } = useParams();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab") || "materials";
  const { user } = useAuth();
  const instructor = user.role === "instructor";
  const tabs = [
    "materials",
    "assignments",
    "announcements",
    "quizzes",
    "progress",
    ...(instructor ? ["students", "settings"] : []),
  ];
  const tab = tabs.includes(requested) ? requested : "materials";
  const {
    data: course,
    loading,
    error,
    reload,
  } = useResource(`/courses/${courseId}`);
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [submitAssignment, setSubmitAssignment] = useState(null);
  const [busy, setBusy] = useState(false);
  const review = instructor ? params.get("review") : null;
  const extensionAssignmentId = params.get("extensions");
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;
  const access = instructor || course.enrolled;
  function actions(type, record) {
    return (
      instructor && (
        <div className="record-actions">
          <button
            className="icon-btn"
            aria-label={`Edit ${record.title}`}
            onClick={() => setEditor({ type, record })}
          >
            <Pencil size={16} />
          </button>
          <button
            className="icon-btn danger"
            aria-label={`Delete ${record.title}`}
            onClick={() => setDeleting({ type, record })}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    );
  }
  return (
    <>
      <Link to="/courses" className="back-link">
        <ArrowLeft size={16} />
        Back to courses
      </Link>
      <section className={`course-hero ${course.color}`}>
        <div>
          <Badge tone="white">{course.code}</Badge>
          <h1>{course.title}</h1>
          <p>{course.description}</p>
          <div className="course-meta">
            <span>
              <Users size={16} />
              {course.studentCount} students
            </span>
            <span>
              <BookOpen size={16} />
              {course.category}
            </span>
            <span>{course.instructorName}</span>
          </div>
        </div>
        <BookOpen size={112} strokeWidth={0.8} className="course-hero-icon" />
      </section>
      {!access ? (
        <div className="panel join-panel">
          <div>
            <h2>Your next chapter is here.</h2>
            <p>
              Join this course to access materials, assignments, and class
              announcements.
            </p>
          </div>
          <Button
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post(`/courses/${courseId}/enroll`);
                toast.success("Welcome to the course!");
                reload();
              } catch (e) {
                toast.error(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Join course
            <ArrowUpRight size={17} />
          </Button>
        </div>
      ) : (
        <>
          <div
            className="course-tabs"
            role="tablist"
            aria-label="Course content"
          >
            {tabs.map((t) => (
              <button
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? "active" : ""}
                key={t}
                onClick={() => setParams({ tab: t })}
              >
                {t === "materials"
                  ? "Learning materials"
                  : t[0].toUpperCase() + t.slice(1)}
                {Array.isArray(course[t]) && <span>{course[t].length}</span>}
              </button>
            ))}
          </div>
          <div className="section-heading course-section-heading">
            <div>
              <h2>
                {tab === "quizzes"
                  ? "Test your understanding"
                  : tab === "progress"
                    ? "Every step counts"
                    : tab === "materials"
                      ? "Your learning resources"
                      : tab === "assignments"
                        ? "Put learning into practice"
                        : tab === "announcements"
                          ? "From your classroom"
                          : tab === "students"
                            ? "Meet your class"
                            : "Course settings"}
              </h2>
              <p>
                {tab === "materials"
                  ? "Everything you need for your next discovery."
                  : tab === "assignments"
                    ? "Instructions, deadlines, and the work that moves you forward."
                    : tab === "announcements"
                      ? "Stay connected with the latest course updates."
                      : ""}
              </p>
            </div>
            {instructor &&
              ["materials", "assignments", "announcements"].includes(tab) && (
                <Button onClick={() => setEditor({ type: tab })}>
                  <Plus size={16} />
                  {tab === "materials"
                    ? "Add material"
                    : tab === "assignments"
                      ? "Create assignment"
                      : "Post announcement"}
                </Button>
              )}
          </div>
          {tab === "quizzes" && <QuizHub courseId={courseId} />}
          {tab === "progress" && <CourseProgress courseId={courseId} />}
          {tab === "materials" && (
            <div className="resource-list">
              {course.materials.length ? (
                course.materials.map((m) => (
                  <article className="panel resource-row" key={m._id}>
                    <span className={`resource-icon ${course.color}`}>
                      <FileText size={25} />
                    </span>
                    <div className="resource-content">
                      <h3>{m.title}</h3>
                      {m.description && (
                        <p className="preserve-lines">{m.description}</p>
                      )}
                      <small>
                        {formatDate(m.createdAt)}
                        {m.file &&
                          ` · ${(m.file.size / 1024 / 1024).toFixed(2)} MB`}
                      </small>
                      <div className="resource-links">
                        <FileDownload file={m.file} />
                        {m.url && (
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-light"
                          >
                            Open resource
                            <ExternalLink size={15} />
                          </a>
                        )}
                      </div>
                    </div>
                    {actions("materials", m)}
                  </article>
                ))
              ) : (
                <div className="panel">
                  <Empty
                    title="A little knowledge is on its way"
                    text={
                      instructor
                        ? "Upload your first resource or share a useful link."
                        : "Your instructor hasn’t added learning materials yet."
                    }
                  />
                </div>
              )}
            </div>
          )}
          {tab === "assignments" && (
            <div className="resource-list">
              {course.assignments.length ? (
                course.assignments.map((a) => {
                  const submission = course.submissions.find(
                    (s) => s.assignmentId === a._id && s.studentId === user._id,
                  );
                  const [status, tone] = assignmentStatus(a, submission);
                  return (
                    <article className="panel assignment-card" key={a._id}>
                      <div className="record-heading">
                        <span className={`resource-icon ${course.color}`}>
                          <ClipboardList size={23} />
                        </span>
                        <div>
                          <h3>{a.title}</h3>
                          <div className="record-meta">
                            Due {formatDate(a.dueDate, true)}
                            <span>·</span>
                            {a.maxPoints} points
                          </div>
                        </div>
                        {!instructor && <Badge tone={tone}>{status}</Badge>}
                        {actions("assignments", a)}
                      </div>
                      <p className="preserve-lines assignment-instructions">
                        {a.hasIndividualExtension && (
                          <small className="learning-block">
                            Individual extension active · Class deadline:{" "}
                            {formatDate(a.originalDueDate, true)}
                          </small>
                        )}
                        {a.instructions}
                      </p>
                      <div className="assignment-bottom">
                        <Button
                          variant="light"
                          onClick={() =>
                            setParams({ tab: "assignments", extensions: a._id })
                          }
                        >
                          {instructor
                            ? "Review deadline extensions"
                            : "Request Deadline Extension"}
                        </Button>
                        <small>
                          {a.allowLate
                            ? "Late submissions accepted"
                            : "Submissions close at the deadline"}
                        </small>
                        {instructor ? (
                          <Button
                            variant="light"
                            onClick={() =>
                              setParams({ tab: "assignments", review: a._id })
                            }
                          >
                            Review submissions{" "}
                            <span className="count-pill">
                              {
                                course.submissions.filter(
                                  (s) => s.assignmentId === a._id,
                                ).length
                              }
                            </span>
                            <ArrowUpRight size={15} />
                          </Button>
                        ) : (
                          <Button
                            variant={submission ? "light" : "primary"}
                            onClick={() => setSubmitAssignment(a)}
                          >
                            {submission?.grade != null
                              ? "View grade & feedback"
                              : submission
                                ? "View submission"
                                : "Open assignment"}
                            <ArrowUpRight size={15} />
                          </Button>
                        )}
                      </div>
                      {submission?.grade != null && (
                        <div className="inline-feedback">
                          <strong>
                            {submission.grade} / {a.maxPoints}
                          </strong>
                          <span>{submission.feedback}</span>
                        </div>
                      )}
                    </article>
                  );
                })
              ) : (
                <div className="panel">
                  <Empty
                    title="Room for your next challenge"
                    text={
                      instructor
                        ? "Create an assignment with clear instructions and a deadline."
                        : "Assignments will appear here when your instructor posts them."
                    }
                  />
                </div>
              )}
            </div>
          )}
          {tab === "announcements" && (
            <div className="resource-list">
              {course.announcements.length ? (
                course.announcements.map((a) => (
                  <article className="panel announcement-card" key={a._id}>
                    <div className="record-heading">
                      <span className={`resource-icon ${course.color}`}>
                        <Megaphone size={22} />
                      </span>
                      <div>
                        <h3>{a.title}</h3>
                        <small>
                          {course.instructorName} ·{" "}
                          {formatDate(a.createdAt, true)}
                          {a.updatedAt !== a.createdAt ? " · Edited" : ""}
                        </small>
                      </div>
                      {a.pinned && (
                        <Badge tone="purple">
                          <Pin size={12} />
                          Pinned
                        </Badge>
                      )}
                      {actions("announcements", a)}
                    </div>
                    <p className="preserve-lines">{a.body}</p>
                  </article>
                ))
              ) : (
                <div className="panel">
                  <Empty
                    title="All quiet in the classroom"
                    text="Course updates and important announcements will appear here."
                  />
                </div>
              )}
            </div>
          )}
          {tab === "students" && (
            <div className="panel">
              {course.students.length ? (
                <div className="table-responsive">
                  <table className="table app-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Email</th>
                        <th>Joined</th>
                        <th>Submissions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {course.students.map((s) => (
                        <tr key={s._id}>
                          <td>
                            <strong>{s.name}</strong>
                          </td>
                          <td>{s.email}</td>
                          <td>{formatDate(s.createdAt)}</td>
                          <td>
                            {
                              course.submissions.filter(
                                (sub) => sub.studentId === s.studentId,
                              ).length
                            }{" "}
                            / {course.assignments.length}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Your class is taking shape"
                  text="Publish this course so students can find and join it."
                />
              )}
            </div>
          )}
          {tab === "settings" && (
            <div className="panel settings-panel">
              <h3>Course details</h3>
              <p>
                Update your course title, description, category, or publishing
                status.
              </p>
              <Badge tone={course.published ? "green" : "orange"}>
                {course.published
                  ? "Published · open for enrollment"
                  : "Draft · only visible to you"}
              </Badge>
              <div>
                <Button
                  onClick={() => setEditor({ type: "courses", record: course })}
                >
                  <Pencil size={16} />
                  Edit course
                </Button>
              </div>
              <hr />
              <h3 className="text-danger">Delete this course</h3>
              <p>
                Remove it from all dashboards and deny access to its content.
                Records are retained in the database for recovery.
              </p>
              <Button
                variant="outline-danger"
                onClick={() => setDeleting({ type: "courses", record: course })}
              >
                <Trash2 size={16} />
                Delete course
              </Button>
            </div>
          )}
        </>
      )}
      {editor && (
        <Editor
          {...editor}
          courseId={courseId}
          onSaved={reload}
          onClose={() => setEditor(null)}
        />
      )}
      {deleting && (
        <Confirm
          title={`Delete ${deleting.type === "courses" ? "course" : "record"}?`}
          text={`“${deleting.record.title}” will be removed.${deleting.type === "assignments" ? " All submissions and grades for this assignment will also be deleted." : ""}`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api.delete(`/${deleting.type}/${deleting.record._id}`);
            toast.success("Deleted successfully.");
            setDeleting(null);
            if (deleting.type === "courses") window.location.assign("/courses");
            else reload();
          }}
        />
      )}
      {submitAssignment && (
        <SubmissionModal
          assignment={submitAssignment}
          submission={course.submissions.find(
            (s) =>
              s.assignmentId === submitAssignment._id &&
              s.studentId === user._id,
          )}
          onClose={() => setSubmitAssignment(null)}
          onSaved={reload}
        />
      )}
      {extensionAssignmentId && (
        <Extensions
          assignmentId={extensionAssignmentId}
          onClose={() => {
            setParams({ tab: "assignments" });
            reload();
          }}
        />
      )}
      {review && (
        <ReviewModal
          assignmentId={review}
          onClose={() => setParams({ tab: "assignments" })}
          onSaved={reload}
        />
      )}
    </>
  );
}
function SubmissionModal({ assignment, submission, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked =
    submission?.grade != null ||
    (!assignment.allowLate && new Date() > new Date(assignment.dueDate));
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    if (!form.get("file")?.size) form.delete("file");
    try {
      await api.post(`/assignments/${assignment._id}/submit`, form, {
        timeout: 120000,
      });
      toast.success("Your work has been submitted.");
      onSaved();
      onClose();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={assignment.title} onClose={() => !busy && onClose()} wide>
      <div className="assignment-modal-meta">
        <Badge tone="purple">{assignment.maxPoints} points</Badge>
        <span>Due {formatDate(assignment.dueDate, true)}</span>
      </div>
      <p className="preserve-lines">{assignment.instructions}</p>
      {submission && (
        <div className="submission-receipt">
          <strong>Submitted {formatDate(submission.submittedAt, true)}</strong>
          {submission.late && <Badge tone="orange">Late</Badge>}
          <FileDownload file={submission.file} />
        </div>
      )}
      {submission?.grade != null && (
        <div className="feedback-box">
          <span>YOUR GRADE</span>
          <h3>
            {submission.grade} <small>/ {assignment.maxPoints}</small>
          </h3>
          <strong>Instructor feedback</strong>
          <p className="preserve-lines">{submission.feedback}</p>
        </div>
      )}
      <form onSubmit={submit}>
        <Field
          label="Your response"
          name="text"
          textarea
          rows={6}
          maxLength={10000}
          defaultValue={submission?.text}
          disabled={locked}
          placeholder="Write your response here, attach a file, or use both."
        />
        {!locked && (
          <Field
            label={
              submission?.file
                ? "Replace attachment (optional)"
                : "Attach your work (optional)"
            }
            name="file"
            type="file"
            accept=".pdf,.txt,.csv,.docx,.pptx,.xlsx,.zip,.png,.jpg,.jpeg,.mp4"
            hint="Maximum file size: 3 MB. Existing attachment is kept if you don’t select a new file."
          />
        )}
        {locked && submission?.grade == null && (
          <p className="form-error">
            The deadline has passed. Submissions are closed.
          </p>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-actions">
          <Button
            type="button"
            variant="light"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </Button>
          {!locked && (
            <Button type="submit" busy={busy}>
              {submission ? "Update submission" : "Submit assignment"}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
function ReviewModal({ assignmentId, onClose, onSaved }) {
  const { data, error, loading, reload } = useResource(
    `/assignments/${assignmentId}/submissions`,
  );
  return (
    <Modal
      title={data ? `Review: ${data.assignment.title}` : "Review submissions"}
      wide
      onClose={onClose}
    >
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : data.items.length ? (
        <div className="review-list">
          {data.items.map((s) => (
            <GradeForm
              key={s._id}
              submission={s}
              maxPoints={data.assignment.maxPoints}
              onSaved={() => {
                reload();
                onSaved();
              }}
            />
          ))}
        </div>
      ) : (
        <Empty
          title="No submissions yet"
          text="Student work will appear here once it’s submitted."
        />
      )}
    </Modal>
  );
}
function GradeForm({ submission: s, maxPoints, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <article className="review-card">
      <div className="record-heading">
        <div>
          <h3>{s.student.name}</h3>
          <small>
            {s.student.email} · {formatDate(s.submittedAt, true)}
          </small>
        </div>
        <Badge tone={s.late ? "orange" : "green"}>
          {s.late ? "Late" : "On time"}
        </Badge>
      </div>
      {s.text && (
        <div className="student-response preserve-lines">{s.text}</div>
      )}
      <FileDownload file={s.file} />
      {s.effectiveDueDate && (
        <p>Current student deadline: {formatDate(s.effectiveDueDate, true)}</p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const values = Object.fromEntries(new FormData(e.currentTarget));
          try {
            await api.patch(`/submissions/${s._id}/grade`, values);
            toast.success("Grade and feedback saved.");
            onSaved();
          } catch (err) {
            setError(message(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          label={`Grade (out of ${maxPoints})`}
          name="grade"
          type="number"
          step="any"
          min={0}
          max={maxPoints}
          required
          defaultValue={s.grade ?? ""}
        />
        <Field
          label="Written feedback"
          name="feedback"
          textarea
          rows={3}
          required
          maxLength={4000}
          defaultValue={s.feedback}
          placeholder="Share constructive feedback…"
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button busy={busy} type="submit">
          {s.grade != null ? "Update grade" : "Save grade & feedback"}
        </Button>
      </form>
    </article>
  );
}
