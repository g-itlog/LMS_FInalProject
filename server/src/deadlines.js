// Keep dueDate as the student's effective deadline in student API responses so
// every existing dashboard, filter, submission form and mobile view agrees.
export function effectiveDeadline(assignment, override) {
  return override?.dueDate > assignment.dueDate
    ? override.dueDate
    : assignment.dueDate;
}
export async function studentAssignments(
  db,
  assignments,
  studentId,
  options = {},
) {
  if (!assignments.length) return [];
  const overrides = await db
    .collection("lms_assignment_deadlines")
    .find(
      {
        studentId,
        assignmentId: { $in: assignments.map((row) => row._id) },
      },
      options,
    )
    .toArray();
  const byId = new Map(overrides.map((row) => [String(row.assignmentId), row]));
  return assignments.map((assignment) => {
    const dueDate = effectiveDeadline(
      assignment,
      byId.get(String(assignment._id)),
    );
    return {
      ...assignment,
      originalDueDate: assignment.dueDate,
      dueDate,
      hasIndividualExtension: dueDate > assignment.dueDate,
    };
  });
}
