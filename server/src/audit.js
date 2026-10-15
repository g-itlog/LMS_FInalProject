export async function audit(db, actor, action, target, detail, options = {}) {
  await db.collection("lms_admin_activity").insertOne(
    {
      actorId: actor._id,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      targetId: target?._id,
      targetName:
        target?.title || target?.name || target?.code || "Learning record",
      detail,
      createdAt: new Date(),
    },
    options,
  );
}
