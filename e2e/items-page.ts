import { Locator, Page, expect } from '@playwright/test';

/** Page Object for the Items list page. */
export class ItemsPage {
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly clearButton: Locator;
  readonly items: Locator;
  readonly resultCount: Locator;
  readonly noResults: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Items' });
    this.searchInput = page.getByTestId('search-input');
    this.clearButton = page.getByTestId('clear-button');
    this.items = page.getByTestId('item');
    this.resultCount = page.getByTestId('result-count');
    this.noResults = page.getByTestId('no-results');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await expect(this.heading).toBeVisible();
  }

  async search(text: string): Promise<void> {
    await this.searchInput.fill(text);
  }

  async clear(): Promise<void> {
    await this.clearButton.click();
  }
}
