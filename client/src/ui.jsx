import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Download,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { downloadFile, message } from "./api";
import toast from "react-hot-toast";

export const formatDate = (value, time = false) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
      }).format(new Date(value))
    : "—";
export function Button({
  children,
  busy,
  variant = "primary",
  className = "",
  ...props
}) {
  return (
    <button
      {...props}
      className={`btn btn-${variant} ${className}`}
      disabled={busy || props.disabled}
    >
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={30} />
      <p>Getting things ready…</p>
    </div>
  );
}
export function ErrorState({ error, retry }) {
  return (
    <div className="empty-state" role="alert">
      <AlertCircle size={36} />
      <h3>We couldn’t load this page</h3>
      <p>{error}</p>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}
export function Empty({ title, text, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <BookOpen size={28} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow || "YOUR LEARNING SPACE"}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Field({ label, name, textarea, children, hint, ...props }) {
  const Component = textarea ? "textarea" : "input";
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children || (
        <Component className="form-control" id={name} name={name} {...props} />
      )}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Badge({ children, tone = "neutral" }) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    const close = (event) => {
      event.preventDefault();
      closeRef.current();
    };
    dialog.addEventListener("cancel", close);
    return () => {
      dialog.removeEventListener("cancel", close);
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`app-modal ${wide ? "wide" : ""}`}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-top">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Confirm({ title, text, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal title={title} onClose={() => !busy && onClose()}>
      <p>{text}</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button variant="light" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="danger"
          busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } catch (e) {
              setError(message(e));
              setBusy(false);
            }
          }}
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
}
export function SearchBox({ value, onChange, placeholder = "Search…" }) {
  return (
    <div className="search-box">
      <Search size={18} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button onClick={() => onChange("")} aria-label="Clear search">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
export function Pagination({ page, pages, onChange }) {
  return (
    pages > 1 && (
      <nav className="pagination-bar" aria-label="Pagination">
        <Button
          variant="light"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ArrowLeft size={15} /> Previous
        </Button>
        <span>
          Page {page} of {pages}
        </span>
        <Button
          variant="light"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next <ArrowRight size={15} />
        </Button>
      </nav>
    )
  );
}
export function FileDownload({ file }) {
  const [busy, setBusy] = useState(false);
  return (
    file && (
      <Button
        variant="light"
        busy={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await downloadFile(file);
          } catch (error) {
            toast.error(message(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download size={15} />
        <span className="truncate">{file.name}</span>
      </Button>
    )
  );
}
export function CourseCard({ course }) {
  return (
    <Link to={`/courses/${course._id}`} className="course-card">
      <div className={`course-cover ${course.color || "violet"}`}>
        <span className="course-code">{course.code}</span>
        <BookOpen size={70} strokeWidth={1} />
        <span className="cover-dots" />
      </div>
      <div className="course-card-body">
        <div className="course-category">{course.category}</div>
        <h3>{course.title}</h3>
        <p>{course.instructorName || "Your classroom"}</p>
        <div className="course-card-footer">
          <span>{course.studentCount ?? "—"} students</span>
          <span>
            {course.enrolled ? (
              <>
                <Check size={13} /> Enrolled
              </>
            ) : course.published ? (
              "Open course"
            ) : (
              "Draft"
            )}{" "}
            <ArrowRight size={15} />
          </span>
        </div>
      </div>
    </Link>
  );
}
export function assignmentStatus(assignment, submission) {
  return submission?.grade != null
    ? ["Graded", "green"]
    : submission
      ? [submission.late ? "Submitted late" : "Submitted", "blue"]
      : new Date(assignment.dueDate) < new Date()
        ? [assignment.allowLate ? "Overdue · open" : "Closed", "red"]
        : ["To do", "orange"];
}
