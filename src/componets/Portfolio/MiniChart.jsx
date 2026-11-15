import { useId } from "react";
import "./MiniChart.css";

const CHART_COLORS = {
  light: { growth: "#3b7a57", fall: "#b85042" },
  dark: { growth: "#529471", fall: "#c96f63" },
};

const VIEW_WIDTH = 180;
const VIEW_HEIGHT = 64;
const PADDING_X = 6;
const PADDING_Y = 7;

function samplePoints(points, maxPoints) {
  if (points.length <= maxPoints) return points;

  const step = (points.length - 1) / (maxPoints - 1);
  const sampled = [];

  for (let index = 0; index < maxPoints; index += 1) {
    sampled.push(points[Math.round(index * step)]);
  }

  return sampled;
}

function EmptyChart() {
  return (
    <div className="miniChart miniChart-empty" aria-hidden="true">
      <span className="miniChartEmptyLine" />
    </div>
  );
}

export default function MiniChart({ data, theme, status = "ready" }) {
  const rawId = useId();
  const gradientId = `mini-chart-gradient-${rawId.replace(
    /[^a-zA-Z0-9_-]/g,
    "",
  )}`;

  if (status === "loading") {
    return (
      <div className="miniChart miniChart-placeholder" aria-hidden="true">
        <span className="miniChartSkeleton" />
      </div>
    );
  }

  if (!Array.isArray(data) || data.length < 2) {
    return <EmptyChart />;
  }

  const firstTimestamp = data[0][0];
  const lastTimestamp = data[data.length - 1][0];

  if (
    !Number.isFinite(firstTimestamp) ||
    !Number.isFinite(lastTimestamp)
  ) {
    return <EmptyChart />;
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;

  for (const [, price] of data) {
    if (price < minPrice) minPrice = price;
    if (price > maxPrice) maxPrice = price;
  }

  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
    return <EmptyChart />;
  }

  if (minPrice === maxPrice) {
    const delta = Math.abs(minPrice) * 0.05 || 1;
    minPrice -= delta;
    maxPrice += delta;
  }

  const timeSpan = lastTimestamp - firstTimestamp || 1;
  const plotWidth = VIEW_WIDTH - PADDING_X * 2;
  const plotHeight = VIEW_HEIGHT - PADDING_Y * 2;
  const xScale = (timestamp) =>
    PADDING_X + ((timestamp - firstTimestamp) / timeSpan) * plotWidth;
  const yScale = (price) =>
    PADDING_Y + (1 - (price - minPrice) / (maxPrice - minPrice)) * plotHeight;

  const sampled = samplePoints(data, 120);
  const linePath = sampled
    .map(([timestamp, price], index) => {
      const x = xScale(timestamp).toFixed(2);
      const y = yScale(price).toFixed(2);
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");

  const baseline = VIEW_HEIGHT - PADDING_Y;
  const firstX = xScale(firstTimestamp).toFixed(2);
  const lastX = xScale(lastTimestamp).toFixed(2);
  const areaPath = `${linePath} L${lastX} ${baseline} L${firstX} ${baseline} Z`;

  const growth = data[data.length - 1][1] >= data[0][1];
  const colors = CHART_COLORS[theme ? "light" : "dark"];
  const stroke = growth ? colors.growth : colors.fall;

  return (
    <div className="miniChart" aria-hidden="true">
      <svg
        className="miniChartSvg"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          className="miniChartLine"
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
