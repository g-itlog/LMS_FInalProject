import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/database.js";

const password = "Password2026!";
const origin = "http://localhost:5173";
let mongo,
  database,
  app,
  admin,
  student,
  instructor,
  adminId,
  studentId,
  instructorId,
  courseId,
  draftId,
  newUserId;
const post = (agent, path) => agent.post(path).set("Origin", origin);
const patch = (agent, path) => agent.patch(path).set("Origin", origin);
before(async () => {
  mongo = await MongoMemoryServer.create();
  database = await connectDatabase(mongo.getUri(), "lms_admin_test");
  app = createApp({
    ...database,
    config: {
      secret: "test-admin-secret-at-least-32-characters",
      inviteCode: "test-code",
      production: false,
      origins: [origin],
    },
  });
  const users = database.db.collection("lms_users");
  for (const role of ["admin", "student", "instructor"]) {
    const result = await users.insertOne({
      name: `Test ${role}`,
      email: `${role}@admin-test.edu`,
      passwordHash: await bcrypt.hash(password, 4),
      role,
      bio: "",
      department: "IT",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    if (role === "admin") adminId = result.insertedId;
    if (role === "student") studentId = result.insertedId;
    if (role === "instructor") instructorId = result.insertedId;
  }
  admin = request.agent(app);
  student = request.agent(app);
  instructor = request.agent(app);
  for (const [agent, role] of [
    [admin, "admin"],
    [student, "student"],
    [instructor, "instructor"],
  ])
    await post(agent, "/api/auth/login")
      .send({ email: `${role}@admin-test.edu`, password })
      .expect(200);
  const course = {
    title: "Admin Test Course",
    code: "ADMIN 101",
    category: "IT",
    description: "An active classroom for testing administrative oversight.",
    published: true,
    color: "blue",
  };
  courseId = (await post(instructor, "/api/courses").send(course).expect(201))
    .body._id;
  draftId = (
    await post(instructor, "/api/courses")
      .send({ ...course, code: "ADMIN 102", published: false })
      .expect(201)
  ).body._id;
  await post(student, `/api/courses/${courseId}/enroll`).expect(200);
});
after(async () => {
  await database?.client.close();
  await mongo?.stop();
});

test("admin routes enforce authentication and role checks for reads and writes", async () => {
  for (const path of [
    "/api/admin/overview",
    "/api/admin/users",
    "/api/admin/courses",
    "/api/admin/activity",
    `/api/admin/users/${studentId}`,
    `/api/admin/courses/${courseId}`,
  ]) {
    await request(app).get(path).expect(401);
    await student.get(path).expect(403);
    await instructor.get(path).expect(403);
  }
  await post(student, "/api/admin/users").send({}).expect(403);
  await patch(instructor, `/api/admin/users/${studentId}`)
    .send({ status: "suspended" })
    .expect(403);
  await patch(student, `/api/admin/courses/${courseId}/publication`)
    .send({ published: false })
    .expect(403);
  await patch(admin, `/api/admin/users/${studentId}`)
    .send({ name: "Origin attack" })
    .unset("Origin")
    .expect(403);
});

test("administrator privilege cannot be acquired through signup, profile, or mobile", async () => {
  for (const path of ["/api/auth/register", "/api/mobile/auth/register"])
    await request(app)
      .post(path)
      .send({
        name: "Attacker",
        email: "attacker@admin-test.edu",
        password,
        role: "admin",
      })
      .expect(400);
  await patch(student, "/api/auth/profile")
    .send({
      name: "Test student",
      bio: "",
      department: "IT",
      role: "admin",
      status: "active",
    })
    .expect(200);
  assert.equal(
    (await database.db.collection("lms_users").findOne({ _id: studentId }))
      .role,
    "student",
  );
  await request(app)
    .post("/api/mobile/auth/login")
    .send({ email: "admin@admin-test.edu", password })
    .expect(403);
  // A web administrator's valid JWT still cannot be used as a mobile bearer session.
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@admin-test.edu", password })
    .expect(200);
  const token = decodeURIComponent(
    login.headers["set-cookie"][0].split(";")[0].slice("lms_session=".length),
  );
  await request(app)
    .get("/api/admin/overview")
    .set("Authorization", `Bearer ${token}`)
    .expect(403);
});

test("overview and paginated directories return real counts without credentials", async () => {
  const overview = await admin.get("/api/admin/overview").expect(200);
  assert.equal(overview.body.stats.students, 1);
  assert.equal(overview.body.stats.instructors, 1);
  assert.equal(overview.body.stats.admins, 1);
  assert.equal(overview.body.stats.courses, 2);
  assert.equal(overview.body.stats.enrollments, 1);
  assert.equal(overview.body.stats.publishedCourses, 1);
  const result = await admin
    .get("/api/admin/users?role=student&status=active&search=TEST")
    .expect(200);
  assert.equal(result.body.total, 1);
  assert.equal(result.body.items[0].status, "active");
  assert.doesNotMatch(
    JSON.stringify([overview.body, result.body]),
    /passwordHash|test-admin-secret|\$2[aby]\$/,
  );
  await admin.get("/api/admin/users?search=%5B").expect(200);
  await admin.get("/api/admin/users?page=0").expect(400);
  await admin.get("/api/admin/users?search[$ne]=x").expect(400);
  await admin.get("/api/admin/users/not-an-id").expect(400);
});

test("admins can create validated student and instructor accounts but cannot create admins over HTTP", async () => {
  await post(admin, "/api/admin/users")
    .send({
      name: "New Instructor",
      email: "new-instructor@admin-test.edu",
      password,
      role: "instructor",
      department: "IT",
    })
    .expect(201);
  const result = await post(admin, "/api/admin/users")
    .send({
      name: "New Student",
      email: "NEW-STUDENT@admin-test.edu",
      password,
      role: "student",
    })
    .expect(201);
  newUserId = result.body.user._id;
  assert.equal(result.body.user.email, "new-student@admin-test.edu");
  assert.equal(result.body.user.passwordHash, undefined);
  const stored = await database.db
    .collection("lms_users")
    .findOne({ email: "new-student@admin-test.edu" });
  assert.ok(await bcrypt.compare(password, stored.passwordHash));
  await post(admin, "/api/admin/users")
    .send({
      name: "No Admin",
      email: "no-admin@admin-test.edu",
      password,
      role: "admin",
    })
    .expect(400);
  await post(admin, "/api/admin/users")
    .send({
      name: "Weak",
      email: "weak@admin-test.edu",
      password: "weak",
      role: "student",
    })
    .expect(400);
  await post(admin, "/api/admin/users")
    .send({ name: "Duplicate", email: "new-student@admin-test.edu", password })
    .expect(409);
});

test("account editing and role changes preserve teaching history and protect all administrators", async () => {
  await patch(admin, `/api/admin/users/${studentId}`)
    .send({ role: "instructor" })
    .expect(409);
  await patch(admin, `/api/admin/users/${instructorId}`)
    .send({ role: "student" })
    .expect(409);
  const detail = await admin.get(`/api/admin/users/${studentId}`).expect(200);
  assert.equal(detail.body.counts.enrollments, 1);
  assert.equal(detail.body.canChangeRole, false);
  await patch(admin, `/api/admin/users/${newUserId}`)
    .send({
      name: "Updated User",
      email: "updated@admin-test.edu",
      department: "Engineering",
      role: "instructor",
    })
    .expect(200);
  await patch(admin, `/api/admin/users/${adminId}`)
    .send({ status: "suspended" })
    .expect(403);
  await patch(admin, `/api/admin/users/${newUserId}`)
    .send({ role: "admin" })
    .expect(400);
  await patch(admin, `/api/admin/users/${newUserId}`)
    .send({ passwordHash: "bad" })
    .expect(400);
  await patch(admin, `/api/admin/users/${newUserId}`)
    .send({ email: "student@admin-test.edu" })
    .expect(409);
});

test("suspension immediately revokes web and mobile sessions while retaining course records", async () => {
  const mobile = await request(app)
    .post("/api/mobile/auth/login")
    .send({ email: "student@admin-test.edu", password })
    .expect(200);
  await patch(admin, `/api/admin/users/${studentId}`)
    .send({ status: "suspended" })
    .expect(200);
  await student.get("/api/auth/me").expect(401);
  await request(app)
    .get("/api/dashboard")
    .set("Authorization", `Bearer ${mobile.body.token}`)
    .expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "student@admin-test.edu", password })
    .expect(403);
  await request(app)
    .post("/api/mobile/auth/login")
    .send({ email: "student@admin-test.edu", password })
    .expect(403);
  assert.equal(
    await database.db
      .collection("lms_enrollments")
      .countDocuments({ studentId }),
    1,
  );
  assert.equal(
    await database.db
      .collection("lms_sessions")
      .countDocuments({ userId: studentId }),
    0,
  );
  await patch(admin, `/api/admin/users/${studentId}`)
    .send({ status: "active" })
    .expect(200);
  await post(student, "/api/auth/login")
    .send({ email: "student@admin-test.edu", password })
    .expect(200);
  await student.get(`/api/courses/${courseId}`).expect(200);
});

