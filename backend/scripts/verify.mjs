import { spawn, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { npmInvocation } from "./process.mjs";
const backend = fileURLToPath(new URL("../", import.meta.url)),
  frontend = fileURLToPath(new URL("../../frontend/", import.meta.url)),
  root = fileURLToPath(new URL("../../", import.meta.url)),
  windows = process.platform === "win32";
const unexpected = readdirSync(root).filter(
  (name) => !["frontend", "backend", ".git"].includes(name),
);
if (unexpected.length)
  throw new Error(
    `Root may only contain frontend and backend (plus Git metadata): ${unexpected.join(", ")}`,
  );
function npm(cwd, args) {
  const invocation = npmInvocation(args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    stdio: "inherit",
    windowsHide: true,
    shell: false,
    env: { ...process.env, RUN_INTEGRATION: "1" },
  });
  if (result.status !== 0)
    throw new Error(`Verification failed: npm ${args.join(" ")}`);
}
npm(backend, ["run", "db:generate"]);
npm(backend, ["run", "db:migrate"]);
npm(backend, ["run", "db:seed"]);
npm(backend, ["run", "db:seed:advanced"]);
npm(backend, ["run", "check:all"]);
npm(backend, ["test"]);
npm(backend, ["run", "build:all"]);
npm(backend, ["audit", "--audit-level=high"]);
npm(frontend, ["audit", "--audit-level=high"]);
if (process.argv.includes("--browser")) {
  const children = [];
  const online = async (url) => {
    try {
      return (await fetch(url)).status < 500;
    } catch {
      return false;
    }
  };
  try {
    for (const [cwd, url] of [
      [backend, "http://127.0.0.1:4000/api/auth/me"],
      [frontend, "http://127.0.0.1:3000/login"],
    ])
      if (!(await online(url))) {
        const invocation = npmInvocation(["run", "start"]);
        const child = spawn(invocation.command, invocation.args, {
          cwd,
          stdio: "inherit",
          windowsHide: true,
          shell: false,
          detached: !windows,
        });
        children.push(child);
      }
    for (let i = 0; i < 60; i++) {
      if (
        (await online("http://127.0.0.1:4000/api/auth/me")) &&
        (await online("http://127.0.0.1:3000/login"))
      )
        break;
      if (i === 59) throw new Error("Application servers did not become ready");
      await new Promise((r) => setTimeout(r, 500));
    }
    npm(backend, ["run", "test:e2e"]);
  } finally {
    for (const child of children) {
      if (windows)
        spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
          windowsHide: true,
          stdio: "ignore",
        });
      else {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
      }
    }
  }
}
console.log(
  "Verified: two-folder structure, migrations, types, unit/database tests, builds, dependency audits" +
    (process.argv.includes("--browser")
      ? ", browser acceptance."
      : ". Add --browser for browser acceptance."),
);
