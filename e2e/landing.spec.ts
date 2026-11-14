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

test('carousel advances by itself and stops under the pointer', async ({ page }) => {
  await page.goto('/');
  const counter = page.locator('[data-carousel-count]');
  const rail = page.locator('[data-carousel-track]');
  await rail.scrollIntoViewIfNeeded();

  await expect(counter).toHaveText('01');
  await expect(counter).toHaveText('02', { timeout: 8000 });

  await rail.hover();
  const paused = await counter.textContent();
  await page.waitForTimeout(5200);
  await expect(counter).toHaveText(paused ?? '02');
});

test('a screenshot opens full size and Escape closes it', async ({ page }) => {
  await page.goto('/');
  await page.locator('#screens').scrollIntoViewIfNeeded();
  await page.locator('[data-shot]').first().click();

  const box = page.locator('[data-lightbox]');
  await expect(box).toHaveAttribute('open', '');
  await expect(page.locator('[data-counter]')).toHaveText('01 / 04');

  await page.keyboard.press('Escape');
  await expect(box).not.toHaveAttribute('open', '');
});

test('reduced motion shows everything at once and keeps the carousel still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const counter = page.locator('[data-carousel-count]');
  await expect(page.locator('#community .card').last()).toHaveCSS('opacity', '1');
  const first = await counter.textContent();
  await page.waitForTimeout(5200);
  await expect(counter).toHaveText(first ?? '01');
});
