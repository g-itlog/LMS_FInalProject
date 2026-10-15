import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectDatabase } from "../src/database.js";
import { createApp } from "../src/app.js";
import { buildReport, reportPeriod, reportCsv } from "../src/analytics.js";

const period = { from: "2026-10-15", to: "2026-10-16" };
const now = new Date("2026-10-16T04:00:00Z");
const password = "Password2026!",
  origin = "http://localhost:5173";
let mongo, database, app, admin, student, instructor, pendingId;
const courseA = new ObjectId(),
  courseB = new ObjectId(),
  archived = new ObjectId();
const assignmentA = new ObjectId(),
  assignmentB = new ObjectId(),
  assignmentArchived = new ObjectId();
const at = (value) => new Date(value);
before(async () => {
  mongo = await MongoMemoryServer.create();
  database = await connectDatabase(mongo.getUri(), "analytics_test");
  const { db } = database;
  app = createApp({
    ...database,
    config: {
      secret: "analytics-test-secret-at-least-32-characters",
      origins: [origin],
      production: false,
    },
  });
  const passwordHash = await bcrypt.hash(password, 4);
  await db.collection("lms_users").insertMany([
    {
      name: "Report Admin",
      email: "admin@reports.test",
      role: "admin",
      passwordHash,
      createdAt: at("2026-10-01T00:00:00Z"),
    },
    {
      name: "Report Teacher",
      email: "instructor@reports.test",
      role: "instructor",
      passwordHash,
      createdAt: at("2026-10-14T16:00:00Z"),
    },
    {
      name: "Report Student",
      email: "student@reports.test",
      role: "student",
      passwordHash,
      createdAt: at("2026-10-15T23:00:00Z"),
    },
    {
      name: "Suspended Student",
      email: "suspended@reports.test",
      role: "student",
      status: "suspended",
      passwordHash,
      createdAt: at("2026-10-16T16:00:00Z"),
    },
  ]);
  await db.collection("lms_courses").insertMany([
    {
      _id: courseA,
      code: "REPORT A",
      title: "Published course",
      published: true,
    },
    {
      _id: courseB,
      code: "REPORT B",
      title: "Unpublished course",
      published: false,
    },
    {
      _id: archived,
      code: "REPORT C",
      title: "Archived course",
      published: true,
      deletedAt: now,
    },
  ]);
  await db.collection("lms_assignments").insertMany([
    { _id: assignmentA, courseId: courseA, maxPoints: 100 },
    { _id: assignmentB, courseId: courseB, maxPoints: 50 },
    { _id: assignmentArchived, courseId: archived, maxPoints: 100 },
  ]);
  const sharedStudent = new ObjectId();
  await db.collection("lms_enrollments").insertMany([
    {
      courseId: courseA,
      studentId: sharedStudent,
      createdAt: at("2026-10-14T16:00:00Z"),
    },
    {
      courseId: courseB,
      studentId: sharedStudent,
      createdAt: at("2026-10-16T01:00:00Z"),
    },
    {
      courseId: courseA,
      studentId: new ObjectId(),
      createdAt: at("2026-10-14T15:59:59.999Z"),
    },
    {
      courseId: archived,
      studentId: sharedStudent,
      createdAt: at("2026-10-15T01:00:00Z"),
    },
  ]);
  pendingId = new ObjectId();
  await db.collection("lms_submissions").insertMany([
    {
      assignmentId: assignmentA,
      courseId: courseA,
      studentId: new ObjectId(),
      grade: 0,
      submittedAt: at("2026-10-14T16:00:00Z"),
    },
    {
      assignmentId: assignmentA,
      courseId: courseA,
      studentId: new ObjectId(),
      grade: 90,
      late: true,
      submittedAt: at("2026-10-16T15:59:59.999Z"),
    },
    {
      _id: pendingId,
      assignmentId: assignmentA,
      courseId: courseA,
      studentId: new ObjectId(),
      grade: null,
      submittedAt: at("2026-10-15T16:00:00Z"),
    },
    {
      assignmentId: assignmentB,
      courseId: courseB,
      studentId: new ObjectId(),
      grade: 40,
      submittedAt: at("2026-10-16T01:00:00Z"),
    },
    {
      assignmentId: assignmentA,
      courseId: courseA,
      studentId: new ObjectId(),
      grade: 20,
      submittedAt: at("2026-10-14T15:59:59.999Z"),
    },
    {
      assignmentId: assignmentB,
      courseId: courseB,
      studentId: new ObjectId(),
      grade: 30,
      submittedAt: at("2026-10-16T16:00:00Z"),
    },
    {
      assignmentId: assignmentArchived,
      courseId: archived,
      studentId: new ObjectId(),
      grade: 99,
      submittedAt: at("2026-10-16T01:00:00Z"),
    },
  ]);
  admin = request.agent(app);
  student = request.agent(app);
  instructor = request.agent(app);
  for (const [agent, role] of [
    [admin, "admin"],
    [student, "student"],
    [instructor, "instructor"],
  ])
    await agent
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email: `${role}@reports.test`, password })
      .expect(200);
});
after(async () => {
  await database?.client.close();
  await mongo?.stop();
});

