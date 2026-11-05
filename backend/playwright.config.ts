import { defineConfig } from "@playwright/test";
import { config } from "dotenv";
config({ path: ".env", quiet: true });
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    headless: true,
    reducedMotion:'reduce',
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: "list",
});
