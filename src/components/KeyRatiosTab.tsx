/**
 * KeyRatiosTab.tsx — Tab 3
 * Four cards: Valuation / Profitability / Leverage / Growth
 * + 52-week range bar
 * Data: fundamentals endpoint (Screener.in) + AI valuationEstimate
 */

import { useState, useEffect } from "react";
import { fetchFundamentals } from "@/lib/api";

interface Props {
  symbol           : string;
  visible          : boolean;
  valuationEstimate: any;   // from AI pipeline
  currentPrice     : number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v: number | null, suffix = "", prefix = ""): string {
  if (v === null || v === undefined) return "—";
  return `${prefix}${v.toLocaleString("en-IN")}${suffix}`;
}

function colorClass(
  value    : number | null,
  thresholds: { green: number; amber: number }, // ≥green=green, ≥amber=amber, else red
  direction: "higher" | "lower" = "higher"       // "lower" inverts (D/E ratio)
): string {
  if (value === null) return "text-text-primary";
  if (direction === "higher") {
    if (value >= thresholds.green) return "text-signal-green font-bold";
    if (value >= thresholds.amber) return "text-signal-amber font-bold";
    return "text-signal-red font-bold";
  } else {
    if (value <= thresholds.green) return "text-signal-green font-bold";
    if (value <= thresholds.amber) return "text-signal-amber font-bold";
    return "text-signal-red font-bold";
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function RatioRow({ label, value, cls = "text-text-primary", note }: {
  label: string; value: string; cls?: string; note?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div>
        <p className="text-xs text-text-secondary">{label}</p>
        {note && <p className="text-2xs text-text-muted">{note}</p>}
      </div>
      <span className={`text-xs ${cls}`}>{value}</span>
    </div>
  );
}

function RatioCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-base p-4">
      <p className="text-xs font-bold text-text-primary mb-3 pb-2 border-b border-border">{title}</p>
      {children}
    </div>
  );
}