test("report periods use inclusive Philippine calendar days and reject invalid or unbounded input", () => {
  const parsed = reportPeriod(period, now);
  assert.equal(parsed.start.toISOString(), "2026-10-14T16:00:00.000Z");
  assert.equal(parsed.end.toISOString(), "2026-10-16T16:00:00.000Z");
  const defaultRange = reportPeriod({}, at("2026-10-15T16:00:00Z"));
  assert.equal(defaultRange.to, "2026-10-16");
  assert.equal(defaultRange.from, "2026-09-17");
  assert.equal(
    reportPeriod({ from: "2024-02-29", to: "2024-02-29" }).end -
      reportPeriod({ from: "2024-02-29", to: "2024-02-29" }).start,
    86400000,
  );
  for (const query of [
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-10-17", to: "2026-10-16" },
    { from: "2026-01-01", to: "2027-01-02" },
    { from: "2026-10-15" },
    { page: 0 },
    { kind: "invalid" },
    { search: { $ne: "" } },
    { unexpected: "ignore-me" },
  ])
    assert.throws(
      () => reportPeriod(query),
      (error) => error.status === 400,
    );
});

test("report totals and daily buckets include boundary records, zero grades, and draft courses accurately", async () => {
  const result = await buildReport(database.db, period, now);
  assert.equal(result.timeZone, "Asia/Manila");
  assert.deepEqual(result.summary, {
    submissions: 4,
    graded: 3,
    pending: 1,
    late: 1,
    earnedPoints: 130,
    possiblePoints: 250,
    scoredSubmissions: 3,
    reviewRate: 75,
    weightedScore: 52,
    newAccounts: 2,
    newEnrollments: 2,
    activeCourses: 2,
  });
  assert.equal(result.daily.length, 2);
  assert.deepEqual(
    result.daily.map((row) => [
      row.date,
      row.newAccounts,
      row.newEnrollments,
      row.submissions,
      row.graded,
      row.pending,
    ]),
    [
      ["2026-10-15", 1, 1, 1, 1, 0],
      ["2026-10-16", 1, 1, 3, 2, 1],
    ],
  );
  assert.equal(
    result.daily.reduce((sum, row) => sum + row.submissions, 0),
    result.summary.submissions,
  );
  assert.equal(
    result.courses.items.reduce((sum, row) => sum + row.enrollments, 0),
    3,
  );
  assert.equal(
    result.courses.items.reduce((sum, row) => sum + row.submissions, 0),
    4,
  );
  assert.deepEqual(
    result.topCourses.map((row) => [row.code, row.submissions]),
    [
      ["REPORT A", 3],
      ["REPORT B", 1],
    ],
  );
  assert.equal(
    result.courses.items.find((row) => row._id.equals(courseB)).weightedScore,
    80,
  );
});

test("empty periods return complete zero-filled dates and no invented rates or scores", async () => {
  const result = await buildReport(
    database.db,
    { from: "2026-09-01", to: "2026-09-03" },
    now,
  );
  assert.equal(result.daily.length, 3);
  assert.ok(
    result.daily.every(
      (row) =>
        row.submissions === 0 &&
        row.newAccounts === 0 &&
        row.newEnrollments === 0,
    ),
  );
  assert.equal(result.summary.reviewRate, null);
  assert.equal(result.summary.weightedScore, null);
  assert.equal(result.summary.submissions, 0);
  assert.equal(result.courses.total, 2);
  assert.deepEqual(result.topCourses, []);
  const singleDay = await buildReport(
    database.db,
    { from: "2026-10-15", to: "2026-10-15" },
    now,
  );
  assert.equal(singleDay.daily.length, 1);
  assert.equal(singleDay.summary.submissions, 1);
  assert.equal(singleDay.summary.graded, 1);
  assert.equal(singleDay.summary.weightedScore, 0);
});

