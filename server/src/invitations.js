import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { fail } from "./security.js";

export const invitationCode = z
  .string()
  .trim()
  .min(16)
  .max(128)
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Use only letters, numbers, underscores, and hyphens.",
  );
export const invitationCreate = z
  .object({
    label: z.string().trim().min(2).max(80),
    code: invitationCode.optional(),
  })
  .strict();
export const invitationEdit = z
  .object({
    label: z.string().trim().min(2).max(80).optional(),
    code: invitationCode.optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide a field to update.",
  );
const digest = (code) => createHash("sha256").update(code).digest("hex");
export const generateInvitationCode = () =>
  randomBytes(18).toString("base64url");
export const invitationFields = (code) => ({ code, codeHash: digest(code) });
export function publicInvitation(row) {
  const { codeHash, source, code, ...safe } = row;
  const used = (row.useCount || 0) > 0;
  return {
    ...safe,
    active: used ? false : row.active,
    used,
    ...(used ? {} : { code }),
  };
}

export function invitationService(db, config) {
  const collection = db.collection("lms_invitations");
  let initialization;
  async function ensure() {
    initialization ||= (async () => {
      const code = config.inviteCode?.trim();
      if (code) {
        try {
          await collection.updateOne(
            { source: "environment-initial" },
            {
              $setOnInsert: {
                ...invitationFields(code),
                label: "Original instructor invitation",
                active: true,
                useCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
            { upsert: true },
          );
        } catch (error) {
          if (error.code !== 11000) throw error;
          // A parallel cold start or an existing matching code must never reactivate it.
          await collection.updateOne(
            { codeHash: digest(code), source: { $exists: false } },
            { $set: { source: "environment-initial" } },
          );
        }
      }
      // Upgrade existing multi-use records without making a used value available again.
      await collection.updateMany(
        { useCount: { $exists: false } },
        { $set: { useCount: 0 } },
      );
      await collection.updateMany(
        {
          useCount: { $gt: 0 },
          $or: [{ active: { $ne: false } }, { code: { $exists: true } }],
        },
        { $set: { active: false }, $unset: { code: "" } },
      );
    })().catch((error) => {
      initialization = undefined;
      throw error;
    });
    await initialization;
  }
  async function register(user, code, options = {}) {
    await ensure();
    const execute = async (session) => {
      const now = new Date();
      const invitation = await collection.findOneAndUpdate(
        {
          codeHash: digest((code || "").trim()),
          active: true,
          useCount: 0,
        },
        {
          $set: {
            active: false,
            useCount: 1,
            usedAt: now,
            lastUsedAt: now,
            usedBy: user._id,
            updatedAt: now,
          },
          $unset: { code: "" },
        },
        { session, returnDocument: "after" },
      );
      if (!invitation)
        fail(
          403,
          "A valid instructor invitation code is required. Ask your administrator for an unused, active code.",
        );
      const result = await db
        .collection("lms_users")
        .insertOne(user, { session });
      await db.collection("lms_admin_activity").insertOne(
        {
          actorId: user._id,
          actorName: user.name,
          action: "invitation.used",
          targetId: invitation._id,
          targetName: invitation.label,
          detail:
            "Instructor registration completed. The single-use invitation was consumed permanently.",
          createdAt: now,
        },
        { session },
      );
      return result;
    };
    if (options.session) return execute(options.session);
    const session = db.client.startSession();
    try {
      return await session.withTransaction(() => execute(session), {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      });
    } finally {
      await session.endSession();
    }
  }
  return {
    collection,
    ensure,
    register,
  };
}
