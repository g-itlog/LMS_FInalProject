import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowUpRight,
  Check,
  Circle,
} from "lucide-react";
import { useAuth } from "./auth";
import { api, message } from "./api";
import { Brand } from "./Shell";
import { Button, Field, Modal } from "./ui";
import EmailVerification from "./EmailVerification";
import { passwordRequirements, validateAuth } from "./auth-validation";

const emptyValues = { name: "", email: "", password: "", inviteCode: "" };

export default function AuthPage({ register = false }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const registeredEmail =
    !register && typeof location.state?.registeredEmail === "string"
      ? location.state.registeredEmail
      : "";
  const [role, setRole] = useState("student");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState(() => ({
    ...emptyValues,
    email: registeredEmail,
  }));
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [challenge, setChallenge] = useState(null),
    [proof, setProof] = useState(null);
  async function complete(values, token) {
    const { data } = await api.post("/auth/register", {
      ...values,
      role,
      verificationToken: token,
    });
    setChallenge(null);
    setProof(null);
    setValues(emptyValues);
    navigate("/login", {
      replace: true,
      state: { registeredEmail: data.user.email },
    });
  }
  const errors = validateAuth(values, { register, role });
  const fieldError = (name) =>
    touched[name] || submitted ? errors[name] || "" : "";
  function bindField(name) {
    return {
      value: values[name],
      disabled: busy,
      onChange(event) {
        const value = event.target.value;
        setValues((current) => ({ ...current, [name]: value }));
        setTouched((current) => ({ ...current, [name]: true }));
        setError("");
      },
      onBlur() {
        // Autofocusing a blank login password must not move links on pointerdown.
        // Edited fields validate as typed; untouched blanks validate on submit.
        if (values[name].length)
          setTouched((current) => ({ ...current, [name]: true }));
      },
    };
  }
  if (user) return <Navigate to="/" replace />;
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setValues({ ...emptyValues, ...values });
    setSubmitted(true);
    const validation = validateAuth(values, { register, role });
    if (Object.keys(validation).length) {
      event.currentTarget.elements
        .namedItem(Object.keys(validation)[0])
        ?.focus();
      return;
    }
    setBusy(true);
    try {
      if (register) {
        if (proof?.email === values.email.trim().toLowerCase())
          await complete(values, proof.token);
        else {
          const { data } = await api.post("/auth/email-otp/request", {
            email: values.email,
            purpose: "register",
          });
          setChallenge(data);
        }
        return;
      }
      const { data } = await api.post("/auth/login", values);
      setUser(data.user);
      navigate("/", { replace: true });
    } catch (e) {
      if (/verification expired|already used/i.test(message(e))) setProof(null);
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <span className="auth-chip">YOUR LEARNING WORKSPACE</span>
          <h1>
            A place for
            <br />
            your next
            <br />
            <span>great idea.</span>
          </h1>
          <p>
            Bring your courses, assignments, and class updates together. Spend
            less time looking, and more time learning.
          </p>
          <div className="auth-index">
            <div>
              <span>01</span>
              <strong>
                A classroom, connected
                <small>Courses and materials in one place.</small>
              </strong>
              <ArrowUpRight size={19} />
            </div>
            <div>
              <span>02</span>
              <strong>
                Know what’s next
                <small>Clear deadlines. Simple submissions.</small>
              </strong>
              <ArrowUpRight size={19} />
            </div>
            <div>
              <span>03</span>
              <strong>
                Feedback that matters
                <small>Keep track of your work and grades.</small>
              </strong>
              <ArrowUpRight size={19} />
            </div>
          </div>
        </div>
        <div className="auth-story-footer">
          <ShieldCheck size={16} /> Your learning. Secure and connected.
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">WELCOME TO KNOWHERE TO GROW</span>
          <h2>{register ? "Make yourself at home." : "Welcome back."}</h2>
          <p>
            {register
              ? "Create your account to join your classroom."
              : "Sign in to pick up where you left off."}
          </p>
          {registeredEmail && (
            <div className="alert alert-success" role="status">
              Registration successful. Please enter your password to sign in.
            </div>
          )}
          {register && (
            <div className="role-picker">
              <button
                type="button"
                disabled={busy}
                className={role === "student" ? "selected" : ""}
                onClick={() => {
                  setRole("student");
                  setError("");
                }}
              >
                I’m a student
              </button>
              <button
                type="button"
                disabled={busy}
                className={role === "instructor" ? "selected" : ""}
                onClick={() => {
                  setRole("instructor");
                  setError("");
                }}
              >
                I’m an instructor
              </button>
            </div>
          )}
          <form onSubmit={submit} noValidate>
            {register && (
              <Field
                label="Full name"
                name="name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
                placeholder="Your full name"
                {...bindField("name")}
                error={fieldError("name")}
              />
            )}
            <Field
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={160}
              placeholder="you@school.edu"
              hint={
                register
                  ? "We’ll email a code to verify this address before creating your account."
                  : undefined
              }
              {...bindField("email")}
              error={fieldError("email")}
            />
            <Field
              label="Password"
              name="password"
              error={fieldError("password")}
            >
              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  className="form-control"
                  {...bindField("password")}
                  aria-invalid={fieldError("password") ? true : undefined}
                  aria-describedby={
                    [
                      register && "password-requirements",
                      fieldError("password") && "password-error",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  type={show ? "text" : "password"}
                  required
                  minLength={register ? 8 : 1}
                  maxLength={register ? 72 : 200}
                  autoComplete={register ? "new-password" : "current-password"}
                  autoFocus={!!registeredEmail}
                  placeholder={
                    register
                      ? "Create a strong password"
                      : "Enter your password"
                  }
                />
                <button
                  type="button"
                  className="icon-btn"
                  disabled={busy}
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                  aria-controls="password"
                  aria-pressed={show}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {register && (
                <ul
                  id="password-requirements"
                  className="password-requirements"
                  aria-label="Password requirements"
                >
                  {passwordRequirements(values.password).map((rule) => (
                    <li key={rule.label} className={rule.met ? "met" : ""}>
                      {rule.met ? (
                        <Check size={14} aria-hidden="true" />
                      ) : (
                        <Circle size={12} aria-hidden="true" />
                      )}
                      <span className="visually-hidden">
                        {rule.met ? "Met: " : "Required: "}
                      </span>
                      {rule.label}
                    </li>
                  ))}
                </ul>
              )}
            </Field>
            {register && role === "instructor" && (
              <Field
                label="Instructor invitation code"
                name="inviteCode"
                type="password"
                required
                maxLength={200}
                hint="Ask your school administrator for an unused invitation code. Each code works once."
                {...bindField("inviteCode")}
                error={fieldError("inviteCode")}
              />
            )}{" "}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <Button type="submit" busy={busy} className="w-100 auth-submit">
              {register ? "Create account" : "Sign in"}
              <ArrowRight size={18} />
            </Button>
          </form>
          {!register && (
            <p className="auth-switch">
              <Link to="/forgot-password">Forgot password?</Link>
            </p>
          )}
          {challenge && (
            <Modal title="Verify your email" onClose={() => setChallenge(null)}>
              <EmailVerification
                email={values.email.trim().toLowerCase()}
                purpose="register"
                initialChallenge={challenge}
                onBack={() => setChallenge(null)}
                onVerified={async (data) => {
                  setProof({
                    email: values.email.trim().toLowerCase(),
                    token: data.verificationToken,
                  });
                  await complete(values, data.verificationToken);
                }}
              />
            </Modal>
          )}
          <div className="auth-switch">
            {register ? "Already have an account?" : "New around here?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </div>
          <p className="auth-fine">
            {register
              ? "For students and instructors."
              : "For students, instructors, and school administrators."}
            <br />
            Connected learning, wherever you are.
          </p>
        </div>
      </main>
    </div>
  );
}
