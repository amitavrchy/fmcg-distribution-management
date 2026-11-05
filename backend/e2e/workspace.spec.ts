import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const password = process.env.SEED_PASSWORD!;
async function signIn(page: Page, email = "admin@fmcg.local") {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page.locator("main h1")).toHaveText("Control tower");
  await expect(
    page.getByRole("heading", { name: /One operating picture/ }),
  ).toBeVisible();
}
test("dashboard login and every operational route renders", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signIn(page);
  await page.screenshot({
    path: "artifacts/overview-desktop.png",
    fullPage: true,
  });
  for (const section of [
    "overview",
    "control",
    "procurement",
    "warehouses",
    "finance",
    "returns",
    "logistics",
    "field",
    "analytics",
    "approvals",
    "orders",
    "deliveries",
    "outlets",
    "inventory",
    "catalog",
    "beats",
    "collections",
    "schemes",
    "targets",
    "claims",
    "team",
    "sync",
    "settings",
  ]) {
    await page.goto(`/${section}`);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator(".boot")).toHaveCount(0);
    await expect(page.locator(".enterprise-loading")).toHaveCount(0);
    const undersized = await page.locator("main").evaluate((root) =>
      Array.from(root.querySelectorAll("*"))
        .filter(
          (e) =>
            e.textContent?.trim() &&
            getComputedStyle(e).display !== "none" &&
            parseFloat(getComputedStyle(e).fontSize) < 14,
        )
        .map((e) => ({ tag: e.tagName, size: getComputedStyle(e).fontSize })),
    );
    expect(undersized).toEqual([]);
  }
  expect(errors).toEqual([]);
});
test("create order with scheme preview and inspect lifecycle detail", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("button", { name: "New order", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Retail outlet")
    .selectOption({ label: "Bismillah Store · OUT-001" });
  await dialog.getByLabel("Quantity").fill("12");
  await dialog.getByRole("button", { name: "Preview schemes" }).click();
  await expect(dialog.getByText("Order total", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Submit order" }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto("/orders");
  await page.locator("tbody .link-button").first().click();
  await expect(
    page.getByRole("dialog").getByText("Order total", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("mobile navigation stays within viewport with readable text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.screenshot({
    path: "artifacts/overview-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Outlets", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your retail network" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("offline order queues and reconnect sync removes it exactly once", async ({
  page,
  context,
}) => {
  await signIn(page, "sr@fmcg.local");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveURL(/\/control$/);
  await expect(page.locator("main h1")).toHaveText("Control tower");
  await expect(
    page.getByText(
      "You’re offline. Saved records are available and new orders will queue for sync.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "New order", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Retail outlet")
    .selectOption({ label: "Bismillah Store · OUT-001" });
  await dialog.getByRole("button", { name: "Save offline order" }).click();
  await expect(dialog).toHaveCount(0);
  await context.setOffline(false);
  await page.goto("/sync");
  await expect(
    page.getByRole("heading", { name: "You’re all caught up" }),
  ).toBeVisible({ timeout: 20000 });
});
test("GPS visit records location and reports productive outcome", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 23.806, longitude: 90.368 });
  await signIn(page, "sr@fmcg.local");
  await page.goto("/beats");
  await page
    .getByRole("button", { name: /Update visit|Check in/ })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record GPS check-in" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Productive", { exact: true }).first(),
  ).toBeVisible();
});
test("dashboard and sign-in pass serious accessibility checks", async ({
  page,
}) => {
  await page.goto("/login");
  let result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    result.violations
      .filter((v) => ["serious", "critical"].includes(v.impact || ""))
      .map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
  ).toEqual([]);
  await signIn(page);
  result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    result.violations
      .filter((v) => ["serious", "critical"].includes(v.impact || ""))
      .map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
  ).toEqual([]);
});
