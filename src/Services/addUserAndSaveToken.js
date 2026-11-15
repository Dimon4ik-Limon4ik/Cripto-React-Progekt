// Создаёт пользователя и сохраняет полученный токен.
import APIreg from "./APIreg.js";
import { saveToken } from "./tokenStorage.js";

export const addUserAndSaveToken = async (formData) => {
  let response;
  try {
    response = await APIreg(formData);
  } catch {
    throw new Error("Не удалось подключиться к серверу. Попробуйте ещё раз.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Не удалось создать аккаунт.");
  }
  if (!data.token) {
    throw new Error("Сервер не вернул токен авторизации.");
  }

  saveToken(data.token);
  return data.token;
};

