import { defineConfig } from "@playwright/test";
import {
  ARTIFACTS_DIR,
  FRONTEND_URL,
  RESULTS_JSON,
} from "./support/env.mjs";

// UI-тесты Playwright. Запуск: cd test && npm run test:ui
export default defineConfig({
  testDir: "./specs",
  globalSetup: "./support/global-setup.mjs",
  // Бэкенд и БД общие, поэтому файлы и тесты идут строго последовательно.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: ARTIFACTS_DIR,
  reporter: [
    ["list"],
    ["json", { outputFile: RESULTS_JSON }],
  ],
  use: {
    baseURL: FRONTEND_URL,
    browserName: "chromium",
    headless: true,
    viewport: { width: 1280, height: 800 },
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    // Трассы содержат DOM и сетевые тела — для отчёта достаточно скриншотов.
    trace: "off",
    video: "off",
  },
});
