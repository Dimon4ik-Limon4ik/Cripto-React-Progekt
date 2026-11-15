import APIlogin from "./APIlogin.js";
import { saveToken } from "./tokenStorage.js";

// Отправляет логин/пароль на сервер и сохраняет полученный JWT.
export default async function loginAndSaveToken(credentials) {
  let response;
  try {
    response = await APIlogin(credentials);
  } catch {
    throw new Error("Не удалось подключиться к серверу. Попробуйте ещё раз.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Не удалось выполнить вход.");
  }
  if (!data.token) {
    throw new Error("Сервер не вернул токен авторизации.");
  }

  saveToken(data.token);
  return data.token;
}
