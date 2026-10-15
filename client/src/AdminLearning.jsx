import { useState } from "react";
import toast from "react-hot-toast";
import { api, message } from "./api";
import { useDebounced, useResource } from "./hooks";
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
  SearchBox,
  formatDate,
} from "./ui";
import "./learning.css";
export function AdminEnrollments() {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("active"),
    [page, setPage] = useState(1);
  const query = new URLSearchParams({
    search: useDebounced(search),
    status,
    page,
  });
  const { data, loading, error, reload } = useResource(
    `/admin/enrollments?${query}`,
  );
  return (
    <>
      <PageHeading
        eyebrow="CLASSROOM MEMBERSHIP"
        title="Enrollments"
        description="Monitor student membership and current learning progress across the school."
      />
      <div className="admin-toolbar">
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search student or course"
        />
        <select
          className="form-select"
          aria-label="Enrollment course status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="active">Active courses</option>
          <option value="archived">Archived courses</option>
          <option value="all">All courses</option>
        </select>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : (
        <>
          <p>{data.total} enrollments found</p>
          <section className="panel">
            <div className="table-responsive">
              <table className="table app-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Course</th>
                    <th>Enrolled</th>
                    <th>Lectures</th>
                    <th>Assignments</th>
                    <th>Quizzes</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r._id}>
                      <td>
                        {r.student?.name}
                        <small className="learning-block">
                          {r.student?.email}
                        </small>
                      </td>
                      <td>
                        {r.course?.code} · {r.course?.title}
                        {r.course?.deletedAt && <Badge>Archived</Badge>}
                      </td>
                      <td>{formatDate(r.createdAt)}</td>
                      <td>
                        {r.progress?.lecturesCompleted || 0}/
                        {r.progress?.lectureCount || 0}
                      </td>
                      <td>
                        {r.progress?.assignmentsSubmitted || 0}/
                        {r.progress?.assignmentCount || 0}
                      </td>
                      <td>
                        {r.progress?.quizzesCompleted || 0}/
                        {r.progress?.quizCount || 0}
                      </td>
                      <td>{r.progress?.progressPercent || 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.items.length && (
              <Empty
                title="No matching enrollments"
                text="Try a different student, course, or status."
              />
            )}
          </section>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </>
  );
}
export function AdminAnnouncements() {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [editor, setEditor] = useState(null),
    [remove, setRemove] = useState(null);
  const { data, loading, error, reload } = useResource(
    `/admin/announcements?${new URLSearchParams({ search: useDebounced(search), page })}`,
  );
  return (
    <>
      <PageHeading
        eyebrow="FROM THE SCHOOL"
        title="School announcements"
        description="Send updates to student and instructor inboxes. Students see the same updates on web and Flutter."
        action={
          <Button onClick={() => setEditor({})}>Post announcement</Button>
        }
      />
      <SearchBox
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Search school announcements"
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : (
        <>
          <div className="resource-list">
            {data.items.map((a) => (
              <article className="panel" key={a._id}>
                <div className="record-heading">
                  <h3>{a.title}</h3>
                  <Badge>
                    {a.audience === "all"
                      ? "Students & instructors"
                      : a.audience === "student"
                        ? "Students"
                        : "Instructors"}
                  </Badge>
                </div>
                <p className="notice-body">{a.body}</p>
                <small>Updated {formatDate(a.updatedAt, true)}</small>
                <div className="learning-toolbar">
                  <Button variant="light" onClick={() => setEditor(a)}>
                    Edit announcement
                  </Button>
                  <Button variant="outline-danger" onClick={() => setRemove(a)}>
                    Delete announcement
                  </Button>
                </div>
              </article>
            ))}
          </div>
          {!data.items.length && (
            <Empty
              title="No school announcements"
              text="Post your first school update when it is ready."
            />
          )}
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
      {editor && (
        <SchoolEditor
          record={editor}
          onClose={() => setEditor(null)}
          onSaved={reload}
        />
      )}
      {remove && (
        <Confirm
          title="Delete announcement?"
          text="This removes the announcement from learner inboxes."
          onClose={() => setRemove(null)}
          onConfirm={async () => {
            await api.delete(`/admin/announcements/${remove._id}`);
            setRemove(null);
            reload();
          }}
        />
      )}
    </>
  );
}
function SchoolEditor({ record, onClose, onSaved }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title={
        record._id ? "Edit school announcement" : "Post school announcement"
      }
      onClose={() => !busy && onClose()}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const body = Object.fromEntries(new FormData(e.currentTarget));
          setBusy(true);
          setError("");
          try {
            await api[record._id ? "patch" : "post"](
              `/admin/announcements${record._id ? `/${record._id}` : ""}`,
              body,
            );
            onSaved();
            onClose();
            toast.success("School announcement saved.");
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          label="Announcement title"
          name="title"
          required
          minLength={3}
          maxLength={160}
          defaultValue={record.title}
        />
        <Field
          label="Message"
          name="body"
          textarea
          required
          minLength={5}
          maxLength={6000}
          rows={6}
          defaultValue={record.body}
        />
        <Field label="Audience" name="audience">
          <select
            id="audience"
            name="audience"
            className="form-select"
            defaultValue={record.audience || "all"}
          >
            <option value="all">Students and instructors</option>
            <option value="student">Students only</option>
            <option value="instructor">Instructors only</option>
          </select>
        </Field>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button
            type="button"
            variant="light"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            Save announcement
          </Button>
        </div>
      </form>
    </Modal>
  );
}
