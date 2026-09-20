import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder(/email/i).fill("admin@lab.local");
  await page.getByPlaceholder(/password/i).fill("Admin123!");
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
  await expect(page.getByText(/dashboard|welcome|overview/i)).toBeVisible({ timeout: 10000 });
}

test.describe("Page navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("dashboard loads with data", async ({ page }) => {
    await expect(page.getByText(/tasks|samples|protocols/i)).toBeVisible();
  });

  test("can navigate to tasks page", async ({ page }) => {
    await page.getByText(/tasks/i).first().click();
    await expect(page.getByText(/task|to.?do|assigned/i)).toBeVisible({ timeout: 5000 });
  });

  test("can navigate to inventory page", async ({ page }) => {
    await page.getByText(/inventory/i).first().click();
    await expect(page.getByText(/inventory|stock|items/i)).toBeVisible({ timeout: 5000 });
  });

  test("can navigate to settings page", async ({ page }) => {
    await page.getByText(/settings/i).first().click();
    await expect(page.getByText(/settings|preferences|configuration/i)).toBeVisible({ timeout: 5000 });
  });
});
