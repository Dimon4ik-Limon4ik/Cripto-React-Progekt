import { defineConfig } from "vitest/config";

// Корень прогона — сам каталог test/api: пути к globalSetup/setupFiles
// и include считаются от него, независимо от текущего каталога shell.
export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: ["**/*.test.js"],
    globalSetup: ["./support/global-setup.mjs"],
    setupFiles: ["./support/setup.mjs"],
    // Файлы и тесты идут последовательно: так проверка изоляции данных
    // в zz-isolation.test.js видит итоговое состояние после всех тестов.
    fileParallelism: false,
    sequence: { shuffle: false },
    hookTimeout: 30_000,
    testTimeout: 20_000,
    reporters: ["default"],
  },
});