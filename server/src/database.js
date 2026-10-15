import { MongoClient, GridFSBucket } from "mongodb";

export async function connectDatabase(uri, name = "classroom_lms") {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(name);
  await Promise.all([
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
      .collection("lms_announcements")
      .createIndex({ courseId: 1, createdAt: -1 }),
  ]);
  return {
    client,
    db,
    bucket: new GridFSBucket(db, { bucketName: "lms_files" }),
  };
}
