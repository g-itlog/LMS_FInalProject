import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import request from "supertest";
import { ObjectId } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/database.js";

const origin = "http://localhost:5173",
  password = "Extensions2026!";
const date = (days) => new Date(Date.now() + days * 86400000).toISOString();
let mongo,
  database,
  app,
  teacher,
  other,
  student,
  second,
  stranger,
  admin,
  mobile,
  mobileToken,
  course,
  assignment,
  studentId,
  secondId,
  pending;
const write = (agent, method, path, body) =>
  agent[method](`/api${path}`).set("Origin", origin).send(body);
const requestBody = (days = 3) => ({
  reason: "I need extra time to finish the research and review my response.",
  requestedDueDate: date(days),
});
async function createAssignment(overrides = {}) {
  return (
    await write(teacher, "post", `/courses/${course._id}/assignments`, {
      title: "Extension workflow assignment",
      instructions: "Prepare a complete response and attach your evidence.",
      dueDate: date(-1),
      maxPoints: 100,
      allowLate: false,
      ...overrides,
    }).expect(201)
  ).body;
}
async function ask(agent, a, body = requestBody()) {
  return (
    await write(agent, "post", `/assignments/${a._id}/extensions`, body).expect(
      201,
    )
  ).body;
}
function decide(row, status = "approved", scope = "student", comment = "") {
  return write(teacher, "patch", `/extensions/${row._id}`, {
    status,
    scope,
    comment,
  });
}
async function view(agent, a) {
  return (await agent.get(`/api/assignments/${a._id}/extensions`).expect(200))
    .body;
}
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  database = await connectDatabase(mongo.getUri(), "extensions_test");
  app = createApp({
    ...database,
    config: {
      secret: "test-extensions-secret-at-least-32-characters",
      origins: [origin],
      production: false,
      apiRequestLimit: 10000,
    },
  });
  const agents = [];
  for (const [name, role] of [
    ["teacher", "instructor"],
    ["other", "instructor"],
    ["student", "student"],
    ["second", "student"],
    ["stranger", "student"],
    ["admin", "admin"],
  ]) {
    const user = await database.db
      .collection("lms_users")
      .insertOne({
        name: `Test ${name}`,
        email: `${name}@extensions.test`,
        role,
        passwordHash: await bcrypt.hash(password, 4),
        createdAt: new Date(),
      });
    if (name === "student") studentId = user.insertedId;
    if (name === "second") secondId = user.insertedId;
    const agent = request.agent(app);
    await write(agent, "post", "/auth/login", {
      email: `${name}@extensions.test`,
      password,
    }).expect(200);
    agents.push(agent);
  }
  [teacher, other, student, second, stranger, admin] = agents;
  const login = (
    await write(student, "post", "/mobile/auth/login", {
      email: "student@extensions.test",
      password,
    }).expect(200)
  ).body;
  mobileToken = login.token;
  mobile = (method, path, body) =>
    request(app)
      [method](`/api${path}`)
      .set("Authorization", `Bearer ${login.token}`)
      .send(body);
  course = (
    await write(teacher, "post", "/courses", {
      title: "Deadline extension course",
      code: "EXT 101",
      category: "Computing",
      description: "A course for isolated deadline extension tests.",
      published: true,
      color: "blue",
    }).expect(201)
  ).body;
  for (const agent of [student, second])
    await write(agent, "post", `/courses/${course._id}/enroll`).expect(200);
  assignment = await createAssignment();
});
after(async () => {
  await database?.client.close();
  await mongo?.stop();
});

