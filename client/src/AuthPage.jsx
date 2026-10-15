import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
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
          <span className="auth-chip">
            <Sparkles size={15} /> A better way to learn
          </span>
          <h1>
            Big ideas.
            <br />
            Small steps.
            <br />
            <span>Endless possibilities.</span>
          </h1>
          <p>
            One place for your courses, your people,
            <br className="desktop-only" /> and everything you’re working
            toward.
          </p>
          <div className="auth-illustration">
            <div className="illustration-orbit" />
            <div className="illustration-card">
              <span className="illustration-book">
                <BookOpen size={42} />
              </span>
              <span className="illustration-lines">
                <i />
                <i />
                <i />
              </span>
              <span className="illustration-check">✓</span>
            </div>
            <div className="floating-label">✦ &nbsp; Keep moving forward</div>
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
          <span className="eyebrow">WELCOME TO CLASSROOM</span>
          <h2>
            {register
              ? "Your next chapter starts here."
              : "Good to have you back."}
          </h2>
          <p>
            {register
              ? "Create an account and make room for something new."
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
            {register ? "Already part of Classroom?" : "New around here?"}{" "}
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
