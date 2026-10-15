import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { fail, id, role } from "./security.js";
import { requireCourse } from "./courses.js";
import { validate } from "./validation.js";
import { effectiveDeadline, studentAssignments } from "./deadlines.js";
import { audit } from "./audit.js";

const requestSchema = z
  .object({
    reason: z.string().trim().min(10).max(2000),
    requestedDueDate: z.string().datetime({ offset: true }),
  })
  .strict();
const decisionSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    scope: z.enum(["student", "class"]).default("student"),
    comment: z.string().trim().max(2000).default(""),
  })
  .strict();
const listing = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    status: z.enum(["all", "pending", "approved", "rejected"]).default("all"),
  })
  .strict();
const laterDate = (date, current) => {
  if (date <= new Date() || date <= current)
    fail(
      400,
      "The requested deadline must be in the future and later than the current deadline.",
    );
  if (date > new Date(Date.now() + 365 * 86400000))
    fail(400, "Choose a deadline within the next 365 days.");
};
export function extensionRoutes(db) {
  const router = Router(),
    assignments = db.collection("lms_assignments"),
    requests = db.collection("lms_extension_requests"),
    deadlines = db.collection("lms_assignment_deadlines");
  async function access(req, assignmentId) {
    const assignment = await assignments.findOne({ _id: id(assignmentId) });
    if (!assignment) fail(404, "Assignment not found.");
    await requireCourse(
      db,
      req.user,
      assignment.courseId,
      req.user.role === "instructor",
    );
    return assignment;
  }
  async function liveAssignment(assignmentId, session) {
    const assignment = await assignments.findOne(
      { _id: assignmentId },
      { session },
    );
    if (
      !assignment ||
      !(await db
        .collection("lms_courses")
        .findOne(
          { _id: assignment.courseId, deletedAt: { $exists: false } },
          { session },
        ))
    )
      fail(404, "Assignment or active course not found.");
    return assignment;
  }
  router.get("/assignments/:assignmentId/extensions", async (req, res) => {
    const assignment = await access(req, req.params.assignmentId),
      query = validate(listing, req.query),
      teacher = req.user.role === "instructor";
    const ownFilter = {
      assignmentId: assignment._id,
      ...(!teacher ? { studentId: req.user._id } : {}),
    };
    const filter = {
      ...ownFilter,
      ...(query.status !== "all" ? { status: query.status } : {}),
    };
    const [total, rows, pending, submission] = await Promise.all([
      requests.countDocuments(filter),
      requests
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * 12)
        .limit(12)
        .toArray(),
      requests.countDocuments({ ...ownFilter, status: "pending" }),
      teacher
        ? null
        : db
            .collection("lms_submissions")
            .findOne({ assignmentId: assignment._id, studentId: req.user._id }),
    ]);
    const people = teacher
      ? await db
          .collection("lms_users")
          .find(
            { _id: { $in: rows.map((row) => row.studentId) } },
            { projection: { name: 1, email: 1 } },
          )
          .toArray()
      : [];
    const overrides = teacher
      ? await deadlines
          .find({
            assignmentId: assignment._id,
            studentId: { $in: rows.map((row) => row.studentId) },
          })
          .toArray()
      : [];
    const mine = teacher
      ? assignment
      : (await studentAssignments(db, [assignment], req.user._id))[0];
    res.json({
      assignment: mine,
      canRequest: !teacher && !pending && submission?.grade == null,
      pending,
      items: rows.map((row) => ({
        ...row,
        ...(teacher
          ? {
              student: people.find((person) =>
                person._id.equals(row.studentId),
              ),
              currentDueDate: effectiveDeadline(
                assignment,
                overrides.find((item) => item.studentId.equals(row.studentId)),
              ),
            }
          : {}),
      })),
      total,
      page: query.page,
      pages: Math.ceil(total / 12),
    });
  });
  router.post(
    "/assignments/:assignmentId/extensions",
    role("student"),
    async (req, res) => {
      const original = await access(req, req.params.assignmentId),
        values = validate(requestSchema, req.body),
        session = db.client.startSession();
      let record;
      try {
        await session.withTransaction(async () => {
          const assignment = await liveAssignment(original._id, session);
          if (
            !(await db
              .collection("lms_enrollments")
              .findOne(
                { courseId: assignment.courseId, studentId: req.user._id },
                { session },
              ))
          )
            fail(403, "Join this course before requesting an extension.");
          const mine = (
              await studentAssignments(db, [assignment], req.user._id, {
                session,
              })
            )[0],
            requestedDueDate = new Date(values.requestedDueDate);
          laterDate(requestedDueDate, mine.dueDate);
          if (
            await requests.findOne(
              {
                assignmentId: assignment._id,
                studentId: req.user._id,
                status: "pending",
              },
              { session },
            )
          )
            fail(
              409,
              "You already have a pending extension request for this assignment.",
            );
          const submission = await db
            .collection("lms_submissions")
            .findOne(
              { assignmentId: assignment._id, studentId: req.user._id },
              { session },
            );
          if (submission?.grade != null)
            fail(409, "Graded work cannot be reopened with an extension.");
          await assignments.updateOne(
            { _id: assignment._id },
            { $inc: { deadlineRevision: 1 } },
            { session },
          );
          record = {
            _id: new ObjectId(),
            assignmentId: assignment._id,
            courseId: assignment.courseId,
            studentId: req.user._id,
            reason: values.reason,
            requestedDueDate,
            originalDueDate: assignment.dueDate,
            previousDueDate: mine.dueDate,
            status: "pending",
            createdAt: new Date(),
          };
          await requests.insertOne(record, { session });
          await audit(
            db,
            req.user,
            "extension.requested",
            assignment,
            "Student requested a deadline extension.",
            { session },
          );
        });
      } finally {
        await session.endSession();
      }
      res.status(201).json(record);
    },
  );
  router.patch(
    "/extensions/:requestId",
    role("instructor"),
    async (req, res) => {
      const original = await requests.findOne({
        _id: id(req.params.requestId),
      });
      if (!original) fail(404, "Extension request not found.");
      await access(req, String(original.assignmentId));
      const values = validate(decisionSchema, req.body),
        session = db.client.startSession();
      try {
        await session.withTransaction(async () => {
          const row = await requests.findOne(
            { _id: original._id, status: "pending" },
            { session },
          );
          if (!row)
            fail(409, "This request was already reviewed. Refresh the list.");
          const assignment = await liveAssignment(row.assignmentId, session);
          const course = await db
            .collection("lms_courses")
            .findOne(
              { _id: assignment.courseId, instructorId: req.user._id },
              { session },
            );
          if (!course)
            fail(403, "Only the course instructor can review this request.");
          if (values.status === "approved") {
            const mine = (
              await studentAssignments(db, [assignment], row.studentId, {
                session,
              })
            )[0];
            laterDate(
              row.requestedDueDate,
              values.scope === "class" ? assignment.dueDate : mine.dueDate,
            );
            const submission = await db
              .collection("lms_submissions")
              .findOne(
                { assignmentId: assignment._id, studentId: row.studentId },
                { session },
              );
            if (submission?.grade != null)
              fail(
                409,
                "This student’s work has already been graded. Reject the request or manage the class deadline separately.",
              );
            if (values.scope === "student")
              await deadlines.updateOne(
                { assignmentId: assignment._id, studentId: row.studentId },
                {
                  $max: { dueDate: row.requestedDueDate },
                  $set: {
                    courseId: assignment.courseId,
                    updatedAt: new Date(),
                  },
                },
                { upsert: true, session },
              );
          }
          await assignments.updateOne(
            { _id: assignment._id },
            {
              $inc: { deadlineRevision: 1 },
              ...(values.status === "approved" && values.scope === "class"
                ? {
                    $set: {
                      dueDate: row.requestedDueDate,
                      updatedAt: new Date(),
                    },
                  }
                : {}),
            },
            { session },
          );
          await requests.updateOne(
            { _id: row._id, status: "pending" },
            {
              $set: {
                status: values.status,
                ...(values.status === "approved"
                  ? { scope: values.scope }
                  : {}),
                comment: values.comment,
                reviewedAt: new Date(),
                reviewedBy: req.user._id,
              },
            },
            { session },
          );
          await audit(
            db,
            req.user,
            `extension.${values.status}`,
            assignment,
            values.status === "approved"
              ? `Approved deadline extension for ${values.scope === "class" ? "the whole class" : "one student"}.`
              : "Rejected an extension request; deadlines unchanged.",
            { session },
          );
        });
      } finally {
        await session.endSession();
      }
      res.json({
        message:
          values.status === "approved"
            ? `Extension approved for ${values.scope === "class" ? "the whole class" : "this student only"}.`
            : "Extension rejected. Deadlines were not changed.",
      });
    },
  );
  return router;
}
