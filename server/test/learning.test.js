import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/database.js";

const origin = "http://localhost:5173",
  password = "Learning2026!";
let mongo,
  database,
  app,
  teacher,
  other,
  student,
  second,
  admin,
  mobile,
  course,
  material,
  assignment,
  quiz,
  revision;
const write = (agent, method, path, body) =>
  agent[method](`/api${path}`).set("Origin", origin).send(body);
const values = {
  title: "A precise quiz",
  instructions: "Select one answer for each question.",
  published: true,
  maxAttempts: 1,
  reviewPolicy: "never",
  closesAt: null,
  questions: [
    {
      prompt: "Two plus two?",
      options: ["Four", "Five"],
      correctIndex: 0,
      points: 5,
      explanation: "Two pairs make four.",
    },
    {
      prompt: "The first letter?",
      options: ["A", "B"],
      correctIndex: 0,
      points: 3,
      explanation: "",
    },
  ],
};
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  database = await connectDatabase(mongo.getUri(), "learning_test");
  app = createApp({
    ...database,
    config: {
      secret: "test-learning-secret-with-32-characters",
      production: false,
      origins: [origin],
      apiRequestLimit: 5000,
    },
  });
  for (const [name, role] of [
    ["teacher", "instructor"],
    ["other", "instructor"],
    ["student", "student"],
    ["second", "student"],
    ["admin", "admin"],
  ])
    await database.db
      .collection("lms_users")
      .insertOne({
        name: `Test ${name}`,
        email: `${name}@learning.test`,
        role,
        passwordHash: await bcrypt.hash(password, 4),
        createdAt: new Date(),
      });
  const agents = [];
  for (const name of ["teacher", "other", "student", "second", "admin"]) {
    const agent = request.agent(app);
    await write(agent, "post", "/auth/login", {
      email: `${name}@learning.test`,
      password,
    }).expect(200);
    agents.push(agent);
  }
  [teacher, other, student, second, admin] = agents;
  const login = await request(app)
    .post("/api/mobile/auth/login")
    .send({ email: "student@learning.test", password })
    .expect(200);
  mobile = (method, path, body) =>
    request(app)
      [method](`/api${path}`)
      .set("Authorization", `Bearer ${login.body.token}`)
      .send(body);
  course = (
    await write(teacher, "post", "/courses", {
      title: "Learning workflow course",
      code: "LEARN 101",
      category: "Computing",
      description: "A test of the complete shared learning workflow.",
      published: true,
      color: "blue",
    }).expect(201)
  ).body;
  await write(student, "post", `/courses/${course._id}/enroll`).expect(200);
  material = (
    await write(teacher, "post", `/courses/${course._id}/materials`, {
      title: "First lecture",
      description: "Read this lecture.",
      url: "https://example.com/lecture",
    }).expect(201)
  ).body;
  assignment = (
    await write(teacher, "post", `/courses/${course._id}/assignments`, {
      title: "Upcoming assignment",
      instructions: "Write a short response to this assignment.",
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      maxPoints: 100,
      allowLate: true,
    }).expect(201)
  ).body;
  quiz = (
    await write(
      teacher,
      "post",
      `/courses/${course._id}/quizzes`,
      values,
    ).expect(201)
  ).body;
  revision = quiz.revision;
});
after(async () => {
  await database?.client.close();
  await mongo?.stop();
});

