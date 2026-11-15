// Проверка test/ на секреты и персональные данные.
// ВАЖНО: значения совпадений НЕ выводятся и НЕ сохраняются — только правило,
// файл и номер строки. Запуск: cd test && npm run scan:secrets
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_JSON = path.join(TEST_DIR, "tmp", "05-secrets-scan.json");
const SKIP_DIRS = new Set(["node_modules", ".git", "05-vite-cache", "04-vite-cache"]);

// Домены, которые разрешены: синтетические тестовые адреса и примеры в документации.
const ALLOWED_EMAIL_DOMAINS = ["@vitest.local", "@example.com", "@example.test", "@example.org"];

const TEXT_RULES = [
  { id: "pg-connection-string", severity: "critical", re: /postgres(?:ql)?:\/\/[^\s"'`)]+/g },
  { id: "secret-env-assignment", severity: "critical", re: /\b(?:SECRET_KEY|JWT_SECRET|passwordBD|UserBD)\s*[:=]\s*["'`][^"'`]{3,}["'`]/g },
  { id: "bearer-token", severity: "critical", re: /\bBearer\s+[A-Za-z0-9._-]{20,}/g },
  { id: "jwt-like", severity: "critical", re: /\beyJ[A-Za-z0-9_-]{10,}/g },
  { id: "api-key", severity: "critical", re: /\bCG-[A-Za-z0-9]{10,}\b/g },
  { id: "env-var-name", severity: "info", re: /\bprocess\.env\.(?:SECRET_KEY|JWT_SECRET|passwordBD|UserBD)\b/g },
];

// Значение из шаблона `${...}` — не секрет: подставляется в рантайме из env.
function isTemplateMatch(match) {
  return match.includes("${");
}

// Заполнитель вида CG-xxxxxxx или CG-0000000 — не ключ.
function isPlaceholderKey(match) {
  return /^CG-(.)\1+$/.test(match);
}


const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BINARY_HINTS = ["eyJ", "postgres://", "postgresql://", "Bearer", "SECRET_KEY", "passwordBD"];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }

  return files;
}

function isText(buffer) {
  const sample = buffer.subarray(0, 4096);
  return !sample.includes(0);
}

function scanText(relative, content, findings) {
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const rule of TEXT_RULES) {
      const hits = line.match(rule.re) ?? [];

      for (const hit of hits) {
        // Шаблоны и заполнители понижаем до info: значений секретов в них нет.
        const isTemplate = rule.id === "pg-connection-string" && isTemplateMatch(hit);
        const isPlaceholder = rule.id === "api-key" && isPlaceholderKey(hit);
        const severity = isTemplate || isPlaceholder ? "info" : rule.severity;
        const id = isTemplate
          ? "pg-connection-template"
          : isPlaceholder
            ? "api-key-placeholder"
            : rule.id;

        findings.push({ rule: id, severity, file: relative, line: index + 1, count: 1 });
      }
    }

    const emails = line.match(EMAIL_RE) ?? [];
    const foreign = emails.filter(
      (email) => !ALLOWED_EMAIL_DOMAINS.some((domain) => email.toLowerCase().endsWith(domain)),
    );

    if (foreign.length > 0) {
      findings.push({ rule: "email-outside-allowed", severity: "critical", file: relative, line: index + 1, count: foreign.length });
    }
  });
}

function scanBinary(relative, buffer, findings) {
  // Для изображений проверяем только наличие ASCII-маркеров, без вывода данных.
  const text = buffer.toString("latin1");
  for (const hint of BINARY_HINTS) {
    if (text.includes(hint)) {
      findings.push({ rule: `binary:${hint}`, severity: "critical", file: relative, line: 0, count: 1 });
    }
  }
  if (text.includes("@") && text.includes(".local")) {
    findings.push({ rule: "binary:email-local", severity: "info", file: relative, line: 0, count: 1 });
  }
}

const findings = [];
for (const file of walk(TEST_DIR)) {
  const relative = path.relative(TEST_DIR, file).replace(/\\/g, "/");
  const buffer = fs.readFileSync(file);

  if (isText(buffer)) {
    scanText(relative, buffer.toString("utf8"), findings);
  } else {
    scanBinary(relative, buffer, findings);
  }
}

const critical = findings.filter((item) => item.severity === "critical");
const info = findings.filter((item) => item.severity === "info");
const byRule = {};

for (const item of findings) {
  byRule[item.rule] ??= { critical: 0, info: 0, files: new Set() };
  byRule[item.rule][item.severity] += 1;
  byRule[item.rule].files.add(item.file);
}

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(
  OUT_JSON,
  JSON.stringify(
    {
      scannedAt: new Date().toISOString(),
      root: "test/",
      filesScanned: walk(TEST_DIR).length,
      criticalFindings: critical.length,
      infoFindings: info.length,
      byRule: Object.fromEntries(
        Object.entries(byRule).map(([rule, value]) => [
          rule,
          { critical: value.critical, info: value.info, files: [...value.files].sort() },
        ]),
      ),
      // Значения совпадений намеренно не сохраняются.
      critical,
      info,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`Файлов проверено: ${walk(TEST_DIR).length}`);
console.log(`Критичных находок: ${critical.length}`);
console.log(`Информационных (имена переменных окружения, служебные пометки): ${info.length}`);

if (critical.length > 0) {
  console.log("Правило | Файл:строка | Совпадений");
  for (const item of critical) {
    console.log(`${item.rule} | ${item.file}:${item.line} | ${item.count}`);
  }
  process.exitCode = 2;
}
