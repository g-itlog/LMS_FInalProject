import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/database.js";
import { MAX_ATTACHMENT_BYTES } from "../src/limits.js";
import { invitationFields } from "../src/invitations.js";

let mongo,
  database,
  app,
  teacher,
  student,
  stranger,
  otherTeacher,
  courseId,
  assignmentId,
  submissionId,
  fileId,
  materialId,
  announcementId;
const origin = "http://localhost:5173";
const password = "Password2026!";
const course = {
  title: "Secure Web Applications",
  code: "TEST 301",
  category: "Computer Science",
  description: "Build and test a secure full-stack application.",
  color: "violet",
  published: true,
};
const post = (agent, url) => agent.post(url).set("Origin", origin);
const patch = (agent, url) => agent.patch(url).set("Origin", origin);
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  database = await connectDatabase(mongo.getUri(), "lms_integration_test");
  await database.db.collection("lms_invitations").insertOne({
    ...invitationFields("second-private-test-code"),
    label: "Second teacher",
    active: true,
    useCount: 0,
    createdAt: new Date(),
  });
  app = createApp({
    ...database,
    config: {
      secret: "test-secret-at-least-32-characters-long",
      inviteCode: "private-test-code",
      origins: [origin],
      production: false,
    },
  });
  teacher = request.agent(app);
  student = request.agent(app);
  stranger = request.agent(app);
  otherTeacher = request.agent(app);
});
after(async () => {
  await database?.client.close();
  await mongo?.stop();
});
test("unauthenticated access and malformed login are rejected", async () => {
  await request(app).get("/api/courses").expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ email: { $ne: "" }, password })
    .expect(400);
});
test("student registration hashes passwords and returns no credentials", async () => {
  const r = await post(student, "/api/auth/register")
    .send({ name: "Test Student", email: "STUDENT@example.test", password })
    .expect(201);
  assert.equal(r.body.user.email, "student@example.test");
  assert.equal(r.body.user.role, "student");
  assert.equal(r.body.user.passwordHash, undefined);
  assert.equal(r.body.token, undefined);
  assert.match(r.headers["set-cookie"][0], /HttpOnly/);
  const stored = await database.db
    .collection("lms_users")
    .findOne({ email: "student@example.test" });
  assert.notEqual(stored.passwordHash, password);
});
test("duplicate accounts and weak passwords are rejected", async () => {
  await request(app)
    .post("/api/auth/register")
    .send({ name: "Duplicate", email: "student@example.test", password })
    .expect(409);
  await request(app)
    .post("/api/auth/register")
    .send({ name: "Weak", email: "weak@example.test", password: "short" })
    .expect(400);
});
test("instructor registration requires a private invitation", async () => {
  await request(app)
    .post("/api/auth/register")
    .send({
      name: "Instructor",
      email: "teacher@example.test",
      password,
      role: "instructor",
      inviteCode: "wrong",
    })
    .expect(403);
  await post(teacher, "/api/auth/register")
    .send({
      name: "Instructor",
      email: "teacher@example.test",
      password,
      role: "instructor",
      inviteCode: "private-test-code",
    })
    .expect(201);
  await post(otherTeacher, "/api/auth/register")
    .send({
      name: "Other Teacher",
      email: "other@example.test",
      password,
      role: "instructor",
      inviteCode: "second-private-test-code",
    })
    .expect(201);
  await post(stranger, "/api/auth/register")
    .send({ name: "Other Student", email: "stranger@example.test", password })
    .expect(201);
});
test("student cannot create courses; instructor can", async () => {
  await post(student, "/api/courses").send(course).expect(403);
  const r = await post(teacher, "/api/courses").send(course).expect(201);
  courseId = r.body._id;
});
test("course ownership, invalid IDs, and origin checks are enforced", async () => {
  await patch(otherTeacher, `/api/courses/${courseId}`)
    .send(course)
    .expect(403);
  await patch(teacher, "/api/courses/not-an-id").send(course).expect(400);
  await teacher
    .patch(`/api/courses/${courseId}`)
    .set("Origin", "https://evil.test")
    .send(course)
    .expect(403);
  await teacher.patch(`/api/courses/${courseId}`).send(course).expect(403);
});
test("catalog search is escaped and paginated", async () => {
  const r = await student
    .get("/api/courses?scope=catalog&search=TEST")
    .expect(200);
  assert.equal(r.body.total, 1);
  assert.equal(r.body.pages, 1);
  await student.get("/api/courses?scope=catalog&search=%5B%24").expect(200);
});
test("only enrolled students can access learning content", async () => {
  const r = await post(teacher, `/api/courses/${courseId}/assignments`)
    .send({
      title: "Build an API",
      instructions: "Create an API with protected CRUD routes.",
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      maxPoints: 100,
    })
    .expect(201);
  assignmentId = r.body._id;
  await post(stranger, `/api/assignments/${assignmentId}/submit`)
    .send({ text: "No enrollment" })
    .expect(403);
  await post(student, `/api/courses/${courseId}/enroll`).expect(200);
  await post(student, `/api/courses/${courseId}/enroll`).expect(200);
  const data = await student.get(`/api/courses/${courseId}`).expect(200);
  assert.equal(data.body.studentCount, 1);
  assert.equal(data.body.assignments.length, 1);
});
test("materials support upload, edit, authenticated download, and URL validation", async () => {
  const r = await post(teacher, `/api/courses/${courseId}/materials`)
    .field("title", "Study guide")
    .field("description", "A useful guide")
    .attach("file", Buffer.from("Learning management systems"), "guide.txt")
    .expect(201);
  materialId = r.body._id;
  fileId = r.body.file.id;
  await student.get(`/api/files/${fileId}`).expect(200);
  await stranger.get(`/api/files/${fileId}`).expect(403);
  await request(app).get(`/api/files/${fileId}`).expect(401);
  await patch(teacher, `/api/materials/${materialId}`)
    .field("title", "Updated guide")
    .field("description", "Updated")
    .expect(200);
  await post(teacher, `/api/courses/${courseId}/materials`)
    .field("title", "Unsafe link")
    .field("url", "javascript:alert(1)")
    .expect(400);
  await post(teacher, `/api/courses/${courseId}/materials`)
    .field("title", "Fake PDF")
    .attach("file", Buffer.from("not a PDF"), "bad.pdf")
    .expect(400);
});
test("3 MB attachment boundary works and larger uploads are rejected without stored files", async () => {
  const count = await database.db
    .collection("lms_files.files")
    .countDocuments();
  const uploaded = await post(teacher, `/api/courses/${courseId}/materials`)
    .field("title", "Boundary-size reading")
    .attach("file", Buffer.alloc(MAX_ATTACHMENT_BYTES, 65), "boundary.txt")
    .expect(201);
  const download = await student
    .get(`/api/files/${uploaded.body.file.id}`)
    .expect(200);
  assert.equal(
    Number(download.headers["content-length"]),
    MAX_ATTACHMENT_BYTES,
  );
  for (const [agent, url, field] of [
    [teacher, `/api/courses/${courseId}/materials`, "title"],
    [student, `/api/assignments/${assignmentId}/submit`, "text"],
  ]) {
    const rejected = await post(agent, url)
      .field(field, "Oversized attachment")
      .attach(
        "file",
        Buffer.alloc(MAX_ATTACHMENT_BYTES + 1, 65),
        "oversized.txt",
      )
      .expect(413);
    assert.match(rejected.body.message, /3 MB/);
  }
  await teacher
    .delete(`/api/materials/${uploaded.body._id}`)
    .set("Origin", origin)
    .expect(200);
  assert.equal(
    await database.db.collection("lms_files.files").countDocuments(),
    count,
  );
});