test("quiz permissions protect teacher ownership, enrollment, student-only mobile and answer keys", async () => {
  await request(app).get("/api/quizzes").expect(401);
  await second.get(`/api/quizzes/${quiz._id}`).expect(403);
  await other.get(`/api/quizzes/${quiz._id}`).expect(403);
  await admin.get("/api/quizzes").expect(403);
  await write(student, "post", `/courses/${course._id}/quizzes`, values).expect(
    403,
  );
  await request(app)
    .post("/api/mobile/auth/login")
    .send({ email: "admin@learning.test", password })
    .expect(403);
  const detail = (await student.get(`/api/quizzes/${quiz._id}`).expect(200))
    .body;
  assert.equal(detail.questions.length, 2);
  assert.doesNotMatch(
    JSON.stringify(detail),
    /correctIndex|explanation|Four pairs/,
  );
  assert.equal(
    (await teacher.get(`/api/quizzes/${quiz._id}`)).body.questions[0]
      .correctIndex,
    0,
  );
  const notices = (await student.get("/api/notifications")).body.items;
  assert.ok(notices.some((n) => n.type === "assignment-due"));
  assert.ok(notices.some((n) => n.type === "material"));
  await write(student, "post", `/quizzes/${quiz._id}/attempts`, {
    revision,
    answers: [0, 0],
    score: 8,
  }).expect(400);
  await write(student, "post", `/quizzes/${quiz._id}/attempts`, {
    revision,
    answers: [0],
  }).expect(400);
});
test("concurrent attempts cannot exceed the limit; server grades zero and withholds restricted review", async () => {
  const path = `/quizzes/${quiz._id}/attempts`;
  const results = await Promise.all([
    write(student, "post", path, { revision, answers: [1, 1] }),
    mobile("post", path, { revision, answers: [1, 1] }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const receipt = results.find((r) => r.status === 201).body;
  assert.equal(receipt.score, 0);
  assert.equal(receipt.maxScore, 8);
  assert.equal(receipt.reviewAllowed, false);
  assert.equal(receipt.review, undefined);
  assert.equal(receipt.answers, undefined);
  assert.equal(receipt.questions, undefined);
  assert.equal((await mobile("get", path)).body.items.length, 1);
  assert.equal(
    (await teacher.get(`/api${path}`)).body.items[0].review[0].correctIndex,
    0,
  );
  await second.get(`/api${path}`).expect(403);
});
test("questions lock after attempts, metadata can change, review policy applies to historical attempts", async () => {
  await write(teacher, "patch", `/quizzes/${quiz._id}`, {
    ...values,
    questions: [{ ...values.questions[0], points: 9 }, values.questions[1]],
  }).expect(409);
  const changed = (
    await write(teacher, "patch", `/quizzes/${quiz._id}`, {
      ...values,
      reviewPolicy: "immediate",
      maxAttempts: 2,
    }).expect(200)
  ).body;
  assert.equal(changed.revision, 2);
  const review = (await mobile("get", `/quizzes/${quiz._id}/attempts`)).body
    .items[0];
  assert.equal(review.reviewAllowed, true);
  assert.equal(review.review[0].earned, 0);
  await write(student, "post", `/quizzes/${quiz._id}/attempts`, {
    revision: 1,
    answers: [0, 0],
  }).expect(409);
  const result = await mobile("post", `/quizzes/${quiz._id}/attempts`, {
    revision: 2,
    answers: [0, 1],
  }).expect(201);
  assert.equal(result.body.score, 5);
  await write(teacher, "patch", `/quizzes/${quiz._id}`, {
    ...values,
    maxAttempts: 1,
  }).expect(409);
});
test("closing dates, drafts, after-close review and malformed questions are enforced", async () => {
  await write(teacher, "post", `/courses/${course._id}/quizzes`, {
    ...values,
    reviewPolicy: "after-close",
  }).expect(400);
  await write(teacher, "post", `/courses/${course._id}/quizzes`, {
    ...values,
    questions: [{ ...values.questions[0], options: ["same", "Same"] }],
  }).expect(400);
  const closed = (
    await write(teacher, "post", `/courses/${course._id}/quizzes`, {
      ...values,
      closesAt: new Date(Date.now() - 1000).toISOString(),
    }).expect(201)
  ).body;
  await write(student, "post", `/quizzes/${closed._id}/attempts`, {
    revision: 1,
    answers: [0, 0],
  }).expect(400);
  const draft = (
    await write(teacher, "post", `/courses/${course._id}/quizzes`, {
      ...values,
      published: false,
    }).expect(201)
  ).body;
  await student.get(`/api/quizzes/${draft._id}`).expect(403);
  const later = (
    await write(teacher, "post", `/courses/${course._id}/quizzes`, {
      ...values,
      reviewPolicy: "after-close",
      closesAt: new Date(Date.now() + 86400000).toISOString(),
    }).expect(201)
  ).body;
  const hidden = (
    await write(student, "post", `/quizzes/${later._id}/attempts`, {
      revision: 1,
      answers: [0, 0],
    }).expect(201)
  ).body;
  assert.equal(hidden.reviewAllowed, false);
  await write(teacher, "patch", `/quizzes/${later._id}`, {
    ...values,
    reviewPolicy: "after-close",
    closesAt: new Date(Date.now() - 1000).toISOString(),
  }).expect(200);
  assert.equal(
    (await student.get(`/api/quizzes/${later._id}/attempts`)).body.items[0]
      .reviewAllowed,
    true,
  );
  await write(teacher, "delete", `/quizzes/${closed._id}`).expect(200);
  await write(teacher, "delete", `/quizzes/${draft._id}`).expect(200);
  await write(teacher, "delete", `/quizzes/${later._id}`).expect(200);
});
test("lecture completion and assignment/quiz progress sync across web/mobile without double counting", async () => {
  await write(second, "put", `/materials/${material._id}/completion`, {
    completed: true,
  }).expect(403);
  await write(teacher, "put", `/materials/${material._id}/completion`, {
    completed: true,
  }).expect(403);
  await write(student, "put", `/materials/${material._id}/completion`, {
    completed: true,
  }).expect(200);
  await mobile("put", `/materials/${material._id}/completion`, {
    completed: true,
  }).expect(200);
  let p = (await mobile("get", `/courses/${course._id}/progress`).expect(200))
    .body;
  assert.equal(p.summary.totalUnits, 3);
  assert.equal(p.summary.completedUnits, 2);
  assert.equal(p.quizzes[0].bestScore, 5);
  await mobile("put", `/materials/${material._id}/completion`, {
    completed: false,
  }).expect(200);
  assert.equal(
    (await student.get(`/api/courses/${course._id}/progress`)).body.lectures[0]
      .completed,
    false,
  );
  await write(student, "put", `/materials/${material._id}/completion`, {
    completed: true,
  }).expect(200);
  await write(student, "post", `/assignments/${assignment._id}/submit`, {
    text: "My complete assignment response.",
  }).expect(201);
  const subs = (
    await teacher.get(`/api/assignments/${assignment._id}/submissions`)
  ).body.items;
  await write(teacher, "patch", `/submissions/${subs[0]._id}/grade`, {
    grade: 0,
    feedback: "Please revisit the lecture.",
  }).expect(200);
  p = (await student.get(`/api/courses/${course._id}/progress`)).body;
  assert.equal(p.summary.progressPercent, 100);
  const roster = (await teacher.get(`/api/courses/${course._id}/progress`))
    .body;
  assert.equal(roster.items[0].quizScores[0].score, 5);
  assert.equal(roster.items[0].lecturesCompleted, 1);
  await other.get(`/api/courses/${course._id}/progress`).expect(403);
});
test("inbox audience, shared read state, deadline clearing, changed announcements and deleted materials", async () => {
  const all = (
    await write(admin, "post", "/admin/announcements", {
      title: "School calendar",
      body: "The school calendar has been updated.",
      audience: "all",
    }).expect(201)
  ).body;
  await write(admin, "post", "/admin/announcements", {
    title: "Faculty only",
    body: "A private faculty update.",
    audience: "instructor",
  }).expect(201);
  let inbox = (await student.get("/api/notifications")).body;
  assert.ok(inbox.items.some((n) => n.title === "School calendar"));
  assert.ok(!inbox.items.some((n) => n.title === "Faculty only"));
  assert.ok(!inbox.items.some((n) => n.type === "assignment-due"));
  assert.ok(
    (await teacher.get("/api/notifications")).body.items.some(
      (n) => n.title === "Faculty only",
    ),
  );
  const notification = inbox.items.find((n) => n.title === "School calendar");
  await write(
    student,
    "patch",
    `/notifications/${notification._id}/read`,
  ).expect(200);
  assert.equal(
    (await mobile("get", "/notifications")).body.items.find(
      (n) => n._id === notification._id,
    ).read,
    true,
  );
  const secondInbox = (await second.get("/api/notifications")).body;
  assert.equal(
    secondInbox.items.find((n) => n._id === notification._id).read,
    false,
  );
  const materialNote = inbox.items.find((n) => n.type === "material");
  await write(
    second,
    "patch",
    `/notifications/${materialNote._id}/read`,
  ).expect(404);
  await write(admin, "patch", `/admin/announcements/${all._id}`, {
    title: "School calendar revised",
    body: "Please review the revised calendar.",
    audience: "student",
  }).expect(200);
  inbox = (await mobile("get", "/notifications")).body;
  assert.equal(
    inbox.items.find((n) => n.title === "School calendar revised").read,
    false,
  );
  assert.ok(
    !(await teacher.get("/api/notifications")).body.items.some(
      (n) => n.title === "School calendar revised",
    ),
  );
  await mobile("post", "/notifications/read-all").expect(200);
  assert.equal((await student.get("/api/notifications")).body.unread, 0);
  await write(teacher, "delete", `/materials/${material._id}`).expect(200);
  assert.ok(
    !(await mobile("get", "/notifications")).body.items.some(
      (n) => n._id === materialNote._id,
    ),
  );
  await write(admin, "delete", `/admin/announcements/${all._id}`).expect(200);
});
test("deadline reminders become overdue, change identity on deadline edits, and paginate without losing read state", async () => {
  const values = {
    title: "Overdue reminder test",
    instructions: "Complete the overdue assignment response.",
    dueDate: new Date(Date.now() - 86400000).toISOString(),
    maxPoints: 10,
    allowLate: true,
  };
  const task = (
    await write(
      teacher,
      "post",
      `/courses/${course._id}/assignments`,
      values,
    ).expect(201)
  ).body;
  let inbox = (await mobile("get", "/notifications")).body;
  const reminder = inbox.items.find((n) => n.type === "assignment-overdue");
  assert.ok(reminder);
  await mobile("patch", `/notifications/${reminder._id}/read`).expect(200);
  await write(teacher, "patch", `/assignments/${task._id}`, {
    ...values,
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
  }).expect(200);
  inbox = (await mobile("get", "/notifications")).body;
  const updated = inbox.items.find((n) => n.type === "assignment-due");
  assert.ok(updated);
  assert.notEqual(updated._id, reminder._id);
  assert.equal(updated.read, false);
  const ids = [];
  for (let index = 0; index < 21; index++) {
    const post = (
      await write(admin, "post", "/admin/announcements", {
        title: `Pagination school notice ${index}`,
        body: "A disposable pagination test notice.",
        audience: "student",
      }).expect(201)
    ).body;
    ids.push(post._id);
  }
  const first = (await mobile("get", "/notifications?page=1")).body,
    secondPage = (await student.get("/api/notifications?page=2")).body;
  assert.equal(first.items.length, 20);
  assert.ok(first.pages >= 2);
  assert.ok(secondPage.items.length > 0);
  assert.ok(
    secondPage.items.every(
      (n) => !first.items.some((item) => item._id === n._id),
    ),
  );
  await mobile("post", "/notifications/read-all").expect(200);
  assert.equal((await student.get("/api/notifications?page=2")).body.unread, 0);
  for (const id of ids)
    await write(admin, "delete", `/admin/announcements/${id}`).expect(200);
  await write(teacher, "delete", `/assignments/${task._id}`).expect(200);
});
test("admin monitors enrollment progress, manages metadata, archives/restores retained learning history and audits", async () => {
  await student.get("/api/admin/enrollments").expect(403);
  await other.get("/api/admin/announcements").expect(403);
  const enrollments = (await admin.get("/api/admin/enrollments?search=LEARN"))
    .body;
  assert.equal(enrollments.total, 1);
  assert.equal(enrollments.items[0].progress.quizzesCompleted, 1);
  const updated = {
    title: "Updated learning course",
    code: course.code,
    category: course.category,
    description: course.description,
    published: true,
    color: "teal",
  };
  await write(admin, "patch", `/admin/courses/${course._id}`, {
    ...updated,
    instructorId: "fake",
  }).expect(400);
  await write(admin, "patch", `/admin/courses/${course._id}`, updated).expect(
    200,
  );
  assert.equal(
    (await teacher.get(`/api/courses/${course._id}`)).body.title,
    updated.title,
  );
  const report = (await admin.get("/api/admin/reports")).body;
  assert.equal(report.learning.quizzesCompleted, 1);
  assert.equal(report.learning.quizAttempts, 3);
  await write(admin, "delete", `/admin/courses/${course._id}`).expect(200);
  await student.get(`/api/courses/${course._id}/progress`).expect(404);
  assert.equal(
    (await admin.get("/api/admin/enrollments?status=archived")).body.total,
    1,
  );
  await write(admin, "post", `/admin/courses/${course._id}/restore`).expect(
    200,
  );
  assert.equal(
    (await student.get(`/api/courses/${course._id}`)).body.published,
    false,
  );
  assert.equal(
    (await student.get(`/api/quizzes/${quiz._id}/attempts`)).body.items.length,
    2,
  );
  const logs = (await admin.get("/api/admin/activity?search=quiz")).body;
  assert.ok(logs.items.some((n) => n.action === "quiz.attempted"));
  assert.doesNotMatch(
    JSON.stringify(logs),
    /Learning2026|passwordHash|correctIndex/,
  );
});
