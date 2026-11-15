import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  formatAxisDate,
  formatAxisPrice,
  formatPrice,
  formatTooltipDate,
} from "../formatPrice.js";
import "./PriceChart.css";

const CHART_COLORS = {
  light: { growth: "#3b7a57", fall: "#b85042" },
  dark: { growth: "#529471", fall: "#c96f63" },
};

const PADDING_TOP = 18;
const PADDING_BOTTOM = 30;
const PADDING_RIGHT = 14;
const Y_TICKS = 5;

function getPaddingLeft(width) {
  return width < 480 ? 56 : 70;
}

function samplePoints(points, maxPoints) {
  if (points.length <= maxPoints) return points;

  const step = (points.length - 1) / (maxPoints - 1);
  const sampled = [];

  for (let index = 0; index < maxPoints; index += 1) {
    sampled.push(points[Math.round(index * step)]);
  }

  return sampled;
}

export default function PriceChart({ data, theme, rangeKey }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hoverIndex, setHoverIndex] = useState(null);
  const rawId = useId();
  const gradientId = `price-chart-gradient-${rawId.replace(
    /[^a-zA-Z0-9_-]/g,
    "",
  )}`;

  useEffect(() => {
    const node = containerRef.current;

    if (!node) return undefined;

    const updateSize = () => {
      setSize({ width: node.clientWidth, height: node.clientHeight });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    if (!data || data.length < 2) return null;

    const width = size.width > 0 ? size.width : 720;
    const height = size.height > 0 ? size.height : 320;
    const left = getPaddingLeft(width);
    const top = PADDING_TOP;
    const plotWidth = Math.max(width - left - PADDING_RIGHT, 10);
    const plotHeight = Math.max(height - top - PADDING_BOTTOM, 10);

    const firstTimestamp = data[0][0];
    const lastTimestamp = data[data.length - 1][0];

    if (!Number.isFinite(firstTimestamp) || firstTimestamp === lastTimestamp) {
      return null;
    }

    let minPrice = Infinity;
    let maxPrice = -Infinity;

    for (const [, price] of data) {
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;
    }

    if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
      return null;
    }

    if (minPrice === maxPrice) {
      const delta = Math.abs(minPrice) * 0.05 || 1;
      minPrice -= delta;
      maxPrice += delta;
    }

    const pricePadding = (maxPrice - minPrice) * 0.08;
    minPrice = Math.max(0, minPrice - pricePadding);
    maxPrice += pricePadding;

    const xScale = (timestamp) =>
      left +
      ((timestamp - firstTimestamp) / (lastTimestamp - firstTimestamp)) *
        plotWidth;
    const yScale = (price) =>
      top + (1 - (price - minPrice) / (maxPrice - minPrice)) * plotHeight;

    const sampled = samplePoints(data, Math.max(80, Math.round(plotWidth)));
    const linePath = sampled
      .map(([timestamp, price], index) => {
        const x = xScale(timestamp).toFixed(2);
        const y = yScale(price).toFixed(2);
        return `${index === 0 ? "M" : "L"}${x} ${y}`;
      })
      .join(" ");

    const baseline = top + plotHeight;
    const areaPath = `${linePath} L${xScale(lastTimestamp).toFixed(
      2,
    )} ${baseline.toFixed(2)} L${xScale(firstTimestamp).toFixed(
      2,
    )} ${baseline.toFixed(2)} Z`;

    const yTicks = Array.from({ length: Y_TICKS }, (_, index) => {
      const value =
        minPrice + ((maxPrice - minPrice) * index) / (Y_TICKS - 1);

      return { value, y: yScale(value) };
    });

    const xTickCount = width >= 760 ? 6 : width >= 540 ? 5 : 4;
    let xTickTimestamps = [];

    if (rangeKey === "6y") {
      const firstYear = new Date(firstTimestamp).getFullYear() + 1;
      const lastYear = new Date(lastTimestamp).getFullYear();
      const yearTicks = [];

      for (let year = firstYear; year <= lastYear; year += 1) {
        yearTicks.push(new Date(year, 0, 1).getTime());
      }

      const step = Math.max(1, Math.ceil(yearTicks.length / xTickCount));

      xTickTimestamps = yearTicks.filter(
        (_, index) => index % step === 0 || index === yearTicks.length - 1,
      );
    }

    if (xTickTimestamps.length < 2) {
      xTickTimestamps = Array.from({ length: xTickCount }, (_, index) => {
        return (
          firstTimestamp +
          ((lastTimestamp - firstTimestamp) * index) / (xTickCount - 1)
        );
      });
    }

    const xTicks = xTickTimestamps.map((timestamp) => {
      const tickX = xScale(timestamp);

      return {
        timestamp,
        x: tickX,
        label: formatAxisDate(timestamp, rangeKey),
        anchor:
          tickX <= left + 24
            ? "start"
            : tickX >= left + plotWidth - 24
              ? "end"
              : "middle",
      };
    });

    return {
      width,
      height,
      left,
      top,
      plotWidth,
      plotHeight,
      linePath,
      areaPath,
      yTicks,
      xTicks,
      xScale,
      yScale,
    };
  }, [data, rangeKey, size.height, size.width]);

  const growth =
    data && data.length > 1 ? data[data.length - 1][1] >= data[0][1] : true;
  const colors = CHART_COLORS[theme ? "light" : "dark"];
  const stroke = growth ? colors.growth : colors.fall;

  const handlePointerMove = (event) => {
    if (!geometry || !data || data.length < 2) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const ratio = (pointerX - geometry.left) / geometry.plotWidth;
    const clampedRatio = Math.min(1, Math.max(0, ratio));
    const index = Math.round(clampedRatio * (data.length - 1));

    setHoverIndex(index);
  };

  const hoverPoint =
    hoverIndex !== null && data && data[hoverIndex] ? data[hoverIndex] : null;

  const hover =
    hoverPoint && geometry
      ? {
          timestamp: hoverPoint[0],
          price: hoverPoint[1],
          x: geometry.xScale(hoverPoint[0]),
          y: geometry.yScale(hoverPoint[1]),
        }
      : null;

  const chartWidth = size.width > 0 ? size.width : 720;
  const chartHeight = size.height > 0 ? size.height : 320;
  const tooltipOnLeft = hover ? hover.x + 170 > chartWidth : false;
  const tooltipTop = hover
    ? Math.min(Math.max(hover.y, 44), Math.max(chartHeight - 44, 44))
    : 0;

  return (
    <div
      ref={containerRef}
      className={`priceChart ${theme ? "" : "priceChart-dark"}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHoverIndex(null)}
    >
      {geometry && (
        <svg
          className="priceChartSvg"
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          role="img"
          aria-label="График изменения цены"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.32" />
              <stop offset="90%" stopColor={stroke} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {geometry.yTicks.map((tick) => (
            <g key={tick.y}>
              <line
                className="priceChartGridLine"
                x1={geometry.left}
                x2={geometry.left + geometry.plotWidth}
                y1={tick.y}
                y2={tick.y}
              />
              <text
                className="priceChartAxisLabel"
                x={geometry.left - 10}
                y={tick.y}
                dy="0.32em"
                textAnchor="end"
              >
                {formatAxisPrice(tick.value)}
              </text>
            </g>
          ))}

          {geometry.xTicks.map((tick) => (
            <text
              key={tick.timestamp}
              className="priceChartAxisLabel"
              x={tick.x}
              y={geometry.top + geometry.plotHeight + 22}
              textAnchor={tick.anchor}
            >
              {tick.label}
            </text>
          ))}

          <path d={geometry.areaPath} fill={`url(#${gradientId})`} />
          <path
            className="priceChartLine"
            d={geometry.linePath}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="1"
          />

          {hover && (
            <g>
              <line
                className="priceChartCrosshair"
                x1={hover.x}
                x2={hover.x}
                y1={geometry.top}
                y2={geometry.top + geometry.plotHeight}
              />
              <line
                className="priceChartCrosshair priceChartCrosshair--horizontal"
                x1={geometry.left}
                x2={geometry.left + geometry.plotWidth}
                y1={hover.y}
                y2={hover.y}
              />
              <circle
                cx={hover.x}
                cy={hover.y}
                r="9"
                fill={stroke}
                fillOpacity="0.18"
              />
              <circle
                className="priceChartDot"
                cx={hover.x}
                cy={hover.y}
                r="4.5"
                fill={stroke}
                stroke={theme ? "#fcf8eb" : "#1e293b"}
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      )}

      {hover && (
        <div
          className={`priceChartTooltip ${
            tooltipOnLeft ? "priceChartTooltip--left" : ""
          }`}
          style={{
            left: tooltipOnLeft ? hover.x - 14 : hover.x + 14,
            top: tooltipTop,
          }}
        >
          <span className="priceChartTooltipDate">
            {formatTooltipDate(hover.timestamp, rangeKey)}
          </span>
          <span className="priceChartTooltipPrice">
            ${formatPrice(hover.price)}
          </span>
        </div>
      )}
    </div>
  );
}
