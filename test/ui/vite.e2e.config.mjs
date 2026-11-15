// Vite-конфиг только для UI-тестов.
// Не заменяет корневой vite.config.js: root остаётся корнем проекта,
// но кеш пишется внутрь test/tmp, чтобы не менять файлы вне test/.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const BACKEND_PORT = 3104;
const FRONTEND_PORT = 5174;

export default defineConfig({
  root: ROOT,
  cacheDir: path.join(ROOT, "test", "tmp", "04-vite-cache"),
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: FRONTEND_PORT,
    strictPort: true,
    // Браузер не может обратиться к бэкенду на localhost:3000 (там чужой
    // dev-сервер), поэтому все перехваченные запросы идут сюда и
    // проксируются на тестовый бэкенд: same-origin => без CORS.
    proxy: {
      "/__e2e-api": {
        target: `http://127.0.0.1:${BACKEND_PORT}`,
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/__e2e-api/, ""),
      },
    },
  },
});
