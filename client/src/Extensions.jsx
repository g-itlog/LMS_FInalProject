import { useState } from "react";
import toast from "react-hot-toast";
import { api, message } from "./api";
import { useAuth } from "./auth";
import { useResource } from "./hooks";
import {
  Badge,
  Button,
  ErrorState,
  Field,
  Loading,
  Modal,
  Pagination,
  formatDate,
} from "./ui";
import "./learning.css";

export default function Extensions({ assignmentId, onClose }) {
  const teacher = useAuth().user.role === "instructor";
  const [page, setPage] = useState(1),
    [status, setStatus] = useState("all");
  const { data, loading, error, reload } = useResource(
    `/assignments/${assignmentId}/extensions?${new URLSearchParams({ page, status })}`,
  );
  return (
    <Modal
      wide
      title={
        teacher ? "Review deadline extensions" : "Request Deadline Extension"
      }
      onClose={onClose}
    >
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : (
        <>
          <h3>{data.assignment.title}</h3>
          <p>
            Current {teacher ? "class" : "your"} deadline:{" "}
            <strong>{formatDate(data.assignment.dueDate, true)}</strong>
          </p>
          {data.assignment.hasIndividualExtension && (
            <p>
              Class deadline:{" "}
              {formatDate(data.assignment.originalDueDate, true)} · Your
              individual extension is active.
            </p>
          )}
          <p>
            Pending requests do not change deadlines. Approved individual
            extensions apply only to the requesting student. Graded work stays
            locked.
          </p>
          {!teacher &&
            (data.canRequest ? (
              <RequestForm
                key={data.assignment.dueDate}
                assignment={data.assignment}
                onSaved={() => {
                  setPage(1);
                  setStatus("all");
                  reload();
                }}
              />
            ) : (
              <p className="admin-notice">
                {data.pending
                  ? "You already have a pending request. Your instructor will review it."
                  : "Graded work cannot be reopened. You can still read your request history below."}
              </p>
            ))}
          <h3 className="admin-section-title">
            {teacher ? "Student requests" : "Your request history"}
          </h3>
          <select
            aria-label="Filter extension status"
            className="form-select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All requests</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          {!data.items.length && (
            <p className="admin-meta">No extension requests found.</p>
          )}
          {data.items.map((row) => (
            <article className="quiz-question" key={row._id}>
              <div className="record-heading">
                <h4>{row.student?.name || "Your extension request"}</h4>
                <Badge
                  tone={
                    row.status === "approved"
                      ? "green"
                      : row.status === "rejected"
                        ? "red"
                        : "orange"
                  }
                >
                  {row.status[0].toUpperCase() + row.status.slice(1)}
                </Badge>
              </div>
              {row.student?.email && <small>{row.student.email}</small>}
              <dl className="extension-dates">
                <div>
                  <dt>Original class deadline at request</dt>
                  <dd>{formatDate(row.originalDueDate, true)}</dd>
                </div>
                <div>
                  <dt>Student deadline at request</dt>
                  <dd>{formatDate(row.previousDueDate, true)}</dd>
                </div>
                <div>
                  <dt>Requested deadline</dt>
                  <dd>{formatDate(row.requestedDueDate, true)}</dd>
                </div>
                {teacher && (
                  <div>
                    <dt>Current student deadline</dt>
                    <dd>{formatDate(row.currentDueDate, true)}</dd>
                  </div>
                )}
              </dl>
              <strong>Student reason</strong>
              <p className="preserve-lines">{row.reason}</p>
              <small>Requested {formatDate(row.createdAt, true)}</small>
              {row.status !== "pending" && (
                <div className="feedback-box">
                  <p>
                    {row.status === "approved"
                      ? `Approved for ${row.scope === "class" ? "the whole class" : "this student only"}.`
                      : "Rejected. This decision did not change the deadline."}
                  </p>
                  <strong>Instructor comment</strong>
                  <p className="preserve-lines">
                    {row.comment || "No comment provided."}
                  </p>
                  <small>Reviewed {formatDate(row.reviewedAt, true)}</small>
                </div>
              )}
              {teacher && row.status === "pending" && (
                <DecisionForm row={row} onSaved={reload} />
              )}
            </article>
          ))}
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </Modal>
  );
}
function RequestForm({ assignment, onSaved }) {
  const [reason, setReason] = useState(""),
    [requested, setRequested] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dateValue = requested ? new Date(requested) : null;
  const reasonError =
    reason.trim().length < 10
      ? "Enter a reason with at least 10 characters."
      : "";
  const dateError =
    !dateValue || !Number.isFinite(dateValue.getTime())
      ? "Choose a requested deadline."
      : dateValue <= new Date() || dateValue <= new Date(assignment.dueDate)
        ? "Choose a future date later than your current deadline."
        : dateValue > new Date(Date.now() + 365 * 86400000)
          ? "Choose a date within the next 365 days."
          : "";
  const [touched, setTouched] = useState({});
  return (
    <form
      noValidate
      className="quiz-question"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setTouched({ reason: true, date: true });
        setError("");
        if (reasonError || dateError) return;
        setBusy(true);
        try {
          await api.post(`/assignments/${assignment._id}/extensions`, {
            reason,
            requestedDueDate: dateValue.toISOString(),
          });
          toast.success("Extension request sent to your instructor.");
          onSaved();
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field
        label="Reason for extension"
        name="extension-reason"
        textarea
        rows={4}
        minLength={10}
        maxLength={2000}
        required
        value={reason}
        disabled={busy}
        onChange={(e) => {
          setReason(e.target.value);
          setTouched({ ...touched, reason: true });
          setError("");
        }}
        error={touched.reason ? reasonError : ""}
      />
      <Field
        label="Requested deadline (your local time)"
        name="extension-date"
        type="datetime-local"
        required
        value={requested}
        disabled={busy}
        onChange={(e) => {
          setRequested(e.target.value);
          setTouched({ ...touched, date: true });
          setError("");
        }}
        error={touched.date ? dateError : ""}
        hint="Your current deadline stays in force until approval."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" busy={busy}>
        Send extension request
      </Button>
    </form>
  );
}
function DecisionForm({ row, onSaved }) {
  const [scope, setScope] = useState("student"),
    [comment, setComment] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(null);
  async function decide() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.patch(`/extensions/${row._id}`, {
        status: confirm,
        scope,
        comment,
      });
      toast.success(data.message);
      onSaved();
    } catch (e) {
      setError(message(e));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="extension-decision">
      <Field label="Approval applies to" name={`scope-${row._id}`}>
        <select
          className="form-select"
          id={`scope-${row._id}`}
          value={scope}
          disabled={busy}
          onChange={(e) => {
            setScope(e.target.value);
            setConfirm(null);
          }}
        >
          <option value="student">This student only</option>
          <option value="class">Whole class</option>
        </select>
      </Field>
      <Field
        label="Instructor comment (optional)"
        name={`comment-${row._id}`}
        textarea
        rows={3}
        maxLength={2000}
        value={comment}
        disabled={busy}
        onChange={(e) => setComment(e.target.value)}
      />
      {scope === "class" && (
        <p className="admin-notice">
          Approval changes the assignment’s class deadline to the requested date
          for all enrolled students. A later individual deadline remains
          protected.
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {confirm ? (
        <div className="feedback-box" role="alert">
          <p>
            {confirm === "approved"
              ? `Approve until ${formatDate(row.requestedDueDate, true)} for ${scope === "class" ? "the whole class" : "this student only"}?`
              : "Reject this request? Existing deadlines will stay in place."}
          </p>
          <div className="learning-toolbar">
            <Button busy={busy} onClick={decide}>
              {confirm === "approved"
                ? "Confirm approval"
                : "Confirm rejection"}
            </Button>
            <Button
              variant="light"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="learning-toolbar">
          <Button onClick={() => setConfirm("approved")}>Approve</Button>
          <Button
            variant="outline-danger"
            onClick={() => setConfirm("rejected")}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
