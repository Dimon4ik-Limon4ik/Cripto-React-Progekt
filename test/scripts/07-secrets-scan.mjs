// Проверка артефактов test/: в них не должно быть значений секретов и дампов БД.
// Скрипт ничего не печатает из secrets/.env — только количества совпадений.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEST_DIR = path.join(ROOT, "test");
const ENV_PATH = path.join(ROOT, "secrets", ".env");
const TEXT_EXTENSIONS = new Set([".md", ".js", ".mjs", ".json", ".txt", ".log", ".html", ".css"]);

function cleanValue(raw) {
  let value = String(raw ?? "").trim();
  if (
    value.length >= 2 &&
    (value[0] === '"' || value[0] === "'") &&
    value.endsWith(value[0])
  ) {
    value = value.slice(1, -1);
  }
  if (value.endsWith(";")) {
    value = value.slice(0, -1);
  }
  return value;
}

const secretValues = fs
  .readFileSync(ENV_PATH, "utf8")
  .split(/\r?\n/)
  .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
  .map((line) => ({
    key: line.slice(0, line.indexOf("=")).trim(),
    value: cleanValue(line.slice(line.indexOf("=") + 1)),
  }))
  .filter((item) => item.value.length >= 6);

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

const files = walk(TEST_DIR);
const scanned = [];
const withSecrets = [];
const withWeakMatches = [];
const dumps = [];

// Строка подключения с учётными данными (user:password@) — недопустима в артефактах.
const CREDENTIALS_URL = /postgres(?:ql)?:\/\/[^\s"'`/:]+:[^\s"'`/@]+@/i;

for (const file of files) {
  const extension = path.extname(file).toLowerCase();

  if ([".dump", ".sql", ".backup", ".tar"].includes(extension)) {
    dumps.push(path.relative(ROOT, file));
  }

  if (!TEXT_EXTENSIONS.has(extension)) {
    continue;
  }

  const stat = fs.statSync(file);
  if (stat.size > 3 * 1024 * 1024) {
    continue;
  }

  const text = fs.readFileSync(file, "utf8");
  scanned.push(file);

  const relative = path.relative(ROOT, file);

  if (CREDENTIALS_URL.test(text)) {
    withSecrets.push({ file: relative, keys: "строка подключения с паролем" });
    continue;
  }

  // Сильные значения (>= 12 символов) не должны встречаться вообще.
  const strongKeys = secretValues
    .filter((item) => item.value.length >= 12 && text.includes(item.value))
    .map((item) => item.key);

  if (strongKeys.length > 0) {
    withSecrets.push({ file: relative, keys: strongKeys.join(", ") });
    continue;
  }

  // Короткие/словарные значения (например, имя роли, совпадающее со словом
  // "postgres" в схеме URL) фиксируем отдельно как слабое совпадение.
  const weakItems = secretValues.filter(
    (item) => item.value.length < 12 && text.includes(item.value),
  );

  if (weakItems.length > 0) {
    // Если после удаления слова "postgres" (схема URL / имя служебной БД)
    // совпадений не остаётся, значение — просто словарное слово.
    const withoutGeneric = text.replace(/postgres/gi, "");
    const explained = weakItems.every((item) => !withoutGeneric.includes(item.value));

    withWeakMatches.push({
      file: relative,
      keys: weakItems.map((item) => item.key).join(", "),
      explained,
    });
  }
}

const leftovers = fs
  .readdirSync(os.tmpdir(), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("crypto-stage7-"))
  .map((entry) => entry.name);

console.log(`просканировано текстовых файлов в test/: ${scanned.length}`);
console.log(`файлов с реальными секретами (сильные значения / строки подключения): ${withSecrets.length}`);
for (const item of withSecrets) {
  console.log(`  ${item.file}: ${item.keys}`);
}
console.log(`файлов со слабыми совпадениями (короткие словарные значения): ${withWeakMatches.length}`);
for (const item of withWeakMatches) {
  const note = item.explained
    ? "объясняется словом postgres в схеме URL/имени служебной БД"
    : "НЕ объясняется словарным словом — проверить вручную";
  console.log(`  ${item.file}: [${item.keys}] — ${note}`);
}

const unexplained = withWeakMatches.filter((item) => !item.explained).length;
console.log(`дампов/дамп-подобных файлов в test/: ${dumps.length}`);
for (const dump of dumps) {
  console.log(`  ${dump}`);
}
console.log(`временных папок crypto-stage7-* вне проекта: ${leftovers.length}`);
for (const name of leftovers) {
  console.log(`  ${name}`);
}

process.exitCode =
  withSecrets.length === 0 && dumps.length === 0 && leftovers.length === 0 && unexplained === 0
    ? 0
    : 1;
