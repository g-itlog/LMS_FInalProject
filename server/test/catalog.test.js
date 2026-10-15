import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/database.js";
import { seedDemo } from "../scripts/seed-data.js";
import {
  additionalCourses,
  seedAdditionalCourses,
} from "../scripts/course-catalog.js";

let mongo, database, app, student, teacher, instructor;
const origin = "http://localhost:5173";
before(async () => {
  mongo = await MongoMemoryServer.create();
  database = await connectDatabase(mongo.getUri(), "catalog_test");
  await seedDemo(database.db, "Classroom2026!");
  instructor = await database.db
    .collection("lms_users")
    .findOne({ email: "instructor@classroom.test" });
  app = createApp({
    ...database,
    config: {
      secret: "isolated-catalog-test-secret-at-least-32-characters",
      production: false,
      origins: [origin],
    },
  });
  const mobile = await request(app)
    .post("/api/mobile/auth/login")
    .send({ email: "student@classroom.test", password: "Classroom2026!" })
    .expect(200);
  student = request(app);
  student.token = mobile.body.token;
  teacher = request.agent(app);
  await teacher
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email: "instructor@classroom.test", password: "Classroom2026!" })
    .expect(200);
});
after(async () => {
  await database?.client.close();
  await mongo?.stop();
});

test("all eight added courses support catalog browsing, enrollment, worksheet download, submission, and grading", async () => {
  const get = (url) =>
    student.get(url).set("Authorization", `Bearer ${student.token}`);
  const post = (url) =>
    student.post(url).set("Authorization", `Bearer ${student.token}`);
  const first = await get("/api/courses?scope=catalog&page=1").expect(200);
  const second = await get("/api/courses?scope=catalog&page=2").expect(200);
  assert.equal(first.body.total, 12);
  assert.equal(first.body.items.length, 9);
  assert.equal(second.body.items.length, 3);
  const courses = [...first.body.items, ...second.body.items];
  assert.equal(new Set(courses.map((c) => c._id)).size, 12);
  const search = await get("/api/courses?scope=catalog&search=Python").expect(
    200,
  );
  assert.equal(search.body.items[0].code, "IT 101");
  for (const definition of additionalCourses) {
    const course = courses.find((c) => c.code === definition.code);
    assert.ok(course);
    assert.equal(course.enrolled, false);
    const preview = await get(`/api/courses/${course._id}`).expect(200);
    assert.equal(preview.body.materials, undefined);
    await post(`/api/courses/${course._id}/enroll`).expect(200);
    const detail = (await get(`/api/courses/${course._id}`).expect(200)).body;
    assert.equal(detail.materials.length, 2);
    assert.equal(detail.assignments.length, 1);
    assert.equal(detail.announcements.length, 1);
    const reading = detail.materials.find((m) => m.url);
    assert.match(reading.url, /^https:\/\//);
    assert.ok(reading.description.length > 20);
    const worksheet = detail.materials.find((m) => m.file);
    assert.ok(worksheet.file.size > 200);
    const file = await get(`/api/files/${worksheet.file.id}`).expect(200);
    assert.match(file.headers["content-disposition"], /attachment/);
    const downloaded = Buffer.isBuffer(file.body)
      ? file.body.toString("utf8")
      : file.text;
    assert.ok(downloaded.includes(definition.title));
    assert.ok(downloaded.includes(definition.assignment.title));
    const assignment = detail.assignments[0];
    assert.ok(new Date(assignment.dueDate) > new Date());
    assert.ok(assignment.instructions.length > 100);
    await post(`/api/assignments/${assignment._id}/submit`)
      .send({ text: `My tested response for ${definition.code}.` })
      .expect(201);
    const review = await teacher
      .get(`/api/assignments/${assignment._id}/submissions`)
      .expect(200);
    assert.equal(review.body.items.length, 1);
    await teacher
      .patch(`/api/submissions/${review.body.items[0]._id}/grade`)
      .set("Origin", origin)
      .send({
        grade: 85,
        feedback: `Constructive feedback for ${definition.code}.`,
      })
      .expect(200);
    const refreshed = (await get(`/api/courses/${course._id}`).expect(200))
      .body;
    assert.equal(refreshed.submissions[0].grade, 85);
    assert.match(refreshed.submissions[0].feedback, /Constructive feedback/);
  }
});

test("catalog seeding is repeatable and preserves edited resources, deadlines, submissions, grades, and stored files", async () => {
  const db = database.db;
  const course = await db.collection("lms_courses").findOne({ code: "IT 101" });
  await db
    .collection("lms_courses")
    .updateOne(
      { _id: course._id },
      { $set: { title: "Instructor-edited Python course", published: false } },
    );
  await db
    .collection("lms_materials")
    .updateOne(
      { courseId: course._id, catalogKey: "worksheet" },
      {
        $set: {
          title: "Instructor-edited worksheet",
          description: "Preserve this feedback and attachment.",
        },
      },
    );
  await db
    .collection("lms_assignments")
    .updateOne(
      { courseId: course._id },
      {
        $set: {
          title: "Instructor-edited task",
          dueDate: new Date("2027-01-01T00:00:00.000Z"),
        },
      },
    );
  const collections = [
    "lms_courses",
    "lms_materials",
    "lms_assignments",
    "lms_announcements",
    "lms_enrollments",
    "lms_submissions",
    "lms_files.files",
    "lms_files.chunks",
  ];
  const beforeState = await Promise.all(
    collections.map(async (name) =>
      JSON.stringify(
        await db.collection(name).find({}).sort({ _id: 1 }).toArray(),
      ),
    ),
  );
  const seeded = await seedAdditionalCourses(db, instructor);
  assert.equal(seeded.length, 8);
  const afterState = await Promise.all(
    collections.map(async (name) =>
      JSON.stringify(
        await db.collection(name).find({}).sort({ _id: 1 }).toArray(),
      ),
    ),
  );
  assert.deepEqual(afterState, beforeState);
});

test("catalog seeding does not revive archived courses or alter another instructor's course", async () => {
  const db = database.db;
  const archivedAt = new Date();
  const otherInstructor = new ObjectId();
  await db
    .collection("lms_courses")
    .updateOne(
      { code: "IT 307" },
      { $set: { deletedAt: archivedAt, published: false } },
    );
  await db
    .collection("lms_courses")
    .updateOne({ code: "IT 306" }, { $set: { instructorId: otherInstructor } });
  const seeded = await seedAdditionalCourses(db, instructor);
  assert.equal(seeded.length, 6);
  const archived = await db
    .collection("lms_courses")
    .findOne({ code: "IT 307" });
  assert.equal(archived.deletedAt.toISOString(), archivedAt.toISOString());
  assert.equal(archived.published, false);
  const owned = await db.collection("lms_courses").findOne({ code: "IT 306" });
  assert.ok(owned.instructorId.equals(otherInstructor));
  assert.equal(await db.collection("lms_courses").countDocuments({}), 12);
});
