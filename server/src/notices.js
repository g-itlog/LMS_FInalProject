import { Router } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { fail, role } from "./security.js";
import { visibleCourseIds } from "./courses.js";
import { validate } from "./validation.js";
import { studentAssignments } from "./deadlines.js";

const keyFor = (type, row, version = "") =>
  createHash("sha256").update(`${type}:${row._id}:${version}`).digest("hex");
export async function notificationItems(db, user) {
  const now = new Date(),
    items = [];
  const add = (
    type,
    row,
    title,
    body,
    courseId,
    tab,
    date,
    version = "",
    extra = {},
  ) =>
    items.push({
      _id: keyFor(type, row, version),
      type,
      title,
      body,
      courseId,
      tab,
      createdAt: date || now,
      ...extra,
    });
  const school = await db
    .collection("lms_school_announcements")
    .find({ audience: { $in: ["all", user.role] } })
    .toArray();
  for (const row of school)
    add(
      "school-announcement",
      row,
      row.title,
      row.body,
      null,
      null,
      row.updatedAt || row.createdAt,
      new Date(row.updatedAt || row.createdAt).toISOString(),
    );
  const courseIds = await visibleCourseIds(db, user);
  const extensionRows = await db
    .collection("lms_extension_requests")
    .find({
      courseId: { $in: courseIds },
      ...(user.role === "instructor"
        ? { status: "pending" }
        : {
            $or: [
              { studentId: user._id },
              { status: "approved", scope: "class" },
            ],
          }),
    })
    .toArray();
  const extensionAssignments = await db
    .collection("lms_assignments")
    .find(
      { _id: { $in: extensionRows.map((row) => row.assignmentId) } },
      { projection: { title: 1, dueDate: 1 } },
    )
    .toArray();
  const people =
    user.role === "instructor"
      ? await db
          .collection("lms_users")
          .find(
            { _id: { $in: extensionRows.map((row) => row.studentId) } },
            { projection: { name: 1 } },
          )
          .toArray()
      : [];
  for (const row of extensionRows) {
    const assignment = extensionAssignments.find((item) =>
      item._id.equals(row.assignmentId),
    );
    if (!assignment) continue;
    const extra = { extensionAssignmentId: row.assignmentId };
    if (user.role === "instructor") {
      const student = people.find((person) => person._id.equals(row.studentId));
      add(
        "extension-request",
        row,
        "Deadline extension requested",
        `${student?.name || "A student"} requested more time for ${assignment.title}.\nReason: ${row.reason}\nOriginal deadline: ${row.originalDueDate.toISOString()}\nRequested deadline: ${row.requestedDueDate.toISOString()}`,
        row.courseId,
        "assignments",
        row.createdAt,
        "",
        extra,
      );
    } else if (row.studentId.equals(user._id)) {
      add(
        "extension-status",
        row,
        `Extension request ${row.status}`,
        `${assignment.title}\n${row.status === "approved" ? `Approved for ${row.scope === "class" ? "the whole class" : "you only"}: ${row.requestedDueDate.toISOString()}` : row.status === "rejected" ? "The request was rejected. This decision did not change your deadline." : "Your instructor has not reviewed this request. Your deadline is unchanged."}${row.comment ? `\nInstructor comment: ${row.comment}` : ""}`,
        row.courseId,
        "assignments",
        row.reviewedAt || row.createdAt,
        row.status,
        extra,
      );
    } else {
      add(
        "class-extension",
        row,
        "Class assignment deadline extended",
        `${assignment.title}\nClass extension approved: ${row.requestedDueDate.toISOString()}\nOpen the assignment to see your current deadline.`,
        row.courseId,
        "assignments",
        row.reviewedAt,
        "",
        {},
      );
    }
  }
  if (user.role === "student") {
    const ids = courseIds,
      filter = { courseId: { $in: ids } };
    const [
      materials,
      announcements,
      assignments,
      submitted,
      quizzes,
      attempts,
    ] = await Promise.all([
      db
        .collection("lms_materials")
        .find(filter, {
          projection: { title: 1, courseId: 1, createdAt: 1, updatedAt: 1 },
        })
        .toArray(),
      db.collection("lms_announcements").find(filter).toArray(),
      db
        .collection("lms_assignments")
        .find({
          ...filter,
          dueDate: { $lte: new Date(now.getTime() + 7 * 86400000) },
        })
        .toArray(),
      db
        .collection("lms_submissions")
        .find(
          { ...filter, studentId: user._id },
          { projection: { assignmentId: 1 } },
        )
        .toArray(),
      db
        .collection("lms_quizzes")
        .find(
          { ...filter, published: true, archivedAt: { $exists: false } },
          {
            projection: {
              title: 1,
              courseId: 1,
              closesAt: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        )
        .toArray(),
      db
        .collection("lms_quiz_attempts")
        .find({ ...filter, studentId: user._id }, { projection: { quizId: 1 } })
        .toArray(),
    ]);
    for (const row of materials)
      add(
        "material",
        row,
        "New learning material",
        row.title,
        row.courseId,
        "materials",
        row.createdAt,
      );
    for (const row of announcements)
      add(
        "course-announcement",
        row,
        row.title,
        row.body,
        row.courseId,
        "announcements",
        row.updatedAt || row.createdAt,
        new Date(row.updatedAt || row.createdAt).toISOString(),
      );
    const done = new Set(submitted.map((row) => String(row.assignmentId)));
    for (const row of await studentAssignments(db, assignments, user._id))
      if (
        !done.has(String(row._id)) &&
        row.dueDate <= new Date(now.getTime() + 7 * 86400000)
      ) {
        const overdue = row.dueDate < now;
        add(
          overdue ? "assignment-overdue" : "assignment-due",
          row,
          overdue ? "Assignment overdue" : "Assignment deadline approaching",
          `${row.title} · Due ${row.dueDate.toISOString()}`,
          row.courseId,
          "assignments",
          row.dueDate,
          row.dueDate.toISOString(),
        );
      }
    for (const row of quizzes) {
      if (row.closesAt && row.closesAt <= now) continue;
      add(
        "quiz",
        row,
        "Quiz available",
        row.title,
        row.courseId,
        "quizzes",
        row.createdAt,
      );
      if (
        row.closesAt &&
        row.closesAt >= now &&
        row.closesAt <= new Date(now.getTime() + 7 * 86400000) &&
        !attempts.some((attempt) => attempt.quizId.equals(row._id))
      )
        add(
          "quiz-due",
          row,
          "Quiz deadline approaching",
          `${row.title} · Closes ${row.closesAt.toISOString()}`,
          row.courseId,
          "quizzes",
          row.closesAt,
          row.closesAt.toISOString(),
        );
    }
  }
  const read = await db
    .collection("lms_notification_reads")
    .find({ userId: user._id }, { projection: { notificationId: 1 } })
    .toArray();
  const readIds = new Set(read.map((row) => row.notificationId));
  return items
    .map((item) => ({ ...item, read: readIds.has(item._id) }))
    .sort(
      (a, b) =>
        Number(a.read) - Number(b.read) ||
        Number(b.type === "assignment-overdue") -
          Number(a.type === "assignment-overdue") ||
        Number(/-due$/.test(b.type)) - Number(/-due$/.test(a.type)) ||
        (/-due$/.test(a.type) && /-due$/.test(b.type)
          ? new Date(a.createdAt) - new Date(b.createdAt)
          : new Date(b.createdAt) - new Date(a.createdAt)) ||
        a._id.localeCompare(b._id),
    );
}
export function noticeRoutes(db) {
  const router = Router();
  router.use("/notifications", (req, res, next) =>
    req.user.role === "admin"
      ? res
          .status(403)
          .json({ message: "Use school announcements in the admin workspace." })
      : next(),
  );
  router.get("/notifications", async (req, res) => {
    const query = validate(
      z
        .object({ page: z.coerce.number().int().min(1).max(100000).default(1) })
        .strict(),
      req.query,
    );
    const rows = await notificationItems(db, req.user),
      limit = 20;
    res.json({
      items: rows.slice((query.page - 1) * limit, query.page * limit),
      total: rows.length,
      unread: rows.filter((row) => !row.read).length,
      page: query.page,
      pages: Math.ceil(rows.length / limit),
    });
  });
  router.patch("/notifications/:notificationId/read", async (req, res) => {
    const rows = await notificationItems(db, req.user),
      item = rows.find((row) => row._id === req.params.notificationId);
    if (!item) fail(404, "Notification not found.");
    await db
      .collection("lms_notification_reads")
      .updateOne(
        { userId: req.user._id, notificationId: item._id },
        { $set: { readAt: new Date() } },
        { upsert: true },
      );
    res.json({ message: "Notification marked as read." });
  });
  router.post("/notifications/read-all", async (req, res) => {
    const rows = await notificationItems(db, req.user);
    if (rows.length)
      await db.collection("lms_notification_reads").bulkWrite(
        rows.map((row) => ({
          updateOne: {
            filter: { userId: req.user._id, notificationId: row._id },
            update: { $set: { readAt: new Date() } },
            upsert: true,
          },
        })),
      );
    res.json({ message: "All current notifications marked as read." });
  });
  router.get("/school-announcements", async (req, res) => {
    res.json({
      items: await db
        .collection("lms_school_announcements")
        .find({ audience: { $in: ["all", req.user.role] } })
        .sort({ createdAt: -1 })
        .toArray(),
    });
  });
  return router;
}
