import { AuthShell } from "@/components/auth/auth-shell";

/** Login, registrasi & reset password memakai satu AuthShell (slideshow tidak ter-reset saat pindah halaman). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
