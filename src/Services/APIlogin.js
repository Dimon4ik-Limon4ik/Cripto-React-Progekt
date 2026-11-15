const url = "http://localhost:3000/auth/login";

export default async function APIlogin(credentials) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });
}