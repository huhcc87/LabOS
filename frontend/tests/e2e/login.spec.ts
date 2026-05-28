import { test, expect } from "@playwright/test";

test.describe("Login flow", () => {
  test("shows login page when not authenticated", async ({ page }) => {
    await page.goto("/");
    // Should see login form
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/email/i).fill("wrong@example.com");
    await page.getByPlaceholder(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in|log in|login/i }).click();
    // Should show error
    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 5000 });
  });

  test("successful login redirects to dashboard", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/email/i).fill("admin@lab.local");
    await page.getByPlaceholder(/password/i).fill("Admin123!");
    await page.getByRole("button", { name: /sign in|log in|login/i }).click();
    // Should redirect to dashboard
    await expect(page.getByText(/dashboard|welcome|overview/i)).toBeVisible({ timeout: 10000 });
  });
});
