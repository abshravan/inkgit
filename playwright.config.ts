import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the production build (`pnpm build` first).
 * Three servers: the app on the local content source, a fake GitHub API, and
 * the app on the GitHub content source. Data is reset on every run.
 */
process.env.E2E_AUTH_SECRET ??= "e2e-auth-secret-not-for-production-0123456789";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { trace: "off", ...devices["Desktop Chrome"], viewport: { width: 1440, height: 950 } },
  projects: [
    { name: "public", testMatch: /public\.spec\.ts/, use: { baseURL: "http://localhost:3100" } },
    {
      name: "admin",
      testMatch: /admin\.spec\.ts/,
      use: { baseURL: "http://localhost:3100" },
      dependencies: ["public"],
    },
    { name: "github", testMatch: /github\.spec\.ts/, use: { baseURL: "http://localhost:3200" } },
  ],
  webServer: [
    {
      command: "node tests/e2e/serve.mjs local 3100",
      url: "http://localhost:3100/",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "pnpm exec tsx tests/helpers/fake-github-server.ts 4100",
      url: "http://127.0.0.1:4100/__control/head",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "node tests/e2e/serve.mjs github 3200",
      url: "http://localhost:3200/",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
