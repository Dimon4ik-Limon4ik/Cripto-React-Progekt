// отправляет данные формы.Регистрация
const url = "http://localhost:3000/auth/addUsers";
export default async function APIreg(formData) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });
}