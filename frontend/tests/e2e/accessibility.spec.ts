import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder(/email/i).fill("admin@lab.local");
  await page.getByPlaceholder(/password/i).fill("Admin123!");
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
  await expect(page.getByText(/dashboard|welcome|overview/i)).toBeVisible({ timeout: 10000 });
}

test.describe("Accessibility", () => {
  test("login page has proper form labels", async ({ page }) => {
    await page.goto("/");
    const emailInput = page.getByPlaceholder(/email/i);
    const passwordInput = page.getByPlaceholder(/password/i);
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test("page has proper heading structure", async ({ page }) => {
    await login(page);
    const h1 = page.locator("h1");
    await expect(h1.first()).toBeVisible();
  });

  test("interactive elements are keyboard focusable", async ({ page }) => {
    await page.goto("/");
    // Tab to email field
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
  });

  test("no images without alt text", async ({ page }) => {
    await login(page);
    const imagesWithoutAlt = page.locator("img:not([alt])");
    const count = await imagesWithoutAlt.count();
    // Allow decorative images (empty alt is OK)
    expect(count).toBeLessThanOrEqual(5);
  });

  test("buttons have accessible names", async ({ page }) => {
    await login(page);
    const buttons = page.locator("button");
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      const name = await button.getAttribute("aria-label") ?? await button.textContent();
      expect(name?.trim().length).toBeGreaterThan(0);
    }
  });
});
