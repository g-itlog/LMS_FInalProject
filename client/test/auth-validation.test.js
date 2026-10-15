import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordRequirements, validateAuth } from "../src/auth-validation.js";

const account = {
  name: "Ana Cruz",
  email: "ana@example.edu",
  password: "Learning42",
};

test("empty fields and whitespace-only names receive actionable errors", () => {
  assert.deepEqual(Object.keys(validateAuth({}, { register: true })), [
    "name",
    "email",
    "password",
  ]);
  assert.ok(validateAuth({ ...account, name: "  " }, { register: true }).name);
  assert.deepEqual(
    validateAuth(
      { ...account, name: " Ana Cruz ", email: " ANA@EXAMPLE.EDU " },
      { register: true },
    ),
    {},
  );
});

test("email validation catches incomplete addresses and the API length limit", () => {
  for (const email of [
    "ana",
    "ana@",
    "ana@example",
    "ana..cruz@example.edu",
    "ana@example..edu",
    "ana @example.edu",
    `${"a".repeat(150)}@example.edu`,
  ]) {
    assert.ok(validateAuth({ ...account, email }).email, email);
  }
  assert.equal(
    validateAuth({ ...account, email: "ana.cruz+class@example.edu" }).email,
    undefined,
  );
});

test("registration checks every password rule and UTF-8 limits", () => {
  for (const password of [
    "Short1",
    "lowercase42",
    "UPPERCASE42",
    "NoNumbersHere",
    "A1" + "a".repeat(71),
    "Aa1" + "é".repeat(35),
  ]) {
    assert.ok(
      validateAuth({ ...account, password }, { register: true }).password,
      password,
    );
  }
  assert.equal(
    validateAuth(
      { ...account, password: "Aa1" + "a".repeat(69) },
      { register: true },
    ).password,
    undefined,
  );
  assert.equal(
    validateAuth(
      { ...account, password: "Aa1" + "é".repeat(34) },
      { register: true },
    ).password,
    undefined,
  );
  assert.ok(passwordRequirements(account.password).every((rule) => rule.met));
});

test("login accepts existing passwords without applying registration strength rules", () => {
  assert.deepEqual(validateAuth({ email: account.email, password: "x" }), {});
  assert.ok(
    validateAuth({ email: account.email, password: "x".repeat(201) }).password,
  );
});

test("invitation code is required only for instructor registration", () => {
  assert.deepEqual(validateAuth(account, { register: true }), {});
  assert.ok(
    validateAuth(account, { register: true, role: "instructor" }).inviteCode,
  );
  assert.deepEqual(
    validateAuth(
      { ...account, inviteCode: "private-test-code" },
      { register: true, role: "instructor" },
    ),
    {},
  );
  assert.ok(
    validateAuth(
      { ...account, inviteCode: "x".repeat(201) },
      { register: true, role: "instructor" },
    ).inviteCode,
  );
});