test("announcements support create, edit, and delete with ownership checks", async () => {
  const r = await post(teacher, `/api/courses/${courseId}/announcements`)
    .send({
      title: "Welcome class",
      body: "Please read the guide.",
      pinned: true,
    })
    .expect(201);
  announcementId = r.body._id;
  await patch(otherTeacher, `/api/announcements/${announcementId}`)
    .send({ title: "Unauthorized", body: "Another announcement" })
    .expect(403);
  await patch(teacher, `/api/announcements/${announcementId}`)
    .send({
      title: "Updated notice",
      body: "Our next class is tomorrow.",
      pinned: false,
    })
    .expect(200);
});
test("assignment submissions accept text and files and isolate student work", async () => {
  await post(student, `/api/assignments/${assignmentId}/submit`)
    .send({ text: "" })
    .expect(400);
  await post(student, `/api/assignments/${assignmentId}/submit`)
    .field("text", "My response")
    .attach("file", Buffer.from("Student work"), "answer.txt")
    .expect(201);
  const r = await teacher
    .get(`/api/assignments/${assignmentId}/submissions`)
    .expect(200);
  submissionId = r.body.items[0]._id;
  assert.equal(r.body.items[0].student.passwordHash, undefined);
  await student.get(`/api/assignments/${assignmentId}/submissions`).expect(403);
  await post(stranger, `/api/courses/${courseId}/enroll`).expect(200);
  await stranger.get(`/api/files/${r.body.items[0].file.id}`).expect(403);
  await post(student, `/api/assignments/${assignmentId}/submit`)
    .send({ text: "Updated response" })
    .expect(200);
});
test("grading validates points, requires feedback, and locks graded work", async () => {
  await patch(student, `/api/submissions/${submissionId}/grade`)
    .send({ grade: 99, feedback: "Not allowed" })
    .expect(403);
  await patch(otherTeacher, `/api/submissions/${submissionId}/grade`)
    .send({ grade: 99, feedback: "Not allowed" })
    .expect(403);
  await patch(teacher, `/api/submissions/${submissionId}/grade`)
    .send({ grade: 101, feedback: "Too high" })
    .expect(400);
  for (const invalidGrade of ["", null, false]) {
    await patch(teacher, `/api/submissions/${submissionId}/grade`)
      .send({ grade: invalidGrade, feedback: "A grade must be a real number." })
      .expect(400);
  }
  await patch(teacher, `/api/submissions/${submissionId}/grade`)
    .send({ grade: 0, feedback: "Please revise your approach." })
    .expect(200);
  const r = await student.get("/api/dashboard").expect(200);
  assert.equal(r.body.submissions[0].grade, 0);
  assert.equal(r.body.submissions[0].feedback, "Please revise your approach.");
  await post(student, `/api/assignments/${assignmentId}/submit`)
    .send({ text: "Try replacing graded work" })
    .expect(409);
});
test("past deadlines close submission, while allowLate records late work", async () => {
  const r = await post(teacher, `/api/courses/${courseId}/assignments`)
    .send({
      title: "Past assignment",
      instructions: "A past assignment for deadline checks.",
      dueDate: new Date(Date.now() - 86400000).toISOString(),
      maxPoints: 20,
    })
    .expect(201);
  await post(student, `/api/assignments/${r.body._id}/submit`)
    .send({ text: "Too late" })
    .expect(400);
  await patch(teacher, `/api/assignments/${r.body._id}`)
    .send({ ...r.body, allowLate: true })
    .expect(200);
  await post(student, `/api/assignments/${r.body._id}/submit`)
    .send({ text: "Late but accepted" })
    .expect(201);
  const result = await student.get("/api/dashboard");
  assert.equal(
    result.body.submissions.find((s) => s.assignmentId === r.body._id).late,
    true,
  );
});
test("mobile login rejects instructors and issues revocable student bearer sessions", async () => {
  await request(app)
    .post("/api/mobile/auth/login")
    .send({ email: "teacher@example.test", password })
    .expect(403);
  await request(app)
    .post("/api/mobile/auth/register")
    .send({
      name: "Escalation",
      email: "escalate@example.test",
      password,
      role: "instructor",
      inviteCode: "private-test-code",
    })
    .expect(403);
  const r = await request(app)
    .post("/api/mobile/auth/login")
    .send({ email: "student@example.test", password })
    .expect(200);
  assert.ok(r.body.token);
  await request(app)
    .get("/api/dashboard")
    .set("Authorization", `Bearer ${r.body.token}`)
    .expect(200);
  await request(app)
    .post("/api/auth/logout")
    .set("Authorization", `Bearer ${r.body.token}`)
    .expect(200);
  await request(app)
    .get("/api/dashboard")
    .set("Authorization", `Bearer ${r.body.token}`)
    .expect(401);
});
test("profile updates cannot escalate roles; password rotation revokes other sessions", async () => {
  const r = await patch(student, "/api/auth/profile")
    .send({
      name: "Updated Student",
      bio: "Learning MERN",
      department: "IT",
      role: "instructor",
    })
    .expect(200);
  assert.equal(r.body.user.role, "student");
  const mobile = await request(app)
    .post("/api/mobile/auth/login")
    .send({ email: "student@example.test", password })
    .expect(200);
  await patch(student, "/api/auth/password")
    .send({ currentPassword: password, newPassword: "NewPassword2026!" })
    .expect(200);
  await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${mobile.body.token}`)
    .expect(401);
  await student.get("/api/auth/me").expect(200);
});
test("content deletion works and deleting a course blocks all related access", async () => {
  await teacher
    .delete(`/api/materials/${materialId}`)
    .set("Origin", origin)
    .expect(200);
  await student.get(`/api/files/${fileId}`).expect(404);
  await teacher
    .delete(`/api/announcements/${announcementId}`)
    .set("Origin", origin)
    .expect(200);
  await teacher
    .delete(`/api/assignments/${assignmentId}`)
    .set("Origin", origin)
    .expect(200);
  await teacher.get(`/api/assignments/${assignmentId}/submissions`).expect(404);
  await teacher
    .delete(`/api/courses/${courseId}`)
    .set("Origin", origin)
    .expect(200);
  await student.get(`/api/courses/${courseId}`).expect(404);
  const r = await student.get("/api/dashboard");
  assert.equal(r.body.courses.length, 0);
});
test("logout revokes the browser session", async () => {
  await post(student, "/api/auth/logout").expect(200);
  await student.get("/api/auth/me").expect(401);
});
