import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { fail, id, role } from "./security.js";
import { schemas, validate } from "./validation.js";
import { requireCourse } from "./courses.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 6 },
  fileFilter(req, file, next) {
    const allowed = [
      ".pdf",
      ".txt",
      ".csv",
      ".docx",
      ".pptx",
      ".xlsx",
      ".zip",
      ".png",
      ".jpg",
      ".jpeg",
      ".mp4",
    ];
    if (!allowed.includes(path.extname(file.originalname).toLowerCase()))
      return next(
        Object.assign(
          new Error("Use PDF, TXT, CSV, Office, ZIP, PNG, JPG, or MP4 files."),
          { status: 400 },
        ),
      );
    next(null, true);
  },
}).single("file");
function checkFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const b = file.buffer;
  const valid = [".txt", ".csv"].includes(ext)
    ? !b.includes(0)
    : ext === ".pdf"
      ? b.subarray(0, 5).toString() === "%PDF-"
      : [".docx", ".pptx", ".xlsx", ".zip"].includes(ext)
        ? b[0] === 0x50 && b[1] === 0x4b
        : ext === ".png"
          ? b
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : [".jpg", ".jpeg"].includes(ext)
            ? b[0] === 255 && b[1] === 216 && b[2] === 255
            : b.subarray(4, 8).toString() === "ftyp";
  if (!b.length || !valid)
    fail(
      400,
      "The file contents do not match its extension, or the file is empty.",
    );
}
async function saveFile(bucket, file, user) {
  if (!file) return null;
  checkFile(file);
  const filename = path
    .basename(file.originalname)
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .slice(0, 160);
  const stream = bucket.openUploadStream(filename, {
    metadata: { ownerId: user._id, mimeType: file.mimetype },
  });
  await new Promise((resolve, reject) => {
    stream.on("finish", resolve).on("error", reject);
    stream.end(file.buffer);
  });
  return { id: stream.id, name: filename, size: file.size };
}
async function removeFile(bucket, file) {
  if (file?.id)
    await bucket.delete(file.id).catch((error) => {
      if (!/File not found/.test(error.message)) throw error;
    });
}

