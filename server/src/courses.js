import { Router } from "express";
import { fail, id, role } from "./security.js";
import { schemas, validate } from "./validation.js";

export async function accessCourse(db, user, courseId, owner = false) {
  const course = await db
    .collection("lms_courses")
    .findOne({ _id: id(courseId), deletedAt: { $exists: false } });
  if (!course) fail(404, "Course not found.");
  const isOwner = course.instructorId.equals(user._id);
  if (owner && !isOwner)
    fail(403, "Only the instructor who owns this course can change it.");
  const enrolled =
    user.role === "student" &&
    !!(await db
      .collection("lms_enrollments")
      .findOne({ courseId: course._id, studentId: user._id }));
  return { course, isOwner, enrolled };
}
export async function requireCourse(db, user, courseId, owner = false) {
  const result = await accessCourse(db, user, courseId, owner);
  if (!result.isOwner && !result.enrolled)
    fail(403, "Join this course to access its learning content.");
  return result;
}
export async function visibleCourseIds(db, user) {
  if (user.role === "instructor")
    return (
      await db
        .collection("lms_courses")
        .find({ instructorId: user._id, deletedAt: { $exists: false } })
        .project({ _id: 1 })
        .toArray()
    ).map((c) => c._id);
  const enrolled = await db
    .collection("lms_enrollments")
    .find({ studentId: user._id })
    .toArray();
  return (
    await db
      .collection("lms_courses")
      .find({
        _id: { $in: enrolled.map((e) => e.courseId) },
        deletedAt: { $exists: false },
      })
      .project({ _id: 1 })
      .toArray()
  ).map((c) => c._id);
}
export function courseRoutes(db, bucket) {
  const router = Router();
  const courses = db.collection("lms_courses");
  const enrollments = db.collection("lms_enrollments");
  router.get("/courses", async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page) || 1);
    const limit = 9;
    const search =
      typeof req.query.search === "string"
        ? req.query.search.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        : "";
    const filter = {
      deletedAt: { $exists: false },
      ...(req.user.role === "instructor"
        ? { instructorId: req.user._id }
        : req.query.scope === "catalog"
          ? { published: true }
          : { _id: { $in: await visibleCourseIds(db, req.user) } }),
    };
    if (search)
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    const [total, rows] = await Promise.all([
      courses.countDocuments(filter),
      courses
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);
    const items = await Promise.all(
      rows.map(async (course) => {
        const [instructor, studentCount, assignmentCount, myEnrollment] =
          await Promise.all([
            db
              .collection("lms_users")
              .findOne(
                { _id: course.instructorId },
                { projection: { name: 1 } },
              ),
            enrollments.countDocuments({ courseId: course._id }),
            db
              .collection("lms_assignments")
              .countDocuments({ courseId: course._id }),
            enrollments.findOne({
              courseId: course._id,
              studentId: req.user._id,
            }),
          ]);
        return {
          ...course,
          instructorName: instructor?.name || "Instructor",
          studentCount,
          assignmentCount,
          enrolled: !!myEnrollment,
        };
      }),
    );
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  });
  router.post("/courses", role("instructor"), async (req, res) => {
    const data = validate(schemas.course, req.body);
    const course = {
      ...data,
      instructorId: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await courses.insertOne(course);
    res.status(201).json({ ...course, _id: result.insertedId });
  });
  router.get("/courses/:courseId", async (req, res) => {
    const { course, enrolled, isOwner } = await accessCourse(
      db,
      req.user,
      req.params.courseId,
    );
    if (
      !isOwner &&
      !enrolled &&
      (!course.published || req.user.role !== "student")
    )
      fail(403, "This course is unavailable.");
    const instructor = await db
      .collection("lms_users")
      .findOne({ _id: course.instructorId }, { projection: { name: 1 } });
    const studentCount = await enrollments.countDocuments({
      courseId: course._id,
    });
    if (!enrolled && !isOwner)
      return res.json({
        ...course,
        instructorName: instructor?.name,
        enrolled,
        studentCount,
      });
    const [materials, assignments, announcements, submissions, students] =
      await Promise.all([
        db
          .collection("lms_materials")
          .find({ courseId: course._id })
          .sort({ createdAt: -1 })
          .toArray(),
        db
          .collection("lms_assignments")
          .find({ courseId: course._id })
          .sort({ dueDate: 1 })
          .toArray(),
        db
          .collection("lms_announcements")
          .find({ courseId: course._id })
          .sort({ pinned: -1, createdAt: -1 })
          .toArray(),
        db
          .collection("lms_submissions")
          .find({
            courseId: course._id,
            ...(isOwner ? {} : { studentId: req.user._id }),
          })
          .toArray(),
        isOwner
          ? enrollments
              .aggregate([
                { $match: { courseId: course._id } },
                {
                  $lookup: {
                    from: "lms_users",
                    localField: "studentId",
                    foreignField: "_id",
                    as: "user",
                  },
                },
                { $unwind: "$user" },
                {
                  $project: {
                    name: "$user.name",
                    email: "$user.email",
                    studentId: 1,
                    createdAt: 1,
                  },
                },
              ])
              .toArray()
          : [],
      ]);
    res.json({
      ...course,
      instructorName: instructor?.name,
      enrolled,
      studentCount,
      materials,
      assignments,
      announcements,
      submissions,
      students,
    });
  });
  router.patch("/courses/:courseId", role("instructor"), async (req, res) => {
    const { course } = await requireCourse(
      db,
      req.user,
      req.params.courseId,
      true,
    );
    const data = validate(schemas.course, req.body);
    await courses.updateOne(
      { _id: course._id, deletedAt: { $exists: false } },
      { $set: { ...data, updatedAt: new Date() } },
    );
    res.json({ ...course, ...data });
  });
  router.delete("/courses/:courseId", role("instructor"), async (req, res) => {
    const { course } = await requireCourse(
      db,
      req.user,
      req.params.courseId,
      true,
    );
    // Archive before cleanup so every related route denies access, including during deletion.
    await courses.updateOne(
      { _id: course._id },
      { $set: { deletedAt: new Date(), published: false } },
    );
    res.json({
      message:
        "Course deleted. Its records are retained for recovery but are no longer accessible.",
    });
  });
  router.post(
    "/courses/:courseId/enroll",
    role("student"),
    async (req, res) => {
      const { course } = await accessCourse(db, req.user, req.params.courseId);
      if (!course.published)
        fail(403, "This course is not open for enrollment.");
      await enrollments.updateOne(
        { courseId: course._id, studentId: req.user._id },
        { $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
      res.json({ message: "You have joined the course." });
    },
  );
  router.get("/dashboard", async (req, res) => {
    const courseIds = await visibleCourseIds(db, req.user);
    const filter = { courseId: { $in: courseIds } };
    const [
      allCourses,
      assignments,
      announcements,
      submissions,
      studentCount,
      materialCount,
    ] = await Promise.all([
      courses
        .find({ _id: { $in: courseIds } })
        .sort({ updatedAt: -1 })
        .toArray(),
      db
        .collection("lms_assignments")
        .find(filter)
        .sort({ dueDate: 1 })
        .toArray(),
      db
        .collection("lms_announcements")
        .find(filter)
        .sort({ pinned: -1, createdAt: -1 })
        .toArray(),
      db
        .collection("lms_submissions")
        .find({
          ...filter,
          ...(req.user.role === "student" ? { studentId: req.user._id } : {}),
        })
        .toArray(),
      enrollments.distinct("studentId", filter).then((v) => v.length),
      db.collection("lms_materials").countDocuments(filter),
    ]);
    const names = Object.fromEntries(
      allCourses.map((c) => [
        c._id.toString(),
        { title: c.title, code: c.code, color: c.color },
      ]),
    );
    const studentIds = [
      ...new Map(
        submissions.map((s) => [s.studentId.toString(), s.studentId]),
      ).values(),
    ];
    const students = await db
      .collection("lms_users")
      .find({ _id: { $in: studentIds } }, { projection: { name: 1 } })
      .toArray();
    const studentNames = Object.fromEntries(
      students.map((s) => [s._id.toString(), s.name]),
    );
    const courseCards = await Promise.all(
      allCourses.map(async (c) => ({
        ...c,
        enrolled: req.user.role === "student",
        studentCount: await enrollments.countDocuments({ courseId: c._id }),
        instructorName: (
          await db
            .collection("lms_users")
            .findOne({ _id: c.instructorId }, { projection: { name: 1 } })
        )?.name,
      })),
    );
    res.json({
      courses: courseCards,
      assignments: assignments.map((a) => ({
        ...a,
        course: names[a.courseId],
      })),
      announcements: announcements.map((a) => ({
        ...a,
        course: names[a.courseId],
      })),
      submissions: submissions.map((s) => ({
        ...s,
        course: names[s.courseId],
        studentName: studentNames[s.studentId],
      })),
      studentCount,
      materialCount,
    });
  });
  return router;
}
