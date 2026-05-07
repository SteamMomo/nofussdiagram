const { test, expect } = require('@playwright/test');
const path = require('path');

const FILE_URL = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

test.describe('Fullscreen zoom controls', () => {

  test('zoom controls are hidden before fullscreen', async ({ page }) => {
    await page.goto(FILE_URL);
    const zoom = page.locator('#fs-zoom-controls');
    await expect(zoom).toBeHidden();
  });

  test('zoom controls become visible in CSS fullscreen (is-fullscreen class)', async ({ page }) => {
    await page.goto(FILE_URL);

    // Manually apply CSS fullscreen (same as the JS fallback path)
    await page.evaluate(() => {
      const wrap = document.getElementById('preview-wrap');
      wrap.classList.add('is-fullscreen');
      document.body.classList.add('fullscreen-active');
    });

    const zoom = page.locator('#fs-zoom-controls');
    await expect(zoom).toBeVisible();

    // All three buttons should be visible
    await expect(page.locator('#fs-zoom-controls .fs-zoom-btn')).toHaveCount(3);

    // Exit button should also be visible
    await expect(page.locator('#fs-exit-btn')).toBeVisible();
  });

  test('zoom label syncs when zoom in/out clicked in fullscreen', async ({ page }) => {
    await page.goto(FILE_URL);

    // Load a template so a diagram renders (needed for panZoom to init)
    await page.selectOption('#template-select', 'flowchart');
    await page.click('button.btn.btn-accent'); // Render button
    await page.waitForTimeout(800);

    // Enter CSS fullscreen
    await page.evaluate(() => {
      const wrap = document.getElementById('preview-wrap');
      wrap.classList.add('is-fullscreen');
      document.body.classList.add('fullscreen-active');
    });

    const fsLabel = page.locator('#fs-zoom-label');
    const badge = page.locator('#zoom-badge');

    const initialLabel = await fsLabel.textContent();

    // Click zoom in
    await page.locator('#fs-zoom-controls .fs-zoom-btn').first().click();
    await page.waitForTimeout(200);

    const afterZoomIn = await fsLabel.textContent();
    const badgeAfter = await badge.textContent();

    // Label should have changed
    expect(afterZoomIn).not.toBe(initialLabel);
    // fs-zoom-label and zoom-badge should always match
    expect(afterZoomIn).toBe(badgeAfter);
  });

  test('exit button in fullscreen calls toggleFullscreen', async ({ page }) => {
    await page.goto(FILE_URL);

    // Use the real JS path so isFullscreen flag is set correctly
    await page.evaluate(() => enableCSSFullscreen(document.getElementById('preview-wrap')));

    await expect(page.locator('#fs-exit-btn')).toBeVisible();
    await page.locator('#fs-exit-btn').click();

    // After clicking exit, fullscreen-active should be removed
    await expect(page.locator('body')).not.toHaveClass(/fullscreen-active/);
    await expect(page.locator('#fs-zoom-controls')).toBeHidden();
  });

  test('zoom controls are inside #preview-wrap (required for native fullscreen)', async ({ page }) => {
    await page.goto(FILE_URL);

    const isInsidePreviewWrap = await page.evaluate(() => {
      const zoom = document.getElementById('fs-zoom-controls');
      const wrap = document.getElementById('preview-wrap');
      return wrap.contains(zoom);
    });

    expect(isInsidePreviewWrap).toBe(true);
  });

  test('fs-exit-btn is inside #preview-wrap (required for native fullscreen)', async ({ page }) => {
    await page.goto(FILE_URL);

    const isInsidePreviewWrap = await page.evaluate(() => {
      const btn = document.getElementById('fs-exit-btn');
      const wrap = document.getElementById('preview-wrap');
      return wrap.contains(btn);
    });

    expect(isInsidePreviewWrap).toBe(true);
  });

  test('native fullscreen path calls setFullscreenState (body gets fullscreen-active)', async ({ page }) => {
    await page.goto(FILE_URL);

    // Simulate the native fullscreen promise resolving by calling the .then() handler directly
    await page.evaluate(() => {
      // Mock requestFullscreen to return a resolved promise (simulates native success)
      const wrap = document.getElementById('preview-wrap');
      wrap.requestFullscreen = () => Promise.resolve();
    });

    await page.click('#fullscreen-btn');
    await page.waitForTimeout(200);

    await expect(page.locator('body')).toHaveClass(/fullscreen-active/);
    await expect(page.locator('#fs-zoom-controls')).toBeVisible();
    await expect(page.locator('#fs-exit-btn')).toBeVisible();
  });

});
