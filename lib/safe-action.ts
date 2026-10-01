import "server-only";
import { unstable_rethrow } from "next/navigation";
import { fail, type ActionResult } from "@/lib/action-result";

/** Jalankan isi server action; error biasa → ActionResult, redirect/notFound Next diteruskan. */
export async function run<T>(fn: () => Promise<ActionResult<T>>, fallback = "Terjadi kesalahan"): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    unstable_rethrow(e);
    return fail(e instanceof Error ? e.message : fallback);
  }
}
