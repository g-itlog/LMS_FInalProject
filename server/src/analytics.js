import { z } from "zod";
import { validate } from "./validation.js";
import { learningSnapshot } from "./learning.js";

export const REPORT_TIME_ZONE = "Asia/Manila";
const DAY = 86400000;
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Enter a valid calendar date.");
const reportQuery = z
  .object({
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    search: z.string().trim().max(100).default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    kind: z.enum(["courses", "daily"]).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Boolean(value.from) !== Boolean(value.to))
      ctx.addIssue({
        code: "custom",
        message: "Provide both start and end dates.",
      });
    if (value.from && value.to) {
      const days = (Date.parse(value.to) - Date.parse(value.from)) / DAY;
      if (days < 0 || days > 365)
        ctx.addIssue({
          code: "custom",
          message: "Choose an inclusive date range of 1–366 days.",
        });
    }
  });
export function reportPeriod(query = {}, now = new Date()) {
  const parsed = validate(reportQuery, query);
  const today = new Date(now.getTime() + 8 * 3600000)
    .toISOString()
    .slice(0, 10);
  const to = parsed.to || today;
  const from =
    parsed.from ||
    new Date(Date.parse(today) - 29 * DAY).toISOString().slice(0, 10);
  return {
    ...parsed,
    from,
    to,
    start: new Date(`${from}T00:00:00+08:00`),
    end: new Date(new Date(`${to}T00:00:00+08:00`).getTime() + DAY),
  };
}
const round = (value) => Math.round(value * 10) / 10;
const totals = () => ({
  submissions: 0,
  graded: 0,
  pending: 0,
  late: 0,
  earnedPoints: 0,
  possiblePoints: 0,
  scoredSubmissions: 0,
});
function metrics(row = {}) {
  const result = { ...totals(), ...row };
  delete result._id;
  return {
    ...result,
    pending: result.submissions - result.graded,
    reviewRate: result.submissions
      ? round((result.graded / result.submissions) * 100)
      : null,
    weightedScore: result.possiblePoints
      ? round((result.earnedPoints / result.possiblePoints) * 100)
      : null,
  };
}
const groupValues = {
  submissions: { $sum: 1 },
  graded: { $sum: { $cond: [{ $isNumber: "$grade" }, 1, 0] } },
  late: { $sum: { $cond: [{ $eq: ["$late", true] }, 1, 0] } },
  earnedPoints: { $sum: { $cond: ["$scorable", "$grade", 0] } },
  possiblePoints: {
    $sum: { $cond: ["$scorable", "$assignment.maxPoints", 0] },
  },
  scoredSubmissions: { $sum: { $cond: ["$scorable", 1, 0] } },
};
const dayGroup = (field) => ({
  $dateToString: {
    date: `$${field}`,
    format: "%Y-%m-%d",
    timezone: REPORT_TIME_ZONE,
  },
});

