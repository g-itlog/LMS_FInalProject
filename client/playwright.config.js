import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:8001",
    channel: "msedge",
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: {
    command: "npm --prefix ../server run test:serve",
    url: "http://127.0.0.1:8001/api/health",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
