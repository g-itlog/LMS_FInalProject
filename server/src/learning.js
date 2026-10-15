import { Router } from "express";
import { fail, id, role } from "./security.js";
import { requireCourse } from "./courses.js";
import { z } from "zod";
import { validate } from "./validation.js";
import { audit } from "./audit.js";

export async function learningSnapshot(db, courseIds, studentIds) {
  const filter = { courseId: { $in: courseIds } },
    people = studentIds ? { studentId: { $in: studentIds } } : {};
  const [
    materials,
    assignments,
    quizzes,
    enrollments,
    completed,
    submissions,
    attempts,
  ] = await Promise.all([
    db
      .collection("lms_materials")
      .find(filter, { projection: { title: 1, courseId: 1 } })
      .toArray(),
    db
      .collection("lms_assignments")
      .find(filter, { projection: { title: 1, courseId: 1 } })
      .toArray(),
    db
      .collection("lms_quizzes")
      .find(
        { ...filter, archivedAt: { $exists: false } },
        { projection: { title: 1, courseId: 1, published: 1, maxScore: 1 } },
      )
      .toArray(),
    db
      .collection("lms_enrollments")
      .find({ ...filter, ...people })
      .toArray(),
    db
      .collection("lms_lecture_completion")
      .find(
        { ...filter, ...people },
        { projection: { studentId: 1, materialId: 1 } },
      )
      .toArray(),
    db
      .collection("lms_submissions")
      .find(
        { ...filter, ...people },
        { projection: { studentId: 1, assignmentId: 1 } },
      )
      .toArray(),
    db
      .collection("lms_quiz_attempts")
      .find(
        { ...filter, ...people },
        { projection: { studentId: 1, quizId: 1, score: 1, maxScore: 1 } },
      )
      .toArray(),
  ]);
  const completionSet = new Set(
      completed.map((row) => `${row.studentId}:${row.materialId}`),
    ),
    submissionSet = new Set(
      submissions.map((row) => `${row.studentId}:${row.assignmentId}`),
    );
  const best = new Map();
  for (const row of attempts) {
    const key = `${row.studentId}:${row.quizId}`;
    if (!best.has(key) || best.get(key).score < row.score)
      best.set(key, { score: row.score, maxScore: row.maxScore });
  }
  const rows = enrollments.map((enrollment) => {
    const ownMaterials = materials.filter((row) =>
      row.courseId.equals(enrollment.courseId),
    );
    const ownAssignments = assignments.filter((row) =>
      row.courseId.equals(enrollment.courseId),
    );
    const ownQuizzes = quizzes.filter(
      (row) => row.courseId.equals(enrollment.courseId) && row.published,
    );
    const lecturesCompleted = ownMaterials.filter((row) =>
      completionSet.has(`${enrollment.studentId}:${row._id}`),
    ).length;
    const assignmentsSubmitted = ownAssignments.filter((row) =>
      submissionSet.has(`${enrollment.studentId}:${row._id}`),
    ).length;
    const quizzesCompleted = ownQuizzes.filter((row) =>
      best.has(`${enrollment.studentId}:${row._id}`),
    ).length;
    const totalUnits =
        ownMaterials.length + ownAssignments.length + ownQuizzes.length,
      completedUnits =
        lecturesCompleted + assignmentsSubmitted + quizzesCompleted;
    return {
      enrollmentId: enrollment._id,
      courseId: enrollment.courseId,
      studentId: enrollment.studentId,
      enrolledAt: enrollment.createdAt,
      lectureCount: ownMaterials.length,
      lecturesCompleted,
      assignmentCount: ownAssignments.length,
      assignmentsSubmitted,
      quizCount: ownQuizzes.length,
      quizzesCompleted,
      totalUnits,
      completedUnits,
      progressPercent: totalUnits
        ? Math.round((completedUnits / totalUnits) * 100)
        : 0,
      quizScores: quizzes
        .filter(
          (row) =>
            row.courseId.equals(enrollment.courseId) &&
            best.has(`${enrollment.studentId}:${row._id}`),
        )
        .map((row) => ({
          _id: row._id,
          title: row.title,
          ...best.get(`${enrollment.studentId}:${row._id}`),
        })),
    };
  });
  const courses = courseIds.map((courseId) => {
    const enrolled = rows.filter((row) => row.courseId.equals(courseId));
    const completedUnits = enrolled.reduce(
        (sum, row) => sum + row.completedUnits,
        0,
      ),
      totalUnits = enrolled.reduce((sum, row) => sum + row.totalUnits, 0);
    return {
      courseId,
      enrollments: enrolled.length,
      completedUnits,
      totalUnits,
      progressPercent: totalUnits
        ? Math.round((completedUnits / totalUnits) * 100)
        : null,
    };
  });
  const totalUnits = courses.reduce((sum, row) => sum + row.totalUnits, 0),
    completedUnits = courses.reduce((sum, row) => sum + row.completedUnits, 0);
  return {
    rows,
    courses,
    materials,
    assignments,
    quizzes,
    completionSet,
    submissionSet,
    best,
    summary: {
      enrollments: rows.length,
      totalUnits,
      completedUnits,
      progressPercent: totalUnits
        ? Math.round((completedUnits / totalUnits) * 100)
        : null,
    },
  };
}
export function learningRoutes(db) {
  const router = Router();
  router.get("/courses/:courseId/progress", async (req, res) => {
    const { course } = await requireCourse(
      db,
      req.user,
      req.params.courseId,
      req.user.role === "instructor",
    );
    const teacher = req.user.role === "instructor",
      data = await learningSnapshot(
        db,
        [course._id],
        teacher ? undefined : [req.user._id],
      );
    if (teacher) {
      const students = await db
        .collection("lms_users")
        .find(
          { _id: { $in: data.rows.map((row) => row.studentId) } },
          { projection: { name: 1, email: 1, status: 1 } },
        )
        .toArray();
      res.json({
        summary: data.summary,
        items: data.rows.map((row) => ({
          ...row,
          student: students.find((student) =>
            student._id.equals(row.studentId),
          ),
        })),
      });
    } else {
      res.json({
        summary: data.rows[0],
        lectures: data.materials.map((row) => ({
          ...row,
          completed: data.completionSet.has(`${req.user._id}:${row._id}`),
        })),
        assignments: data.assignments.map((row) => ({
          ...row,
          completed: data.submissionSet.has(`${req.user._id}:${row._id}`),
        })),
        quizzes: data.quizzes
          .filter((row) => row.published)
          .map((row) => ({
            ...row,
            completed: data.best.has(`${req.user._id}:${row._id}`),
            bestScore:
              data.best.get(`${req.user._id}:${row._id}`)?.score ?? null,
          })),
      });
    }
  });
  router.put(
    "/materials/:materialId/completion",
    role("student"),
    async (req, res) => {
      const values = validate(
        z.object({ completed: z.boolean() }).strict(),
        req.body,
      );
      const material = await db
        .collection("lms_materials")
        .findOne({ _id: id(req.params.materialId) });
      if (!material) fail(404, "Lecture not found.");
      await requireCourse(db, req.user, material.courseId);
      const filter = { materialId: material._id, studentId: req.user._id };
      if (values.completed)
        await db.collection("lms_lecture_completion").updateOne(
          filter,
          {
            $setOnInsert: {
              ...filter,
              courseId: material.courseId,
              completedAt: new Date(),
            },
          },
          { upsert: true },
        );
      else await db.collection("lms_lecture_completion").deleteOne(filter);
      await audit(
        db,
        req.user,
        "lecture.completion",
        material,
        values.completed
          ? "Student marked a lecture completed."
          : "Student marked a lecture incomplete.",
      );
      res.json({ completed: values.completed });
    },
  );
  return router;
}
