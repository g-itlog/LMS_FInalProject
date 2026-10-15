import { useState } from "react";
import { Copy, KeyRound, Plus } from "lucide-react";
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

export default function AdminInvitations() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [changing, setChanging] = useState(null);
  const query = new URLSearchParams({
    search: useDebounced(search),
    status,
    page,
  });
  const { data, loading, error, reload } = useResource(
    `/admin/invitations?${query}`,
  );
  async function copyCode(row) {
    try {
      await navigator.clipboard.writeText(row.code);
      toast.success("Invitation code copied.");
    } catch {
      toast.error(
        "Select the code and copy it manually; clipboard access is unavailable.",
      );
    }
  }
  function saved() {
    setEditing(null);
    setSearch("");
    setStatus("all");
    setPage(1);
    reload();
  }
  return (
    <>
      <PageHeading
        eyebrow="INSTRUCTOR ACCESS"
        title="Invitation codes"
        description="Each active code registers one instructor. It leaves the available list after a successful registration."
        action={
          <Button onClick={() => setEditing({})}>
            <Plus size={17} />
            Create invitation
          </Button>
        }
      />
      <div className="admin-notice admin-invitation-notice">
        <KeyRound size={19} />
        <p>
          Share codes privately with authorized instructors. Deactivate a leaked
          code to block new registrations with it. Existing instructor accounts
          keep their access.
        </p>
      </div>
      <div className="admin-toolbar">
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value.slice(0, 100));
            setPage(1);
          }}
          placeholder="Search invitation codes"
        />
        <select
          className="form-select"
          aria-label="Filter invitation status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">Unused invitations</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="used">Used history</option>
        </select>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : (
        data && (
          <>
            <p className="admin-results" role="status">
              {data.total} {data.total === 1 ? "invitation" : "invitations"}{" "}
              found
            </p>
            <div className="admin-grid">
              {data.items.map((row) => (
                <article className="panel admin-invitation-card" key={row._id}>
                  <div className="admin-course-top">
                    <h2>{row.label}</h2>
                    <Badge tone={row.active ? "green" : "neutral"}>
                      {row.used ? "Used" : row.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {!row.used && (
                    <div className="admin-invitation-value">
                      <code>{row.code}</code>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => copyCode(row)}
                        aria-label={`Copy invitation code for ${row.label}`}
                        title="Copy invitation code"
                      >
                        <Copy size={18} />
                      </button>
                    </div>
                  )}
                  <p className="admin-meta">
                    Single use · Created {formatDate(row.createdAt)}
                  </p>
                  <p className="admin-meta">
                    {row.used
                      ? `Consumed ${formatDate(row.usedAt || row.lastUsedAt, true)}. This code cannot be reused or reactivated.`
                      : row.active
                        ? "Available for one successful instructor registration."
                        : "Deactivated. Registration with this code is blocked."}
                  </p>
                  {!row.used && (
                    <div className="admin-course-actions">
                      <Button
                        variant="light"
                        onClick={() => setEditing(row)}
                        aria-label={`Edit invitation ${row.label}`}
                      >
                        Edit invitation
                      </Button>
                      <Button
                        variant="light"
                        onClick={() => setChanging(row)}
                        aria-label={`${row.active ? "Deactivate" : "Reactivate"} invitation ${row.label}`}
                      >
                        {row.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  )}
                </article>
              ))}
            </div>
            {!data.items.length && (
              <div className="panel">
                <Empty
                  title="No matching invitation codes"
                  text="Create an invitation or adjust your search and status filter."
                />
              </div>
            )}
            <Pagination
              page={data.page}
              pages={data.pages}
              onChange={setPage}
            />
          </>
        )
      )}
      {editing && (
        <InvitationEditor
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
      {changing && (
        <Confirm
          title={
            changing.active
              ? "Deactivate this invitation?"
              : "Reactivate this invitation?"
          }
          text={
            changing.active
              ? `New instructor registrations using “${changing.label}” will be rejected. Existing instructor accounts will keep their access.`
              : `“${changing.label}” will be accepted for new instructor registrations again. Only reactivate it if the code is still private.`
          }
          confirmLabel={
            changing.active ? "Deactivate invitation" : "Reactivate invitation"
          }
          variant={changing.active ? "danger" : "primary"}
          onClose={() => setChanging(null)}
          onConfirm={async () => {
            await api.patch(`/admin/invitations/${changing._id}`, {
              active: !changing.active,
            });
            toast.success(
              changing.active
                ? "Invitation deactivated."
                : "Invitation reactivated.",
            );
            setChanging(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function InvitationEditor({ row, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!values.code.trim()) delete values.code;
    setBusy(true);
    setError("");
    try {
      if (row._id) await api.patch(`/admin/invitations/${row._id}`, values);
      else await api.post("/admin/invitations", values);
      toast.success(
        row._id
          ? "Invitation updated. Its activation status is unchanged."
          : "Invitation created. Copy its code and share it privately.",
      );
      onSaved();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={row._id ? "Edit invitation" : "Create invitation"}
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={save}>
        <Field
          label="Invitation label"
          name="label"
          required
          minLength={2}
          maxLength={80}
          placeholder="e.g. Faculty onboarding — October"
          defaultValue={row.label || ""}
          disabled={busy}
          hint="Use a recognizable label for the instructors or department receiving this code."
        />
        <Field
          label={
            row._id ? "Replacement code (optional)" : "Custom code (optional)"
          }
          name="code"
          autoComplete="off"
          minLength={16}
          maxLength={128}
          pattern="[A-Za-z0-9_-]+"
          disabled={busy}
          placeholder={
            row._id
              ? "Leave blank to keep the current code"
              : "Leave blank to generate a secure code"
          }
          hint={
            row._id
              ? "Replacing the code immediately invalidates its old value. Use 16–128 letters, numbers, underscores, or hyphens."
              : "A secure random code is generated automatically when left blank. Custom codes must use 16–128 letters, numbers, underscores, or hyphens."
          }
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
            {row._id ? "Save invitation" : "Create invitation"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
