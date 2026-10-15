import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { api, message } from "./api";
import { Brand } from "./Shell";
import { Button, Field } from "./ui";
import { passwordRequirements, validateAuth } from "./auth-validation";
import EmailVerification from "./EmailVerification";
export default function PasswordReset() {
  const [email, setEmail] = useState(""),
    [challenge, setChallenge] = useState(null),
    [proof, setProof] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [touched, setTouched] = useState({}),
    [done, setDone] = useState(false);
  const validation = validateAuth(
    { email, password, name: "Password reset" },
    { register: !!proof },
  );
  const passwordError = validation.password,
    confirmError =
      confirm !== password
        ? "Passwords must match."
        : !confirm
          ? "Confirm your new password."
          : "";
  return (
    <div className="auth-page recovery-page">
      <aside className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <span className="eyebrow">A FRESH START</span>
          <h1>
            Back to
            <br />
            your next
            <br />
            <span>chapter.</span>
          </h1>
          <p>
            Verify your email and choose a new password to get back to learning.
          </p>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-form-wrap">
          <Brand />
          <h2 style={{ marginTop: 32 }}>
            {done
              ? "You’re ready to return."
              : proof
                ? "Choose a new password."
                : challenge
                  ? "Check your inbox."
                  : "Forgot your password?"}
          </h2>
          {done ? (
            <>
              <p>
                Your password has been updated. All previous sessions have been
                signed out.
              </p>
              <Link className="btn btn-primary" to="/login">
                Back to sign in
              </Link>
            </>
          ) : proof ? (
            <form
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                setTouched({ password: true, confirm: true });
                setError("");
                if (passwordError || confirmError) return;
                setBusy(true);
                try {
                  await api.post("/auth/reset-password", {
                    resetToken: proof,
                    newPassword: password,
                  });
                  setPassword("");
                  setConfirm("");
                  setProof("");
                  setDone(true);
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field
                label="New password"
                name="newPassword"
                error={touched.password ? passwordError || "" : ""}
              >
                <div className="password-field">
                  <input
                    id="newPassword"
                    className="form-control"
                    type={show ? "text" : "password"}
                    value={password}
                    autoComplete="new-password"
                    maxLength={72}
                    disabled={busy}
                    aria-invalid={touched.password && !!passwordError}
                    aria-describedby="newPassword-error reset-rules"
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setTouched({ ...touched, password: true });
                      setError("");
                    }}
                  />
                  <button
                    className="icon-btn"
                    type="button"
                    disabled={busy}
                    aria-label={show ? "Hide password" : "Show password"}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>
              <ul id="reset-rules" className="password-requirements">
                {passwordRequirements(password).map((r) => (
                  <li className={r.met ? "met" : ""} key={r.label}>
                    {r.met ? "✓" : "○"} {r.label}
                  </li>
                ))}
              </ul>
              <Field
                label="Confirm new password"
                name="confirmPassword"
                type={show ? "text" : "password"}
                value={confirm}
                autoComplete="new-password"
                maxLength={72}
                disabled={busy}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setTouched({ ...touched, confirm: true });
                  setError("");
                }}
                error={touched.confirm ? confirmError : ""}
              />
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <Button busy={busy} type="submit" className="w-100">
                Update password
              </Button>
              <Button
                type="button"
                variant="light"
                disabled={busy}
                onClick={() => {
                  setProof("");
                  setChallenge(null);
                  setError("");
                  setPassword("");
                  setConfirm("");
                  setTouched({});
                  setShow(false);
                }}
              >
                Request a new code
              </Button>
            </form>
          ) : challenge ? (
            <EmailVerification
              email={email.trim().toLowerCase()}
              purpose="reset"
              initialChallenge={challenge}
              onVerified={(data) => {
                setProof(data.resetToken);
                setError("");
              }}
              onBack={() => {
                setChallenge(null);
                setError("");
              }}
            />
          ) : (
            <form
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                setTouched({ email: true });
                setError("");
                if (validation.email) return;
                setBusy(true);
                try {
                  const { data } = await api.post("/auth/email-otp/request", {
                    email,
                    purpose: "reset",
                  });
                  setChallenge(data);
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                Enter your account email. If an eligible account exists, we’ll
                send a reset code.
              </p>
              <Field
                label="Email address"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                maxLength={160}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setTouched({ email: true });
                  setError("");
                }}
                error={touched.email ? validation.email || "" : ""}
                disabled={busy}
              />
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <Button type="submit" busy={busy} className="w-100">
                Send reset code
              </Button>
            </form>
          )}
          {!done && (
            <p className="auth-switch">
              <Link to="/login">Back to sign in</Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
