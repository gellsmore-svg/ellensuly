import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

test("graph workflow: create, assess, act, reuse, lens, compare", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner").getByText("Ellensúly")).toBeVisible();

  await page.getByRole("button", { name: "Load demonstration" }).click();
  await expect(page.getByText("Supplier continuity decision").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Critical supplier may miss delivery date").first()).toBeVisible();
  await expect(page.getByText("Add a second supplier").first()).toBeVisible();

  await page.getByRole("tab", { name: /Connectivity/i }).click();
  await expect(page.getByText(/Structurally important|converges|cycle/i).first()).toBeVisible();

  await page.getByRole("tab", { name: /Exposure/i }).click();
  await page.getByText("Critical supplier may miss delivery date").first().click();
  await expect(page.getByText(/Alternative landscapes|Add a response/i).first()).toBeVisible();

  await page.getByRole("link", { name: "Register" }).click();
  await expect(page.getByRole("heading", { name: "Risk register" })).toBeVisible();

  await page.getByRole("link", { name: "Heatmap" }).click();
  await expect(page.getByRole("heading", { name: /Likelihood/ })).toBeVisible();

  await page.getByRole("link", { name: "Present" }).click();
  await expect(page.getByText("Presentation", { exact: true })).toBeVisible();
});

test("home page has no serious axe violations", async ({ page }) => {
  await page.goto("/");
  await page.addScriptTag({ path: path.join(here, "../node_modules/axe-core/axe.min.js") });
  const results = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (window as unknown as { axe: { run: () => Promise<{ violations: Array<{ impact: string; id: string }> }> } }).axe.run();
  });
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