test("course oversight controls publication while preserving enrollment and instructor ownership", async () => {
  const list = await admin
    .get("/api/admin/courses?status=published&search=ADMIN")
    .expect(200);
  assert.equal(list.body.total, 1);
  assert.equal(list.body.items[0].instructorName, "Test instructor");
  const detail = await admin.get(`/api/admin/courses/${courseId}`).expect(200);
  assert.equal(detail.body.course.counts.enrollments, 1);
  await patch(admin, `/api/admin/courses/${courseId}/publication`)
    .send({ published: false })
    .expect(200);
  assert.equal(
    (await student.get("/api/courses?scope=catalog").expect(200)).body.total,
    0,
  );
  await student.get(`/api/courses/${courseId}`).expect(200);
  await patch(admin, `/api/admin/courses/${courseId}/publication`)
    .send({ published: "true" })
    .expect(400);
  await patch(admin, `/api/courses/${courseId}`)
    .send({ title: "Cannot impersonate teacher" })
    .expect(403);
  await patch(admin, `/api/admin/courses/${courseId}/publication`)
    .send({ published: true })
    .expect(200);
  await instructor
    .delete(`/api/courses/${draftId}`)
    .set("Origin", origin)
    .expect(200);
  const archived = await admin
    .get("/api/admin/courses?status=archived")
    .expect(200);
  assert.equal(archived.body.total, 1);
  await patch(admin, `/api/admin/courses/${draftId}/publication`)
    .send({ published: true })
    .expect(404);
});

test("administrative activity is searchable, attributed, private, and contains no passwords", async () => {
  const result = await admin.get("/api/admin/activity").expect(200);
  assert.ok(result.body.total >= 7);
  assert.ok(result.body.items.every((item) => item.actorName === "Test admin"));
  assert.ok(
    result.body.items.some((item) => item.action === "course.publication"),
  );
  const filtered = await admin
    .get("/api/admin/activity?search=Engineering")
    .expect(200);
  assert.equal(filtered.body.total, 1);
  assert.doesNotMatch(
    JSON.stringify(result.body),
    /Password2026|passwordHash|test-code|lms_session/,
  );
  await student.get("/api/admin/activity").expect(403);
});