test("a resubmission is counted at its latest saved date without inventing extra submission attempts", async () => {
  const collection = database.db.collection("lms_submissions");
  try {
    await collection.updateOne(
      { _id: pendingId },
      { $set: { submittedAt: at("2026-10-16T16:00:00Z") } },
    );
    const result = await buildReport(database.db, period, now);
    assert.equal(result.summary.submissions, 3);
    assert.equal(result.summary.pending, 0);
    assert.equal(await collection.countDocuments({ _id: pendingId }), 1);
  } finally {
    await collection.updateOne(
      { _id: pendingId },
      { $set: { submittedAt: at("2026-10-15T16:00:00Z") } },
    );
  }
});

test("invalid assessment denominators are excluded from weighted scores without dropping submission counts", async () => {
  const inserted = await database.db.collection("lms_submissions").insertOne({
    assignmentId: new ObjectId(),
    courseId: courseA,
    studentId: new ObjectId(),
    grade: 10,
    submittedAt: at("2026-10-16T01:00:00Z"),
  });
  try {
    const result = await buildReport(database.db, period, now);
    assert.equal(result.summary.submissions, 5);
    assert.equal(result.summary.graded, 4);
    assert.equal(result.summary.scoredSubmissions, 3);
    assert.equal(result.summary.weightedScore, 52);
  } finally {
    await database.db
      .collection("lms_submissions")
      .deleteOne({ _id: inserted.insertedId });
  }
});

test("course search and pagination do not change school totals and CSV exports all matching rows safely", async () => {
  const extra = Array.from({ length: 13 }, (_, index) => ({
    _id: new ObjectId(),
    code: `CSV ${String(index).padStart(2, "0")}`,
    title: index === 0 ? '=SUM(1,2) "quoted"' : "CSV Course",
    published: false,
  }));
  await database.db.collection("lms_courses").insertMany(extra);
  try {
    const result = await buildReport(
      database.db,
      { ...period, search: "CSV", page: 2 },
      now,
    );
    assert.equal(result.courses.total, 13);
    assert.equal(result.courses.pages, 2);
    assert.equal(result.courses.items.length, 1);
    assert.equal(result.summary.submissions, 4);
    const csv = reportCsv(result);
    assert.equal(csv.split("\r\n").filter(Boolean).length, 14);
    assert.ok(csv.includes('"CSV 00"') && csv.includes('"CSV 12"'));
    assert.ok(csv.includes('"\'=SUM(1,2) ""quoted"""'));
    assert.ok(csv.includes('"Asia/Manila"'));
    const daily = reportCsv(result, "daily");
    assert.equal(daily.split("\r\n").filter(Boolean).length, 3);
    assert.ok(daily.includes('"2026-10-15","1","1","1","1","0","0"'));
  } finally {
    await database.db
      .collection("lms_courses")
      .deleteMany({ _id: { $in: extra.map((row) => row._id) } });
  }
});

test("report APIs and exports enforce admin permissions, query validation, and credential-free responses", async () => {
  for (const endpoint of ["/api/admin/reports", "/api/admin/reports/export"]) {
    await request(app).get(endpoint).expect(401);
    await student.get(endpoint).expect(403);
    await instructor.get(endpoint).expect(403);
    await admin.get(`${endpoint}?from=2026-02-30&to=2026-03-01`).expect(400);
    await admin.get(`${endpoint}?unexpected=field`).expect(400);
  }
  const params = new URLSearchParams(period);
  const response = await admin.get(`/api/admin/reports?${params}`).expect(200);
  assert.equal(response.body.summary.weightedScore, 52);
  assert.equal(response.body.courseRows, undefined);
  assert.doesNotMatch(
    JSON.stringify(response.body),
    /passwordHash|Password2026|@reports\.test|Report Student/,
  );
  const csv = await admin
    .get(`/api/admin/reports/export?${params}&kind=courses`)
    .expect(200);
  assert.match(csv.headers["content-type"], /text\/csv/);
  assert.match(
    csv.headers["content-disposition"],
    /knowhere-courses-2026-10-15-2026-10-16\.csv/,
  );
  assert.equal(csv.headers["cache-control"], "no-store");
  assert.ok(csv.text.includes('"REPORT A"'));
});
