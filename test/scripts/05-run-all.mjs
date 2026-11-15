// Запуск ВСЕХ тестов одной командой: API (Vitest) + UI (Playwright).
// Оба набора запускаются всегда (дефект-тесты намеренно красные, поэтому `&&`
// остановил бы прогон после API). Итог пишется в test/tmp/05-run-all-summary.json.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOG = path.join(TEST_DIR, "tmp", "05-run-all.log");
const SUMMARY = path.join(TEST_DIR, "tmp", "05-run-all-summary.json");

const ANSI = /\u001b\[[0-9;]*m/g;
const strip = (text) => text.replace(ANSI, "");

function run(label, command, lines) {
  console.log(`▶ ${label}: ${command}`);
  fs.appendFileSync(LOG, `▶ ${label}: ${command}\n`, "utf8");

  const result = spawnSync(command, {
    cwd: TEST_DIR,
    shell: true,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });

  const output = strip(`${result.stdout ?? ""}${result.stderr ?? ""}`).trimEnd();
  lines.push(`### ${label}: ${command}`);
  lines.push(output);

  // Пишем сразу после каждого набора: видно прогресс, даже если прогон прервётся.
  fs.appendFileSync(LOG, `${output}\n\n`, "utf8");
  console.log(`■ ${label}: код выхода ${result.status ?? 1}`);

  return { label, command, exitCode: result.status ?? 1, output };
}

function parseVitest(output) {
  const match = output.match(/Tests\s+(?:(\d+) failed\s*\|\s*)?(\d+) passed\s*\((\d+)\)/);
  if (!match) return null;

  return { failed: Number(match[1] ?? 0), passed: Number(match[2]), total: Number(match[3]) };
}

function parsePlaywright(output) {
  const passed = output.match(/^\s+(\d+) passed/m);
  const failed = output.match(/^\s+(\d+) failed/m);
  if (!passed && !failed) return null;

  const passedCount = Number(passed?.[1] ?? 0);
  const failedCount = Number(failed?.[1] ?? 0);

  return { passed: passedCount, failed: failedCount, total: passedCount + failedCount };
}

fs.mkdirSync(path.join(TEST_DIR, "tmp"), { recursive: true });
fs.writeFileSync(LOG, "", "utf8");

const lines = [];
const api = run("API (Vitest)", "npm run test:api", lines);
const ui = run("UI (Playwright)", "npm run test:ui", lines);


const apiStats = parseVitest(api.output);
const uiStats = parsePlaywright(ui.output);

const totals = {
  createdAt: new Date().toISOString(),
  runs: [
    { name: "API (Vitest)", command: api.command, exitCode: api.exitCode, ...(apiStats ?? {}) },
    { name: "UI (Playwright)", command: ui.command, exitCode: ui.exitCode, ...(uiStats ?? {}) },
  ],
};

const totalAll = (apiStats?.total ?? 0) + (uiStats?.total ?? 0);
const failedAll = (apiStats?.failed ?? 0) + (uiStats?.failed ?? 0);

Object.assign(totals, {
  total: totalAll,
  failed: failedAll,
  passed: totalAll - failedAll,
  log: "test/tmp/05-run-all.log",
});

fs.writeFileSync(SUMMARY, JSON.stringify(totals, null, 2), "utf8");

console.log("— Итог прогона —");
for (const item of totals.runs) {
  const stats = item.total ? `${item.passed} passed / ${item.failed} failed / ${item.total} всего` : "статистика не распознана";
  console.log(`${item.name}: ${stats} (код выхода ${item.exitCode})`);
}
console.log(`Всего: ${totals.passed} passed / ${totals.failed} failed / ${totals.total} тестов`);
console.log("Полный вывод: test/tmp/05-run-all.log");

// Ненулевой код — потому что дефект-тесты пока красные (это ожидаемое состояние).
process.exitCode = failedAll > 0 ? 1 : 0;
