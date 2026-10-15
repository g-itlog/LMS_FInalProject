import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { fail, id, role } from "./security.js";
import { requireCourse, visibleCourseIds } from "./courses.js";
import { validate } from "./validation.js";
import { audit } from "./audit.js";

const question = z
  .object({
    prompt: z.string().trim().min(3).max(2000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
    correctIndex: z.number().int().min(0).max(5),
    points: z.number().int().min(1).max(100).default(1),
    explanation: z.string().trim().max(2000).default(""),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.correctIndex >= value.options.length)
      ctx.addIssue({
        code: "custom",
        message: "Select an existing answer option.",
      });
    if (
      new Set(value.options.map((option) => option.toLowerCase())).size !==
      value.options.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Answer options must be distinct.",
      });
  });
const quizSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    instructions: z.string().trim().max(6000).default(""),
    published: z.boolean().default(false),
    closesAt: z.string().datetime({ offset: true }).nullable().default(null),
    maxAttempts: z.number().int().min(1).max(10).default(1),
    reviewPolicy: z
      .enum(["immediate", "after-close", "never"])
      .default("immediate"),
    questions: z.array(question).min(1).max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.reviewPolicy === "after-close" && !value.closesAt)
      ctx.addIssue({
        code: "custom",
        message: "After-close review requires a closing date.",
      });
  });
const submissionSchema = z
  .object({
    revision: z.number().int().min(1),
    answers: z.array(z.number().int().min(0).max(5)).min(1).max(100),
  })
  .strict();
const current = { archivedAt: { $exists: false } };
const studentQuiz = (quiz) => {
  const { questions, attemptSerial, ...safe } = quiz;
  return {
    ...safe,
    questions: questions.map(({ correctIndex, explanation, ...item }) => item),
  };
};
const reviewAllowed = (quiz) =>
  quiz.reviewPolicy === "immediate" ||
  (quiz.reviewPolicy === "after-close" &&
    quiz.closesAt &&
    new Date() >= quiz.closesAt);
