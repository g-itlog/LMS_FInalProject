import { z } from "zod";

const text = (min, max) => z.string().trim().min(min).max(max);
const password = z
  .string()
  .min(8)
  .max(72)
  .refine(
    (v) => Buffer.byteLength(v, "utf8") <= 72,
    "Password must be at most 72 UTF-8 bytes",
  )
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number");
export const schemas = {
  register: z.object({
    name: text(2, 80),
    email: z
      .string()
      .trim()
      .email()
      .max(160)
      .transform((v) => v.toLowerCase()),
    password,
    role: z.enum(["student", "instructor"]).default("student"),
    inviteCode: z.string().max(200).optional(),
    verificationToken: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  }),
  login: z.object({
    email: z
      .string()
      .trim()
      .email()
      .max(160)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(1).max(200),
  }),
  profile: z.object({
    name: text(2, 80),
    bio: text(0, 600).default(""),
    department: text(0, 100).default(""),
  }),
  password: z.object({
    currentPassword: z.string().min(1).max(200),
    newPassword: password,
  }),
  course: z.object({
    title: text(3, 120),
    code: text(3, 20)
      .regex(/^[a-zA-Z0-9 -]+$/)
      .transform((v) => v.toUpperCase()),
    description: text(10, 3000),
    category: text(2, 60),
    color: z
      .enum(["violet", "blue", "teal", "orange", "pink"])
      .default("violet"),
    published: z.boolean().default(false),
  }),
  assignment: z.object({
    title: text(3, 160),
    instructions: text(10, 6000),
    dueDate: z
      .string()
      .datetime({ offset: true })
      .transform((v) => new Date(v)),
    maxPoints: z.coerce.number().int().min(1).max(1000),
    allowLate: z.boolean().default(false),
  }),
  material: z.object({
    title: text(3, 160),
    description: text(0, 3000).default(""),
    url: z
      .union([
        z.literal(""),
        z
          .string()
          .url()
          .max(2000)
          .refine((v) => /^https?:\/\//i.test(v), "Use an http or https link"),
      ])
      .default(""),
  }),
  announcement: z.object({
    title: text(3, 160),
    body: text(5, 6000),
    pinned: z.boolean().default(false),
  }),
  submission: z.object({ text: text(0, 10000).default("") }),
  grade: z.object({
    grade: z.preprocess(
      (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
      z.number().finite().min(0),
    ),
    feedback: text(1, 4000),
  }),
};
export function validate(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const error = new Error(
      result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
    error.status = 400;
    throw error;
  }
  return result.data;
}
