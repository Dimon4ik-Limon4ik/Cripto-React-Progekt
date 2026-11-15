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

// Не раскрываем стек в заголовках ответов.
app.disable("x-powered-by");

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

// Базовые защитные заголовки без внешних зависимостей (helmet не требуется).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
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

  // Тело больше лимита express.json() — это ошибка клиента, а не сервера.
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Слишком большой запрос" });
  }

  // Прочие 4xx от middleware (неверный Content-Type и т.п.) отдаём как есть.
  const status = Number(err?.status ?? err?.statusCode ?? 500);
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: "Некорректный запрос" });
  }

  // Объект ошибки может содержать SQL и персональные данные — только код/сообщение.
  console.error("Необработанная ошибка сервера:", err?.code ?? err?.message);
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

