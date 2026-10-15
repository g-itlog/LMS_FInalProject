import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import request from "supertest";
import { ObjectId } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/database.js";
import { invitationFields, invitationService } from "../src/invitations.js";

const password = "Password2026!";
const origin = "http://localhost:5173";
const config = {
  secret: "test-invitation-secret-at-least-32-characters",
  inviteCode: "LegacyInstructorCode2026",
  production: false,
  origins: [origin],
};
let mongo,
  database,
  app,
  admin,
  student,
  instructor,
  legacyId,
  firstId,
  secondId,
  generated;
const firstCode = "FacultyFirstCode2026";
const replacementCode = "FacultyReplacement2026";
const post = (agent, path) => agent.post(path).set("Origin", origin);
const patch = (agent, path) => agent.patch(path).set("Origin", origin);
const signup = (code, email, target = app) =>
  request(target)
    .post("/api/auth/register")
    .send({
      name: "Invited Instructor",
      email,
      password,
      role: "instructor",
      inviteCode: code,
    });
const create = async (label, code) =>
  (
    await post(admin, "/api/admin/invitations")
      .send({ label, ...(code ? { code } : {}) })
      .expect(201)
  ).body.invitation;
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  database = await connectDatabase(mongo.getUri(), "lms_invitation_test");
  app = createApp({ ...database, config });
  for (const role of ["admin", "student", "instructor"])
    await database.db
      .collection("lms_users")
      .insertOne({
        name: `Test ${role}`,
        email: `${role}@invitation-test.edu`,
        role,
        passwordHash: await bcrypt.hash(password, 4),
        createdAt: new Date(),
      });
  admin = request.agent(app);
  student = request.agent(app);
  instructor = request.agent(app);
  for (const [agent, role] of [
    [admin, "admin"],
    [student, "student"],
    [instructor, "instructor"],
  ])
    await post(agent, "/api/auth/login")
      .send({ email: `${role}@invitation-test.edu`, password })
      .expect(200);
});
after(async () => {
  await database?.client.close();
  await mongo?.stop();
});

test("only web admins can manage invitations and the legacy code imports once", async () => {
  await request(app).get("/api/admin/invitations").expect(401);
  for (const agent of [student, instructor]) {
    await agent.get("/api/admin/invitations").expect(403);
    await post(agent, "/api/admin/invitations")
      .send({ label: "Forbidden" })
      .expect(403);
  }
  const result = await admin.get("/api/admin/invitations").expect(200);
  assert.equal(result.body.total, 1);
  const legacy = result.body.items[0];
  legacyId = legacy._id;
  assert.equal(legacy.code, config.inviteCode);
  assert.equal(legacy.active, true);
  assert.equal(legacy.used, false);
  assert.equal(legacy.codeHash, undefined);
  assert.equal(legacy.source, undefined);
});

test("admins create multiple distinct single-use codes, including secure generated values", async () => {
  const first = await create("Computing faculty", firstCode);
  firstId = first._id;
  const second = await create("Science faculty");
  secondId = second._id;
  generated = second.code;
  assert.match(generated, /^[A-Za-z0-9_-]{24}$/);
  assert.equal(
    (await admin.get("/api/admin/invitations?status=active").expect(200)).body
      .total,
    3,
  );
  assert.equal(
    (await admin.get("/api/admin/invitations?search=Computing").expect(200))
      .body.total,
    1,
  );
});

test("successful registration consumes its code, removes plaintext, and leaves only immutable history", async () => {
  const result = await signup(firstCode, "first@invitation-test.edu").expect(
    201,
  );
  assert.equal(result.body.user.role, "instructor");
  await signup(firstCode, "reuse@invitation-test.edu").expect(403);
  await signup(firstCode, "first@invitation-test.edu").expect(409);
  const available = await admin.get("/api/admin/invitations").expect(200);
  assert.ok(!available.body.items.some((row) => row._id === firstId));
  const history = await admin
    .get("/api/admin/invitations?status=used")
    .expect(200);
  const receipt = history.body.items.find((row) => row._id === firstId);
  assert.equal(receipt.used, true);
  assert.equal(receipt.active, false);
  assert.equal(receipt.code, undefined);
  assert.equal(receipt.codeHash, undefined);
  const stored = await database.db
    .collection("lms_invitations")
    .findOne({ _id: new ObjectId(firstId) });
  assert.equal(stored.code, undefined);
  assert.equal(stored.useCount, 1);
  assert.ok(stored.usedAt instanceof Date);
  assert.equal(String(stored.usedBy), result.body.user._id);
  for (const changes of [
    { active: true },
    { code: "AttemptedReissue2026" },
    { label: "Changed history" },
  ])
    await patch(admin, `/api/admin/invitations/${firstId}`)
      .send(changes)
      .expect(409);
  await post(admin, "/api/admin/invitations")
    .send({ label: "Recreated used value", code: firstCode })
    .expect(409);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "first@invitation-test.edu", password })
    .expect(200);
});

test("unused invitations can be edited, deactivated, and reactivated before their one successful use", async () => {
  await patch(admin, `/api/admin/invitations/${secondId}`)
    .send({ active: false })
    .expect(200);
  await signup(generated, "inactive@invitation-test.edu").expect(403);
  await patch(admin, `/api/admin/invitations/${secondId}`)
    .send({ label: "Science replacement", code: replacementCode })
    .expect(200);
  await signup(replacementCode, "still-inactive@invitation-test.edu").expect(
    403,
  );
  await patch(admin, `/api/admin/invitations/${secondId}`)
    .send({ active: true })
    .expect(200);
  await signup(generated, "old-value@invitation-test.edu").expect(403);
  await signup(replacementCode, "replacement@invitation-test.edu").expect(201);
  await signup(
    replacementCode,
    "reused-replacement@invitation-test.edu",
  ).expect(403);
});

