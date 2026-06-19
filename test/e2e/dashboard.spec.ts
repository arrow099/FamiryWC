import { expect, test } from "@playwright/test";

test("renders dashboard and core tabs", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Famiry 2026" })).toBeVisible();
  await expect(page.getByText("World Cup bracket challenge")).toBeVisible();

  await page.getByRole("tab", { name: "Participants" }).click();
  await expect(page.getByRole("cell", { name: "Leppy27" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "BRA" }).first()).toBeVisible();
  await expect(page.getByTitle("BRA flag").first()).toBeVisible();

  await page.getByRole("tab", { name: "Groups" }).click();
  await expect(page.getByRole("heading", { name: "Group A" })).toBeVisible();
  await expect(page.getByText("MEX").first()).toBeVisible();
  await expect(page.getByTitle("MEX flag").first()).toBeVisible();

  await page.getByRole("tab", { name: "Leaderboard" }).click();
  await expect(page.getByRole("columnheader", { name: "Total" })).toBeVisible();
});

test("keeps every dashboard section within the page viewport", async ({ page }) => {
  await page.goto("/");

  for (const tab of ["Overview", "Participants", "Groups", "Knockout", "Schedule", "Compare", "Leaderboard"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("heading", { name: tab, exact: true })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  }
});
