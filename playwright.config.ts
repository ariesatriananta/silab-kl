import { defineConfig, devices } from "@playwright/test"
import { config as loadDotenv } from "dotenv"

loadDotenv({ path: ".env.local" })
loadDotenv()

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  globalSetup: "./tests/e2e/global-setup.ts",
  webServer: {
    command: "pnpm build && pnpm start -p 3000",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 300_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
