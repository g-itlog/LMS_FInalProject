import { randomBytes, createHmac } from "node:crypto";
import assert from "node:assert/strict";
// Existing workflow fixtures seed an already-verified email grant. The email-auth
// integration suite separately exercises real request/verify/consume endpoints.
export async function registrationProof(db, email, secret) {
  const proof = randomBytes(32).toString("hex");
  await db
    .collection("lms_email_challenges")
    .insertOne({
      _id: randomBytes(32).toString("hex"),
      email: email.trim().toLowerCase(),
      purpose: "register",
      verifiedAt: new Date(),
      grantHash: createHmac("sha256", secret).update(proof).digest("hex"),
      grantExpiresAt: new Date(Date.now() + 600000),
      expiresAt: new Date(Date.now() + 600000),
    });
  return proof;
}
export function expectable(promise) {
  promise.expect = (status) =>
    promise.then((response) => {
      assert.equal(response.status, status, response.text);
      return response;
    });
  return promise;
}
