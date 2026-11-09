import { expect, test } from '@playwright/test';
import { ItemsPage } from './items-page';

const TOTAL_ITEMS = 10;

test.describe('Items list search', () => {
  let itemsPage: ItemsPage;

  test.beforeEach(async ({ page }) => {
    itemsPage = new ItemsPage(page);
    await itemsPage.goto();
  });

  test('shows all items on load', async () => {
    await expect(itemsPage.items).toHaveCount(TOTAL_ITEMS);
    await expect(itemsPage.resultCount).toHaveText(`Showing ${TOTAL_ITEMS} of ${TOTAL_ITEMS} items`);
    await expect(itemsPage.clearButton).toBeHidden();
  });

  test('filters by name, case-insensitive', async () => {
    await itemsPage.search('APPLE');
    await expect(itemsPage.items).toHaveCount(1);
    await expect(itemsPage.items.first()).toContainText('Apple');
    await expect(itemsPage.resultCount).toHaveText(`Showing 1 of ${TOTAL_ITEMS} items`);
  });

  test('filters by partial name', async () => {
    await itemsPage.search('ro');
    // Carrot, Broccoli, Croissant
    await expect(itemsPage.items).toHaveCount(3);
  });

  test('filters by category', async () => {
    await itemsPage.search('dairy');
    await expect(itemsPage.items).toHaveCount(2);
    for (const item of await itemsPage.items.all()) {
      await expect(item).toContainText('Dairy');
    }
  });

  test('shows empty state when nothing matches', async () => {
    await itemsPage.search('zzz');
    await expect(itemsPage.items).toHaveCount(0);
    await expect(itemsPage.noResults).toHaveText('No items match "zzz".');
  });

  test('clear button resets the filter', async () => {
    await itemsPage.search('fruit');
    await expect(itemsPage.items).toHaveCount(3);
    await itemsPage.clear();
    await expect(itemsPage.searchInput).toHaveValue('');
    await expect(itemsPage.items).toHaveCount(TOTAL_ITEMS);
  });

  test('ignores surrounding whitespace', async () => {
    await itemsPage.search('   milk   ');
    await expect(itemsPage.items).toHaveCount(1);
    await expect(itemsPage.items.first()).toContainText('Milk');
  });
});
