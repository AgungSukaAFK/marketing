import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._-]{3,32}$/, "Username 3-32 karakter: huruf kecil, angka, titik, _ atau -"),
    email: z.email("Email tidak valid"),
    password: z.string().min(8, "Password minimal 8 karakter").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Konfirmasi password tidak sama" });

export const passwordSchema = z
  .object({ password: z.string().min(8, "Password minimal 8 karakter").max(72), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Konfirmasi password tidak sama" });
