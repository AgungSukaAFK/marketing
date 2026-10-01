import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "Username 3-32 karakter: huruf kecil, angka, titik, _ atau -");

export const roleSchema = z.enum(["sales", "admin", "master"]);

export const createAccountSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  username: usernameSchema,
  email: z.email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter").max(72),
  role: roleSchema,
});

export const updateAccountSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  username: usernameSchema,
  role: roleSchema,
  active: z.boolean(),
});

export const activateSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    username: usernameSchema,
    role: z.enum(["moderator", "sales", "admin", "master"]),
    tenant_id: z.union([z.guid(), z.literal(""), z.null()]).transform((v) => v || null),
    active: z.boolean(),
  })
  .refine((v) => v.role === "moderator" || v.tenant_id, { path: ["tenant_id"], message: "Pilih company/tenant" });

export const tenantSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, "Kode 2-20 karakter: huruf besar, angka, atau -"),
});

/** Akun baru dibuat moderator → langsung aktif, tinggal login. */
export const moderatorCreateSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
    username: usernameSchema,
    email: z.email("Email tidak valid"),
    password: z.string().min(8, "Password minimal 8 karakter").max(72),
    role: z.enum(["moderator", "sales", "admin", "master"]),
    tenant_id: z.union([z.guid(), z.literal(""), z.null()]).transform((v) => v || null),
  })
  .refine((v) => v.role === "moderator" || v.tenant_id, { path: ["tenant_id"], message: "Pilih company/tenant" });
