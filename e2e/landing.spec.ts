import { test, expect, type Page } from '@playwright/test';

// What must keep working after any design pass: the page is readable without waiting for motion,
// the carousel moves on its own but yields to a pointer, and a screenshot opens full size.

const collectErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
};

test('landing renders every section and logs nothing', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');

  await expect(page.locator('h1')).toBeVisible();
  for (const id of ['features', 'screens', 'data', 'download', 'changelog', 'pricing', 'faq', 'start', 'community']) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }

  await expect(page.locator('.proof__item')).toHaveCount(3);
  await expect(page.locator('#features .card')).toHaveCount(6);
  expect(errors).toEqual([]);
});

test('sections become visible as they are scrolled into view', async ({ page }) => {
  await page.goto('/');
  const last = page.locator('#community .card').last();
  await expect(last).toHaveCSS('opacity', '0');
  await last.scrollIntoViewIfNeeded();
  await expect(last).toHaveCSS('opacity', '1');
});

test('carousel drifts on its own and does not pull back after a drag', async ({ page }) => {
  await page.goto('/');
  const rail = page.locator('[data-carousel-track]');
  await rail.scrollIntoViewIfNeeded();

  const leftOf = () => rail.evaluate((el) => el.scrollLeft);
  const start = await leftOf();
  await page.waitForTimeout(1200);
  expect(await leftOf()).toBeGreaterThan(start + 5);

  // A drag must leave the strip where the hand let go: no magnetic snap back to a slide edge.
  const box = await rail.boundingBox();
  if (!box) throw new Error('the rail has no box');
  await page.mouse.move(box.x + 400, box.y + 150);
  await page.mouse.down();
  for (let step = 1; step <= 6; step += 1) {
    await page.mouse.move(box.x + 400 - step * 40, box.y + 150);
  }
  await page.mouse.up();

  const released = await leftOf();
  await page.waitForTimeout(500);
  expect(await leftOf()).toBeGreaterThanOrEqual(released - 1);
});

test('a screenshot opens full size and Escape closes it', async ({ page }) => {
  await page.goto('/');
  // The phone, not a slide: the rail never stops moving, so a slide is never "stable" enough
  // for a locator click.
  await page.locator('.phone__open').scrollIntoViewIfNeeded();
  await page.locator('.phone__open').click();

  const box = page.locator('[data-lightbox]');
  await expect(box).toHaveAttribute('open', '');
  await expect(box.locator('[data-counter]')).toHaveText('05 / 05');
  await expect(box.locator('[data-caption]')).toHaveText('телефон: задачи');

  await page.keyboard.press('Escape');
  await expect(box).not.toHaveAttribute('open', '');
});

test('reduced motion shows everything at once and keeps the rail still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await expect(page.locator('#community .card').last()).toHaveCSS('opacity', '1');

  const rail = page.locator('[data-carousel-track]');
  await rail.scrollIntoViewIfNeeded();
  const start = await rail.evaluate((el) => el.scrollLeft);
  await page.waitForTimeout(2000);
  expect(await rail.evaluate((el) => el.scrollLeft)).toBe(start);
});
