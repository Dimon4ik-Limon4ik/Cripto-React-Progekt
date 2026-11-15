// Точка входа backend: CORS для dev-клиента, JSON-парсер и подключение роутеров.
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import express from "express";
import authRouter from "./routes/Router.js";
import cryptoRouter from "./routes/cryptoRouter.js";
import favoritesRouter from "./routes/favoritesRouter.js";
import ensureUsersSchema from "./services/ensureUsersSchema.js";
import ensureFavoritesSchema from "./services/ensureFavoritesSchema.js";

// Все секреты (ключа API, JWT и БД) хранятся в secrets/.env вне Git.
dotenv.config({ path: fileURLToPath(new URL("../secrets/.env", import.meta.url)) });

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ORIGINS = (
  process.env.CLIENT_ORIGINS ??
  "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
).split(",");

// Vite-клиент работает на другом порту, поэтому без CORS браузер блокирует запросы.
const isAllowedOrigin = (origin) =>
  CLIENT_ORIGINS.includes(origin) ||
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

app.use((req, res, next) => {
  const { origin } = req.headers;

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  // Preflight-запрос не должен доходить до роутеров.
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/crypto", cryptoRouter);
app.use("/favorites", favoritesRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Маршрут не найден" });
});

// Ошибки разбора JSON и прочие непойманные ошибки не должны ронять сервер.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Некорректный JSON в запросе" });
  }

  console.error("Необработанная ошибка сервера:", err);
  return res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

// Старые базы создавались без даты регистрации — готовим схему до старта.
try {
  await ensureUsersSchema();
} catch (error) {
  console.error("Не удалось подготовить схему пользователей:", error.message);
}

// Избранное привязываем к аккаунтам до старта, чтобы старые базы
// с одной общей таблицей автоматически стали персональными.
try {
  await ensureFavoritesSchema();
} catch (error) {
  console.error("Не удалось подготовить схему избранного:", error.message);
}

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});

