import { test, expect } from "../support/fixtures.mjs";
import {
  cardByName,
  createUserViaApi,
  gotoHome,
  useToken,
} from "../support/helpers.mjs";

// Доступность: доступные имена элементов управления и клавиатурная работа.
// Два первых теста описывают ЖЕЛАЕМОЕ поведение и на текущем коде ПАДАЮТ
// (см. test/reports/FIXES_FOR_AGENT.md): у поля поиска и кнопки темы нет
// доступного имени.

test.describe("Доступность главной страницы", () => {
  // Главная открывается только с токеном, поэтому готовим сессию заранее.
  let session;

  test.beforeAll(async () => {
    session = await createUserViaApi();
  });

  test.beforeEach(async ({ context }) => {
    await useToken(context, session.token);
  });

  test("дефект: поле поиска должно иметь доступное имя", async ({ page }) => {
    await gotoHome(page);

    await expect(page.locator(".CriptoSearch")).toHaveAccessibleName(/поиск/i);
  });

  test("дефект: кнопка переключения темы должна иметь доступное имя", async ({
    page,
  }) => {
    await gotoHome(page);

    await expect(page.locator(".btnSunMoon")).toHaveAccessibleName(/тем/i);
  });

  test("звезда избранного — кнопка с состоянием", async ({ page }) => {
    await gotoHome(page);

    const star = cardByName(page, "Stub Coin 0").locator(".star");
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await expect(star).toHaveAccessibleName("Добавить в избранное");
  });

  test("карточка монеты доступна как кнопка и открывается с клавиатуры", async ({
    page,
  }) => {
    await gotoHome(page);

    const card = cardByName(page, "Stub Coin 8");
    await expect(card).toHaveAttribute("role", "button");
    await expect(card).toHaveAccessibleName("Открыть страницу Stub Coin 8");

    await card.focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/coin\/stub-coin-8$/);
  });
});
