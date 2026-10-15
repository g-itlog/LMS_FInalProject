import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCheck,
  ClipboardList,
  Clock3,
  GraduationCap,
  Megaphone,
  Plus,
  Users,
} from "lucide-react";
import { useAuth } from "./auth";
import { useResource } from "./hooks";
import {
  Badge,
  CourseCard,
  Empty,
  ErrorState,
  Loading,
  PageHeading,
  formatDate,
} from "./ui";

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useResource("/dashboard");
  const instructor = user.role === "instructor";
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;
  const graded = data.submissions.filter((s) => s.grade != null);
  const pending = data.submissions.filter((s) => s.grade == null);
  const due = data.assignments
    .filter(
      (a) =>
        !data.submissions.some((s) => s.assignmentId === a._id) &&
        new Date(a.dueDate) >= new Date(),
    )
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const next = instructor ? pending[0] : due[0];
  const nextAssignment = instructor
    ? data.assignments.find((a) => a._id === next?.assignmentId)
    : next;
  const possible = graded.reduce(
    (sum, s) =>
      sum +
      (data.assignments.find((a) => a._id === s.assignmentId)?.maxPoints || 0),
    0,
  );
  const average = possible
    ? Math.round((100 * graded.reduce((sum, s) => sum + s.grade, 0)) / possible)
    : null;
  const stats = instructor
    ? [
        [BookOpen, data.courses.length, "Active courses", "violet"],
        [Users, data.studentCount, "Enrolled students", "blue"],
        [ClipboardList, pending.length, "Awaiting review", "orange"],
        [CheckCheck, graded.length, "Submissions graded", "teal"],
      ]
    : [
        [BookOpen, data.courses.length, "Enrolled courses", "violet"],
        [Clock3, due.length, "Upcoming assignments", "orange"],
        [CheckCheck, data.submissions.length, "Work submitted", "blue"],
        [
          GraduationCap,
          average == null ? "—" : `${average}%`,
          "Overall grade",
          "teal",
        ],
      ];
  return (
    <>
      <PageHeading
        eyebrow={instructor ? "TEACHING DESK" : "STUDENT DESK"}
        title={`Hello, ${user.name.split(" ")[0]}.`}
        description={
          instructor
            ? "Your courses, student work, and class updates."
            : "Your coursework, deadlines, and feedback in one place."
        }
        action={
          <Link
            className="btn btn-light"
            to={instructor ? "/courses?create=1" : "/courses?scope=catalog"}
          >
            {instructor ? <Plus size={17} /> : <BookOpen size={17} />}
            {instructor ? "Create a course" : "Explore courses"}
          </Link>
        }
      />
      <section className="welcome-banner">
        <div>
          <span className="banner-kicker">
            {instructor ? "READY FOR YOUR REVIEW" : "NEXT ON YOUR SCHEDULE"}
          </span>
          <h2>
            {nextAssignment?.title ||
              (instructor
                ? "Your review queue is clear."
                : "No upcoming deadlines.")}
          </h2>
          <p>
            {next
              ? instructor
                ? `Submitted by ${next.studentName} · ${formatDate(next.submittedAt)}`
                : `${next.course?.code || "Assignment"} · Due ${formatDate(next.dueDate, true)}`
              : instructor
                ? "No student submissions are waiting for a grade."
                : "No upcoming assignments. Your course materials are ready whenever you are."}
          </p>
          <Link
            to={
              next
                ? `/courses/${next.courseId}?tab=assignments${instructor ? `&review=${next.assignmentId}` : ""}`
                : "/courses"
            }
          >
            {next
              ? instructor
                ? "Review submission"
                : "View assignment"
              : "Go to my courses"}{" "}
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="schedule-stamp" aria-hidden="true">
          <span>{instructor ? "IN REVIEW" : "DUE NEXT"}</span>
          <strong>
            {instructor
              ? pending.length.toString().padStart(2, "0")
              : next
                ? new Intl.DateTimeFormat("en", { day: "2-digit" }).format(
                    new Date(next.dueDate),
                  )
                : "—"}
          </strong>
          <span>
            {instructor
              ? "SUBMISSIONS"
              : next
                ? new Intl.DateTimeFormat("en", { month: "short" }).format(
                    new Date(next.dueDate),
                  )
                : "ALL CLEAR"}
          </span>
        </div>
      </section>
      <div className="stats-grid">
        {stats.map(([Icon, value, label, color]) => (
          <div className="stat-card" key={label}>
            <span className={`stat-icon ${color}`}>
              <Icon size={22} />
            </span>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
            <ArrowUpRight size={16} className="stat-arrow" />
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-left">
          <section>
            <div className="section-heading">
              <div>
                <h2>
                  My courses <span>{data.courses.length}</span>
                </h2>
                <p>
                  {instructor
                    ? "Manage materials and keep your classes moving."
                    : "Open a course to find materials and assignments."}
                </p>
              </div>
              <Link to="/courses">
                View all <ArrowRight size={15} />
              </Link>
            </div>
            {data.courses.length ? (
              <div className="course-grid dashboard-courses">
                {data.courses.slice(0, 2).map((c) => (
                  <CourseCard key={c._id} course={c} />
                ))}
              </div>
            ) : (
              <div className="panel">
                <Empty
                  title={
                    instructor
                      ? "Your first classroom awaits"
                      : "Make space for learning"
                  }
                  text={
                    instructor
                      ? "Create a course and start sharing what you know."
                      : "Explore the catalog and join your first course."
                  }
                  action={
                    <Link
                      className="btn btn-primary"
                      to={
                        instructor
                          ? "/courses?create=1"
                          : "/courses?scope=catalog"
                      }
                    >
                      {instructor ? "Create course" : "Browse courses"}
                      <ArrowRight size={16} />
                    </Link>
                  }
                />
              </div>
            )}
          </section>
          <section className="panel task-panel">
            <div className="section-heading">
              <div>
                <h2>{instructor ? "Recent submissions" : "Coming up next"}</h2>
                <p>
                  {instructor
                    ? "Student work awaiting a grade and feedback."
                    : "Unsubmitted assignments, ordered by deadline."}
                </p>
              </div>
              <Link to={instructor ? "/grades" : "/assignments"}>
                View all <ArrowRight size={15} />
              </Link>
            </div>
            {(instructor ? pending : due).slice(0, 4).map((item) => {
              const assignment = instructor
                ? data.assignments.find((a) => a._id === item.assignmentId)
                : item;
              return (
                <Link
                  className="task-row"
                  key={item._id}
                  to={
                    instructor
                      ? `/courses/${item.courseId}?tab=assignments&review=${item.assignmentId}`
                      : `/courses/${item.courseId}?tab=assignments`
                  }
                >
                  <span
                    className={`task-icon ${assignment?.course?.color || "violet"}`}
                  >
                    <ClipboardList size={20} />
                  </span>
                  <div>
                    <h4>{assignment?.title || "Assignment"}</h4>
                    <p>
                      {instructor ? item.studentName : assignment?.course?.code}{" "}
                      ·{" "}
                      {formatDate(
                        instructor ? item.submittedAt : item.dueDate,
                        true,
                      )}
                    </p>
                  </div>
                  <Badge tone={instructor ? "orange" : "neutral"}>
                    {instructor ? "Review" : "To do"}
                  </Badge>
                  <ArrowUpRight size={16} />
                </Link>
              );
            })}
            {!(instructor ? pending : due).length && (
              <div className="quiet-empty">
                <CheckCheck size={23} />
                <span>
                  {instructor
                    ? "You’re all caught up on reviews."
                    : "You have no upcoming assignments."}
                </span>
              </div>
            )}
          </section>
        </div>
        <aside className="dashboard-right">
          <section className="panel announcement-widget">
            <div className="section-heading">
              <h2>Notice board</h2>
              <Megaphone size={19} />
            </div>
            {data.announcements.length ? (
              data.announcements.slice(0, 3).map((a) => (
                <Link
                  className="notice-item"
                  to={`/courses/${a.courseId}?tab=announcements`}
                  key={a._id}
                >
                  <div>
                    <Badge tone={a.pinned ? "purple" : "neutral"}>
                      {a.pinned ? "Pinned" : a.course?.code}
                    </Badge>
                    <span>{formatDate(a.createdAt)}</span>
                  </div>
                  <h4>{a.title}</h4>
                  <p>{a.body}</p>
                </Link>
              ))
            ) : (
              <div className="quiet-empty vertical">
                <Megaphone size={28} />
                <p>
                  No announcements just yet.
                  <br />
                  Updates from your courses appear here.
                </p>
              </div>
            )}
            <Link className="widget-link" to="/announcements">
              All announcements <ArrowRight size={15} />
            </Link>
          </section>
          <section className="desk-links">
            <div className="eyebrow">
              {instructor ? "TEACHING TOOLS" : "YOUR RECORD"}
            </div>
            <Link to="/grades">
              <GraduationCap size={20} />
              <span>
                {instructor ? "Review submissions" : "Grades & feedback"}
                <small>
                  {instructor
                    ? `${pending.length} awaiting review`
                    : `${graded.length} graded assignments`}
                </small>
              </span>
              <ArrowUpRight size={17} />
            </Link>
            <Link to="/profile">
              <Users size={20} />
              <span>
                My profile<small>Account and security settings</small>
              </span>
              <ArrowUpRight size={17} />
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
