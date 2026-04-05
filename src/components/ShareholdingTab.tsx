/**
 * ShareholdingTab.tsx — Tab 4
 * 8-quarter table + Recharts line chart for FII/DII trend
 * + Overall signal banner
 */

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";
import { fetchFundamentals } from "@/lib/api";

interface Props {
  symbol : string;
  visible: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function TrendBadge({ trend }: { trend: string }) {
  if (trend === "BUYING")  return <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-signal-green-bg text-signal-green border border-signal-green/20">↑ Buying</span>;
  if (trend === "SELLING") return <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-signal-red-bg text-signal-red border border-signal-red/20">↓ Selling</span>;
  return <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-muted text-text-muted border border-border">→ Stable</span>;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return <div className="h-8 bg-muted rounded animate-pulse w-full mb-1" />;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function ShareholdingTab({ symbol, visible }: Props) {
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
        else setError(r.error || "Failed to load shareholding");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [visible, fetched, symbol]);

  if (!visible) return null;

  if (loading) return (
    <div className="space-y-3">
      <div className="h-12 bg-muted rounded-xl animate-pulse" />
      <div className="card-base p-3 space-y-1">
        {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
      <div className="card-base h-48 animate-pulse bg-muted rounded-xl" />
    </div>
  );

  if (error) return (
    <div className="card-base p-6 text-center">
      <p className="text-sm text-signal-red">⚠ {error}</p>
    </div>
  );

  if (!data?.shareholding) return (
    <p className="text-xs text-text-muted p-4">Shareholding data not available for {symbol}.</p>
  );

  const sh      = data.shareholding;
  const quarters = sh.quarters.slice(0, 8);

  // Overall signal from promoter trend
  const promoterTrend = sh.trend.promoters;
  const signalBg = promoterTrend === "BUYING" ? "bg-signal-green-bg border-signal-green/20 text-signal-green"
                 : promoterTrend === "SELLING" ? "bg-signal-red-bg border-signal-red/20 text-signal-red"
                 : "bg-muted border-border text-text-muted";
  const signalLabel = promoterTrend === "BUYING"  ? "INSIDERS BUILDING"
                    : promoterTrend === "SELLING" ? "INSIDERS TRIMMING"
                    : "HOLDING STEADY";

  // Build chart data — oldest first (quarters are oldest→newest)
  const chartData = quarters.map((q: string, i: number) => ({
    quarter  : q,
    FII      : sh.fii[i]       ?? null,
    DII      : sh.dii[i]       ?? null,
    Promoters: sh.promoters[i] ?? null,
  }));

  const rows = [
    { label: "Promoters", key: "promoters" as const },
    { label: "FII",       key: "fii"       as const },
    { label: "DII",       key: "dii"       as const },
    { label: "Public",    key: "public"    as const },
  ];

  const latestPledge = sh.latestPledge ?? null;
  const hasPledge    = latestPledge !== null && latestPledge > 0;
  const pledgeColor  = latestPledge === null ? "text-text-muted"
    : latestPledge <= 5  ? "text-signal-green"
    : latestPledge <= 20 ? "text-signal-amber"
    : "text-signal-red";

  return (
    <div className="space-y-4">

      {/* Signal banner */}
      <div className={`rounded-xl px-4 py-3 border flex items-center gap-3 ${signalBg}`}>
        <span className="text-lg">{promoterTrend === "BUYING" ? "🏗️" : promoterTrend === "SELLING" ? "📉" : "⚖️"}</span>
        <div>
          <p className="text-xs font-bold">{signalLabel}</p>
          <p className="text-2xs opacity-80">Based on promoter shareholding movement over last 8 quarters</p>
        </div>
      </div>

      {/* Pledge warning */}
      {hasPledge && (
        <div className={`rounded-xl px-4 py-3 border flex items-center gap-3 ${
          latestPledge! > 20
            ? "bg-signal-red-bg border-signal-red/20 text-signal-red"
            : "bg-signal-amber-bg border-signal-amber/20 text-signal-amber"
        }`}>
          <span className="text-lg">⚠️</span>
          <div>
            <p className="text-xs font-bold">
              {latestPledge!.toFixed(1)}% of promoter shares pledged
            </p>
            <p className="text-2xs opacity-80">
              {latestPledge! > 20
                ? "High pledge — price drops can trigger forced selling"
                : "Moderate pledge — monitor for changes"}
            </p>
          </div>
        </div>
      )}

      {/* Shareholding table */}
      <div className="card-base overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 text-text-muted font-semibold w-24">Holder</th>
              <th className="text-left px-3 py-2 text-text-muted font-semibold w-24">Trend</th>
              {quarters.map((q: string) => (
                <th key={q} className="text-right px-2 py-2 text-text-muted font-medium whitespace-nowrap">{q}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, key }) => {
              const vals  = sh[key].slice(0, 8) as (number | null)[];
              const trend = sh.trend[key];
              return (
                <tr key={label} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5 font-semibold text-text-primary">{label}</td>
                  <td className="px-3 py-2.5"><TrendBadge trend={trend} /></td>
                  {vals.map((v, i) => (
                    <td key={i} className="text-right px-2 py-2.5 text-text-secondary tabular-nums">
                      {v != null ? v.toFixed(2) : "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
            {/* Pledge row — only if data exists */}
            {sh.pledge?.length > 0 && (
              <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5 font-semibold text-text-primary">Pledge %</td>
                <td className="px-3 py-2.5">
                  {latestPledge !== null && latestPledge > 0
                    ? <span className={`text-2xs font-bold px-2 py-0.5 rounded-full border ${
                        latestPledge > 20
                          ? "bg-signal-red-bg text-signal-red border-signal-red/20"
                          : "bg-signal-amber-bg text-signal-amber border-signal-amber/20"
                      }`}>⚠ {latestPledge.toFixed(1)}%</span>
                    : <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-signal-green-bg text-signal-green border border-signal-green/20">✓ Nil</span>
                  }
                </td>
                {(sh.pledge.slice(0, 8) as (number | null)[]).map((v, i) => (
                  <td key={i} className={`text-right px-2 py-2.5 tabular-nums ${
                    v === null || v === 0 ? "text-text-muted"
                    : v <= 5 ? "text-signal-green"
                    : v <= 20 ? "text-signal-amber"
                    : "text-signal-red font-semibold"
                  }`}>
                    {v != null ? v.toFixed(1) : "—"}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* FII / DII trend chart */}
      <div className="card-base p-4">
        <p className="text-xs font-bold text-text-primary mb-4">FII / DII Trend (% stake)</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: "hsl(var(--text-muted))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--text-muted))" }} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 11,
              }}
              formatter={(v: any) => [`${v}%`]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="FII" stroke="#378ADD" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="DII" stroke="#639922" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Promoter trend chart */}
      <div className="card-base p-4">
        <p className="text-xs font-bold text-text-primary mb-4">Promoter Stake (%)</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: "hsl(var(--text-muted))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--text-muted))" }} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 11,
              }}
              formatter={(v: any) => [`${v}%`]}
            />
            <Line type="monotone" dataKey="Promoters" stroke="#BA7517" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

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
