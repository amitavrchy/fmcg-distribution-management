import { existsSync } from "node:fs";
import path from "node:path";
export function npmInvocation(args) {
  if (process.platform !== "win32") return { command: "npm", args };
  const configured = process.env.npm_execpath;
  const cli = configured?.endsWith("npm-cli.js")
    ? configured
    : path.join(
        path.dirname(process.execPath),
        "node_modules",
        "npm",
        "bin",
        "npm-cli.js",
      );
  if (!existsSync(cli))
    throw new Error(
      "Cannot locate npm CLI. Run this helper through npm from backend.",
    );
  return { command: process.execPath, args: [cli, ...args] };
}
