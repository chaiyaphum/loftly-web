import { test, expect } from '@playwright/test';

/**
 * `/promos-today` smoke. Staging may have an empty promos table — the page
 * must still render cleanly. Accept either:
 *   (a) at least one promo card, OR
 *   (b) the "ไม่มีโปรที่ใช้ได้ตอนนี้" empty-state.
 *
 * Also asserts:
 *   - H1 is visible (semantic heading)
 *   - The "มี X โปรที่ใช้ได้ตอนนี้" count is rendered server-side
 *   - No 5xx
 */

test.describe('/promos-today', () => {
  test('renders promo grid OR empty-state without 5xx', async ({ page }) => {
    const response = await page.goto('/promos-today');
    expect(
      response?.status(),
      'promos-today must not 5xx',
    ).toBeLessThan(500);

    // H1 present — SSR markup.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Server-rendered total count.
    await expect(page.getByTestId('promos-count')).toBeVisible();

    // Either the grid has cards, or the empty-state is visible.
    const grid = page.getByTestId('promos-grid');
    const empty = page.getByTestId('promos-empty');

    const gridVisible = await grid.isVisible().catch(() => false);
    const emptyVisible = await empty.isVisible().catch(() => false);

    expect(
      gridVisible || emptyVisible,
      'expected either a promos grid or the empty-state',
    ).toBe(true);

    if (gridVisible) {
      const cards = page.getByTestId('promo-card');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
    } else {
      // Empty-state Thai copy — the exact string the task spec calls out.
      await expect(empty).toContainText(/ไม่มีโปร/);
    }
  });
});
