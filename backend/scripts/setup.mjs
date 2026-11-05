import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { npmInvocation } from "./process.mjs";
const backend = fileURLToPath(new URL("../", import.meta.url)),
  frontend = fileURLToPath(new URL("../../frontend/", import.meta.url)),
  windows = process.platform === "win32";
if (!existsSync(path.join(backend, ".env"))) {
  const example = readFileSync(path.join(backend, ".env.example"), "utf8");
  writeFileSync(
    path.join(backend, ".env"),
    example.replace(
      "replace-with-at-least-32-random-characters",
      randomBytes(32).toString("hex"),
    ),
    { mode: 0o600 },
  );
}
if (!existsSync(path.join(frontend, ".env.local")))
  copyFileSync(
    path.join(frontend, ".env.example"),
    path.join(frontend, ".env.local"),
  );
function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    windowsHide: true,
    shell: false,
  });
  if (result.status !== 0)
    throw new Error(`Setup failed: ${command} ${args.join(" ")}`);
}
run(
  "docker",
  ["compose", "-f", path.join(backend, "compose.yaml"), "up", "-d"],
  backend,
);
function npm(args, cwd) {
  const invocation = npmInvocation(args);
  run(invocation.command, invocation.args, cwd);
}
npm(["ci"], backend);
npm(["ci"], frontend);
for (const script of [
  "db:generate",
  "db:migrate",
  "db:seed",
  "db:seed:advanced",
])
  npm(["run", script], backend);
console.log(
  "Ready. From backend, run npm run dev:all and open http://127.0.0.1:3000.",
);
