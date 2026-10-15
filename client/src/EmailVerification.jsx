import { useEffect, useState } from "react";
import { api, message } from "./api";
import { Button, Field } from "./ui";
import { Link } from "react-router-dom";

export default function EmailVerification({
  email,
  purpose,
  initialChallenge,
  onVerified,
  onBack,
}) {
  const [challenge, setChallenge] = useState(initialChallenge),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [verified, setVerified] = useState(false);
  const [resendAt, setResendAt] = useState(
      () => Date.now() + initialChallenge.resendAfter * 1000,
    ),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  async function resend() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/auth/email-otp/request", {
        email,
        purpose,
      });
      setChallenge(data);
      setCode("");
      setResendAt(Date.now() + data.resendAfter * 1000);
      setNow(Date.now());
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="otp-address">
        Check <strong>{email}</strong> and your spam folder. The six-digit code
        expires in 10 minutes. Only the latest requested code works.
      </p>
      {!verified && (
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            if (!/^\d{6}$/.test(code)) {
              setError("Enter the six-digit code from your email.");
              return;
            }
            setBusy(true);
            try {
              const { data } = await api.post("/auth/email-otp/verify", {
                challengeId: challenge.challengeId,
                code,
                purpose,
              });
              setVerified(true);
              await onVerified(data);
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field
            label="Email verification code"
            name="otp"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            autoFocus
            disabled={busy}
            required
            hint="Never share this code. We will never ask for it outside this verification form."
          />
          <Button type="submit" busy={busy} className="w-100">
            Verify code
          </Button>
        </form>
      )}
      {verified && (
        <p role="status">
          Your email is verified. If registration could not finish, go back to
          correct the form and submit it again.
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="learning-toolbar">
        <Button variant="light" disabled={busy} onClick={onBack}>
          {verified ? "Back to registration" : "Back"}
        </Button>
        {!verified && (
          <Button
            variant="light"
            disabled={busy || remaining > 0}
            onClick={resend}
          >
            {remaining ? `Resend in ${remaining}s` : "Resend code"}
          </Button>
        )}
      </div>
      {purpose === "register" && (
        <p>
          Already have an account? <Link to="/login">Sign in</Link> or{" "}
          <Link to="/forgot-password">reset your password</Link>.
        </p>
      )}
    </>
  );
}