export function contentRoutes(db, bucket) {
  const router = Router();
  for (const [type, schema] of [
    ["assignments", schemas.assignment],
    ["announcements", schemas.announcement],
  ]) {
    const collection = db.collection(`lms_${type}`);
    router.post(
      `/courses/:courseId/${type}`,
      role("instructor"),
      async (req, res) => {
        const { course } = await requireCourse(
          db,
          req.user,
          req.params.courseId,
          true,
        );
        const data = validate(schema, req.body);
        const record = {
          ...data,
          courseId: course._id,
          authorId: req.user._id,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const result = await collection.insertOne(record);
        res.status(201).json({ ...record, _id: result.insertedId });
      },
    );
    router.patch(`/${type}/:recordId`, role("instructor"), async (req, res) => {
      const record = await collection.findOne({ _id: id(req.params.recordId) });
      if (!record) fail(404, "Record not found.");
      await requireCourse(db, req.user, record.courseId, true);
      const data = validate(schema, req.body);
      if (type === "assignments") {
        const highest = await db
          .collection("lms_submissions")
          .find({ assignmentId: record._id, grade: { $ne: null } })
          .sort({ grade: -1 })
          .limit(1)
          .next();
        if (highest && highest.grade > data.maxPoints)
          fail(400, "Maximum points cannot be less than an existing grade.");
      }
      await collection.updateOne(
        { _id: record._id },
        { $set: { ...data, updatedAt: new Date() } },
      );
      res.json({ ...record, ...data });
    });
    router.delete(
      `/${type}/:recordId`,
      role("instructor"),
      async (req, res) => {
        const record = await collection.findOne({
          _id: id(req.params.recordId),
        });
        if (!record) fail(404, "Record not found.");
        await requireCourse(db, req.user, record.courseId, true);
        if (type === "assignments") {
          const submissions = await db
            .collection("lms_submissions")
            .find({ assignmentId: record._id })
            .toArray();
          for (const s of submissions) await removeFile(bucket, s.file);
          await db
            .collection("lms_submissions")
            .deleteMany({ assignmentId: record._id });
        }
        await collection.deleteOne({ _id: record._id });
        res.json({ message: "Record deleted." });
      },
    );
  }
  router.post(
    "/courses/:courseId/materials",
    role("instructor"),
    async (req, res, next) => {
      await requireCourse(db, req.user, req.params.courseId, true);
      next();
    },
    upload,
    async (req, res) => {
      const { course } = await requireCourse(
        db,
        req.user,
        req.params.courseId,
        true,
      );
      const data = validate(schemas.material, req.body);
      if (!req.file && !data.url)
        fail(400, "Upload a file or provide a learning resource link.");
      const file = await saveFile(bucket, req.file, req.user);
      const record = {
        ...data,
        file,
        courseId: course._id,
        authorId: req.user._id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      try {
        const result = await db.collection("lms_materials").insertOne(record);
        res.status(201).json({ ...record, _id: result.insertedId });
      } catch (error) {
        await removeFile(bucket, file);
        throw error;
      }
    },
  );
  router.patch(
    "/materials/:recordId",
    role("instructor"),
    async (req, res, next) => {
      const record = await db
        .collection("lms_materials")
        .findOne({ _id: id(req.params.recordId) });
      if (!record) fail(404, "Material not found.");
      await requireCourse(db, req.user, record.courseId, true);
      req.material = record;
      next();
    },
    upload,
    async (req, res) => {
      const record = req.material;
      const data = validate(schemas.material, req.body);
      if (!req.file && !record.file && !data.url)
        fail(400, "Upload a file or provide a learning resource link.");
      const file = req.file
        ? await saveFile(bucket, req.file, req.user)
        : record.file;
      try {
        await db
          .collection("lms_materials")
          .updateOne(
            { _id: record._id },
            { $set: { ...data, file, updatedAt: new Date() } },
          );
      } catch (error) {
        if (req.file) await removeFile(bucket, file);
        throw error;
      }
      if (req.file) await removeFile(bucket, record.file);
      res.json({ ...record, ...data, file });
    },
  );
  router.delete(
    "/materials/:recordId",
    role("instructor"),
    async (req, res) => {
      const record = await db
        .collection("lms_materials")
        .findOne({ _id: id(req.params.recordId) });
      if (!record) fail(404, "Material not found.");
      await requireCourse(db, req.user, record.courseId, true);
      await db.collection("lms_materials").deleteOne({ _id: record._id });
      await removeFile(bucket, record.file);
      res.json({ message: "Material deleted." });
    },
  );
  router.post(
    "/assignments/:assignmentId/submit",
    role("student"),
    async (req, res, next) => {
      const assignment = await db
        .collection("lms_assignments")
        .findOne({ _id: id(req.params.assignmentId) });
      if (!assignment) fail(404, "Assignment not found.");
      await requireCourse(db, req.user, assignment.courseId);
      if (!assignment.allowLate && new Date() > assignment.dueDate)
        fail(400, "The submission deadline has passed.");
      req.assignment = assignment;
      next();
    },
    upload,
    async (req, res) => {
      const assignment = req.assignment;
      const data = validate(schemas.submission, req.body);
      if (!assignment.allowLate && new Date() > assignment.dueDate)
        fail(400, "The submission deadline has passed.");
      const filter = { assignmentId: assignment._id, studentId: req.user._id };
      const existing = await db.collection("lms_submissions").findOne(filter);
      if (existing?.grade != null)
        fail(
          409,
          "Graded submissions cannot be replaced. Contact your instructor.",
        );
      if (!data.text && !req.file && !existing?.file)
        fail(400, "Add a written response or attach a file.");
      const file = req.file
        ? await saveFile(bucket, req.file, req.user)
        : existing?.file || null;
      const record = {
        ...data,
        file,
        courseId: assignment.courseId,
        submittedAt: new Date(),
        late: new Date() > assignment.dueDate,
        grade: null,
        feedback: "",
        gradedAt: null,
      };
      try {
        if (existing) {
          const result = await db
            .collection("lms_submissions")
            .updateOne({ ...filter, grade: null }, { $set: record });
          if (!result.matchedCount)
            fail(
              409,
              "This submission has just been graded. Refresh and try again.",
            );
        } else
          await db
            .collection("lms_submissions")
            .insertOne({ ...filter, ...record });
      } catch (error) {
        if (req.file) await removeFile(bucket, file);
        throw error;
      }
      if (req.file && existing?.file) await removeFile(bucket, existing.file);
      res
        .status(existing ? 200 : 201)
        .json({
          message: existing ? "Submission updated." : "Assignment submitted.",
        });
    },
  );
  router.get(
    "/assignments/:assignmentId/submissions",
    role("instructor"),
    async (req, res) => {
      const assignment = await db
        .collection("lms_assignments")
        .findOne({ _id: id(req.params.assignmentId) });
      if (!assignment) fail(404, "Assignment not found.");
      await requireCourse(db, req.user, assignment.courseId, true);
      const items = await db
        .collection("lms_submissions")
        .aggregate([
          { $match: { assignmentId: assignment._id } },
          { $sort: { submittedAt: -1 } },
          {
            $lookup: {
              from: "lms_users",
              localField: "studentId",
              foreignField: "_id",
              as: "student",
            },
          },
          { $unwind: "$student" },
          { $project: { "student.passwordHash": 0, "student.password": 0 } },
        ])
        .toArray();
      res.json({ assignment, items });
    },
  );
  router.patch(
    "/submissions/:submissionId/grade",
    role("instructor"),
    async (req, res) => {
      const submission = await db
        .collection("lms_submissions")
        .findOne({ _id: id(req.params.submissionId) });
      if (!submission) fail(404, "Submission not found.");
      await requireCourse(db, req.user, submission.courseId, true);
      const assignment = await db
        .collection("lms_assignments")
        .findOne({ _id: submission.assignmentId });
      if (!assignment) fail(404, "Assignment not found.");
      const data = validate(schemas.grade, req.body);
      if (data.grade > assignment.maxPoints)
        fail(400, `Grade cannot exceed ${assignment.maxPoints} points.`);
      await db
        .collection("lms_submissions")
        .updateOne(
          { _id: submission._id },
          { $set: { ...data, gradedAt: new Date(), gradedBy: req.user._id } },
        );
      res.json({ message: "Grade and feedback saved." });
    },
  );
  router.get("/files/:fileId", async (req, res) => {
    const fileId = id(req.params.fileId);
    const material = await db
      .collection("lms_materials")
      .findOne({ "file.id": fileId });
    const submission =
      !material &&
      (await db.collection("lms_submissions").findOne({ "file.id": fileId }));
    const record = material || submission;
    if (!record) fail(404, "File not found.");
    const { isOwner } = await requireCourse(db, req.user, record.courseId);
    if (submission && !isOwner && !submission.studentId.equals(req.user._id))
      fail(403, "You cannot access another student’s work.");
    const file = await bucket.find({ _id: fileId }).next();
    if (!file) fail(404, "File not found.");
    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Content-Length": String(file.length),
      "Cache-Control": "private, no-store",
    });
    const stream = bucket.openDownloadStream(fileId);
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  });
  return router;
}
