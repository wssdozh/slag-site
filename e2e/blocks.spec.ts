import { test, expect } from '@playwright/test';

// The feature tiles are drawn, not photographed: four CSS-only illustrations assembled from divs.
// Two things must hold for them as a group — a reader who never waits for motion still sees a
// meaningful finished picture, and nothing on a phone squeezes the page sideways. The rest of the
// file pins the page skeleton the landing copy is written against.

const BLOCKS = ['.ill--composer', '.ill--search', '.ill--files', '.ill--sync'];

test('every illustration block is visible and carries its own text', async ({ page }) => {
  await page.goto('/');

  // All four live in the features grid, one per tile; the other two tiles are text only.
  await expect(page.locator('#features .card .ill')).toHaveCount(4);

  for (const selector of BLOCKS) {
    const block = page.locator(selector);
    await expect(block, `${selector} is missing`).toHaveCount(1);
    await expect(block, `${selector} is not visible`).toBeVisible();

    // The picture is decorative, but the words inside it are what makes it read as a product
    // screen rather than an abstract shape.
    const text = (await block.innerText()).trim();
    expect(text.length, `${selector} has no text inside`).toBeGreaterThan(0);
    await expect(block.locator('.ill__mono').first()).toBeVisible();
  }
});

test('reduced motion stops every animation inside the illustration blocks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const running = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          return animation.playState === 'running' && !!target && !!target.closest('.ill');
        }).length,
  );

  expect(running, 'animations are still running inside .ill under prefers-reduced-motion: reduce').toBe(0);
});

test('reduced motion shows the finished state of the illustrations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  // The card already landed, the query already filtered down to its hit, the metadata panel is open:
  // a still frame of the gesture having happened, not a freeze at frame zero.
  await expect(page.locator('.ill--composer .ill__card')).toHaveCSS('opacity', '1');
  await expect(page.locator('.ill--search .ill__hit').first()).toHaveCSS('opacity', '1');
  await expect(page.locator('.ill--files .ill__meta')).toBeVisible();
});

test('the landing does not scroll sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));

  expect(widths.scroll, `page scrolls horizontally: scrollWidth ${widths.scroll} vs clientWidth ${widths.client}`).toBe(
    widths.client,
  );
});

test('the landing is seven sections and none of the retired anchors came back', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('section')).toHaveCount(7);

  // Hiding the old blocks is not enough: ids that still exist keep in-page links and SEO anchors
  // alive. They were removed together with the blocks, so a `#download` hit is a regression.
  for (const id of ['data', 'download', 'changelog', 'community']) {
    await expect(page.locator(`#${id}`), `section #${id} must not exist`).toHaveCount(0);
  }

  for (const id of ['features', 'screens', 'pricing', 'faq', 'start']) {
    await expect(page.locator(`#${id}`), `section #${id} is missing`).toHaveCount(1);
  }
});

test('the closing call to action points at the release notes', async ({ page }) => {
  await page.goto('/');

  const meta = page.locator('.cta .cta__meta');
  await expect(meta).toHaveCount(1);
  await expect(meta).toBeVisible();
  await expect(meta.locator('a[href="/releases"]')).toHaveCount(1);
});
