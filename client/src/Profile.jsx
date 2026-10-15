import { useState } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "./auth";
import { api, message } from "./api";
import { Badge, Button, Field, PageHeading, formatDate } from "./ui";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.patch(
        "/auth/profile",
        Object.fromEntries(new FormData(event.currentTarget)),
      );
      setUser(data.user);
      toast.success("Profile updated.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function password(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (data.newPassword !== data.confirmPassword)
      return setPasswordError("The new passwords do not match.");
    setPasswordBusy(true);
    setPasswordError("");
    try {
      await api.patch("/auth/password", data);
      form.reset();
      toast.success("Password changed. Other sessions have been signed out.");
    } catch (e) {
      setPasswordError(message(e));
    } finally {
      setPasswordBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="My profile"
        description="A little about you, and the details that keep your account secure."
      />
      <div className="profile-grid">
        <aside className="panel profile-summary">
          <span className="avatar large">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </span>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <Badge tone="purple">
            {user.role === "admin"
              ? "Administrator"
              : user.role === "instructor"
                ? "Instructor"
                : "Student"}
          </Badge>
          {user.department && (
            <p className="profile-department">{user.department}</p>
          )}
          <hr />
          <span>
            Learning with us since
            <br />
            <strong>{formatDate(user.createdAt)}</strong>
          </span>
          <div className="profile-security">
            <ShieldCheck size={17} /> Secure account
          </div>
        </aside>
        <div className="profile-forms">
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>
                  <UserRound size={19} />
                  Personal information
                </h2>
                <p>Your name and a little about your learning journey.</p>
              </div>
            </div>
            <form onSubmit={save}>
              <Field
                label="Full name"
                name="name"
                required
                minLength={2}
                maxLength={80}
                defaultValue={user.name}
              />
              <Field
                label="Email address"
                name="email"
                type="email"
                value={user.email}
                disabled
                hint="Your email identifies your account and cannot be changed here."
              />
              <Field
                label="Department or program"
                name="department"
                maxLength={100}
                defaultValue={user.department}
                placeholder="e.g. BS Information Technology"
              />
              <Field
                label="About me"
                name="bio"
                textarea
                rows={4}
                maxLength={600}
                defaultValue={user.bio}
                placeholder="Your interests, goals, or a little introduction…"
              />
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <Button busy={busy} type="submit">
                  Save profile
                </Button>
              </div>
            </form>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>
                  <ShieldCheck size={19} />
                  Password & security
                </h2>
                <p>Changing your password signs out your other devices.</p>
              </div>
            </div>
            <form onSubmit={password}>
              <Field
                label="Current password"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
              <div className="form-two">
                <Field
                  label="New password"
                  name="newPassword"
                  type="password"
                  minLength={8}
                  maxLength={72}
                  required
                  autoComplete="new-password"
                />
                <Field
                  label="Confirm new password"
                  name="confirmPassword"
                  type="password"
                  minLength={8}
                  maxLength={72}
                  required
                  autoComplete="new-password"
                />
              </div>
              <small className="password-help">
                Use 8–72 characters with an uppercase letter, a lowercase
                letter, and a number.
              </small>
              {passwordError && (
                <p className="form-error" role="alert">
                  {passwordError}
                </p>
              )}
              <div className="form-actions">
                <Button busy={passwordBusy} type="submit" variant="light">
                  Update password
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
