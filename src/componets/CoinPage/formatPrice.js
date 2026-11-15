export function formatPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  const abs = Math.abs(number);
  let options;

  if (abs === 0) {
    options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  } else if (abs < 0.0001) {
    options = { maximumSignificantDigits: 4 };
  } else if (abs < 0.01) {
    options = { minimumFractionDigits: 6, maximumFractionDigits: 8 };
  } else if (abs < 1) {
    options = { minimumFractionDigits: 4, maximumFractionDigits: 4 };
  } else {
    options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  }

  return number.toLocaleString("en-US", options);
}

export function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  const sign = number > 0 ? "+" : number < 0 ? "-" : "";
  const formatted = Math.abs(number).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${sign}${formatted}%`;
}

export function formatAxisPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "";

  const abs = Math.abs(number);

  if (abs >= 1_000_000_000) {
    return `${(number / 1_000_000_000).toLocaleString("en-US", {
      maximumFractionDigits: 1,
    })}B`;
  }

  if (abs >= 1_000_000) {
    return `${(number / 1_000_000).toLocaleString("en-US", {
      maximumFractionDigits: 1,
    })}M`;
  }

  if (abs >= 1000) {
    return number.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  if (abs >= 1) {
    return number.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  if (abs >= 0.01) {
    return number.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }

  if (abs === 0) return "0";

  return number.toPrecision(3);
}

export function formatAxisDate(timestamp, rangeKey) {
  const date = new Date(timestamp);

  if (rangeKey === "1d") {
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (rangeKey === "7d" || rangeKey === "30d") {
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  }

  if (rangeKey === "1y") {
    return date.toLocaleDateString("ru-RU", {
      month: "short",
      year: "2-digit",
    });
  }

  return date.toLocaleDateString("ru-RU", { year: "numeric" });
}

export function formatTooltipDate(timestamp, rangeKey) {
  const date = new Date(timestamp);

  if (rangeKey === "1d" || rangeKey === "7d" || rangeKey === "30d") {
    return date.toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
