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
  const due = data.assignments.filter(
    (a) =>
      !data.submissions.some((s) => s.assignmentId === a._id) &&
      new Date(a.dueDate) >= new Date(),
  );
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
        eyebrow="LET’S MAKE TODAY COUNT"
        title={`Hello, ${user.name.split(" ")[0]} 👋`}
        description={
          instructor
            ? "Here’s what’s happening in your classrooms today."
            : "A fresh day to learn something new. You’ve got this."
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
            {instructor
              ? "INSPIRE THE NEXT CHAPTER"
              : "YOUR FUTURE IS A WORK IN PROGRESS"}
          </span>
          <h2>
            {instructor
              ? "Great teaching starts\nwith a little connection."
              : "Keep your curiosity.\nBuild your momentum."}
          </h2>
          <p>
            {instructor
              ? "Share a resource, start a conversation, make an impact."
              : "Every lesson, every question, every small win moves you forward."}
          </p>
          <Link to={instructor ? "/assignments" : "/courses"}>
            {instructor ? "Review your assignments" : "Go to my courses"}{" "}
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="art-circle" />
          <div className="art-book back" />
          <div className="art-book front">
            <BookOpen size={66} strokeWidth={1.3} />
            <span>
              THE NEXT
              <br />
              CHAPTER
            </span>
          </div>
          <span className="art-star one">✦</span>
          <span className="art-star two">✧</span>
          <span className="art-dot" />
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
                    ? "The spaces where you make a difference."
                    : "Your next discovery is a lesson away."}
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
                    ? "A little feedback goes a long way."
                    : "Keep an eye on your next milestones."}
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
                    : "No upcoming deadlines. A little room to breathe."}
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
          <section className="tip-card">
            <span>✦</span>
            <div className="eyebrow">A LITTLE REMINDER</div>
            <h3>
              Progress is progress,
              <br />
              no matter how small.
            </h3>
            <p>
              {instructor
                ? "Your encouragement might be the reason someone keeps going."
                : "Set aside a few minutes today. Your future self will thank you."}
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
