import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Pin } from "lucide-react";
import { useAuth } from "./auth";
import { useResource } from "./hooks";
import {
  Badge,
  Empty,
  ErrorState,
  Loading,
  PageHeading,
  Pagination,
  SearchBox,
  assignmentStatus,
  formatDate,
} from "./ui";

export default function ActivityPage({ type }) {
  const { user } = useAuth();
  const instructor = user.role === "instructor";
  const { data, loading, error, reload } = useResource("/dashboard");
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;
  const title =
    type === "assignments"
      ? "Assignments"
      : type === "announcements"
        ? "Announcements"
        : instructor
          ? "Review submissions"
          : "Grades & feedback";
  let items =
    type === "announcements"
      ? data.announcements
      : type === "grades" && instructor
        ? data.submissions.map((s) => ({
            ...s,
            title:
              data.assignments.find((a) => a._id === s.assignmentId)?.title ||
              "Assignment",
          }))
        : data.assignments.map((a) => ({
            ...a,
            submission: data.submissions.find((s) => s.assignmentId === a._id),
          }));
  items = items.filter(
    (item) =>
      (courseFilter === "all" || item.courseId === courseFilter) &&
      `${item.title} ${item.course?.code} ${item.body || ""} ${item.studentName || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  if (statusFilter !== "all")
    items = items.filter((item) =>
      statusFilter === "graded"
        ? (item.submission?.grade ?? item.grade) != null
        : statusFilter === "pending"
          ? type === "grades" && instructor
            ? item.grade == null
            : item.submission && item.submission.grade == null
          : !item.submission,
    );
  const shown = items.slice((page - 1) * 8, page * 8);
  return (
    <>
      <PageHeading
        eyebrow={
          type === "announcements" ? "STAY IN THE LOOP" : "ONE STEP AT A TIME"
        }
        title={title}
        description={
          type === "announcements"
            ? "The latest updates from your learning community."
            : type === "assignments"
              ? "Your tasks and deadlines, all in one place."
              : instructor
                ? "Recognize effort. Guide the next step."
                : "See how far you’ve come, and what to work on next."
        }
      />
      <div className="list-toolbar">
        <div className="filter-group">
          <select
            className="form-select"
            aria-label="Filter by course"
            value={courseFilter}
            onChange={(e) => {
              setCourseFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All courses</option>
            {data.courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.code}
              </option>
            ))}
          </select>
          {type !== "announcements" &&
            !(type === "assignments" && instructor) && (
              <select
                className="form-select"
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All statuses</option>
                <option value="graded">Graded</option>
                <option value="pending">Awaiting grade</option>
                {!instructor && <option value="todo">Not submitted</option>}
              </select>
            )}
        </div>
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={`Search ${title.toLowerCase()}…`}
        />
      </div>
      {!shown.length ? (
        <div className="panel">
          <Empty
            title={
              search || courseFilter !== "all"
                ? "No matching results"
                : type === "announcements"
                  ? "All quiet for now"
                  : "A fresh page"
            }
            text={
              type === "announcements"
                ? "Course announcements will appear here."
                : instructor
                  ? "Manage assignments inside your courses. Submitted work will appear here for review."
                  : "Assignments from your enrolled courses will appear here."
            }
            action={
              <Link to="/courses" className="btn btn-primary">
                Go to courses
                <ArrowUpRight size={16} />
              </Link>
            }
          />
        </div>
      ) : type === "announcements" ? (
        <div className="resource-list">
          {shown.map((a) => (
            <article className="panel announcement-card" key={a._id}>
              <div className="record-heading">
                <div>
                  <Badge tone="purple">{a.course?.code}</Badge>
                  <h3>{a.title}</h3>
                  <small>{formatDate(a.createdAt, true)}</small>
                </div>
                {a.pinned && <Pin size={17} />}
              </div>
              <p className="preserve-lines">{a.body}</p>
              <Link
                to={`/courses/${a.courseId}?tab=announcements`}
                className="text-link"
              >
                View classroom
                <ArrowUpRight size={15} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <div className="table-responsive">
            <table className="table app-table">
              <thead>
                <tr>
                  <th>Assignment</th>
                  <th>
                    {type === "grades" && instructor ? "Student" : "Deadline"}
                  </th>
                  <th>Status</th>
                  {type === "grades" && <th>Grade</th>}
                  <th>
                    <span className="visually-hidden">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => {
                  const submission =
                    instructor && type === "grades" ? a : a.submission;
                  const assignment =
                    instructor && type === "grades"
                      ? data.assignments.find((v) => v._id === a.assignmentId)
                      : a;
                  const [status, tone] = assignmentStatus(
                    assignment,
                    submission,
                  );
                  return (
                    <tr key={a._id}>
                      <td>
                        <span className="table-course-code">
                          {a.course?.code}
                        </span>
                        <strong>{a.title}</strong>
                        {type === "grades" && submission?.feedback && (
                          <p className="table-feedback">
                            {submission.feedback}
                          </p>
                        )}
                      </td>
                      <td>
                        {instructor && type === "grades"
                          ? a.studentName
                          : formatDate(a.dueDate, true)}
                      </td>
                      <td>
                        <Badge
                          tone={
                            instructor && type === "assignments"
                              ? "purple"
                              : tone
                          }
                        >
                          {instructor && type === "assignments"
                            ? `${data.submissions.filter((s) => s.assignmentId === a._id).length} submitted`
                            : status}
                        </Badge>
                      </td>
                      {type === "grades" && (
                        <td className="grade-cell">
                          {submission?.grade != null
                            ? `${submission.grade} / ${assignment?.maxPoints}`
                            : "—"}
                        </td>
                      )}
                      <td>
                        <Link
                          className="btn btn-light btn-sm"
                          to={`/courses/${a.courseId}?tab=assignments${instructor ? `&review=${type === "grades" ? a.assignmentId : a._id}` : ""}`}
                        >
                          {instructor ? "Review" : "View"}
                          <ArrowUpRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Pagination
        page={page}
        pages={Math.ceil(items.length / 8)}
        onChange={setPage}
      />
    </>
  );
}
