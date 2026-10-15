import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "./auth";
import { api, message } from "./api";
import { Brand } from "./Shell";
import { Button, Field } from "./ui";

export default function AuthPage({ register = false }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("student");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (user) return <Navigate to="/" replace />;
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const { data } = await api.post(
        `/auth/${register ? "register" : "login"}`,
        register ? { ...values, role } : values,
      );
      setUser(data.user);
      navigate("/", { replace: true });
    } catch (e) {
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
          {register && (
            <div className="role-picker">
              <button
                type="button"
                className={role === "student" ? "selected" : ""}
                onClick={() => setRole("student")}
              >
                I’m a student
              </button>
              <button
                type="button"
                className={role === "instructor" ? "selected" : ""}
                onClick={() => setRole("instructor")}
              >
                I’m an instructor
              </button>
            </div>
          )}
          <form onSubmit={submit}>
            {register && (
              <Field
                label="Full name"
                name="name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
                placeholder="Your full name"
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
            />
            <Field
              label="Password"
              name="password"
              hint={
                register
                  ? "8–72 characters, with an uppercase letter, a lowercase letter, and a number."
                  : null
              }
            >
              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  className="form-control"
                  type={show ? "text" : "password"}
                  required
                  minLength={register ? 8 : 1}
                  maxLength={register ? 72 : 200}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={
                    register
                      ? "Create a strong password"
                      : "Enter your password"
                  }
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            {register && role === "instructor" && (
              <Field
                label="Instructor invitation code"
                name="inviteCode"
                type="password"
                required
                maxLength={200}
                hint="Ask your school administrator for your private code."
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
          <div className="auth-switch">
            {register ? "Already have an account?" : "New around here?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </div>
          <p className="auth-fine">
            For students and instructors.
            <br />
            Connected learning, wherever you are.
          </p>
        </div>
      </main>
    </div>
  );
}
