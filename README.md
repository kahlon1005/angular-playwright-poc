# Playwright E2E Testing for Angular

This guide explains how to add [Playwright](https://playwright.dev) end-to-end (E2E) tests to **any Angular application** by hand, step by step.

This repository is a working reference implementation: a small Angular app (a list of items with a search filter) tested with Playwright in Chromium, Firefox and WebKit. Every file the guide asks you to create also exists here, so you can copy from it.

---

## Contents

1. [What you get](#1-what-you-get)
2. [Prerequisites](#2-prerequisites)
3. [Install Playwright](#3-install-playwright)
4. [Create the Playwright config](#4-create-the-playwright-config)
5. [Add npm scripts](#5-add-npm-scripts)
6. [Ignore generated output](#6-ignore-generated-output)
7. [Make the app testable (test ids)](#7-make-the-app-testable-test-ids)
8. [Write a page object](#8-write-a-page-object)
9. [Write your first test](#9-write-your-first-test)
10. [Run the tests](#10-run-the-tests)
11. [Debugging and reports](#11-debugging-and-reports)
12. [Running in CI](#12-running-in-ci)
13. [Optional: remove the default unit-test runner](#13-optional-remove-the-default-unit-test-runner)
14. [Conventions and best practices](#14-conventions-and-best-practices)
15. [Troubleshooting](#15-troubleshooting)
16. [Reference: this repository](#16-reference-this-repository)

---

## 1. What you get

After following this guide, your Angular project will have:

- Playwright tests in an `e2e/` folder, written in TypeScript.
- Tests that run in **Chromium, Firefox and WebKit** (the engine behind Safari).
- The Angular dev server **started automatically** before tests run, or your already-running app reused.
- A **page object** layer, so selectors live in one place.
- Screenshots and traces captured on failure, plus an HTML report.
- npm scripts for headless runs, headed runs, the interactive UI and the report.
- A ready-to-use CI pipeline example.

## 2. Prerequisites

| Requirement | Version | Check with |
|---|---|---|
| Node.js | 20 or newer (LTS recommended) | `node --version` |
| npm | 10 or newer | `npm --version` |
| Angular app | Any recent version (built with the Angular CLI) | `npx ng version` |

The app must start with `ng serve` (or `npm start`). The examples assume the default port **4200**.

On Linux, Playwright needs some system libraries for its browsers. Step 3 shows how to install them.

## 3. Install Playwright

From the root of your Angular project (the folder with `angular.json`):

```bash
# 1. Add the Playwright test runner as a dev dependency
npm install --save-dev @playwright/test

# 2. Download the browsers Playwright will drive
npx playwright install chromium firefox webkit
```

On **Linux** (including most CI machines), install the browsers' system dependencies as well:

```bash
npx playwright install --with-deps chromium firefox webkit
```

> Browsers are downloaded once per machine into a shared cache (`%LOCALAPPDATA%\ms-playwright` on Windows, `~/.cache/ms-playwright` on Linux, `~/Library/Caches/ms-playwright` on macOS). After you upgrade `@playwright/test`, run `npx playwright install` again.

> **Shortcut:** `npm init playwright@latest` scaffolds a similar setup interactively. This guide does everything by hand, so you know what each piece does and can adapt it to an existing project.

## 4. Create the Playwright config

Create `playwright.config.ts` in the project root:

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 4200;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  // Where test files live
  testDir: './e2e',

  // Run tests in parallel (each test gets its own browser context)
  fullyParallel: true,

  // Fail the CI build if a test.only was left in the code
  forbidOnly: !!process.env['CI'],

  // Retry flaky tests on CI only
  retries: process.env['CI'] ? 2 : 0,

  // Use one worker on CI for stability; locally Playwright picks a number based on CPU cores
  workers: process.env['CI'] ? 1 : undefined,

  // HTML report (don't auto-open it) + readable console output
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    // Lets tests call page.goto('/') instead of using the full URL
    baseURL: BASE_URL,
    // Record a trace when a failed test is retried (open it in the trace viewer)
    trace: 'on-first-retry',
    // Save a screenshot when a test fails
    screenshot: 'only-on-failure',
  },

  // One "project" per browser. Remove any you don't need.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  // Start the Angular dev server before running tests
  webServer: {
    command: `npx ng serve --port ${PORT}`,
    url: BASE_URL,
    // Locally: reuse an app that's already running on the port.
    // On CI: always start a fresh server.
    reuseExistingServer: !process.env['CI'],
    // The first Angular build can be slow
    timeout: 120_000,
  },
});
```

### Settings you'll most likely change

| Setting | Change it when |
|---|---|
| `PORT` | Your app runs on a port other than 4200. |
| `webServer.command` | Your app needs a specific configuration, e.g. `npx ng serve --configuration=e2e`, or is in a workspace with several projects, e.g. `npx ng serve my-app`. |
| `projects` | You only need some browsers, or want mobile viewports (e.g. `devices['Pixel 7']`, `devices['iPhone 15']`). |
| `use.baseURL` | You want to point the tests at a deployed environment instead of a local server. In that case also remove `webServer`. |

### Do I need to stop my running app?

No. With `reuseExistingServer: true` (the local default above), Playwright first checks `BASE_URL`:

- **If something is already serving on that URL**, the tests use it.
- **If not**, Playwright runs `webServer.command`, waits until the URL responds, runs the tests, then stops the server.

### Optional: testing a production build instead of `ng serve`

`ng serve` is convenient, but a production build is closer to what users get. To test one, build first and serve the output with a static server:

```bash
npm install --save-dev http-server
```

```ts
webServer: {
  command: 'npx ng build && npx http-server dist/<your-app>/browser -p 4200 -s',
  url: 'http://localhost:4200',
  reuseExistingServer: !process.env['CI'],
  timeout: 180_000,
},
```

The `-s` flag makes `http-server` serve `index.html` for unknown paths, so Angular routing works. Check the actual output folder in `angular.json` (`outputPath`).

## 5. Add npm scripts

In `package.json`, add these scripts (or replace the existing `test` script):

```json
"scripts": {
  "test": "playwright test",
  "test:ui": "playwright test --ui",
  "test:headed": "playwright test --headed",
  "test:debug": "playwright test --debug",
  "test:report": "playwright show-report"
}
```

> If you want to keep Angular's unit tests under `npm test`, name these scripts `e2e`, `e2e:ui` and so on instead.

## 6. Ignore generated output

Add to `.gitignore`:

```gitignore
# Playwright
/test-results/
/playwright-report/
/blob-report/
/playwright/.cache/
```

## 7. Make the app testable (test ids)

Playwright can find elements in many ways. Give priority to locators that match what a user sees:

1. **Role and accessible name:** `page.getByRole('button', { name: 'Clear' })`
2. **Label or placeholder:** `page.getByLabel('Search items')`, `page.getByPlaceholder('Search...')`
3. **Visible text:** `page.getByText('No items match')`
4. **Test id:** `page.getByTestId('search-input')`, as a stable fallback

**Don't** use CSS classes or DOM structure (`.item > span:nth-child(2)`). They change whenever the styling changes.

For elements that have no clear role or text, such as list rows, counters and containers, add a `data-testid` attribute in the Angular template:

```html
<input
  type="search"
  aria-label="Search items"
  data-testid="search-input"
  [value]="query()"
  (input)="onSearch($event)"
/>

<ul data-testid="item-list">
  @for (item of filteredItems(); track item.id) {
    <li data-testid="item">{{ item.name }}</li>
  }
</ul>

<p data-testid="result-count">Showing {{ filteredItems().length }} items</p>
```

`page.getByTestId()` reads `data-testid` by default. If your team already uses another attribute (e.g. `data-cy` or `data-qa`), set it in the config:

```ts
use: { testIdAttribute: 'data-qa' }
```

## 8. Write a page object

A page object keeps a page's selectors and actions in one class. When the UI changes, you update one file instead of every test.

Create `e2e/items-page.ts`:

```ts
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
```

Guidelines:

- **One class per page or major component** (e.g. `LoginPage`, `OrdersPage`, `HeaderComponent`).
- **Expose locators and user actions** (`search()`, `submit()`). Put assertions in the tests, except quick "page is ready" checks like the one in `goto()`.
- **Locators are lazy.** Creating one doesn't query the page, so you can define them all in the constructor.

## 9. Write your first test

Test files must end in `.spec.ts` (or `.test.ts`) and live under `testDir` (`e2e/`).

Create `e2e/search.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { ItemsPage } from './items-page';

test.describe('Items list search', () => {
  let itemsPage: ItemsPage;

  test.beforeEach(async ({ page }) => {
    itemsPage = new ItemsPage(page);
    await itemsPage.goto();
  });

  test('shows all items on load', async () => {
    await expect(itemsPage.items).toHaveCount(10);
  });

  test('filters by name, case-insensitive', async () => {
    await itemsPage.search('APPLE');
    await expect(itemsPage.items).toHaveCount(1);
    await expect(itemsPage.items.first()).toContainText('Apple');
  });

  test('shows empty state when nothing matches', async () => {
    await itemsPage.search('zzz');
    await expect(itemsPage.items).toHaveCount(0);
    await expect(itemsPage.noResults).toHaveText('No items match "zzz".');
  });

  test('clear button resets the filter', async () => {
    await itemsPage.search('fruit');
    await itemsPage.clear();
    await expect(itemsPage.searchInput).toHaveValue('');
    await expect(itemsPage.items).toHaveCount(10);
  });
});
```

Key points:

- **Always `await` an `expect` on a locator.** Assertions like `toHaveCount`, `toHaveText` and `toBeVisible` retry automatically until they pass or time out (5 s by default). This is why Playwright tests don't need manual waits or `sleep`.
- **Each test gets a fresh browser context** (its own cookies and storage), so tests are independent and can run in parallel.
- **No Angular-specific waiting is needed.** Actions such as `fill` and `click` wait until the element is visible, enabled and stable, and assertions retry until Angular has re-rendered.

## 10. Run the tests

| Command | What it does |
|---|---|
| `npm test` | Runs all tests in all browsers, without visible windows. |
| `npm run test:ui` | Opens Playwright's interactive UI: pick tests, watch them run, inspect each step. |
| `npm run test:headed` | Runs the tests with visible browser windows. |
| `npm run test:debug` | Opens the Playwright Inspector and pauses at the first action, so you can step through. |
| `npm run test:report` | Opens the HTML report from the last run. |
| `npx playwright test --project=chromium` | Runs the tests in one browser only. |
| `npx playwright test e2e/search.spec.ts` | Runs a single file. |
| `npx playwright test -g "clear button"` | Runs the tests whose title matches the text. |
| `npx playwright test --repeat-each=5` | Repeats each test, useful for hunting flaky tests. |

To run a single test while you're working on it, temporarily change `test(` to `test.only(`. Because of `forbidOnly`, CI fails if you forget to remove it.

## 11. Debugging and reports

- **UI mode** (`npm run test:ui`): the best day-to-day tool. It shows a timeline of each action with a page snapshot, console logs and network calls, and can re-run tests when you save (the eye icon).
- **HTML report** (`npm run test:report`): lists every test with its duration, error, screenshot and trace. It is written to `playwright-report/`.
- **Trace viewer:** traces are recorded when a failed test is retried (`trace: 'on-first-retry'`). Open one from the HTML report, or run `npx playwright show-trace path/to/trace.zip`. To record a trace on every run while debugging, use `npx playwright test --trace on`.
- **Codegen:** `npx playwright codegen http://localhost:4200` opens a browser that records your clicks and typing as test code. It's a quick way to find good locators.
- **VS Code:** install the **Playwright Test for VSCode** extension (`ms-playwright.playwright`). It adds run and debug buttons next to each test, lets you set breakpoints in tests, and has a "Pick locator" tool.

## 12. Running in CI

Example GitHub Actions workflow, saved as `.github/workflows/e2e.yml`:

```yaml
name: E2E tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run Playwright tests
        run: npx playwright test
        env:
          CI: true

      - name: Upload HTML report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
```

The same steps work on any CI system (Azure DevOps, GitLab, Jenkins):

1. `npm ci`
2. `npx playwright install --with-deps`
3. `npx playwright test` with the environment variable `CI=true`
4. Keep `playwright-report/` as a build artifact

With `CI` set, the config turns on retries, uses a single worker, fails the build on a leftover `test.only`, and always starts a fresh dev server.

> **Docker alternative:** the official image `mcr.microsoft.com/playwright:v<version>-noble` comes with the browsers and system libraries already installed. Use the same version as `@playwright/test` in your `package.json`.

## 13. Optional: remove the default unit-test runner

New Angular CLI projects include a unit-test setup (Vitest, or Karma/Jasmine in older versions). If Playwright is your **only** test framework, as in this repository, you can remove it.

**Vitest (Angular 20 and newer):**

```bash
npm uninstall vitest jsdom
```

**Karma/Jasmine (older projects):**

```bash
npm uninstall karma karma-chrome-launcher karma-coverage karma-jasmine karma-jasmine-html-reporter jasmine-core @types/jasmine
```

Then:

1. In `angular.json`, delete the `"test"` entry under `projects.<app>.architect`.
2. Delete `tsconfig.spec.json`, and remove its entry from the `references` list in `tsconfig.json` if it has one.
3. Delete the `src/**/*.spec.ts` files (and `karma.conf.js` if there is one).

> Before you remove it, consider keeping the unit tests. Unit tests are fast and good for component logic. Playwright is best for real user flows across browsers. Many teams use both.

## 14. Conventions and best practices

**Structure**

```
e2e/
  pages/              # page objects (one per page/component), for larger suites
  fixtures/           # custom fixtures, test data
  <feature>.spec.ts   # one spec file per feature or user flow
playwright.config.ts
```

Small suites (like this repository) can keep page objects directly in `e2e/`.

**Writing tests**

- **Test behaviour, not implementation.** Assert what the user sees, not component state.
- **Use locators that match what users see:** role, label, text, then `data-testid`. Avoid CSS and XPath.
- **Never use fixed waits** (`page.waitForTimeout`). Rely on auto-waiting actions and retrying `expect`.
- **Keep tests independent.** Don't depend on test order or on data left behind by another test.
- **One flow per test**, with a title that describes the behaviour (`'clear button resets the filter'`).
- **Mock unstable back ends** with `page.route()` when you want to test the UI on its own:

  ```ts
  await page.route('**/api/items', (route) =>
    route.fulfill({ json: [{ id: 1, name: 'Apple', category: 'Fruit', price: 0.5 }] }),
  );
  ```

- **Reuse login.** For apps behind authentication, log in once in a setup project, save the session with `storageState`, and reuse it in every test. See [Authentication](https://playwright.dev/docs/auth).

## 15. Troubleshooting

| Problem | Cause and fix |
|---|---|
| `Executable doesn't exist at ...ms-playwright...` | The browsers aren't installed, or don't match your Playwright version. Run `npx playwright install`. |
| `Timed out waiting 120000ms from config.webServer` | `ng serve` took too long, or failed to start. Run `npx ng serve` yourself to see the error, or increase `webServer.timeout`. |
| `http://localhost:4200 is already used` (on CI) | Something else is using the port, and `reuseExistingServer` is off on CI. Free the port or change `PORT`. |
| Tests run against an old version of the app | A dev server from earlier is still running and is being reused. Stop it, or restart it. |
| `getByTestId(...)` finds nothing | Check the attribute name (`data-testid`, or your `testIdAttribute`) and that the element is actually rendered (e.g. not hidden behind an `@if`). |
| `strict mode violation: ... resolved to N elements` | The locator matches several elements. Make it more specific, or use `.first()`, `.nth(i)` or `.filter({ hasText: '...' })`. |
| Browser download fails behind a corporate proxy | Set `HTTPS_PROXY`, or point `PLAYWRIGHT_DOWNLOAD_HOST` to an internal mirror, then run `npx playwright install` again. |
| Linux: `Host system is missing dependencies` | Run `npx playwright install --with-deps`, or use the official Docker image. |
| The UI window closes immediately | Run `npm run test:ui` from your own terminal (not a background process). It stays open until you close the window. |

## 16. Reference: this repository

**Stack:** Angular 22, TypeScript 6, @playwright/test 1.65.

| File | Purpose |
|---|---|
| [playwright.config.ts](playwright.config.ts) | Playwright configuration (browsers, dev server, reporters) |
| [e2e/items-page.ts](e2e/items-page.ts) | Page object for the items page |
| [e2e/search.spec.ts](e2e/search.spec.ts) | E2E tests for the search filter (7 tests × 3 browsers) |
| [src/app/app.html](src/app/app.html) | Template with `data-testid` attributes |
| [src/app/app.ts](src/app/app.ts) | Items data and the filtering logic |

To try it:

```bash
npm install
npx playwright install chromium firefox webkit
npm test              # 21 tests: 7 tests × 3 browsers
npm start             # app at http://localhost:4200
```

**Further reading:** [Playwright docs](https://playwright.dev/docs/intro) · [Locators](https://playwright.dev/docs/locators) · [Best practices](https://playwright.dev/docs/best-practices) · [CI guide](https://playwright.dev/docs/ci) · [Angular CLI](https://angular.dev/tools/cli)
