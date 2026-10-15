import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, id, publicUser, role } from "./security.js";
import { schemas, validate } from "./validation.js";
import { buildReport, reportCsv, reportPeriod } from "./analytics.js";
import {
  generateInvitationCode,
  invitationCreate,
  invitationEdit,
  invitationFields,
  publicInvitation,
} from "./invitations.js";

const activeCourses = { deletedAt: { $exists: false } };
const userProjection = {
  name: 1,
  email: 1,
  role: 1,
  status: 1,
  bio: 1,
  department: 1,
  createdAt: 1,
  updatedAt: 1,
  lastLoginAt: 1,
};
const editUser = z
  .object({
    name: schemas.register.shape.name.optional(),
    email: schemas.register.shape.email.optional(),
    department: z.string().trim().max(100).optional(),
    role: z.enum(["student", "instructor"]).optional(),
    status: z.enum(["active", "suspended"]).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Provide a field to update.");
const createUser = schemas.register
  .omit({ inviteCode: true })
  .extend({ department: z.string().trim().max(100).default("") })
  .strict();
const listing = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    search: z.string().trim().max(100).default(""),
    role: z.enum(["all", "student", "instructor", "admin"]).default("all"),
    status: z
      .enum(["all", "active", "suspended", "published", "draft", "archived"])
      .default("all"),
  })
  .strict();
const safeSearch = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const account = (user) => ({
  ...publicUser(user),
  status: user.status || "active",
});
async function pageOf(collection, filter, page, projection) {
  const limit = 12;
  const [total, items] = await Promise.all([
    collection.countDocuments(filter),
    collection
      .find(filter, { projection })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
  ]);
  return { items, total, page, pages: Math.ceil(total / limit) };
}

