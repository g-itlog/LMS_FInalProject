// Match the API's email and password rules without sending requests while typing.
const emailPattern =
  /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

export function passwordRequirements(password = "") {
  return [
    {
      label: "8–72 characters",
      met:
        password.length >= 8 &&
        password.length <= 72 &&
        new TextEncoder().encode(password).length <= 72,
      message: "Use 8–72 characters for your password.",
    },
    {
      label: "One uppercase letter",
      met: /[A-Z]/.test(password),
      message: "Include an uppercase letter.",
    },
    {
      label: "One lowercase letter",
      met: /[a-z]/.test(password),
      message: "Include a lowercase letter.",
    },
    {
      label: "One number",
      met: /[0-9]/.test(password),
      message: "Include a number.",
    },
  ];
}

export function validateAuth(
  values,
  { register = false, role = "student" } = {},
) {
  const errors = {};
  const name = (values.name || "").trim();
  const email = (values.email || "").trim();
  const password = values.password || "";
  if (register) {
    if (!name) errors.name = "Enter your full name.";
    else if (name.length < 2 || name.length > 80)
      errors.name = "Use 2–80 characters for your name.";
  }
  if (!email) errors.email = "Enter your email address.";
  else if (email.length > 160 || !emailPattern.test(email))
    errors.email = "Enter a valid email address, such as you@school.edu.";
  if (!password) errors.password = "Enter your password.";
  else if (register) {
    if (new TextEncoder().encode(password).length > 72)
      errors.password =
        "Your password exceeds 72 bytes. Emoji and accented letters use more space; try a shorter password.";
    else {
      const unmet = passwordRequirements(password).find((rule) => !rule.met);
      if (unmet) errors.password = unmet.message;
    }
  } else if (password.length > 200)
    errors.password = "Use at most 200 characters.";
  if (register && role === "instructor" && !values.inviteCode)
    errors.inviteCode = "Enter your instructor invitation code.";
  else if (register && role === "instructor" && values.inviteCode.length > 200)
    errors.inviteCode = "Use at most 200 characters for the invitation code.";
  return errors;
}
