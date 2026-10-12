// `npm run dev:prod` — next dev, tapi pakai Supabase cloud dari `.env`.
// process.env diprioritaskan Next.js di atas `.env.local`, jadi nilai lokal
// tidak menimpa. (`node --env-file` tidak bisa: flag itu ikut diteruskan ke
// child process Next lewat NODE_OPTIONS dan ditolak Node.)
import { spawn } from "node:child_process";

process.loadEnvFile(".env");

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 0)));
