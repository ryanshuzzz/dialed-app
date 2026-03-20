import { test, expect } from '@playwright/test';

test.describe('session logger road', () => {
  test('log road session using seeded MSW road event', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('email-input').fill('e2e@test.local');
    await page.getByTestId('password-input').fill('password');
    await page.getByTestId('auth-submit-btn').click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/sessions/new');
    await expect(page.getByTestId('session-logger')).toBeVisible();

    await page.getByTestId('venue-road').check();
    await expect(page.getByTestId('event-select')).toBeVisible();

    await page
      .getByTestId('event-select')
      .selectOption({ label: '2026-02-01 · Commute — SF to Oakland' });
    await page.getByTestId('next-button').click();

    await expect(page.getByTestId('step-details')).toBeVisible();
    await expect(page.getByTestId('session-type-select')).toBeVisible();

    await page.getByTestId('next-button').click();
    await expect(page.getByTestId('skip-upload-button')).toBeVisible();
    await page.getByTestId('skip-upload-button').click();

    await expect(page.getByTestId('step-review')).toBeVisible();
    await page.getByTestId('save-session').click();

    await expect(page).toHaveURL(/\/sessions\/session-/);
  });
});
