import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api, message } from "./api";
import { useResource } from "./hooks";
import {
  Badge,
  Button,
  Empty,
  ErrorState,
  Loading,
  PageHeading,
  Pagination,
  formatDate,
} from "./ui";
import "./learning.css";
export default function Notices() {
  const [page, setPage] = useState(1),
    [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useResource(
    `/notifications?page=${page}`,
  );
  async function mark(path, method = "patch") {
    setBusy(true);
    try {
      await api[method](path);
      reload();
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="STAY CONNECTED"
        title="Your inbox"
        description="School updates, course news, new materials, and approaching or overdue deadlines."
        action={
          <Button
            busy={busy}
            variant="light"
            onClick={() => mark("/notifications/read-all", "post")}
          >
            Mark all as read
          </Button>
        }
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : (
        <>
          <p role="status">
            {data.unread} unread · {data.total} current notifications
          </p>
          <p>
            Deadline reminders cover the next 7 days. Submitted work clears its
            reminders. Read states are shared with the student mobile app.
          </p>
          <div className="resource-list">
            {data.items.map((n) => (
              <article
                className={`panel ${n.read ? "" : "notice-unread"}`}
                key={n._id}
              >
                <div className="record-heading">
                  <h3>{n.title}</h3>
                  <Badge tone={n.read ? "neutral" : "blue"}>
                    {n.read ? "Read" : "Unread"}
                  </Badge>
                </div>
                <p className="notice-body">{n.body}</p>
                <small>{formatDate(n.createdAt, true)}</small>
                <div className="learning-toolbar">
                  {!n.read && (
                    <Button
                      variant="light"
                      disabled={busy}
                      onClick={() => mark(`/notifications/${n._id}/read`)}
                    >
                      Mark as read
                    </Button>
                  )}
                  {n.courseId && (
                    <Link
                      className="btn btn-light"
                      to={`/courses/${n.courseId}?tab=${n.tab}${n.extensionAssignmentId ? `&extensions=${n.extensionAssignmentId}` : ""}`}
                    >
                      {n.extensionAssignmentId
                        ? "View extension request"
                        : "Open course"}
                    </Link>
                  )}
                </div>
              </article>
            ))}
            {!data.items.length && (
              <Empty
                title="You’re all caught up"
                text="Your school and course updates will appear here."
              />
            )}
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </>
  );
}
