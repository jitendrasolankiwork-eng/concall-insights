/**
 * MarketTicker.tsx
 *
 * Scrolling marquee bar showing live NIFTY 50, SENSEX, BANK NIFTY prices.
 * Fetches from /api/price/indices/all (60s polling, 60s backend cache).
 * Pauses on hover. Disappears silently if data is unavailable.
 */

import { useState, useEffect } from "react";

interface IndexData {
  label     : string;
  price     : number;
  change    : number;
  changePct : number;
  isPositive: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits : 2,
    maximumFractionDigits : 2,
  }).format(n);

export default function MarketTicker() {
  const [indices, setIndices] = useState<IndexData[]>([]);

  const load = async () => {
    try {
      const resp = await fetch("/api/price/indices/all");
      const data = await resp.json();
      if (data.success && Array.isArray(data.indices) && data.indices.length > 0) {
        setIndices(data.indices);
      }
    } catch {
      // Fail silently — ticker just stays hidden or shows last data
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  if (indices.length === 0) return null;

  // Duplicate for seamless infinite loop (translate -50% = one full copy)
  const items = [...indices, ...indices];

  return (
    <div
      className="bg-muted border-b border-border overflow-hidden"
      style={{ height: "28px" }}
      aria-label="Live market indices"
    >
      <div className="market-ticker-track h-full">
        {items.map((idx, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-5 h-full whitespace-nowrap shrink-0"
          >
            {/* Separator dot */}
            {i > 0 && (
              <span className="w-1 h-1 rounded-full bg-border shrink-0" />
            )}
            <span className="text-2xs font-semibold text-text-muted">
              {idx.label}
            </span>
            <span className="text-2xs font-bold text-text-primary">
              {fmt(idx.price)}
            </span>
            <span
              className={`text-2xs font-medium ${
                idx.isPositive ? "text-signal-green" : "text-signal-red"
              }`}
            >
              {idx.isPositive ? "▲" : "▼"} {Math.abs(idx.changePct).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
