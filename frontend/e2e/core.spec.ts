import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

test("new decision dialog creates a graph and supports adding its first risk", async ({
  page,
}) => {
  const decisionName = `Interface workflow check ${Date.now()}`;
  await page.addInitScript(() => localStorage.setItem("ellensuly-seen", "1"));
  await page.goto("/");
  await page.getByRole("button", { name: "New decision", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Decision name").fill(decisionName);
  await dialog
    .getByLabel(/Objective or context/)
    .fill("Verify the decision creation journey.");
  await dialog.getByRole("button", { name: "Create decision" }).click();
  await expect(
    page
      .getByRole("heading", { name: decisionName, exact: true })
      .first(),
  ).toBeVisible();
  await page.getByText("Add a focal risk", { exact: true }).click();
  await page.getByLabel("Risk", { exact: true }).fill("Delivery delay");
  await page.getByRole("button", { name: "Add risk", exact: true }).click();
  await expect(
    page.locator(".exposure-node").getByText("Delivery delay", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Filter decisions" })
    .fill(decisionName);
  await expect(page.locator(".decision-card")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Filter decisions" })
    .fill("no-matching-decision");
  await expect(page.getByText(/No decisions match/)).toBeVisible();
  await page.getByRole("button", { name: "Clear filter" }).click();
  await expect(page.locator(".decision-card").first()).toBeVisible();
});

test("mobile overview and dialog fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "See the bigger picture." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "New decision", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "New decision", exact: true }),
  ).toBeFocused();
});

test("workspace failures can be retried", async ({ page }) => {
  await page.route("**/api/v1/graphs", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Temporarily unavailable" }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Temporarily unavailable",
  );
  await page.unroute("**/api/v1/graphs");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("alert")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Map a new decision" }),
  ).toBeVisible();
});

test("graph workflow: create, assess, act, reuse, lens, compare", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("banner").getByText("Ellensúly")).toBeVisible();

  await page.getByRole("button", { name: "Load demonstration" }).click();
  await expect(
    page.getByText("Supplier continuity decision").first(),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText("Critical supplier may miss delivery date").first(),
  ).toBeVisible();
  await expect(page.getByText("Add a second supplier").first()).toBeVisible();

  await page.getByRole("tab", { name: /Connectivity/i }).click();
  await expect(
    page.getByText(/Structurally important|converges|cycle/i).first(),
  ).toBeVisible();

  await page.getByRole("tab", { name: /Exposure/i }).click();
  await page
    .getByText("Critical supplier may miss delivery date")
    .first()
    .click();
  await expect(
    page.getByText(/Alternative landscapes|Add a response/i).first(),
  ).toBeVisible();

  await page.getByRole("link", { name: "Register" }).click();
  await expect(
    page.getByRole("heading", { name: "Risk register" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Heatmap" }).click();
  await expect(page.getByRole("heading", { name: /Likelihood/ })).toBeVisible();

  await page.getByRole("link", { name: "Present" }).click();
  await expect(page.getByText("Presentation", { exact: true })).toBeVisible();
});

test("home page has no serious axe violations", async ({ page }) => {
  await page.goto("/");
  await page.addScriptTag({
    path: path.join(here, "../node_modules/axe-core/axe.min.js"),
  });
  const results = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (
      window as unknown as {
        axe: {
          run: () => Promise<{
            violations: Array<{ impact: string; id: string }>;
          }>;
        };
      }
    ).axe.run();
  });
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
