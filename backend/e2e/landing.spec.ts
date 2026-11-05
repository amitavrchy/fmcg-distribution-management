import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("public landing, keyboard previews and workspace entry", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle("DeshFlow · Keep distribution moving");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Less friction.More flow.",
  );
  await expect(
    page.getByRole("tab", { name: "Control tower", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Control tower", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Procurement", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText(
    "From purchase order to paid supplier.",
  );
  await expect(
    page.getByAltText("Procurement workspace with sample business records"),
  ).toBeVisible();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tabpanel")).toContainText(
    "See the whole picture.",
  );
  await page
    .getByText("Can the field team work without internet?", { exact: true })
    .click();
  await expect(page.locator("details[open]")).toContainText(
    "Orders and collections can be queued",
  );
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "artifacts/landing-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Open your workspace" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});

test("mobile landing navigation, typography and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Platform", exact: true })
    .click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/#platform$/);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const small = await page.locator(".landing-page").evaluate((root) =>
      Array.from(root.querySelectorAll("*"))
        .filter(
          (el) =>
            el.textContent?.trim() &&
            el.getClientRects().length &&
            parseFloat(getComputedStyle(el).fontSize) < 14,
        )
        .map((el) => el.className),
    );
    expect(small).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  expect(
    await page
      .locator(".lp-network")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.goto("/");
  await page.screenshot({
    path: "artifacts/landing-mobile.png",
    fullPage: true,
  });
});
