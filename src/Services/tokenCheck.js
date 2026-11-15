// Проверяет сохранённый токен на сервере (автовход после перезагрузки страницы).
const url = "http://localhost:3000/auth/tokenCheck";

export default async function tokenCheck(token) {
  if (!token) return false;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) return false;
  if (!response.ok) {
    throw new Error(`HTTP_ERROR_${response.status}`);
  }

  const data = await response.json().catch(() => ({}));
  return data.valid === true;
}