export function adminRoutes(db, invitations) {
  const router = Router();
  router.use("/admin", role("admin"));
  const users = db.collection("lms_users");
  const courses = db.collection("lms_courses");
  const activity = db.collection("lms_admin_activity");
  router.get("/admin/reports", async (req, res) => {
    const { courseRows, ...report } = await buildReport(db, req.query);
    res.json(report);
  });
  router.get("/admin/reports/export", async (req, res) => {
    const period = reportPeriod(req.query);
    const report = await buildReport(db, {
      ...req.query,
      from: period.from,
      to: period.to,
    });
    const kind = period.kind || "courses";
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="knowhere-${kind}-${period.from}-${period.to}.csv"`,
    });
    res.send(reportCsv(report, kind));
  });
  async function record(actor, action, target, detail) {
    await activity.insertOne({
      actorId: actor._id,
      actorName: actor.name,
      action,
      targetId: target._id,
      targetName: target.name || target.title,
      detail,
      createdAt: new Date(),
    });
  }
  async function courseCounts(courseId) {
    const names = [
      "enrollments",
      "materials",
      "assignments",
      "announcements",
      "submissions",
    ];
    const counts = await Promise.all(
      names.map((name) =>
        db.collection(`lms_${name}`).countDocuments({ courseId }),
      ),
    );
    return Object.fromEntries(names.map((name, i) => [name, counts[i]]));
  }
  router.get("/admin/invitations", async (req, res) => {
    await invitations.ensure();
    const query = validate(
      z
        .object({
          page: listing.shape.page,
          search: listing.shape.search,
          status: z.enum(["all", "active", "inactive", "used"]).default("all"),
        })
        .strict(),
      req.query,
    );
    const filter = { useCount: query.status === "used" ? { $gt: 0 } : 0 };
    if (["active", "inactive"].includes(query.status))
      filter.active = query.status === "active";
    if (query.search)
      filter.$or = ["label", "code"].map((field) => ({
        [field]: { $regex: safeSearch(query.search), $options: "i" },
      }));
    const result = await pageOf(invitations.collection, filter, query.page);
    res.json({ ...result, items: result.items.map(publicInvitation) });
  });
  router.post("/admin/invitations", async (req, res) => {
    await invitations.ensure();
    const data = validate(invitationCreate, req.body);
    const row = {
      label: data.label,
      ...invitationFields(data.code || generateInvitationCode()),
      active: true,
      useCount: 0,
      createdBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await invitations.collection.insertOne(row);
    row._id = result.insertedId;
    await record(
      req.user,
      "invitation.created",
      { _id: row._id, name: row.label },
      "Created an active single-use instructor invitation code.",
    );
    res.status(201).json({ invitation: publicInvitation(row) });
  });
  router.patch("/admin/invitations/:invitationId", async (req, res) => {
    await invitations.ensure();
    const data = validate(invitationEdit, req.body);
    const row = await invitations.collection.findOne({
      _id: id(req.params.invitationId),
    });
    if (!row) fail(404, "Invitation code not found.");
    if ((row.useCount || 0) > 0)
      fail(
        409,
        "This invitation has already been used. Create a new invitation; used codes cannot be edited or reactivated.",
      );
    const changes = {
      ...data,
      ...(data.code ? invitationFields(data.code) : {}),
    };
    const updated = await invitations.collection.updateOne(
      { _id: row._id, useCount: 0 },
      { $set: { ...changes, updatedAt: new Date(), updatedBy: req.user._id } },
    );
    if (!updated.matchedCount)
      fail(
        409,
        "This invitation was used while you were editing it. Create a new invitation instead.",
      );
    const detail = Object.keys(data)
      .map((key) =>
        key === "active"
          ? data.active
            ? "Reactivated the code."
            : "Deactivated the code; new instructor registrations are blocked."
          : key === "code"
            ? "Replaced the code value; its previous value is no longer accepted."
            : "Updated the invitation label.",
      )
      .join(" ");
    await record(
      req.user,
      "invitation.updated",
      { _id: row._id, name: data.label || row.label },
      detail,
    );
    res.json({ invitation: publicInvitation({ ...row, ...changes }) });
  });
  async function enrichCourses(items) {
    return Promise.all(
      items.map(async (course) => {
        const [instructor, counts] = await Promise.all([
          users.findOne(
            { _id: course.instructorId },
            { projection: { name: 1, email: 1 } },
          ),
          courseCounts(course._id),
        ]);
        return {
          ...course,
          instructorName: instructor?.name || "Unavailable instructor",
          instructorEmail: instructor?.email,
          counts,
        };
      }),
    );
  }
  async function submissions(filter, limit = 6) {
    return db
      .collection("lms_submissions")
      .aggregate([
        { $match: filter },
        { $sort: { submittedAt: -1, _id: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: "lms_users",
            localField: "studentId",
            foreignField: "_id",
            pipeline: [{ $project: { name: 1 } }],
            as: "student",
          },
        },
        {
          $lookup: {
            from: "lms_assignments",
            localField: "assignmentId",
            foreignField: "_id",
            pipeline: [{ $project: { title: 1, maxPoints: 1 } }],
            as: "assignment",
          },
        },
        {
          $lookup: {
            from: "lms_courses",
            localField: "courseId",
            foreignField: "_id",
            pipeline: [{ $project: { title: 1, code: 1 } }],
            as: "course",
          },
        },
        {
          $project: {
            _id: 1,
            grade: 1,
            submittedAt: 1,
            studentName: { $arrayElemAt: ["$student.name", 0] },
            assignmentTitle: { $arrayElemAt: ["$assignment.title", 0] },
            maxPoints: { $arrayElemAt: ["$assignment.maxPoints", 0] },
            courseCode: { $arrayElemAt: ["$course.code", 0] },
          },
        },
      ])
      .toArray();
  }
  router.get("/admin/overview", async (req, res) => {
    const ids = await courses.distinct("_id", activeCourses);
    const contentFilter = { courseId: { $in: ids } };
    const [
      roles,
      suspendedUsers,
      publishedCourses,
      archivedCourses,
      enrollments,
      materials,
      assignments,
      announcements,
      submitted,
      graded,
      recentUsers,
      recentSubmissions,
      recentActivity,
      analytics,
    ] = await Promise.all([
      users
        .aggregate([{ $group: { _id: "$role", total: { $sum: 1 } } }])
        .toArray(),
      users.countDocuments({ status: "suspended" }),
      courses.countDocuments({ ...activeCourses, published: true }),
      courses.countDocuments({ deletedAt: { $exists: true } }),
      ...[
        "enrollments",
        "materials",
        "assignments",
        "announcements",
        "submissions",
      ].map((name) =>
        db.collection(`lms_${name}`).countDocuments(contentFilter),
      ),
      db
        .collection("lms_submissions")
        .countDocuments({ ...contentFilter, grade: { $ne: null } }),
      users
        .find({}, { projection: userProjection })
        .sort({ createdAt: -1, _id: -1 })
        .limit(6)
        .toArray(),
      submissions(contentFilter),
      activity.find().sort({ createdAt: -1, _id: -1 }).limit(6).toArray(),
      buildReport(db),
    ]);
    const roleCounts = Object.fromEntries(roles.map((r) => [r._id, r.total]));
    res.json({
      stats: {
        users: roles.reduce((sum, r) => sum + r.total, 0),
        students: roleCounts.student || 0,
        instructors: roleCounts.instructor || 0,
        admins: roleCounts.admin || 0,
        suspendedUsers,
        courses: ids.length,
        publishedCourses,
        archivedCourses,
        enrollments,
        materials,
        assignments,
        announcements,
        submissions: submitted,
        graded,
        pending: submitted - graded,
      },
      recentUsers: recentUsers.map(account),
      recentSubmissions,
      recentActivity,
      analytics: {
        from: analytics.from,
        to: analytics.to,
        timeZone: analytics.timeZone,
        generatedAt: analytics.generatedAt,
        daily: analytics.daily,
        learning: analytics.learning,
      },
    });
  });
  router.get("/admin/users", async (req, res) => {
    const {
      page,
      search,
      role: userRole,
      status,
    } = validate(listing, req.query);
    if (!["all", "active", "suspended"].includes(status))
      fail(400, "Invalid account status.");
    const filter = {};
    if (userRole !== "all") filter.role = userRole;
    if (status !== "all")
      filter.status = status === "active" ? { $ne: "suspended" } : "suspended";
    if (search)
      filter.$or = ["name", "email", "department"].map((field) => ({
        [field]: { $regex: safeSearch(search), $options: "i" },
      }));
    const result = await pageOf(users, filter, page, userProjection);
    res.json({ ...result, items: result.items.map(account) });
  });
  router.get("/admin/users/:userId", async (req, res) => {
    const user = await users.findOne(
      { _id: id(req.params.userId) },
      { projection: userProjection },
    );
    if (!user) fail(404, "User not found.");
    const [ownedCourses, enrollments, submitted, graded, sessions] =
      await Promise.all([
        courses.countDocuments({ instructorId: user._id }),
        db
          .collection("lms_enrollments")
          .countDocuments({ studentId: user._id }),
        db
          .collection("lms_submissions")
          .countDocuments({ studentId: user._id }),
        db
          .collection("lms_submissions")
          .countDocuments({ studentId: user._id, grade: { $ne: null } }),
        db
          .collection("lms_sessions")
          .countDocuments({ userId: user._id, expiresAt: { $gt: new Date() } }),
      ]);
    res.json({
      user: account(user),
      counts: {
        ownedCourses,
        enrollments,
        submissions: submitted,
        graded,
        sessions,
      },
      canChangeRole:
        user.role !== "admin" && !ownedCourses && !enrollments && !submitted,
      ownedCourseList:
        user.role === "instructor"
          ? await courses
              .find(
                { instructorId: user._id },
                {
                  projection: { title: 1, code: 1, published: 1, deletedAt: 1 },
                },
              )
              .sort({ createdAt: -1 })
              .toArray()
          : [],
      enrollmentList:
        user.role === "student"
          ? await db
              .collection("lms_enrollments")
              .aggregate([
                { $match: { studentId: user._id } },
                {
                  $lookup: {
                    from: "lms_courses",
                    localField: "courseId",
                    foreignField: "_id",
                    pipeline: [
                      { $project: { title: 1, code: 1, deletedAt: 1 } },
                    ],
                    as: "course",
                  },
                },
                { $unwind: "$course" },
                { $project: { course: 1, createdAt: 1 } },
              ])
              .toArray()
          : [],
    });
  });
  router.post("/admin/users", async (req, res) => {
    const data = validate(createUser, req.body);
    if (await users.findOne({ email: data.email }))
      fail(409, "An account with this email already exists.");
    const { password, ...profile } = data;
    const user = {
      ...profile,
      passwordHash: await bcrypt.hash(password, 12),
      status: "active",
      bio: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await users.insertOne(user);
    user._id = result.insertedId;
    await record(
      req.user,
      "user.created",
      user,
      `Created a ${user.role} account.`,
    );
    res.status(201).json({ user: account(user) });
  });
  router.patch("/admin/users/:userId", async (req, res) => {
    const data = validate(editUser, req.body);
    const user = await users.findOne({ _id: id(req.params.userId) });
    if (!user) fail(404, "User not found.");
    if (user.role === "admin")
      fail(
        403,
        "Administrator accounts are protected. Use My profile to update your own account.",
      );
    if (data.role && data.role !== user.role) {
      const linked = await Promise.all([
        courses.countDocuments({ instructorId: user._id }),
        db
          .collection("lms_enrollments")
          .countDocuments({ studentId: user._id }),
        db
          .collection("lms_submissions")
          .countDocuments({ studentId: user._id }),
      ]);
      if (linked.some(Boolean))
        fail(
          409,
          "This account has course or submission records. Create a separate account for the other role to preserve its history.",
        );
    }
    if (
      data.email &&
      data.email !== user.email &&
      (await users.findOne({ email: data.email }))
    )
      fail(409, "An account with this email already exists.");
    const changes = Object.fromEntries(
      Object.entries(data).filter(
        ([key, value]) =>
          (key === "status" ? user.status || "active" : user[key] || "") !==
          value,
      ),
    );
    if (!Object.keys(changes).length) return res.json({ user: account(user) });
    await users.updateOne(
      { _id: user._id, role: { $ne: "admin" } },
      {
        $set: { ...changes, updatedAt: new Date() },
        ...(changes.email ? { $unset: { emailVerifiedAt: "" } } : {}),
      },
    );
    if (changes.role || changes.email || changes.status)
      await db.collection("lms_sessions").deleteMany({ userId: user._id });
    const detail = Object.entries(changes)
      .map(
        ([key, value]) =>
          `${key}: ${key === "status" ? user.status || "active" : user[key] || "—"} → ${value || "—"}`,
      )
      .join("; ");
    await record(req.user, "user.updated", user, detail);
    res.json({ user: account({ ...user, ...changes }) });
  });
  router.get("/admin/courses", async (req, res) => {
    const { page, search, status } = validate(listing, req.query);
    if (!["all", "published", "draft", "archived"].includes(status))
      fail(400, "Invalid course status.");
    const filter =
      status === "archived"
        ? { deletedAt: { $exists: true } }
        : { ...activeCourses };
    if (["published", "draft"].includes(status))
      filter.published = status === "published";
    if (search)
      filter.$or = ["title", "code", "category"].map((field) => ({
        [field]: { $regex: safeSearch(search), $options: "i" },
      }));
    const result = await pageOf(courses, filter, page);
    res.json({ ...result, items: await enrichCourses(result.items) });
  });
  router.get("/admin/courses/:courseId", async (req, res) => {
    const course = await courses.findOne({ _id: id(req.params.courseId) });
    if (!course) fail(404, "Course not found.");
    const filter = { courseId: course._id };
    const [enriched] = await enrichCourses([course]);
    const [assignments, recentSubmissions, announcements] = await Promise.all([
      db
        .collection("lms_assignments")
        .find(filter)
        .sort({ dueDate: -1 })
        .limit(10)
        .toArray(),
      submissions(filter, 10),
      db
        .collection("lms_announcements")
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray(),
    ]);
    res.json({
      course: enriched,
      assignments,
      recentSubmissions,
      announcements,
    });
  });
  router.patch("/admin/courses/:courseId/publication", async (req, res) => {
    const { published } = validate(
      z.object({ published: z.boolean() }).strict(),
      req.body,
    );
    const course = await courses.findOne({
      _id: id(req.params.courseId),
      ...activeCourses,
    });
    if (!course)
      fail(
        404,
        "Active course not found. Archived courses cannot be published.",
      );
    if (course.published !== published) {
      await courses.updateOne(
        { _id: course._id, ...activeCourses },
        { $set: { published, updatedAt: new Date() } },
      );
      await record(
        req.user,
        "course.publication",
        course,
        published
          ? "Opened the course for catalog enrollment."
          : "Removed the course from catalog enrollment. Existing students retain access.",
      );
    }
    res.json({
      message: published ? "Course published." : "Course unpublished.",
      published,
    });
  });
  router.get("/admin/activity", async (req, res) => {
    const { page, search } = validate(listing, req.query);
    const filter = search
      ? {
          $or: ["actorName", "targetName", "action", "detail"].map((field) => ({
            [field]: { $regex: safeSearch(search), $options: "i" },
          })),
        }
      : {};
    res.json(await pageOf(activity, filter, page));
  });
  return router;
}
