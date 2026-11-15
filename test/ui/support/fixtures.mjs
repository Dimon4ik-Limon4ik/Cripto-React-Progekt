// Общий test-объект: до загрузки приложения ставит переписывание API-URL и
// сетевые заглушки, чтобы тесты не ходили в сеть и не трогали чужие серверы.
import { test as base } from "@playwright/test";
import { installApiRewrite, installStubs } from "./network.mjs";

export const test = base.extend({
  context: async ({ context }, use) => {
    await installApiRewrite(context);
    await installStubs(context);
    await use(context);
  },
});

export { expect } from "@playwright/test";
