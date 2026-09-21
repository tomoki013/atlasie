import { defineConfig, devices } from "@playwright/test";

const port = 3107;
const baseURL = `http://localhost:${port}`;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 2,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: { baseURL, trace: "retain-on-failure" },
  webServer: {
    command: `npm run dev -w apps/web -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180000,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
