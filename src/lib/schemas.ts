import { z } from "zod";

const LOGIN_REQUIRED_MSG = "Enter your username/email and password.";
export const loginSchema = z.object({
  identifier: z
    .string({ error: LOGIN_REQUIRED_MSG })
    .trim()
    .min(1, LOGIN_REQUIRED_MSG),
  password: z.string({ error: LOGIN_REQUIRED_MSG }).min(1, LOGIN_REQUIRED_MSG),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(50)
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "Username can only contain letters, numbers, dots, dashes and underscores."
    ),
  email: z.union([z.string().trim().toLowerCase().email("Enter a valid email."), z.literal("")]),
  password: z.string().min(8, "Password must be at least 8 characters."),
  role: z.enum(["ADMIN", "DATA_PROCESSOR"]).default("DATA_PROCESSOR"),
});

export const editUserSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("disable") }),
  z.object({ op: z.literal("enable") }),
  z.object({ op: z.literal("role"), role: z.enum(["ADMIN", "DATA_PROCESSOR"]) }),
  z.object({
    op: z.literal("reset_password"),
    password: z.string().min(8, "Password must be at least 8 characters."),
  }),
  z.object({
    op: z.literal("edit"),
    name: z.string().trim().min(1).max(100).optional(),
    email: z.union([z.string().trim().toLowerCase().email(), z.literal("")]).optional(),
  }),
]);

export const settingsSchema = z.object({
  claimTimeoutMinutes: z.number().int().min(1, "Must be at least 1 minute.").max(1440),
  timezone: z.string().trim().min(1, "Timezone is required."),
});

export const createTemplateSchema = z.object({
  dictionaryId: z.string().trim().min(1),
  body: z.string().trim().min(1, "Message body is required.").max(2000),
});

export const editTemplateSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("edit"),
    body: z.string().trim().min(1, "Message body is required.").max(2000),
  }),
  z.object({ op: z.literal("retire") }),
  z.object({ op: z.literal("restore") }),
  z.object({ op: z.literal("move"), direction: z.enum(["up", "down"]) }),
]);

export const createDictionarySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  seedStarters: z.boolean().default(false),
});

export const queueActionSchema = z.object({
  recordId: z.string().trim().min(1, "Invalid request."),
  action: z.enum(["skip", "done", "next", "previous"]),
});

export const recordPatchSchema = z.object({
  called: z.boolean().optional(),
  verified: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
});

