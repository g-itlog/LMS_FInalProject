import { Router } from "express";
import { z } from "zod";
import { fail, id, role } from "./security.js";
import { schemas, validate } from "./validation.js";
import { audit } from "./audit.js";
import { learningSnapshot } from "./learning.js";

const listing = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    search: z.string().trim().max(100).default(""),
  })
  .strict();
const announcement = z
  .object({
    title: z.string().trim().min(3).max(160),
    body: z.string().trim().min(5).max(6000),
    audience: z.enum(["all", "student", "instructor"]).default("all"),
  })
  .strict();
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function adminExtensionRoutes(db) {
  const router = Router();
  router.use("/admin", role("admin"));
  router.get("/admin/enrollments", async (req, res) => {
    const query = validate(
      listing.extend({
        status: z.enum(["active", "archived", "all"]).default("active"),
      }),
      req.query,
    );
    const pipeline = [
      {
        $lookup: {
          from: "lms_users",
          localField: "studentId",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1, email: 1, status: 1 } }],
          as: "student",
        },
      },
      { $unwind: "$student" },
      {
        $lookup: {
          from: "lms_courses",
          localField: "courseId",
          foreignField: "_id",
          pipeline: [
            { $project: { title: 1, code: 1, deletedAt: 1, published: 1 } },
          ],
          as: "course",
        },
      },
      { $unwind: "$course" },
    ];
    if (query.status !== "all")
      pipeline.push({
        $match: {
          "course.deletedAt": { $exists: query.status === "archived" },
        },
      });
    if (query.search)
      pipeline.push({
        $match: {
          $or: [
            "student.name",
            "student.email",
            "course.code",
            "course.title",
          ].map((field) => ({
            [field]: { $regex: escape(query.search), $options: "i" },
          })),
        },
      });
    const [data] = await db
      .collection("lms_enrollments")
      .aggregate([
        ...pipeline,
        {
          $facet: {
            total: [{ $count: "count" }],
            items: [
              { $sort: { createdAt: -1, _id: -1 } },
              { $skip: (query.page - 1) * 12 },
              { $limit: 12 },
            ],
          },
        },
      ])
      .toArray();
    const total = data.total[0]?.count || 0,
      ids = [
        ...new Map(
          data.items.map((row) => [String(row.courseId), row.courseId]),
        ).values(),
      ];
    const progress = await learningSnapshot(db, ids);
    res.json({
      items: data.items.map((row) => ({
        ...row,
        progress: progress.rows.find((item) =>
          item.enrollmentId.equals(row._id),
        ),
      })),
      total,
      page: query.page,
      pages: Math.ceil(total / 12),
    });
  });
  router.patch("/admin/courses/:courseId", async (req, res) => {
    const values = validate(schemas.course.strict(), req.body);
    const course = await db
      .collection("lms_courses")
      .findOne({ _id: id(req.params.courseId), deletedAt: { $exists: false } });
    if (!course) fail(404, "Active course not found.");
    await db
      .collection("lms_courses")
      .updateOne(
        { _id: course._id },
        { $set: { ...values, updatedAt: new Date() } },
      );
    await audit(
      db,
      req.user,
      "course.admin-updated",
      course,
      "Administrator updated course metadata; instructor ownership and learning records were retained.",
    );
    res.json({ ...course, ...values });
  });
  router.delete("/admin/courses/:courseId", async (req, res) => {
    const course = await db
      .collection("lms_courses")
      .findOne({ _id: id(req.params.courseId), deletedAt: { $exists: false } });
    if (!course) fail(404, "Active course not found.");
    await db.collection("lms_courses").updateOne(
      { _id: course._id },
      {
        $set: {
          deletedAt: new Date(),
          published: false,
          updatedAt: new Date(),
        },
      },
    );
    await audit(
      db,
      req.user,
      "course.archived",
      course,
      "Administrator archived the course; enrollments and assessment history were retained.",
    );
    res.json({ message: "Course archived. Learning history was retained." });
  });
  router.post("/admin/courses/:courseId/restore", async (req, res) => {
    const course = await db
      .collection("lms_courses")
      .findOne({ _id: id(req.params.courseId), deletedAt: { $exists: true } });
    if (!course) fail(404, "Archived course not found.");
    await db.collection("lms_courses").updateOne(
      { _id: course._id },
      {
        $unset: { deletedAt: "" },
        $set: { published: false, updatedAt: new Date() },
      },
    );
    await audit(
      db,
      req.user,
      "course.restored",
      course,
      "Restored an archived course as unpublished. Existing enrollments and history were retained.",
    );
    res.json({ message: "Course restored as unpublished." });
  });
  const posts = db.collection("lms_school_announcements");
  router.get("/admin/announcements", async (req, res) => {
    const query = validate(listing, req.query),
      filter = query.search
        ? {
            $or: ["title", "body"].map((field) => ({
              [field]: { $regex: escape(query.search), $options: "i" },
            })),
          }
        : {};
    const [total, items] = await Promise.all([
      posts.countDocuments(filter),
      posts
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * 12)
        .limit(12)
        .toArray(),
    ]);
    res.json({ items, total, page: query.page, pages: Math.ceil(total / 12) });
  });
  router.post("/admin/announcements", async (req, res) => {
    const values = validate(announcement, req.body),
      now = new Date(),
      post = {
        ...values,
        authorId: req.user._id,
        createdAt: now,
        updatedAt: now,
      };
    const result = await posts.insertOne(post);
    post._id = result.insertedId;
    await audit(
      db,
      req.user,
      "school-announcement.created",
      post,
      `Posted a school update for ${values.audience}.`,
    );
    res.status(201).json(post);
  });
  router.patch("/admin/announcements/:postId", async (req, res) => {
    const values = validate(announcement, req.body),
      post = await posts.findOne({ _id: id(req.params.postId) });
    if (!post) fail(404, "Announcement not found.");
    await posts.updateOne(
      { _id: post._id },
      { $set: { ...values, updatedAt: new Date() } },
    );
    await audit(
      db,
      req.user,
      "school-announcement.updated",
      post,
      "Updated a school announcement and audience.",
    );
    res.json({ message: "School announcement updated." });
  });
  router.delete("/admin/announcements/:postId", async (req, res) => {
    const post = await posts.findOne({ _id: id(req.params.postId) });
    if (!post) fail(404, "Announcement not found.");
    await posts.deleteOne({ _id: post._id });
    await audit(
      db,
      req.user,
      "school-announcement.deleted",
      post,
      "Deleted a school announcement.",
    );
    res.json({ message: "School announcement deleted." });
  });
  return router;
}
