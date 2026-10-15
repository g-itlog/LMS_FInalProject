import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  Users,
  ClipboardList,
  Clock3,
  Plus,
  RefreshCw,
  ArrowUpRight,
  ShieldCheck,
  Search,
  UserRound,
  GraduationCap,
} from "lucide-react";
import toast from "react-hot-toast";
import { api, message } from "./api";
import { useDebounced, useResource } from "./hooks";
import { validateAuth } from "./auth-validation";
import {
  Badge,
  Button,
  Confirm,
  Empty,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeading,
  Pagination,
  formatDate,
} from "./ui";

const roles = {
  student: "Student",
  instructor: "Instructor",
  admin: "Administrator",
};
const actions = {
  "admin.created": "Administrator created",
  "user.created": "Account created",
  "user.updated": "Account updated",
  "course.publication": "Course publication changed",
  "invitation.created": "Invitation code created",
  "invitation.updated": "Invitation code updated",
  "invitation.used": "Invitation code used",
};
const statusBadge = (user) => (
  <Badge tone={user.status === "suspended" ? "red" : "green"}>
    {user.status === "suspended" ? "Suspended" : "Active"}
  </Badge>
);

function Stat({ icon: Icon, value, label, tone = "blue" }) {
  return (
    <div className="stat-card">
      <span className={`stat-icon ${tone}`}>
        <Icon size={21} />
      </span>
      <div>
        <strong>{Number(value || 0).toLocaleString()}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
function Counts({ items }) {
  return (
    <dl className="admin-counts">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? 0}</dd>
        </div>
      ))}
    </dl>
  );
}
function ListState({ loading, error, reload, children }) {
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;
  return children;
}
function Filter({ label, value, onChange, options }) {
  return (
    <select
      className="form-select"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map(([value, text]) => (
        <option key={value} value={value}>
          {text}
        </option>
      ))}
    </select>
  );
}
function AdminSearch({ value, onChange, placeholder }) {
  return (
    <div className="search-box">
      <Search size={17} aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={placeholder}
        placeholder={placeholder}
        maxLength={100}
      />
    </div>
  );
}
function ActivityRows({ items }) {
  return items.length ? (
    <div className="admin-feed">
      {items.map((item) => (
        <article className="admin-feed-row" key={item._id}>
          <span className="admin-feed-icon">
            <ShieldCheck size={17} />
          </span>
          <div>
            <strong>{actions[item.action] || "Administrative action"}</strong>
            <p>{item.targetName}</p>
            <p className="preserve-lines admin-detail">{item.detail}</p>
            <small>
              {item.actorName} · {formatDate(item.createdAt, true)}
            </small>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <Empty
      title="No admin activity yet"
      text="Account and course changes made by administrators will appear here."
    />
  );
}
function SubmissionRows({ items }) {
  return items.length ? (
    <div className="admin-feed">
      {items.map((item) => (
        <article className="admin-feed-row" key={item._id}>
          <span className="admin-feed-icon">
            <ClipboardList size={17} />
          </span>
          <div>
            <strong>{item.assignmentTitle || "Assignment"}</strong>
            <p>
              {item.studentName || "Student"} · {item.courseCode || "Course"}
            </p>
            <small>{formatDate(item.submittedAt, true)}</small>
          </div>
          <Badge tone={item.grade == null ? "orange" : "green"}>
            {item.grade == null
              ? "Awaiting review"
              : `${item.grade} / ${item.maxPoints ?? "—"}`}
          </Badge>
        </article>
      ))}
    </div>
  ) : (
    <Empty
      title="No submissions yet"
      text="Student submissions from active courses will appear here."
    />
  );
}

export function AdminOverview() {
  const { data, loading, error, reload } = useResource("/admin/overview");
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;
  const { stats } = data;
  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRATION DESK"
        title="School overview"
        description="Your people, courses, and learning activity in one place."
        action={
          <Button variant="light" onClick={reload}>
            <RefreshCw size={16} />
            Refresh
          </Button>
        }
      />
      <section className="admin-intro panel">
        <div>
          <span className="eyebrow">KNOWHERE TO GROW / ADMINISTRATION</span>
          <h2>A view of your learning community.</h2>
          <p>
            Manage access, keep the course catalog organized, and follow the
            work happening across your school.
          </p>
        </div>
        <Link to="/admin/users" className="btn btn-primary">
          Manage users <ArrowUpRight size={17} />
        </Link>
      </section>
      <div className="stats-grid">
        <Stat icon={Users} value={stats.users} label="Registered users" />
        <Stat
          icon={BookOpen}
          value={stats.courses}
          label="Active courses"
          tone="violet"
        />
        <Stat
          icon={GraduationCap}
          value={stats.enrollments}
          label="Course enrollments"
          tone="teal"
        />
        <Stat
          icon={Clock3}
          value={stats.pending}
          label="Awaiting review"
          tone="orange"
        />
      </div>
      <div className="admin-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>People & access</h2>
              <p>Accounts across the whole school.</p>
            </div>
            <Users size={20} />
          </div>
          <Counts
            items={[
              ["Students", stats.students],
              ["Instructors", stats.instructors],
              ["Administrators", stats.admins],
              ["Suspended accounts", stats.suspendedUsers],
            ]}
          />
          <Link to="/admin/users" className="text-link">
            View user directory <ArrowUpRight size={15} />
          </Link>
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Active learning</h2>
              <p>Learning records in courses that have not been archived.</p>
            </div>
            <BookOpen size={20} />
          </div>
          <Counts
            items={[
              ["Published courses", stats.publishedCourses],
              ["Learning materials", stats.materials],
              ["Assignments", stats.assignments],
              ["Announcements", stats.announcements],
              ["Submissions received", stats.submissions],
              ["Submissions graded", stats.graded],
            ]}
          />
          <Link to="/admin/courses" className="text-link">
            View course directory <ArrowUpRight size={15} />
          </Link>
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Recently joined</h2>
              <p>The six most recent accounts.</p>
            </div>
            <Link to="/admin/users" className="text-link">
              View all
            </Link>
          </div>
          <div className="admin-feed">
            {data.recentUsers.map((user) => (
              <div className="admin-feed-row" key={user._id}>
                <span className="admin-feed-icon">
                  <UserRound size={17} />
                </span>
                <div>
                  <Link
                    className="text-link"
                    to={`/admin/users?search=${encodeURIComponent(user.email)}`}
                  >
                    {user.name}
                  </Link>
                  <p>
                    {roles[user.role]} · {formatDate(user.createdAt)}
                  </p>
                </div>
                {statusBadge(user)}
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Recent student work</h2>
              <p>The six most recent submissions from active courses.</p>
            </div>
          </div>
          <SubmissionRows items={data.recentSubmissions} />
        </section>
      </div>
      <section className="panel admin-section">
        <div className="section-heading">
          <div>
            <h2>Admin activity</h2>
            <p>A record of account and publication changes.</p>
          </div>
          <Link to="/admin/activity" className="text-link">
            View all
          </Link>
        </div>
        <ActivityRows items={data.recentActivity} />
      </section>
    </>
  );
}

export function AdminUsers() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState(
    params.get("search")?.slice(0, 100) || "",
  );
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const query = new URLSearchParams({
    search: useDebounced(search),
    role,
    status,
    page,
  });
  const { data, loading, error, reload } = useResource(`/admin/users?${query}`);
  function change(setter, value) {
    setter(value);
    setPage(1);
  }
  return (
    <>
      <PageHeading
        eyebrow="PEOPLE & ACCESS"
        title="User directory"
        description="Manage student and instructor accounts. Suspended accounts retain their learning records."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={17} />
            Create account
          </Button>
        }
      />
      <div className="admin-toolbar">
        <AdminSearch
          value={search}
          onChange={(value) => change(setSearch, value)}
          placeholder="Search users by name or email"
        />
        <Filter
          label="Filter users by role"
          value={role}
          onChange={(value) => change(setRole, value)}
          options={[
            ["all", "All roles"],
            ["student", "Students"],
            ["instructor", "Instructors"],
            ["admin", "Administrators"],
          ]}
        />
        <Filter
          label="Filter users by status"
          value={status}
          onChange={(value) => change(setStatus, value)}
          options={[
            ["all", "All account statuses"],
            ["active", "Active"],
            ["suspended", "Suspended"],
          ]}
        />
      </div>
      <ListState loading={loading} error={error} reload={reload}>
        {data && (
          <>
            <p className="admin-results" role="status">
              {data.total} {data.total === 1 ? "account" : "accounts"} found
            </p>
            <div className="admin-user-list">
              {data.items.map((user) => (
                <article className="panel admin-user-row" key={user._id}>
                  <span className="avatar">
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div className="admin-user-identity">
                    <h2>{user.name}</h2>
                    <p>{user.email}</p>
                    <small>{user.department || "No department"}</small>
                  </div>
                  <div className="admin-user-badges">
                    <Badge tone={`role-${user.role}`}>
                      {roles[user.role]}
                    </Badge>
                    {statusBadge(user)}
                  </div>
                  <Button
                    variant="light"
                    onClick={() => setSelected(user._id)}
                    aria-label={`View account for ${user.name}`}
                  >
                    View account <ArrowUpRight size={15} />
                  </Button>
                </article>
              ))}
            </div>
            {!data.items.length && (
              <div className="panel">
                <Empty
                  title="No matching accounts"
                  text="Try another name, email address, role, or status."
                />
              </div>
            )}
            <Pagination
              page={data.page}
              pages={data.pages}
              onChange={setPage}
            />
          </>
        )}
      </ListState>
      {selected && (
        <UserDialog
          userId={selected}
          onClose={() => setSelected(null)}
          onSaved={reload}
        />
      )}
      {creating && (
        <CreateUserDialog
          onClose={() => setCreating(false)}
          onSaved={() => {
            setPage(1);
            reload();
          }}
        />
      )}
    </>
  );
}
function UserDialog({ userId, onClose, onSaved }) {
  const { data, loading, error, reload } = useResource(
    `/admin/users/${userId}`,
  );
  return (
    <Modal title="Account details" onClose={onClose}>
      <ListState loading={loading} error={error} reload={reload}>
        {data && <UserEditor data={data} onClose={onClose} onSaved={onSaved} />}
      </ListState>
    </Modal>
  );
}
function UserEditor({ data, onClose, onSaved }) {
  const { user, counts, canChangeRole } = data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.patch(
        `/admin/users/${user._id}`,
        Object.fromEntries(new FormData(event.currentTarget)),
      );
      toast.success("Account updated.");
      onSaved();
      onClose();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-account-heading">
        <div>
          <strong>{user.name}</strong>
          <p>{user.email}</p>
        </div>
        {statusBadge(user)}
      </div>
      <Counts
        items={[
          ["Courses owned", counts.ownedCourses],
          ["Enrollments", counts.enrollments],
          ["Submissions", counts.submissions],
          ["Graded submissions", counts.graded],
          ["Active sessions", counts.sessions],
        ]}
      />
      <p className="admin-meta">
        Joined {formatDate(user.createdAt)} · Last sign-in{" "}
        {user.lastLoginAt ? formatDate(user.lastLoginAt, true) : "Not recorded"}
      </p>
      {user.role === "admin" ? (
        <div className="admin-notice">
          <ShieldCheck size={19} />
          <p>
            Administrator accounts are protected. You can update your own
            profile and password in{" "}
            <Link className="text-link" to="/profile">
              My profile
            </Link>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={save}>
          <Field
            label="Full name"
            name="name"
            required
            minLength={2}
            maxLength={80}
            defaultValue={user.name}
            disabled={busy}
          />
          <Field
            label="Email address"
            name="email"
            type="email"
            autoComplete="off"
            required
            maxLength={160}
            defaultValue={user.email}
            disabled={busy}
          />
          <Field
            label="Department"
            name="department"
            maxLength={100}
            defaultValue={user.department}
            disabled={busy}
          />
          <div className="field">
            <label htmlFor="account-role">Account role</label>
            <select
              id="account-role"
              className="form-select"
              name="role"
              defaultValue={user.role}
              disabled={busy || !canChangeRole}
              aria-describedby="account-role-hint"
            >
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
            </select>
            <small id="account-role-hint">
              {canChangeRole
                ? "Changing the role or email signs out this user's current sessions."
                : "This account has course or submission records. Its role is kept to preserve that history."}
            </small>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button
              type="button"
              variant="light"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" busy={busy}>
              Save changes
            </Button>
          </div>
          <div className="admin-access-action">
            <div>
              <strong>
                {user.status === "suspended"
                  ? "Restore account access"
                  : "Suspend account access"}
              </strong>
              <p>
                {user.status === "suspended"
                  ? "Allow this user to sign in again."
                  : "Sign this user out and prevent new sign-ins. Their records are retained."}
              </p>
            </div>
            <Button
              type="button"
              variant="light"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              {user.status === "suspended"
                ? "Reactivate account"
                : "Suspend account"}
            </Button>
          </div>
        </form>
      )}
      {confirm && (
        <Confirm
          confirmLabel={
            user.status === "suspended"
              ? "Reactivate account"
              : "Suspend account"
          }
          variant={user.status === "suspended" ? "primary" : "danger"}
          title={
            user.status === "suspended"
              ? "Reactivate this account?"
              : "Suspend this account?"
          }
          text={
            user.status === "suspended"
              ? `${user.name} will be able to sign in again.`
              : `${user.name} will be signed out and unable to sign in. Their courses and submissions will be retained.`
          }
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await api.patch(`/admin/users/${user._id}`, {
              status: user.status === "suspended" ? "active" : "suspended",
            });
            toast.success("Account access updated.");
            onSaved();
            onClose();
          }}
        />
      )}
    </>
  );
}
function CreateUserDialog({ onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const validation = validateAuth(values, { register: true });
    if (Object.keys(validation).length) {
      setError(Object.values(validation)[0]);
      form.elements.namedItem(Object.keys(validation)[0])?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.post("/admin/users", values);
      toast.success(
        "Account created. Share its sign-in details privately with the account owner.",
      );
      onSaved();
      onClose();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Create an account" onClose={() => !busy && onClose()}>
      <p className="admin-meta">
        Create a student or instructor account. Share the initial password
        privately; the account owner can change it in My profile.
      </p>
      <form onSubmit={submit}>
        <Field
          label="Full name"
          name="name"
          autoComplete="off"
          required
          minLength={2}
          maxLength={80}
          disabled={busy}
        />
        <Field
          label="Email address"
          name="email"
          type="email"
          autoComplete="off"
          required
          maxLength={160}
          disabled={busy}
        />
        <Field
          label="Department"
          name="department"
          maxLength={100}
          disabled={busy}
        />
        <div className="field">
          <label htmlFor="new-account-role">Account role</label>
          <select
            id="new-account-role"
            name="role"
            className="form-select"
            disabled={busy}
          >
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
          </select>
        </div>
        <Field
          label="Initial password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          disabled={busy}
          hint="8–72 characters, including an uppercase letter, a lowercase letter, and a number. Emoji and accented letters may reach the size limit sooner."
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button
            type="button"
            variant="light"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            Create account
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminCourses() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [publication, setPublication] = useState(null);
  const query = new URLSearchParams({
    search: useDebounced(search),
    status,
    page,
  });
  const { data, loading, error, reload } = useResource(
    `/admin/courses?${query}`,
  );
  return (
    <>
      <PageHeading
        eyebrow="COURSE OVERSIGHT"
        title="Course directory"
        description="See who teaches each course, inspect learning activity, and manage catalog publication."
      />
      <div className="admin-toolbar">
        <AdminSearch
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search courses by title or code"
        />
        <Filter
          label="Filter course publication"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={[
            ["all", "All active courses"],
            ["published", "Published"],
            ["draft", "Unpublished"],
            ["archived", "Archived"],
          ]}
        />
      </div>
      <ListState loading={loading} error={error} reload={reload}>
        {data && (
          <>
            <p className="admin-results" role="status">
              {data.total} {data.total === 1 ? "course" : "courses"} found
            </p>
            <div className="admin-grid">
              {data.items.map((course) => (
                <article className="panel admin-course-card" key={course._id}>
                  <div className="admin-course-top">
                    <Badge tone="purple">{course.code}</Badge>
                    <Badge
                      tone={
                        course.deletedAt
                          ? "neutral"
                          : course.published
                            ? "green"
                            : "orange"
                      }
                    >
                      {course.deletedAt
                        ? "Archived"
                        : course.published
                          ? "Published"
                          : "Unpublished"}
                    </Badge>
                  </div>
                  <h2>{course.title}</h2>
                  <p className="admin-meta">
                    {course.category} · {course.instructorName}
                  </p>
                  <p className="admin-course-description">
                    {course.description}
                  </p>
                  <Counts
                    items={[
                      ["Students", course.counts.enrollments],
                      ["Assignments", course.counts.assignments],
                      ["Materials", course.counts.materials],
                      ["Submissions", course.counts.submissions],
                    ]}
                  />
                  <div className="admin-course-actions">
                    <Button
                      variant="light"
                      onClick={() => setSelected(course._id)}
                      aria-label={`View course ${course.code}`}
                    >
                      View course <ArrowUpRight size={15} />
                    </Button>
                    {!course.deletedAt && (
                      <Button
                        variant="light"
                        onClick={() => setPublication(course)}
                        aria-label={`${course.published ? "Unpublish" : "Publish"} ${course.code}`}
                      >
                        {course.published ? "Unpublish" : "Publish"}
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {!data.items.length && (
              <div className="panel">
                <Empty
                  title="No matching courses"
                  text="Try another title, course code, or publication status."
                />
              </div>
            )}
            <Pagination
              page={data.page}
              pages={data.pages}
              onChange={setPage}
            />
          </>
        )}
      </ListState>
      {selected && (
        <CourseDialog courseId={selected} onClose={() => setSelected(null)} />
      )}
      {publication && (
        <Confirm
          confirmLabel={
            publication.published ? "Unpublish course" : "Publish course"
          }
          variant="primary"
          title={`${publication.published ? "Unpublish" : "Publish"} ${publication.code}?`}
          text={
            publication.published
              ? "This course will be hidden from the enrollment catalog. Existing students will keep access to their learning materials and assignments."
              : "This course will be available in the catalog for students to enroll."
          }
          onClose={() => setPublication(null)}
          onConfirm={async () => {
            const { data } = await api.patch(
              `/admin/courses/${publication._id}/publication`,
              { published: !publication.published },
            );
            toast.success(data.message);
            setPublication(null);
            reload();
          }}
        />
      )}
    </>
  );
}
function CourseDialog({ courseId, onClose }) {
  const { data, loading, error, reload } = useResource(
    `/admin/courses/${courseId}`,
  );
  return (
    <Modal title="Course overview" onClose={onClose} wide>
      <ListState loading={loading} error={error} reload={reload}>
        {data && (
          <>
            <Badge tone="purple">{data.course.code}</Badge>
            <h3 className="admin-course-title">{data.course.title}</h3>
            <p className="admin-meta">
              {data.course.instructorName} · {data.course.instructorEmail}
            </p>
            <p className="preserve-lines">{data.course.description}</p>
            {data.course.deletedAt && (
              <p className="admin-notice">
                This course was archived on {formatDate(data.course.deletedAt)}.
                Its records are retained for oversight.
              </p>
            )}
            <Counts
              items={[
                ["Students", data.course.counts.enrollments],
                ["Materials", data.course.counts.materials],
                ["Assignments", data.course.counts.assignments],
                ["Announcements", data.course.counts.announcements],
                ["Submissions", data.course.counts.submissions],
              ]}
            />
            <h4 className="admin-section-title">
              Latest assignments <small>Up to 10, ordered by deadline</small>
            </h4>
            {data.assignments.length ? (
              <div className="admin-feed">
                {data.assignments.map((assignment) => (
                  <div className="admin-feed-row" key={assignment._id}>
                    <div>
                      <strong>{assignment.title}</strong>
                      <p>
                        Due {formatDate(assignment.dueDate, true)} ·{" "}
                        {assignment.maxPoints} points
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="admin-meta">No assignments in this course.</p>
            )}
            <h4 className="admin-section-title">
              Recent submissions <small>Up to 10 most recent</small>
            </h4>
            <SubmissionRows items={data.recentSubmissions} />
            <h4 className="admin-section-title">
              Recent announcements <small>Up to five most recent</small>
            </h4>
            {data.announcements.length ? (
              <div className="admin-feed">
                {data.announcements.map((item) => (
                  <div className="admin-feed-row" key={item._id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p className="preserve-lines">{item.body}</p>
                      <small>{formatDate(item.createdAt, true)}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="admin-meta">No announcements in this course.</p>
            )}
            <p className="admin-meta admin-section">
              Learning content and grades are managed by the course instructor.
            </p>
          </>
        )}
      </ListState>
    </Modal>
  );
}

export function AdminActivity() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ search: useDebounced(search), page });
  const { data, loading, error, reload } = useResource(
    `/admin/activity?${query}`,
  );
  return (
    <>
      <PageHeading
        eyebrow="ACCOUNTABILITY"
        title="Admin activity"
        description="Track who created accounts, changed access, or updated course publication."
        action={
          <Button variant="light" onClick={reload}>
            <RefreshCw size={16} />
            Refresh
          </Button>
        }
      />
      <div className="admin-toolbar">
        <AdminSearch
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search admin activity"
        />
      </div>
      <ListState loading={loading} error={error} reload={reload}>
        {data && (
          <>
            <p className="admin-results" role="status">
              {data.total} {data.total === 1 ? "event" : "events"} found
            </p>
            <section className="panel">
              <ActivityRows items={data.items} />
            </section>
            <Pagination
              page={data.page}
              pages={data.pages}
              onChange={setPage}
            />
          </>
        )}
      </ListState>
    </>
  );
}
