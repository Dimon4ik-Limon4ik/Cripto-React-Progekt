import { formatPrice } from "../CoinPage/formatPrice.js";

function isEmptyValue(value) {
  return value === null || value === undefined || value === "";
}

// Денежное значение с полной точностью — для цен, максимумов и ATH.
export function formatMoney(value) {
  if (isEmptyValue(value)) return "—";

  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return `$${formatPrice(number)}`;
}

// Компактные значения для капитализации и объёма торгов.
export function formatCompactMoney(value) {
  if (isEmptyValue(value)) return "—";

  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  const abs = Math.abs(number);
  const format = (divider, suffix) =>
    `$${(number / divider).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })}${suffix}`;

  if (abs >= 1_000_000_000_000) return format(1_000_000_000_000, "T");
  if (abs >= 1_000_000_000) return format(1_000_000_000, "B");
  if (abs >= 1_000_000) return format(1_000_000, "M");
  if (abs >= 1_000) return format(1_000, "K");

  return `$${formatPrice(number)}`;
}

// Дата исторического максимума в коротком русском формате.
export function formatShortDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
