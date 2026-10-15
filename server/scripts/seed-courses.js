import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { connectDatabase } from "../src/database.js";
import { seedAdditionalCourses } from "./course-catalog.js";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
let database;
try {
  database = await connectDatabase(
    process.env.MONGO_URL,
    process.env.MONGO_DB_NAME || "classroom_lms",
  );
  const instructor = await database.db
    .collection("lms_users")
    .findOne({
      email: process.env.COURSE_INSTRUCTOR_EMAIL || "instructor@classroom.test",
      role: "instructor",
    });
  if (!instructor) throw new Error("InstructorNotFound");
  const courses = await seedAdditionalCourses(database.db, instructor);
  console.log(
    `Additional catalog ready: ${courses.length} courses with readings, downloadable worksheets, assignments, and announcements.`,
  );
  console.log(
    "Existing course content, enrollments, submissions, and grades were preserved.",
  );
} catch (error) {
  console.error(
    error.message === "InstructorNotFound"
      ? "Create an instructor first, or set COURSE_INSTRUCTOR_EMAIL to an existing instructor email."
      : `Catalog setup failed (${error.name}). Check the database connection and try again.`,
  );
  process.exitCode = 1;
} finally {
  await database?.client.close();
}
