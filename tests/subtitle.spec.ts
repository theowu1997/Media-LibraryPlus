import { test, expect } from '@playwright/test';

// Template placeholder only. Replace with an Electron-backed subtitle flow test before enabling.
test.skip('Subtitle search and manual add', async ({ page }) => {
  // Launch the Electron app (assumes dev server is running and exposes a web port)
  // If using electron main process, use Playwright's electron API instead.
  await page.goto('http://localhost:5173'); // Adjust if your dev server uses a different port

  // 1. Open a movie/player (simulate clicking a movie card)
  await page.click('.movie-card'); // Adjust selector as needed

  // 2. Open subtitle panel
  await page.click('.player-btn[title="Subtitles (CC)"]');

  // 3. Check that the search input is pre-filled
  const searchInput = page.locator('.player-sub-search-input');
  await expect(searchInput).not.toBeEmpty();

  // 4. Edit the search input and search
  await searchInput.fill('test custom query');
  await page.click('.player-sub-search-btn');
  // Wait for results or no-results message
  await expect(page.locator('.player-sub-result, .player-sub-hint')).toBeVisible();

  // 5. Add subtitle from file
  await page.click('button:has-text("Add Subtitle")');
  // Simulate file upload (requires a test subtitle file in the repo)
  // await page.setInputFiles('input[type="file"]', 'tests/sample.srt');
  // await expect(page.locator('.subtitle-active')).toBeVisible();
});