test("legacy deactivation survives cold starts and environment changes, and managed codes work without the variable", async () => {
  await patch(admin, `/api/admin/invitations/${legacyId}`)
    .send({ active: false })
    .expect(200);
  const restarted = createApp({
    ...database,
    config: { ...config, inviteCode: "DifferentEnvironment2026" },
  });
  await signup(
    config.inviteCode,
    "disabled-legacy@invitation-test.edu",
    restarted,
  ).expect(403);
  await signup(
    "DifferentEnvironment2026",
    "new-env@invitation-test.edu",
    restarted,
  ).expect(403);
  assert.equal(
    await database.db.collection("lms_invitations").countDocuments(),
    3,
  );
  const managed = await create("No environment needed");
  const withoutEnvironment = createApp({
    ...database,
    config: { ...config, inviteCode: undefined },
  });
  await signup(
    managed.code,
    "without-env@invitation-test.edu",
    withoutEnvironment,
  ).expect(201);
  await signup(
    managed.code,
    "without-env-reuse@invitation-test.edu",
    withoutEnvironment,
  ).expect(403);
});

test("invalid input and unauthorized changes fail and audit logs never contain invitation values", async () => {
  for (const code of ["short", "Code With Spaces2026"])
    await post(admin, "/api/admin/invitations")
      .send({ label: "Invalid code", code })
      .expect(400);
  await post(admin, "/api/admin/invitations")
    .send({ label: "Duplicate", code: replacementCode })
    .expect(409);
  await patch(admin, `/api/admin/invitations/${legacyId}`)
    .send({ codeHash: "injected" })
    .expect(400);
  await patch(admin, `/api/admin/invitations/${legacyId}`)
    .send({ active: "false" })
    .expect(400);
  await patch(student, `/api/admin/invitations/${legacyId}`)
    .send({ active: true })
    .expect(403);
  await patch(admin, "/api/admin/invitations/not-an-id")
    .send({ active: false })
    .expect(400);
  await admin.get("/api/admin/invitations?status=invalid").expect(400);
  await signup({ $ne: "" }, "nosql@invitation-test.edu").expect(400);
  const events = await admin.get("/api/admin/activity").expect(200);
  const eventText = JSON.stringify(events.body);
  assert.ok(
    events.body.items.some((event) => event.action === "invitation.used"),
  );
  for (const secret of [
    generated,
    firstCode,
    replacementCode,
    config.inviteCode,
  ])
    assert.ok(!eventText.includes(secret));
});

test("two different instructors racing the same code create exactly one account", async () => {
  const invite = await create("Concurrent registration");
  const results = await Promise.all([
    signup(invite.code, "race-one@invitation-test.edu"),
    signup(invite.code, "race-two@invitation-test.edu"),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 403]);
  assert.equal(
    await database.db
      .collection("lms_users")
      .countDocuments({
        email: {
          $in: ["race-one@invitation-test.edu", "race-two@invitation-test.edu"],
        },
      }),
    1,
  );
  const row = await database.db
    .collection("lms_invitations")
    .findOne({ _id: new ObjectId(invite._id) });
  assert.equal(row.useCount, 1);
  assert.equal(row.active, false);
  assert.equal(row.code, undefined);
});

test("a failed account insert rolls back code consumption and its audit event", async () => {
  const invite = await create("Rollback registration");
  const service = invitationService(database.db, config);
  // Simulate an email collision after the HTTP pre-check but before the transaction inserts.
  await assert.rejects(
    service.register(
      {
        _id: new ObjectId(),
        name: "Duplicate",
        email: "first@invitation-test.edu",
        role: "instructor",
        passwordHash: "unused-test-hash",
      },
      invite.code,
    ),
    (error) => error.code === 11000,
  );
  const row = await database.db
    .collection("lms_invitations")
    .findOne({ _id: new ObjectId(invite._id) });
  assert.equal(row.active, true);
  assert.equal(row.useCount, 0);
  assert.equal(row.code, invite.code);
  assert.equal(row.usedBy, undefined);
  assert.equal(
    await database.db
      .collection("lms_admin_activity")
      .countDocuments({ action: "invitation.used", targetId: row._id }),
    0,
  );
  await signup(invite.code, "after-rollback@invitation-test.edu").expect(201);
});

test("historically used multi-use records retire permanently on migration", async () => {
  const code = "HistoricalFacultyCode2026";
  const inserted = await database.db
    .collection("lms_invitations")
    .insertOne({
      ...invitationFields(code),
      label: "Historical invitation",
      active: true,
      useCount: 3,
      lastUsedAt: new Date(),
      createdAt: new Date(),
    });
  const restarted = createApp({ ...database, config });
  await signup(code, "historical-reuse@invitation-test.edu", restarted).expect(
    403,
  );
  const row = await database.db
    .collection("lms_invitations")
    .findOne({ _id: inserted.insertedId });
  assert.equal(row.active, false);
  assert.equal(row.code, undefined);
  assert.equal(row.useCount, 3);
  await patch(admin, `/api/admin/invitations/${row._id}`)
    .send({ active: true })
    .expect(409);
  await post(admin, "/api/admin/invitations")
    .send({ label: "Reissue history", code })
    .expect(409);
});