function RangeBar({ low, high, current }: { low: number | null; high: number | null; current: number | null }) {
  if (!low || !high || !current) return <p className="text-2xs text-text-muted">52W data not available</p>;
  const pct     = Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100));
  const qPct    = pct < 33 ? "text-signal-red" : pct < 67 ? "text-signal-amber" : "text-signal-green";
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-2xs text-text-muted">
        <span>52W Low: ₹{low.toLocaleString("en-IN")}</span>
        <span>52W High: ₹{high.toLocaleString("en-IN")}</span>
      </div>
      <div className="relative h-2 bg-muted rounded-full">
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-signal-red via-signal-amber to-signal-green rounded-full" style={{ width: "100%" }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-foreground shadow-sm"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <p className={`text-xs text-center font-semibold ${qPct}`}>
        ₹{current.toLocaleString("en-IN")} — {pct.toFixed(0)}% from 52W low
      </p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="card-base p-4 space-y-2 animate-pulse">
      <div className="h-4 bg-muted rounded w-24 mb-3" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex justify-between py-2 border-b border-border/50">
          <div className="h-3 bg-muted rounded w-28" />
          <div className="h-3 bg-muted rounded w-14" />
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function KeyRatiosTab({ symbol, visible, valuationEstimate, currentPrice }: Props) {
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!visible || fetched) return;
    setFetched(true);
    setLoading(true);
    fetchFundamentals(symbol)
      .then((r) => {
        if (r.success && r.data) setData(r.data);
        else setError(r.error || "Failed to load");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [visible, fetched, symbol]);

  if (!visible) return null;

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );

  if (error) return (
    <div className="card-base p-6 text-center">
      <p className="text-sm text-signal-red">⚠ {error}</p>
    </div>
  );

  if (!data) return null;

  // Forward PE from AI estimate
  const fwdPeRange = valuationEstimate?.peRange
    ? `${valuationEstimate.peRange.low}–${valuationEstimate.peRange.high}x`
    : "—";

  const deRatio = data.balanceSheet?.debtToEquity?.at(-2) ?? null; // latest annual (not TTM)

  // Growth CAGR from P&L
  const cagr = data.cagr || {};

  return (
    <div className="space-y-4">

      {/* 52-week range bar */}
      {(data.high52w || data.low52w) && (
        <div className="card-base p-4">
          <p className="text-xs font-bold text-text-primary mb-3">52-Week Price Range</p>
          <RangeBar
            low={data.low52w}
            high={data.high52w}
            current={currentPrice ?? data.currentPrice}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Valuation */}
        <RatioCard title="Valuation">
          <RatioRow label="Market Cap"      value={data.marketCap    != null ? `₹${data.marketCap.toLocaleString("en-IN")} Cr` : "—"} />
          <RatioRow label="Trailing P/E"   value={fmt(data.pe, "x")} />
          <RatioRow label="Forward P/E"    value={fwdPeRange}        note="AI estimate" />
          <RatioRow label="Book Value"     value={data.bookValue    != null ? `₹${fmt(data.bookValue)}` : "—"} />
          <RatioRow label="EPS (latest yr)" value={(() => {
            const pl = data.profitLoss;
            if (!pl?.eps) return "—";
            const vals = pl.eps.slice(0, -1).filter((v: any) => v !== null);
            if (!vals.length) return "—";
            return `₹${vals[vals.length - 1]}`;
          })()} />
          <RatioRow label="Dividend Yield" value={fmt(data.dividendYield, "%")} />
        </RatioCard>

        {/* Profitability */}
        <RatioCard title="Profitability">
          <RatioRow
            label="ROCE"
            value={fmt(data.roce, "%")}
            cls={colorClass(data.roce, { green: 15, amber: 10 })}
          />
          <RatioRow
            label="ROE"
            value={fmt(data.roe, "%")}
            cls={colorClass(data.roe, { green: 15, amber: 10 })}
          />
          <RatioRow
            label="OPM (latest yr)"
            value={(() => {
              const pl = data.profitLoss;
              if (!pl) return "—";
              // Take last non-TTM opm value
              const opmVals = pl.opm?.slice(0, -1).filter((v: any) => v !== null);
              if (!opmVals?.length) return "—";
              return `${opmVals[opmVals.length - 1]}%`;
            })()}
          />
          <RatioRow label="Face Value" value={data.faceValue != null ? `₹${data.faceValue}` : "—"} />
        </RatioCard>

        {/* Leverage */}
        <RatioCard title="Leverage">
          <RatioRow
            label="Debt / Equity (latest yr)"
            value={fmt(deRatio, "x")}
            cls={colorClass(deRatio, { green: 1, amber: 2 }, "lower")}
          />
          <RatioRow
            label="Interest Coverage (latest yr)"
            value={(() => {
              const pl = data.profitLoss;
              if (!pl?.interestCoverage) return "—";
              const vals = pl.interestCoverage.slice(0, -1).filter((v: any) => v !== null);
              if (!vals.length) return "—";
              return `${vals[vals.length - 1]}x`;
            })()}
            cls={(() => {
              const pl = data.profitLoss;
              if (!pl?.interestCoverage) return "text-text-primary";
              const vals = pl.interestCoverage.slice(0, -1).filter((v: any) => v !== null);
              const v = vals.length ? vals[vals.length - 1] : null;
              return colorClass(v, { green: 5, amber: 2 });
            })()}
            note="Op. Profit ÷ Interest"
          />
          <RatioRow
            label="Borrowings (latest yr)"
            value={(() => {
              const bs = data.balanceSheet;
              if (!bs) return "—";
              const vals = bs.borrowings?.slice(0, -1).filter((v: any) => v !== null);
              if (!vals?.length) return "—";
              return `₹${vals[vals.length - 1].toLocaleString("en-IN")} Cr`;
            })()}
          />
          <RatioRow
            label="Reserves (latest yr)"
            value={(() => {
              const bs = data.balanceSheet;
              if (!bs) return "—";
              const vals = bs.reserves?.slice(0, -1).filter((v: any) => v !== null);
              if (!vals?.length) return "—";
              return `₹${vals[vals.length - 1].toLocaleString("en-IN")} Cr`;
            })()}
          />
        </RatioCard>

        {/* Growth CAGR */}
        <RatioCard title="Growth CAGR">
          <RatioRow label="Revenue 3Y" value={fmt(cagr.revenue3Y, "%")} cls={colorClass(cagr.revenue3Y, { green: 15, amber: 8 })} />
          <RatioRow label="Revenue 5Y" value={fmt(cagr.revenue5Y, "%")} cls={colorClass(cagr.revenue5Y, { green: 15, amber: 8 })} />
          <RatioRow label="PAT 3Y"     value={fmt(cagr.profit3Y,  "%")} cls={colorClass(cagr.profit3Y,  { green: 15, amber: 8 })} />
          <RatioRow label="PAT 5Y"     value={fmt(cagr.profit5Y,  "%")} cls={colorClass(cagr.profit5Y,  { green: 15, amber: 8 })} />
        </RatioCard>

      </div>

      {/* Footer */}
      {data._cachedAt && (
        <p className="text-2xs text-text-muted text-center">
          Data from Screener.in ·{" "}
          {(() => {
            const h = Math.round((Date.now() - new Date(data._cachedAt).getTime()) / 3_600_000);
            return h < 1 ? "Updated just now" : h < 24 ? `Updated ${h}h ago` : `Updated ${Math.round(h / 24)}d ago`;
          })()}
        </p>
      )}
    </div>
  );
}
