import { useState } from "react";
import { api, message } from "./api";
import { Button, Field, Modal } from "./ui";
import toast from "react-hot-toast";

function localDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function Editor({ type, record, courseId, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [color, setColor] = useState(record?.color || "violet");
  const names = {
    courses: "course",
    materials: "learning material",
    assignments: "assignment",
    announcements: "announcement",
  };
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    let data = Object.fromEntries(form);
    if (type === "courses") {
      data.published = form.has("published");
      data.color = color;
    }
    if (type === "assignments") {
      data.dueDate = new Date(data.dueDate).toISOString();
      data.maxPoints = Number(data.maxPoints);
      data.allowLate = form.has("allowLate");
    }
    if (type === "announcements") data.pinned = form.has("pinned");
    if (type === "materials") {
      if (!form.get("file")?.size) form.delete("file");
      data = form;
    }
    const url = record
      ? `/${type}/${record._id}`
      : type === "courses"
        ? "/courses"
        : `/courses/${courseId}/${type}`;
    try {
      await api[record ? "patch" : "post"](url, data, {
        timeout: type === "materials" ? 120000 : 30000,
      });
      toast.success(`${record ? "Updated" : "Created"} successfully.`);
      onSaved();
      onClose();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${record ? "Edit" : "Create"} ${names[type]}`}
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={submit}>
        <Field
          label={type === "courses" ? "Course title" : "Title"}
          name="title"
          required
          minLength={3}
          maxLength={type === "courses" ? 120 : 160}
          defaultValue={record?.title}
          placeholder={
            type === "courses"
              ? "e.g. Introduction to Web Development"
              : "Give it a clear, descriptive title"
          }
        />
        {type === "courses" && (
          <>
            <div className="form-two">
              <Field
                label="Course code"
                name="code"
                required
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9 -]+"
                defaultValue={record?.code}
                placeholder="e.g. IT 101"
              />
              <Field
                label="Category"
                name="category"
                required
                minLength={2}
                maxLength={60}
                defaultValue={record?.category}
                placeholder="e.g. Computer Science"
              />
            </div>
            <Field
              label="Description"
              name="description"
              textarea
              rows={4}
              required
              minLength={10}
              maxLength={3000}
              defaultValue={record?.description}
              placeholder="What will students learn in this course?"
            />
            <div className="field">
              <label>Course color</label>
              <div className="color-picker">
                {["violet", "blue", "teal", "orange", "pink"].map((c) => (
                  <button
                    type="button"
                    key={c}
                    aria-label={`${c} course color`}
                    aria-pressed={color === c}
                    className={`color-swatch ${c} ${color === c ? "selected" : ""}`}
                    onClick={() => setColor(c)}
                  >
                    {color === c ? "✓" : ""}
                  </button>
                ))}
              </div>
            </div>
            <label className="check-field">
              <input
                name="published"
                type="checkbox"
                defaultChecked={record?.published}
              />
              Publish course and allow student enrollment
            </label>
          </>
        )}
        {type === "assignments" && (
          <>
            <Field
              label="Instructions"
              name="instructions"
              textarea
              rows={5}
              required
              minLength={10}
              maxLength={6000}
              defaultValue={record?.instructions}
              placeholder="Describe the task, requirements, and assessment criteria."
            />
            <div className="form-two">
              <Field
                label="Deadline (your local time)"
                name="dueDate"
                type="datetime-local"
                required
                defaultValue={localDate(record?.dueDate)}
              />
              <Field
                label="Maximum points"
                name="maxPoints"
                type="number"
                min={1}
                max={1000}
                step={1}
                required
                defaultValue={record?.maxPoints || 100}
              />
            </div>
            <label className="check-field">
              <input
                type="checkbox"
                name="allowLate"
                defaultChecked={record?.allowLate}
              />
              Accept late submissions
            </label>
          </>
        )}
        {type === "announcements" && (
          <>
            <Field
              label="Message"
              name="body"
              textarea
              rows={6}
              required
              minLength={5}
              maxLength={6000}
              defaultValue={record?.body}
              placeholder="Share an update with your class…"
            />
            <label className="check-field">
              <input
                type="checkbox"
                name="pinned"
                defaultChecked={record?.pinned}
              />
              Pin this announcement
            </label>
          </>
        )}
        {type === "materials" && (
          <>
            <Field
              label="Description"
              name="description"
              textarea
              rows={3}
              maxLength={3000}
              defaultValue={record?.description}
              placeholder="Add context for this resource (optional)."
            />
            <Field
              label="Resource link"
              name="url"
              type="url"
              maxLength={2000}
              defaultValue={record?.url}
              placeholder="https://…"
              hint="Upload a file, add a link, or use both."
            />
            <Field
              label={
                record?.file
                  ? "Replace attached file (optional)"
                  : "Attach file"
              }
              name="file"
              type="file"
              accept=".pdf,.txt,.csv,.docx,.pptx,.xlsx,.zip,.png,.jpg,.jpeg,.mp4"
              hint={
                record?.file
                  ? `Current: ${record.file.name}. Maximum 3 MB.`
                  : "PDF, text, Office documents, ZIP, images, or MP4. Maximum 3 MB."
              }
            />
          </>
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
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            {record ? "Save changes" : `Create ${names[type]}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
