import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('login with MSW then see Garage', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Dialed' })).toBeVisible();
    await page.getByTestId('email-input').fill('e2e@test.local');
    await page.getByTestId('password-input').fill('password');
    await page.getByTestId('auth-submit-btn').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Garage' })).toBeVisible();
    await expect(page.getByTestId('add-bike-button')).toBeVisible();
  });
});
