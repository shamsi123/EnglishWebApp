import { expect, test, type Page } from '@playwright/test';
import { passGate, playLesson } from '../scripts/kidslang-driver.mjs';

async function onboard(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Let's go/ }).click();
  await page.getByLabel('Email').fill('Parent@Example.com');
  await page.getByLabel('Password').fill('kidslang-demo');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await passGate(page);
  await page.getByLabel('Nickname').fill('Sara');
  await page.getByRole('button', { name: 'Create profile' }).click();
  await page.getByTestId('child-Sara').click();
  await page.getByTestId('course-ar').click();
}

test('parent signs up, child completes an RTL Arabic lesson and unlocks the next one', async ({ page }) => {
  await onboard(page);
  await expect(page.getByTestId('node-ar-l1-u1-l2')).toHaveAttribute('data-status', 'locked');
  await page.getByTestId('node-ar-l1-u1-l1').click();

  // Arabic content is right-to-left and uses the joined-form-safe renderer
  await expect(page.getByTestId('learn-card').locator('[dir="rtl"]').first()).toBeVisible();
  expect(await playLesson(page)).toBe('reward');
  await expect(page.getByText('Hooray!')).toBeVisible();

  await page.getByRole('button', { name: /Back to map/ }).click();
  await expect(page.getByTestId('node-ar-l1-u1-l1')).toHaveAttribute('data-status', 'mastered');
  await expect(page.getByTestId('node-ar-l1-u1-l2')).toHaveAttribute('data-status', 'available');
});

test('a missed check goes to the Help Loop, never to "failed", and the lesson stays locked', async ({ page }) => {
  await onboard(page);
  await page.getByTestId('node-ar-l1-u1-l1').click();
  expect(await playLesson(page, { failCheck: true })).toBe('help');
  await expect(page.getByText("Let's practice together!")).toBeVisible();
  await expect(page.getByText(/fail/i)).toHaveCount(0);
  await page.goto('/journey/ar');
  await expect(page.getByTestId('node-ar-l1-u1-l2')).toHaveAttribute('data-status', 'locked');
});

test('the app shell and lessons keep working offline, and answers queue for sync', async ({ page, context }) => {
  await onboard(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // let the service worker control the page
  await context.setOffline(true);
  await page.goto('/journey/ar');
  await page.getByTestId('node-ar-l1-u1-l1').click();
  expect(await playLesson(page)).toBe('reward');
  const queued = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('kidslang')!);
    return s.state.data[s.state.activeChildId].queue.length as number;
  });
  expect(queued).toBeGreaterThan(0);
  await context.setOffline(false);
});