export async function buildReport(db, query = {}, now = new Date()) {
  const period = reportPeriod(query, now);
  const range = { $gte: period.start, $lt: period.end };
  const courses = await db
    .collection("lms_courses")
    .find(
      { deletedAt: { $exists: false } },
      { projection: { title: 1, code: 1, published: 1 } },
    )
    .sort({ code: 1, _id: 1 })
    .toArray();
  const content = { courseId: { $in: courses.map((course) => course._id) } };
  const [accountDays, enrollmentCounts, assignmentCounts, submissionData] =
    await Promise.all([
      db
        .collection("lms_users")
        .aggregate([
          { $match: { createdAt: range } },
          { $group: { _id: dayGroup("createdAt"), newAccounts: { $sum: 1 } } },
        ])
        .toArray(),
      db
        .collection("lms_enrollments")
        .aggregate([
          { $match: content },
          {
            $facet: {
              byCourse: [
                { $group: { _id: "$courseId", enrollments: { $sum: 1 } } },
              ],
              daily: [
                { $match: { createdAt: range } },
                {
                  $group: {
                    _id: dayGroup("createdAt"),
                    newEnrollments: { $sum: 1 },
                  },
                },
              ],
            },
          },
        ])
        .toArray(),
      db
        .collection("lms_assignments")
        .aggregate([
          { $match: content },
          { $group: { _id: "$courseId", assignments: { $sum: 1 } } },
        ])
        .toArray(),
      db
        .collection("lms_submissions")
        .aggregate([
          { $match: { ...content, submittedAt: range } },
          {
            $lookup: {
              from: "lms_assignments",
              localField: "assignmentId",
              foreignField: "_id",
              as: "assignment",
            },
          },
          { $set: { assignment: { $arrayElemAt: ["$assignment", 0] } } },
          {
            $set: {
              scorable: {
                $and: [
                  { $isNumber: "$grade" },
                  { $isNumber: "$assignment.maxPoints" },
                  { $gt: ["$assignment.maxPoints", 0] },
                  { $gte: ["$grade", 0] },
                  { $lte: ["$grade", "$assignment.maxPoints"] },
                  { $eq: ["$assignment.courseId", "$courseId"] },
                ],
              },
            },
          },
          {
            $facet: {
              totals: [{ $group: { _id: null, ...groupValues } }],
              daily: [
                { $group: { _id: dayGroup("submittedAt"), ...groupValues } },
              ],
              byCourse: [{ $group: { _id: "$courseId", ...groupValues } }],
            },
          },
        ])
        .toArray(),
    ]);
  const enrollment = enrollmentCounts[0] || { byCourse: [], daily: [] };
  const submission = submissionData[0] || {
    totals: [],
    daily: [],
    byCourse: [],
  };
  const keyed = (rows) => new Map(rows.map((row) => [String(row._id), row]));
  const accountsByDay = keyed(accountDays),
    enrollmentsByDay = keyed(enrollment.daily),
    submissionsByDay = keyed(submission.daily);
  const enrollmentsByCourse = keyed(enrollment.byCourse),
    assignmentsByCourse = keyed(assignmentCounts),
    submissionsByCourse = keyed(submission.byCourse);
  const daily = [];
  for (
    let cursor = Date.parse(period.from);
    cursor <= Date.parse(period.to);
    cursor += DAY
  ) {
    const date = new Date(cursor).toISOString().slice(0, 10);
    daily.push({
      date,
      newAccounts: accountsByDay.get(date)?.newAccounts || 0,
      newEnrollments: enrollmentsByDay.get(date)?.newEnrollments || 0,
      ...metrics(submissionsByDay.get(date)),
    });
  }
  const learning = await learningSnapshot(
    db,
    courses.map((course) => course._id),
  );
  const courseRows = courses.map((course) => ({
    ...course,
    progressPercent:
      learning.courses.find((row) => row.courseId.equals(course._id))
        ?.progressPercent ?? null,
    enrollments: enrollmentsByCourse.get(String(course._id))?.enrollments || 0,
    assignments: assignmentsByCourse.get(String(course._id))?.assignments || 0,
    ...metrics(submissionsByCourse.get(String(course._id))),
  }));
  const search = period.search.toLowerCase();
  const filtered = courseRows.filter((course) =>
    `${course.code} ${course.title}`.toLowerCase().includes(search),
  );
  const limit = 12;
  return {
    from: period.from,
    to: period.to,
    timeZone: REPORT_TIME_ZONE,
    generatedAt: now,
    learning: {
      ...learning.summary,
      lecturesCompleted: learning.rows.reduce(
        (sum, row) => sum + row.lecturesCompleted,
        0,
      ),
      quizzesCompleted: learning.rows.reduce(
        (sum, row) => sum + row.quizzesCompleted,
        0,
      ),
      quizAttempts: await db
        .collection("lms_quiz_attempts")
        .countDocuments(content),
    },
    summary: {
      ...metrics(submission.totals[0]),
      newAccounts: accountDays.reduce((sum, row) => sum + row.newAccounts, 0),
      newEnrollments: enrollment.daily.reduce(
        (sum, row) => sum + row.newEnrollments,
        0,
      ),
      activeCourses: courses.length,
    },
    daily,
    topCourses: [...courseRows]
      .filter((course) => course.submissions > 0)
      .sort(
        (a, b) => b.submissions - a.submissions || a.code.localeCompare(b.code),
      )
      .slice(0, 6),
    courses: {
      items: filtered.slice((period.page - 1) * limit, period.page * limit),
      page: period.page,
      total: filtered.length,
      pages: Math.ceil(filtered.length / limit),
    },
    // Kept internal for a complete CSV export, independent of table pagination.
    courseRows: filtered,
  };
}

function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (typeof value === "string" && /^[\s]*[=+\-@\t\r\n]/.test(text))
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function reportCsv(report, kind = "courses") {
  const columns =
    kind === "daily"
      ? [
          ["Date (Asia/Manila)", "date"],
          ["New accounts", "newAccounts"],
          ["New enrollments", "newEnrollments"],
          ["Latest submissions", "submissions"],
          ["Currently graded", "graded"],
          ["Awaiting review", "pending"],
          ["Late", "late"],
        ]
      : [
          ["Course code", "code"],
          ["Course title", "title"],
          ["Currently published", "published"],
          ["Current enrollments", "enrollments"],
          ["Current assignments", "assignments"],
          ["Current learning progress percent", "progressPercent"],
          ["Latest submissions in period", "submissions"],
          ["Currently graded", "graded"],
          ["Awaiting review", "pending"],
          ["Late", "late"],
          ["Earned points", "earnedPoints"],
          ["Possible points", "possiblePoints"],
          ["Scored submissions", "scoredSubmissions"],
          ["Weighted score percent", "weightedScore"],
        ];
  const rows = kind === "daily" ? report.daily : report.courseRows;
  return (
    "\uFEFF" +
    [
      [
        "Period start",
        "Period end",
        "Time zone",
        ...columns.map(([label]) => label),
      ]
        .map(csvCell)
        .join(","),
      ...rows.map((row) =>
        [
          report.from,
          report.to,
          report.timeZone,
          ...columns.map(([, key]) => row[key]),
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\r\n") +
    "\r\n"
  );
}