function attemptView(attempt, quiz, teacher = false) {
  const { questions, answers, ...safe } = attempt;
  const permitted = teacher || reviewAllowed(quiz);
  return {
    ...safe,
    reviewAllowed: permitted,
    ...(permitted
      ? {
          review: questions.map((item, index) => ({
            ...item,
            chosenIndex: answers[index],
            earned: answers[index] === item.correctIndex ? item.points : 0,
          })),
        }
      : {}),
  };
}
export function quizRoutes(db) {
  const router = Router(),
    quizzes = db.collection("lms_quizzes"),
    attempts = db.collection("lms_quiz_attempts");
  async function access(req) {
    const quiz = await quizzes.findOne({ _id: id(req.params.quizId) });
    if (!quiz) fail(404, "Quiz not found.");
    await requireCourse(
      db,
      req.user,
      quiz.courseId,
      req.user.role === "instructor",
    );
    if (
      req.user.role === "student" &&
      (!quiz.published || quiz.archivedAt) &&
      !(await attempts.findOne({ quizId: quiz._id, studentId: req.user._id }))
    )
      fail(403, "This quiz is not available.");
    return quiz;
  }
  async function list(req, res, courseId) {
    const ids = courseId
      ? [
          (
            await requireCourse(
              db,
              req.user,
              courseId,
              req.user.role === "instructor",
            )
          ).course._id,
        ]
      : await visibleCourseIds(db, req.user);
    const rows = await quizzes
      .find({ courseId: { $in: ids } })
      .sort({ createdAt: -1 })
      .toArray();
    const mine =
      req.user.role === "student"
        ? await attempts
            .find(
              { courseId: { $in: ids }, studentId: req.user._id },
              {
                projection: {
                  quizId: 1,
                  score: 1,
                  maxScore: 1,
                  attemptNumber: 1,
                  submittedAt: 1,
                },
              },
            )
            .toArray()
        : [];
    const courseRows = await db
      .collection("lms_courses")
      .find({ _id: { $in: ids } }, { projection: { title: 1, code: 1 } })
      .toArray();
    const items = rows
      .filter(
        (quiz) =>
          req.user.role === "instructor" ||
          (quiz.published && !quiz.archivedAt) ||
          mine.some((attempt) => attempt.quizId.equals(quiz._id)),
      )
      .map((quiz) => {
        const own = mine.filter((attempt) => attempt.quizId.equals(quiz._id));
        const { questions, attemptSerial, ...safe } = quiz;
        return {
          ...safe,
          questionCount: questions.length,
          course: courseRows.find((course) => course._id.equals(quiz.courseId)),
          attemptCount: own.length,
          bestScore: own.length
            ? Math.max(...own.map((attempt) => attempt.score))
            : null,
        };
      });
    res.json({ items });
  }
  router.get("/quizzes", async (req, res) => list(req, res));
  router.get("/courses/:courseId/quizzes", async (req, res) =>
    list(req, res, req.params.courseId),
  );
  router.post(
    "/courses/:courseId/quizzes",
    role("instructor"),
    async (req, res) => {
      const { course } = await requireCourse(
        db,
        req.user,
        req.params.courseId,
        true,
      );
      const values = validate(quizSchema, req.body),
        now = new Date();
      const quiz = {
        ...values,
        closesAt: values.closesAt ? new Date(values.closesAt) : null,
        courseId: course._id,
        authorId: req.user._id,
        revision: 1,
        attemptSerial: 0,
        maxScore: values.questions.reduce((sum, item) => sum + item.points, 0),
        createdAt: now,
        updatedAt: now,
      };
      const result = await quizzes.insertOne(quiz);
      quiz._id = result.insertedId;
      await audit(db, req.user, "quiz.created", quiz, "Created a course quiz.");
      res.status(201).json(quiz);
    },
  );
  router.get("/quizzes/:quizId", async (req, res) => {
    const quiz = await access(req);
    const count = await attempts.countDocuments({
      quizId: quiz._id,
      studentId: req.user._id,
    });
    res.json({
      ...(req.user.role === "instructor" ? quiz : studentQuiz(quiz)),
      ...(req.user.role === "instructor"
        ? {
            questionsLocked: !!(await attempts.findOne(
              { quizId: quiz._id },
              { projection: { _id: 1 } },
            )),
          }
        : {}),
      attemptCount: count,
      canAttempt:
        req.user.role === "student" &&
        quiz.published &&
        !quiz.archivedAt &&
        (!quiz.closesAt || new Date() < quiz.closesAt) &&
        count < quiz.maxAttempts,
    });
  });
  router.patch("/quizzes/:quizId", role("instructor"), async (req, res) => {
    const quiz = await access(req),
      values = validate(quizSchema, req.body);
    if (quiz.archivedAt) fail(409, "Archived quizzes cannot be edited.");
    const session = db.client.startSession();
    try {
      await session.withTransaction(async () => {
        const latest = await quizzes.findOne({ _id: quiz._id }, { session });
        if (latest.archivedAt)
          fail(409, "This quiz was archived. Refresh the page.");
        const used = await attempts.findOne({ quizId: quiz._id }, { session });
        if (
          used &&
          JSON.stringify(values.questions) !== JSON.stringify(latest.questions)
        )
          fail(
            409,
            "Questions and points are locked after the first attempt. Create a new quiz to change them.",
          );
        const highest = await attempts
          .find({ quizId: quiz._id }, { session })
          .sort({ attemptNumber: -1 })
          .limit(1)
          .next();
        if (highest && values.maxAttempts < highest.attemptNumber)
          fail(
            409,
            "The attempt limit cannot be lower than an existing attempt number.",
          );
        const changed = await quizzes.updateOne(
          { _id: quiz._id, revision: latest.revision },
          {
            $set: {
              ...values,
              closesAt: values.closesAt ? new Date(values.closesAt) : null,
              maxScore: values.questions.reduce(
                (sum, item) => sum + item.points,
                0,
              ),
              updatedAt: new Date(),
            },
            $inc: { revision: 1 },
          },
          { session },
        );
        if (!changed.matchedCount)
          fail(409, "The quiz changed. Refresh and try again.");
      });
    } finally {
      await session.endSession();
    }
    await audit(
      db,
      req.user,
      "quiz.updated",
      quiz,
      "Updated quiz settings or unused questions.",
    );
    res.json(await quizzes.findOne({ _id: quiz._id }));
  });
  router.delete("/quizzes/:quizId", role("instructor"), async (req, res) => {
    const quiz = await access(req);
    await quizzes.updateOne(
      { _id: quiz._id },
      {
        $set: { archivedAt: new Date(), published: false },
        $inc: { revision: 1 },
      },
    );
    await audit(
      db,
      req.user,
      "quiz.archived",
      quiz,
      "Archived quiz; existing attempts were retained.",
    );
    res.json({ message: "Quiz archived. Existing attempts are retained." });
  });
  router.post(
    "/quizzes/:quizId/attempts",
    role("student"),
    async (req, res) => {
      const quiz = await access(req),
        values = validate(submissionSchema, req.body);
      const session = db.client.startSession();
      let saved;
      try {
        await session.withTransaction(async () => {
          const latest = await quizzes.findOne(
            { _id: quiz._id, ...current },
            { session },
          );
          if (!latest || !latest.published)
            fail(403, "This quiz is not accepting attempts.");
          if (latest.closesAt && new Date() >= latest.closesAt)
            fail(400, "The quiz deadline has passed.");
          if (latest.revision !== values.revision)
            fail(409, "The quiz changed. Reload it before submitting.");
          if (
            values.answers.length !== latest.questions.length ||
            values.answers.some(
              (answer, index) =>
                answer >= latest.questions[index].options.length,
            )
          )
            fail(400, "Answer every question with a valid option.");
          const count = await attempts.countDocuments(
            { quizId: quiz._id, studentId: req.user._id },
            { session },
          );
          if (count >= latest.maxAttempts)
            fail(409, "You have used all permitted attempts.");
          await quizzes.updateOne(
            { _id: quiz._id },
            { $inc: { attemptSerial: 1 } },
            { session },
          );
          saved = {
            _id: new ObjectId(),
            quizId: quiz._id,
            courseId: quiz.courseId,
            studentId: req.user._id,
            attemptNumber: count + 1,
            answers: values.answers,
            questions: latest.questions,
            score: latest.questions.reduce(
              (sum, item, index) =>
                sum +
                (values.answers[index] === item.correctIndex ? item.points : 0),
              0,
            ),
            maxScore: latest.maxScore,
            revision: latest.revision,
            submittedAt: new Date(),
          };
          await attempts.insertOne(saved, { session });
        });
      } finally {
        await session.endSession();
      }
      await audit(
        db,
        req.user,
        "quiz.attempted",
        quiz,
        "Submitted a quiz attempt; grading was performed by the server.",
      );
      res
        .status(201)
        .json(attemptView(saved, await quizzes.findOne({ _id: quiz._id })));
    },
  );
  router.get("/quizzes/:quizId/attempts", async (req, res) => {
    const quiz = await access(req),
      teacher = req.user.role === "instructor";
    const rows = await attempts
      .find({
        quizId: quiz._id,
        ...(!teacher ? { studentId: req.user._id } : {}),
      })
      .sort({ submittedAt: -1, _id: -1 })
      .toArray();
    const students = teacher
      ? await db
          .collection("lms_users")
          .find(
            { _id: { $in: rows.map((row) => row.studentId) } },
            { projection: { name: 1, email: 1 } },
          )
          .toArray()
      : [];
    res.json({
      items: rows.map((row) => ({
        ...attemptView(row, quiz, teacher),
        ...(teacher
          ? {
              student: students.find((student) =>
                student._id.equals(row.studentId),
              ),
            }
          : {}),
      })),
    });
  });
  return router;
}