test("extensions require enrollment, owner review, valid future dates and strict request fields", async () => {
  await request(app)
    .get(`/api/assignments/${assignment._id}/extensions`)
    .expect(401);
  for (const agent of [stranger, other])
    await agent
      .get(`/api/assignments/${assignment._id}/extensions`)
      .expect(403);
  await admin.get(`/api/assignments/${assignment._id}/extensions`).expect(403);
  await write(
    teacher,
    "post",
    `/assignments/${assignment._id}/extensions`,
    requestBody(),
  ).expect(403);
  await write(
    stranger,
    "post",
    `/assignments/${assignment._id}/extensions`,
    requestBody(),
  ).expect(403);
  for (const body of [
    { ...requestBody(), reason: "short" },
    { ...requestBody(), reason: "x".repeat(2001) },
    { ...requestBody(), requestedDueDate: date(-2) },
    { ...requestBody(), requestedDueDate: date(366) },
    { ...requestBody(), studentId: String(secondId) },
    { ...requestBody(), requestedDueDate: "invalid" },
  ])
    await write(
      student,
      "post",
      `/assignments/${assignment._id}/extensions`,
      body,
    ).expect(400);
  await student.get("/api/assignments/not-an-id/extensions").expect(400);
});
test("pending requests preserve deadlines, notify only the owning instructor and prevent duplicate concurrent requests", async () => {
  const values = requestBody(),
    results = await Promise.all([
      write(
        student,
        "post",
        `/assignments/${assignment._id}/extensions`,
        values,
      ),
      mobile("post", `/assignments/${assignment._id}/extensions`, values),
    ]);
  assert.deepEqual(results.map((row) => row.status).sort(), [201, 409]);
  pending = results.find((row) => row.status === 201).body;
  assert.equal(pending.originalDueDate, assignment.dueDate);
  assert.equal(pending.previousDueDate, assignment.dueDate);
  assert.equal((await view(student, assignment)).canRequest, false);
  assert.equal((await view(second, assignment)).items.length, 0);
  assert.equal(
    (await student.get("/api/dashboard")).body.assignments[0].dueDate,
    assignment.dueDate,
  );
  await write(student, "post", `/assignments/${assignment._id}/submit`, {
    text: "Still too late without approval.",
  }).expect(400);
  const inbox = (await teacher.get("/api/notifications")).body.items;
  const notice = inbox.find((n) => n.type === "extension-request");
  assert.ok(notice);
  assert.match(notice.body, /Test student|extra time/);
  assert.ok(notice.body.includes(assignment.dueDate));
  assert.ok(notice.body.includes(values.requestedDueDate));
  assert.equal(notice.extensionAssignmentId, assignment._id);
  assert.ok(
    !(await other.get("/api/notifications")).body.items.some(
      (n) => n.type === "extension-request",
    ),
  );
  await write(student, "patch", `/extensions/${pending._id}`, {
    status: "approved",
  }).expect(403);
  await write(other, "patch", `/extensions/${pending._id}`, {
    status: "approved",
  }).expect(403);
});
test("rejection stores instructor comments across web/mobile, keeps the original deadline and clears the pending instructor notice", async () => {
  await decide(
    pending,
    "rejected",
    "student",
    "Please keep the original deadline and contact me about your draft.",
  ).expect(200);
  const own = (
    await mobile("get", `/assignments/${assignment._id}/extensions`).expect(200)
  ).body;
  assert.equal(own.items[0].status, "rejected");
  assert.match(own.items[0].comment, /original deadline/);
  assert.equal(own.assignment.dueDate, assignment.dueDate);
  assert.equal(own.canRequest, true);
  assert.ok(
    !(await teacher.get("/api/notifications")).body.items.some(
      (n) => n.type === "extension-request",
    ),
  );
  assert.ok(
    (await student.get("/api/notifications")).body.items.some(
      (n) =>
        n.title === "Extension request rejected" &&
        n.body.includes("original deadline"),
    ),
  );
  await decide(pending).expect(409);
});
test("individual approval updates only that student across dashboards, upload enforcement, late status and reminders", async () => {
  const row = await ask(student, assignment),
    target = row.requestedDueDate;
  await decide(row, "approved", "student", "Approved for you only.").expect(
    200,
  );
  assert.equal(
    (
      await database.db
        .collection("lms_assignments")
        .findOne({ _id: new ObjectId(assignment._id) })
    ).dueDate.toISOString(),
    assignment.dueDate,
  );
  const mine = (await mobile("get", "/dashboard")).body.assignments[0],
    theirs = (await second.get("/api/dashboard")).body.assignments[0];
  assert.equal(mine.dueDate, target);
  assert.equal(mine.originalDueDate, assignment.dueDate);
  assert.equal(mine.hasIndividualExtension, true);
  assert.equal(theirs.dueDate, assignment.dueDate);
  const raw = (await teacher.get(`/api/courses/${course._id}`)).body
    .assignments[0];
  assert.equal(raw.dueDate, assignment.dueDate);
  await write(second, "post", `/assignments/${assignment._id}/submit`, {
    text: "Not extended for me.",
  }).expect(400);
  const response = await request(app)
    .post(`/api/assignments/${assignment._id}/submit`)
    .set("Authorization", `Bearer ${mobileToken}`)
    .field("text", "Submitted under my individual extension.")
    .attach("file", Buffer.from("Extension test attachment"), "extension.txt")
    .expect(201);
  assert.ok(response.body.message);
  const submission = (
    await teacher.get(`/api/assignments/${assignment._id}/submissions`)
  ).body.items[0];
  assert.equal(submission.late, false);
  assert.equal(submission.deadlineAtSubmission, target);
  assert.equal(submission.effectiveDueDate, target);
  assert.ok(
    !(await mobile("get", "/notifications")).body.items.some(
      (n) => n.type === "assignment-overdue",
    ),
  );
  assert.ok(
    (await second.get("/api/notifications")).body.items.some(
      (n) => n.type === "assignment-overdue",
    ),
  );
});
test("whole-class approval extends current and future enrollments without shortening a longer individual extension or exposing private reasons", async () => {
  const a = await createAssignment({
      dueDate: date(1),
      title: "Whole class extension",
    }),
    individual = await ask(student, a, requestBody(10));
  await decide(individual).expect(200);
  const values = {
      ...requestBody(5),
      reason: "Private student reason about a family circumstance.",
    },
    whole = await ask(second, a, values);
  await decide(
    whole,
    "approved",
    "class",
    "Private response to the requester.",
  ).expect(200);
  const own = (await view(student, a)).assignment,
    other = (await view(second, a)).assignment;
  assert.equal(own.dueDate, individual.requestedDueDate);
  assert.equal(other.dueDate, whole.requestedDueDate);
  await write(stranger, "post", `/courses/${course._id}/enroll`).expect(200);
  assert.equal(
    (await view(stranger, a)).assignment.dueDate,
    whole.requestedDueDate,
  );
  const notice = (await student.get("/api/notifications")).body.items.find(
    (n) => n.type === "class-extension",
  );
  assert.ok(notice);
  assert.doesNotMatch(
    notice.body,
    /Private student reason|Private response|Test second/,
  );
  const again = await ask(second, a, requestBody(15));
  await decide(
    again,
    "rejected",
    "class",
    "The class already has sufficient extra time.",
  ).expect(200);
  assert.equal(
    (await view(second, a)).assignment.dueDate,
    whole.requestedDueDate,
  );
});
test("simultaneous approve/reject reviews commit one decision and cannot silently overwrite deadlines", async () => {
  const a = await createAssignment(),
    row = await ask(second, a),
    results = await Promise.all([
      decide(row, "approved", "class"),
      decide(row, "rejected"),
    ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const saved = (await view(second, a)).items[0];
  assert.equal(
    (await view(second, a)).assignment.dueDate,
    saved.status === "approved" ? row.requestedDueDate : a.dueDate,
  );
});
test("graded work remains locked, including when grading happens while an extension request is pending", async () => {
  const a = await createAssignment({ dueDate: date(1) }),
    row = await ask(student, a);
  await write(student, "post", `/assignments/${a._id}/submit`, {
    text: "A completed assignment response.",
  }).expect(201);
  const sub = (await teacher.get(`/api/assignments/${a._id}/submissions`)).body
    .items[0];
  await write(teacher, "patch", `/submissions/${sub._id}/grade`, {
    grade: 0,
    feedback: "Please review these concepts.",
  }).expect(200);
  await decide(row).expect(409);
  await decide(
    row,
    "rejected",
    "student",
    "This work is already graded.",
  ).expect(200);
  await write(
    student,
    "post",
    `/assignments/${a._id}/extensions`,
    requestBody(),
  ).expect(409);
  assert.equal((await view(student, a)).canRequest, false);
});
test("late work keeps its historical deadline until resubmission under an approved extension", async () => {
  const a = await createAssignment({ allowLate: true });
  await write(second, "post", `/assignments/${a._id}/submit`, {
    text: "Original late work.",
  }).expect(201);
  const row = await ask(second, a);
  await decide(row).expect(200);
  let sub = (await teacher.get(`/api/assignments/${a._id}/submissions`)).body
    .items[0];
  assert.equal(sub.late, true);
  assert.equal(sub.deadlineAtSubmission, a.dueDate);
  await write(second, "post", `/assignments/${a._id}/submit`, {
    text: "Updated work under the approved deadline.",
  }).expect(200);
  sub = (await teacher.get(`/api/assignments/${a._id}/submissions`)).body
    .items[0];
  assert.equal(sub.late, false);
  assert.equal(sub.deadlineAtSubmission, row.requestedDueDate);
});
test("stale requests cannot shorten newer deadlines; history is filtered/paginated and assignment deletion cleans related records", async () => {
  const a = await createAssignment({ dueDate: date(1) }),
    row = await ask(second, a, requestBody(2));
  await write(teacher, "patch", `/assignments/${a._id}`, {
    title: a.title,
    instructions: a.instructions,
    dueDate: date(6),
    maxPoints: 100,
    allowLate: false,
  }).expect(200);
  await decide(row).expect(400);
  await decide(row, "rejected").expect(200);
  for (let i = 0; i < 12; i++) {
    const next = await ask(second, a, requestBody(9));
    await decide(next, "rejected").expect(200);
  }
  const page = (
    await second.get(
      `/api/assignments/${a._id}/extensions?status=rejected&page=2`,
    )
  ).body;
  assert.equal(page.total, 13);
  assert.equal(page.items.length, 1);
  await second.get(`/api/assignments/${a._id}/extensions?page=0`).expect(400);
  const last = await ask(second, a, requestBody(12));
  await decide(last).expect(200);
  await write(teacher, "delete", `/assignments/${a._id}`).expect(200);
  await second.get(`/api/assignments/${a._id}/extensions`).expect(404);
  await decide(last).expect(404);
  assert.equal(
    await database.db
      .collection("lms_extension_requests")
      .countDocuments({ assignmentId: new ObjectId(a._id) }),
    0,
  );
  assert.equal(
    await database.db
      .collection("lms_assignment_deadlines")
      .countDocuments({
        studentId: secondId,
        dueDate: new Date(last.requestedDueDate),
      }),
    0,
  );
});
test("course archival hides pending notifications and blocks request reads, new requests and instructor decisions", async () => {
  const a = await createAssignment(),
    row = await ask(student, a);
  await write(teacher, "delete", `/courses/${course._id}`).expect(200);
  await student.get(`/api/assignments/${a._id}/extensions`).expect(404);
  await decide(row).expect(404);
  await write(
    student,
    "post",
    `/assignments/${a._id}/extensions`,
    requestBody(),
  ).expect(404);
  assert.equal(
    (await teacher.get("/api/notifications")).body.items.filter(
      (n) => n.type === "extension-request",
    ).length,
    0,
  );
  const logs = (await admin.get("/api/admin/activity?search=extension")).body;
  assert.ok(logs.items.some((row) => row.action === "extension.requested"));
  assert.ok(!JSON.stringify(logs).includes("Private student reason"));
});
