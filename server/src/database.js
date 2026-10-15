import { MongoClient, GridFSBucket } from "mongodb";

export async function connectDatabase(
  uri,
  name = "classroom_lms",
  options = {},
) {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    ...options,
  });
  try {
    await client.connect();
    const db = client.db(name);
    await Promise.all([
      db
        .collection("lms_assignment_deadlines")
        .createIndex({ assignmentId: 1, studentId: 1 }, { unique: true }),
      db
        .collection("lms_extension_requests")
        .createIndex(
          { assignmentId: 1, studentId: 1 },
          { unique: true, partialFilterExpression: { status: "pending" } },
        ),
      db
        .collection("lms_extension_requests")
        .createIndex({ courseId: 1, status: 1, createdAt: -1 }),
      db
        .collection("lms_email_challenges")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db
        .collection("lms_email_challenges")
        .createIndex({ grantHash: 1 }, { unique: true, sparse: true }),
      db
        .collection("lms_email_challenges")
        .createIndex({ email: 1, purpose: 1 }),
      db
        .collection("lms_email_limits")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("lms_users").createIndex({ email: 1 }, { unique: true }),
      db
        .collection("lms_sessions")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("lms_courses").createIndex({ code: 1 }, { unique: true }),
      db
        .collection("lms_enrollments")
        .createIndex({ courseId: 1, studentId: 1 }, { unique: true }),
      db
        .collection("lms_submissions")
        .createIndex({ assignmentId: 1, studentId: 1 }, { unique: true }),
      db.collection("lms_assignments").createIndex({ courseId: 1, dueDate: 1 }),
      db.collection("lms_materials").createIndex({ courseId: 1 }),
      db
        .collection("lms_quizzes")
        .createIndex({ courseId: 1, published: 1, archivedAt: 1 }),
      db
        .collection("lms_quiz_attempts")
        .createIndex(
          { quizId: 1, studentId: 1, attemptNumber: 1 },
          { unique: true },
        ),
      db
        .collection("lms_quiz_attempts")
        .createIndex({ courseId: 1, studentId: 1 }),
      db
        .collection("lms_lecture_completion")
        .createIndex({ materialId: 1, studentId: 1 }, { unique: true }),
      db
        .collection("lms_lecture_completion")
        .createIndex({ courseId: 1, studentId: 1 }),
      db
        .collection("lms_notification_reads")
        .createIndex({ userId: 1, notificationId: 1 }, { unique: true }),
      db
        .collection("lms_school_announcements")
        .createIndex({ audience: 1, createdAt: -1 }),
      db
        .collection("lms_submissions")
        .createIndex({ courseId: 1, submittedAt: 1 }),
      db
        .collection("lms_enrollments")
        .createIndex({ courseId: 1, createdAt: 1 }),
      db.collection("lms_users").createIndex({ createdAt: 1 }),
      db
        .collection("lms_users")
        .createIndex({ role: 1, status: 1, createdAt: -1 }),
      db
        .collection("lms_admin_activity")
        .createIndex({ createdAt: -1, _id: -1 }),
      db
        .collection("lms_invitations")
        .createIndex({ codeHash: 1 }, { unique: true }),
      db
        .collection("lms_invitations")
        .createIndex({ source: 1 }, { unique: true, sparse: true }),
      db
        .collection("lms_invitations")
        .createIndex({ useCount: 1, active: 1, createdAt: -1 }),
      db
        .collection("lms_announcements")
        .createIndex({ courseId: 1, createdAt: -1 }),
    ]);
    return {
      client,
      db,
      bucket: new GridFSBucket(db, { bucketName: "lms_files" }),
    };
  } catch (error) {
    await client.close();
    throw error;
  }
}
