/**
 * FundamentalsTab.tsx — Tab 2
 * Sub-tabs: Income Statement / Balance Sheet / Cash Flow
 * Each shows 5-year bar charts using Recharts + CAGR summary table.
 */

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Cell, LabelList,
} from "recharts";
import { fetchFundamentals } from "@/lib/api";
import { OverviewTab } from "@/components/OverviewTab";
import type { CompanyInsight } from "@/types/portfolio";

interface Props {
  symbol  : string;
  visible : boolean;
  company?: CompanyInsight | null;
}

type SubTab = "overview" | "income" | "balance" | "cashflow" | "quarterly";

// ── Colors (design spec) ──────────────────────────────────────────────────────
const C = {
  green  : "#639922",
  teal   : "#2E8B8B",
  blue   : "#378ADD",
  red    : "#E24B4A",
  amber  : "#BA7517",
  muted  : "#8A8A8A",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v: number | null, suffix = ""): string {
  if (v === null || v === undefined) return "—";
  return `${v.toLocaleString("en-IN")}${suffix}`;
}

function cagrColor(v: number | null): string {
  if (v === null) return "text-text-muted";
  if (v >= 20) return "text-signal-green font-bold";
  if (v >= 10) return "text-signal-amber font-bold";
  return "text-text-primary";
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-md text-xs space-y-1">
      <p className="font-semibold text-text-primary mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-text-secondary">{p.name}:</span>
          <span className="font-semibold text-text-primary">
            ₹{p.value?.toLocaleString("en-IN")} Cr
          </span>
        </div>
      ))}
    </div>
  );
};

// ── CAGR Table ────────────────────────────────────────────────────────────────
function CagrTable({ cagr }: { cagr: any }) {
  if (!cagr) return null;
  const rows = [
    { label: "Revenue CAGR", "3Y": cagr.revenue3Y, "5Y": cagr.revenue5Y, "10Y": cagr.revenue10Y },
    { label: "PAT CAGR",     "3Y": cagr.profit3Y,  "5Y": cagr.profit5Y,  "10Y": cagr.profit10Y  },
  ];
  return (
    <div className="card-base overflow-x-auto mt-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-3 py-2 text-text-muted font-semibold">Metric</th>
            {["3Y", "5Y", "10Y"].map((p) => (
              <th key={p} className="text-right px-4 py-2 text-text-muted font-semibold">{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border/50">
              <td className="px-3 py-2.5 font-medium text-text-primary">{r.label}</td>
              {(["3Y", "5Y", "10Y"] as const).map((p) => (
                <td key={p} className={`text-right px-4 py-2.5 ${cagrColor(r[p] as number | null)}`}>
                  {r[p] !== null && r[p] !== undefined ? `${r[p]}%` : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Shared % helpers (used by all charts) ────────────────────────────────────

function pctChange(curr: number | null, prev: number | null): number | null {
  if (curr === null || prev === null || prev === 0) return null;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100 * 10) / 10;
}

function PctCell({ v, px = "px-3" }: { v: number | null; px?: string }) {
  if (v === null) return <td className={`text-right ${px} py-2 text-text-muted tabular-nums`}>—</td>;
  const color = v > 0 ? "text-signal-green font-semibold" : v < 0 ? "text-signal-red font-semibold" : "text-text-muted";
  return (
    <td className={`text-right ${px} py-2 tabular-nums ${color}`}>
      {v > 0 ? "+" : ""}{v}%
    </td>
  );
}

/** Factory: creates a YoY label renderer staggered by `extraUp` pixels above bar top.
 *  Bar 1 (Revenue / Borrowings / Op CF) → extraUp 0
 *  Bar 2 (Op Profit / Reserves / FCF)   → extraUp 12
 *  Bar 3 (Net Profit)                   → extraUp 24
 */
function makeYoYBarLabel(extraUp: number = 0) {
  return function YoYBarLabelInner(props: any) {
    const { x, y, width, value } = props;
    if (value === null || value === undefined) return null;
    const color = value > 0 ? C.green : C.red;
    return (
      <text x={x + width / 2} y={y - 5 - extraUp} textAnchor="middle" fontSize={8} fontWeight="700" fill={color}>
        {value > 0 ? "+" : ""}{value}%
      </text>
    );
  };
}
const YoYBarLabel    = makeYoYBarLabel(0);   // kept for single-bar charts (CashFlow)
const YoYBarLabel2   = makeYoYBarLabel(12);
const YoYBarLabel3   = makeYoYBarLabel(24);

// ── Sub-tab: Income Statement ─────────────────────────────────────────────────
function IncomeChart({ pl }: { pl: any }) {
  if (!pl?.years?.length) return <p className="text-xs text-text-muted p-4">P&L data not available.</p>;

  const MAX   = 7;
  const slice = (arr: any[]) => (arr || []).slice(-MAX);
  const years = slice(pl.years);
  const rev   = slice(pl.revenue);
  const op    = slice(pl.operatingProfit);
  const net   = slice(pl.netProfit);

  const revYoY = rev.map((v: number | null, i: number) => pctChange(v, i > 0 ? rev[i - 1] : null));
  const opYoY  = op.map((v: number | null,  i: number) => pctChange(v, i > 0 ? op[i - 1]  : null));
  const netYoY = net.map((v: number | null, i: number) => pctChange(v, i > 0 ? net[i - 1] : null));

  const chartData = years.map((y: string, i: number) => ({
    year        : y.replace("Mar ", ""),
    Revenue     : rev[i],
    "Op Profit" : op[i],
    "Net Profit": net[i],
    revYoY      : revYoY[i],
    opYoY       : opYoY[i],
    netYoY      : netYoY[i],
  }));

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 20, right: 8, left: -20, bottom: 0 }} barSize={18}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 10, fill: "hsl(var(--text-muted))" }} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--text-muted))" }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Revenue"    fill={C.green} radius={[3, 3, 0, 0]}>
            <LabelList dataKey="revYoY" content={YoYBarLabel} />
          </Bar>
          <Bar dataKey="Op Profit"  fill={C.teal}  radius={[3, 3, 0, 0]}>
            <LabelList dataKey="opYoY" content={YoYBarLabel2} />
          </Bar>
          <Bar dataKey="Net Profit" fill={C.blue}  radius={[3, 3, 0, 0]}>
            <LabelList dataKey="netYoY" content={YoYBarLabel3} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* CAGR table + YoY rows */}
      <CagrTable cagr={pl.cagr} />
      <div className="card-base overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 text-text-muted font-semibold sticky left-0 bg-card">YoY Growth</th>
              {years.map((y: string) => (
                <th key={y} className="text-right px-3 py-2 text-text-muted font-medium whitespace-nowrap">
                  {y.replace("Mar ", "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50 bg-muted/20">
              <td className="px-3 py-2 font-medium text-text-secondary sticky left-0 bg-muted/20">Revenue YoY</td>
              {revYoY.map((v: number | null, i: number) => <PctCell key={i} v={v} />)}
            </tr>
            <tr className="border-b border-border/50 bg-muted/20">
              <td className="px-3 py-2 font-medium text-text-secondary sticky left-0 bg-muted/20">Op Profit YoY</td>
              {opYoY.map((v: number | null, i: number) => <PctCell key={i} v={v} />)}
            </tr>
            <tr className="bg-muted/20">
              <td className="px-3 py-2 font-medium text-text-secondary sticky left-0 bg-muted/20">Net Profit YoY</td>
              {netYoY.map((v: number | null, i: number) => <PctCell key={i} v={v} />)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-tab: Balance Sheet ────────────────────────────────────────────────────
function BalanceChart({ bs }: { bs: any }) {
  if (!bs?.years?.length) return <p className="text-xs text-text-muted p-4">Balance sheet data not available.</p>;

  const MAX   = 7;
  const slice = (arr: any[]) => (arr || []).slice(-MAX);
  const years = slice(bs.years);
  const borr  = slice(bs.borrowings);
  const res   = slice(bs.reserves);
  const de    = slice(bs.debtToEquity);

  const borrYoY = borr.map((v: number | null, i: number) => pctChange(v, i > 0 ? borr[i - 1] : null));
  const resYoY  = res.map((v: number | null,  i: number) => pctChange(v, i > 0 ? res[i - 1]  : null));

  const chartData = years.map((y: string, i: number) => ({
    year       : y.replace("Mar ", "").replace("Sep ", "Sep "),
    Borrowings : borr[i],
    Reserves   : res[i],
    borrYoY    : borrYoY[i],
    resYoY     : resYoY[i],
  }));

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 20, right: 8, left: -20, bottom: 0 }} barSize={22}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 10, fill: "hsl(var(--text-muted))" }} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--text-muted))" }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Borrowings" fill={C.red}   radius={[3, 3, 0, 0]}>
            <LabelList dataKey="borrYoY" content={YoYBarLabel} />
          </Bar>
          <Bar dataKey="Reserves"   fill={C.green} radius={[3, 3, 0, 0]}>
            <LabelList dataKey="resYoY" content={YoYBarLabel2} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* D/E + YoY table */}
      <div className="card-base overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 text-text-muted font-semibold sticky left-0 bg-card">Metric</th>
              {years.map((y: string) => (
                <th key={y} className="text-right px-3 py-2 text-text-muted font-medium whitespace-nowrap">
                  {y.replace("Mar ", "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="px-3 py-2.5 font-medium text-text-primary sticky left-0 bg-card">D/E Ratio</td>
              {de.map((v: number | null, i: number) => (
                <td key={i} className={`text-right px-3 py-2.5 tabular-nums ${
                  v === null ? "text-text-muted" :
                  v <= 1 ? "text-signal-green font-semibold" :
                  v <= 2 ? "text-signal-amber font-semibold" :
                           "text-signal-red font-semibold"
                }`}>
                  {v !== null ? `${v}x` : "—"}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border/50 bg-muted/20">
              <td className="px-3 py-2 font-medium text-text-secondary sticky left-0 bg-muted/20">Reserves YoY</td>
              {resYoY.map((v: number | null, i: number) => <PctCell key={i} v={v} />)}
            </tr>
            <tr className="bg-muted/20">
              <td className="px-3 py-2 font-medium text-text-secondary sticky left-0 bg-muted/20">Borrowings YoY</td>
              {borrYoY.map((v: number | null, i: number) => <PctCell key={i} v={v} />)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-tab: Cash Flow ────────────────────────────────────────────────────────
function CashFlowChart({ cf }: { cf: any }) {
  if (!cf?.years?.length) return <p className="text-xs text-text-muted p-4">Cash flow data not available.</p>;

  const MAX   = 7;
  const slice = (arr: any[]) => (arr || []).slice(-MAX);
  const years = slice(cf.years);
  const opCF  = slice(cf.operatingCF);
  const invCF = slice(cf.investingCF);
  const finCF = slice(cf.financingCF);
  const fcf   = slice(cf.freeCashFlow);

  const opCFYoY  = opCF.map((v: number | null, i: number) => pctChange(v, i > 0 ? opCF[i - 1] : null));
  const fcfYoY   = fcf.map((v: number | null,  i: number) => pctChange(v, i > 0 ? fcf[i - 1]  : null));

  const chartData = years.map((y: string, i: number) => ({
    year    : y.replace("Mar ", ""),
    "Op CF" : opCF[i],
    opCFYoY : opCFYoY[i],
  }));

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 20, right: 8, left: -20, bottom: 0 }} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 10, fill: "hsl(var(--text-muted))" }} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--text-muted))" }} />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
          <Bar dataKey="Op CF" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={(entry["Op CF"] ?? 0) >= 0 ? C.green : C.red} />
            ))}
            <LabelList dataKey="opCFYoY" content={YoYBarLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Full CF table + YoY rows */}
      <div className="card-base overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 text-text-muted font-semibold sticky left-0 bg-card">Cash Flow (₹ Cr)</th>
              {years.map((y: string) => (
                <th key={y} className="text-right px-3 py-2 text-text-muted whitespace-nowrap">
                  {y.replace("Mar ", "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: "Operating CF", vals: opCF },
              { label: "Investing CF", vals: invCF },
              { label: "Financing CF", vals: finCF },
              { label: "Free CF",      vals: fcf  },
            ].map(({ label, vals }) => (
              <tr key={label} className="border-b border-border/50">
                <td className="px-3 py-2 font-medium text-text-primary sticky left-0 bg-card">{label}</td>
                {vals.map((v: number | null, i: number) => (
                  <td key={i} className={`text-right px-3 py-2 tabular-nums ${
                    v === null ? "text-text-muted" :
                    v >= 0 ? "text-signal-green" : "text-signal-red"
                  }`}>
                    {v !== null ? v.toLocaleString("en-IN") : "—"}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-muted/20">
              <td className="px-3 py-2 font-medium text-text-secondary sticky left-0 bg-muted/20">Op CF YoY</td>
              {opCFYoY.map((v: number | null, i: number) => <PctCell key={i} v={v} />)}
            </tr>
            <tr className="bg-muted/20">
              <td className="px-3 py-2 font-medium text-text-secondary sticky left-0 bg-muted/20">Free CF YoY</td>
              {fcfYoY.map((v: number | null, i: number) => <PctCell key={i} v={v} />)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-tab: Quarterly Results ────────────────────────────────────────────────

/** Factory: creates a QoQ label renderer staggered by `extraUp` pixels above bar top.
 *  Revenue → 0  (label just above bar)
 *  Op Profit → 12 (label 12px higher, avoids collision with Revenue label)
 *  Net Profit → 24 (label 24px higher, avoids collision with both)
 */
function makeQoQLabel(extraUp: number = 0) {
  return function QoQLabelInner(props: any) {
    const { x, y, width, value } = props;
    if (value === null || value === undefined) return null;
    const color = value > 0 ? C.green : C.red;
    return (
      <text
        x={x + width / 2}
        y={y - 5 - extraUp}
        textAnchor="middle"
        fontSize={8}
        fontWeight="700"
        fill={color}
      >
        {value > 0 ? "+" : ""}{value}%
      </text>
    );
  };
}
const QoQLabelRev = makeQoQLabel(0);
const QoQLabelOp  = makeQoQLabel(12);
const QoQLabelNet = makeQoQLabel(24);

/** Enhanced tooltip — shows values + QoQ + YoY */
function QuarterlyTooltip({ active, payload, label, revQoQ, revYoY, netQoQ, netYoY, idx }: any) {
  if (!active || !payload?.length) return null;
  const i = idx;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-md text-xs space-y-1.5 min-w-[160px]">
      <p className="font-semibold text-text-primary mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-text-secondary">{p.name}</span>
          </div>
          <span className="font-semibold text-text-primary">₹{p.value?.toLocaleString("en-IN")} Cr</span>
        </div>
      ))}
      {/* QoQ + YoY for Revenue */}
      {(revQoQ[i] !== null || revYoY[i] !== null) && (
        <div className="border-t border-border pt-1.5 space-y-1">
          {revQoQ[i] !== null && (
            <div className="flex justify-between gap-3">
              <span className="text-text-muted">Rev QoQ</span>
              <span className={`font-bold ${revQoQ[i]! > 0 ? "text-signal-green" : "text-signal-red"}`}>
                {revQoQ[i]! > 0 ? "+" : ""}{revQoQ[i]}%
              </span>
            </div>
          )}
          {revYoY[i] !== null && (
            <div className="flex justify-between gap-3">
              <span className="text-text-muted">Rev YoY</span>
              <span className={`font-bold ${revYoY[i]! > 0 ? "text-signal-green" : "text-signal-red"}`}>
                {revYoY[i]! > 0 ? "+" : ""}{revYoY[i]}%
              </span>
            </div>
          )}
          {netQoQ[i] !== null && (
            <div className="flex justify-between gap-3">
              <span className="text-text-muted">PAT QoQ</span>
              <span className={`font-bold ${netQoQ[i]! > 0 ? "text-signal-green" : "text-signal-red"}`}>
                {netQoQ[i]! > 0 ? "+" : ""}{netQoQ[i]}%
              </span>
            </div>
          )}
          {netYoY[i] !== null && (
            <div className="flex justify-between gap-3">
              <span className="text-text-muted">PAT YoY</span>
              <span className={`font-bold ${netYoY[i]! > 0 ? "text-signal-green" : "text-signal-red"}`}>
                {netYoY[i]! > 0 ? "+" : ""}{netYoY[i]}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuarterlyChart({ qr }: { qr: any }) {
  if (!qr?.quarters?.length) return <p className="text-xs text-text-muted p-4">Quarterly data not available.</p>;

  const MAX  = 8;
  const slice = (arr: any[]) => (arr || []).slice(-MAX);

  // Use full arrays (not sliced) for YoY lookback of 4 quarters
  const allRev = qr.revenue  || [];
  const allNet = qr.netProfit || [];

  const qtrs = slice(qr.quarters);
  const rev  = slice(allRev);
  const op   = slice(qr.opProfit);
  const net  = slice(allNet);
  const opm  = slice(qr.opm);
  const eps  = slice(qr.eps);

  // Full-length slices for lookback
  const fullRev = allRev.slice(-(MAX + 4));
  const fullNet = allNet.slice(-(MAX + 4));
  const offset  = fullRev.length - MAX; // how many extra entries at the start

  // QoQ: compare to previous quarter (i-1 in current window)
  const revQoQ = rev.map((v: number | null, i: number) =>
    pctChange(v, i > 0 ? rev[i - 1] : null));
  const opQoQ  = op.map((v: number | null, i: number) =>
    pctChange(v, i > 0 ? op[i - 1] : null));
  const netQoQ = net.map((v: number | null, i: number) =>
    pctChange(v, i > 0 ? net[i - 1] : null));

  // YoY: compare to same quarter 4 slots back using the extended array
  const revYoY = rev.map((v: number | null, i: number) => {
    const prev = fullRev[offset + i - 4] ?? null;
    return pctChange(v, prev);
  });
  const netYoY = net.map((v: number | null, i: number) => {
    const prev = fullNet[offset + i - 4] ?? null;
    return pctChange(v, prev);
  });

  // Chart label data — attach QoQ to all bars
  const chartData = qtrs.map((q: string, i: number) => ({
    quarter      : q.replace(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/,
                     (_, m, y) => `${m} '${y.slice(2)}`),
    Revenue      : rev[i],
    "Op Profit"  : op[i],
    "Net Profit" : net[i],
    revQoQ       : revQoQ[i],
    opQoQ        : opQoQ[i],
    netQoQ       : netQoQ[i],
  }));

  // Tooltip needs index — track via activeIndex state
  const [activeIdx, setActiveIdx] = useState<number>(0);

  return (
    <div className="space-y-3">
      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 8, left: -20, bottom: 0 }}
          barSize={16}
          onMouseMove={(state: any) => {
            if (state.isTooltipActive) setActiveIdx(state.activeTooltipIndex ?? 0);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: "hsl(var(--text-muted))" }} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--text-muted))" }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
          <Tooltip content={
            <QuarterlyTooltip
              revQoQ={revQoQ} revYoY={revYoY}
              netQoQ={netQoQ} netYoY={netYoY}
              idx={activeIdx}
            />
          } />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Revenue" fill={C.green} radius={[3, 3, 0, 0]}>
            <LabelList dataKey="revQoQ" content={QoQLabelRev} />
          </Bar>
          <Bar dataKey="Op Profit"  fill={C.teal} radius={[3, 3, 0, 0]}>
            <LabelList dataKey="opQoQ" content={QoQLabelOp} />
          </Bar>
          <Bar dataKey="Net Profit" fill={C.blue} radius={[3, 3, 0, 0]}>
            <LabelList dataKey="netQoQ" content={QoQLabelNet} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Table */}
      <div className="card-base overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 text-text-muted font-semibold sticky left-0 bg-card">Metric</th>
              {qtrs.map((q: string, i: number) => (
                <th key={i} className="text-right px-2 py-2 text-text-muted font-medium whitespace-nowrap">
                  {chartData[i]?.quarter ?? q}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* OPM */}
            <tr className="border-b border-border/50">
              <td className="px-3 py-2 font-medium text-text-primary whitespace-nowrap sticky left-0 bg-card">OPM %</td>
              {opm.map((v: number | null, i: number) => (
                <td key={i} className={`text-right px-2 py-2 tabular-nums ${
                  v === null ? "text-text-muted" :
                  v >= 20 ? "text-signal-green font-semibold" :
                  v >= 10 ? "text-signal-amber" : "text-signal-red"
                }`}>
                  {v !== null ? `${v}%` : "—"}
                </td>
              ))}
            </tr>
            {/* EPS */}
            <tr className="border-b border-border/50">
              <td className="px-3 py-2 font-medium text-text-primary sticky left-0 bg-card">EPS (₹)</td>
              {eps.map((v: number | null, i: number) => (
                <td key={i} className="text-right px-2 py-2 text-text-secondary tabular-nums">
                  {v !== null ? v : "—"}
                </td>
              ))}
            </tr>
            {/* Revenue QoQ */}
            <tr className="border-b border-border/50 bg-muted/20">
              <td className="px-3 py-2 font-medium text-text-secondary whitespace-nowrap sticky left-0 bg-muted/20">Rev QoQ %</td>
              {revQoQ.map((v: number | null, i: number) => <PctCell key={i} v={v} />)}
            </tr>
            {/* Revenue YoY */}
            <tr className="border-b border-border/50 bg-muted/20">
              <td className="px-3 py-2 font-medium text-text-secondary whitespace-nowrap sticky left-0 bg-muted/20">Rev YoY %</td>
              {revYoY.map((v: number | null, i: number) => <PctCell key={i} v={v} />)}
            </tr>
            {/* Op Profit QoQ */}
            <tr className="border-b border-border/50 bg-muted/20">
              <td className="px-3 py-2 font-medium text-text-secondary whitespace-nowrap sticky left-0 bg-muted/20">Op QoQ %</td>
              {opQoQ.map((v: number | null, i: number) => <PctCell key={i} v={v} />)}
            </tr>
            {/* PAT QoQ */}
            <tr className="border-b border-border/50 bg-muted/20">
              <td className="px-3 py-2 font-medium text-text-secondary whitespace-nowrap sticky left-0 bg-muted/20">PAT QoQ %</td>
              {netQoQ.map((v: number | null, i: number) => <PctCell key={i} v={v} />)}
            </tr>
            {/* PAT YoY */}
            <tr className="bg-muted/20">
              <td className="px-3 py-2 font-medium text-text-secondary whitespace-nowrap sticky left-0 bg-muted/20">PAT YoY %</td>
              {netYoY.map((v: number | null, i: number) => <PctCell key={i} v={v} />)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function FundamentalsTab({ symbol, visible, company }: Props) {
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const [subTab,  setSubTab]  = useState<SubTab>("overview");

  useEffect(() => {
    if (!visible || fetched) return;
    setFetched(true);
    setLoading(true);
    fetchFundamentals(symbol)
      .then((r) => {
        if (r.success && r.data) setData(r.data);
        else setError(r.error || "Failed to load fundamentals");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [visible, fetched, symbol]);

  if (!visible) return null;

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-muted rounded-xl w-72" />
      <div className="card-base h-64 bg-muted rounded-xl" />
      <div className="card-base h-24 bg-muted rounded-xl" />
    </div>
  );

  if (error) return (
    <div className="card-base p-6 text-center space-y-3">
      <p className="text-sm text-signal-red">⚠ {error}</p>
      <button onClick={() => { setFetched(false); setData(null); setError(null); }}
        className="text-xs text-signal-blue hover:underline">Try again</button>
    </div>
  );

  if (!data) return null;

  const subTabs: { key: SubTab; label: string }[] = [
    { key: "overview",  label: "Overview"         },
    { key: "quarterly", label: "Quarterly"        },
    { key: "income",    label: "Income Statement" },
    { key: "balance",   label: "Balance Sheet"    },
    { key: "cashflow",  label: "Cash Flow"        },
  ];

  const ageText = data._cachedAt ? (() => {
    const h = Math.round((Date.now() - new Date(data._cachedAt).getTime()) / 3_600_000);
    return h < 1 ? "Updated just now" : h < 24 ? `Updated ${h}h ago` : `Updated ${Math.round(h / 24)}d ago`;
  })() : null;

  return (
    <div className="space-y-4">

      {/* Sub-tab switcher */}
      <div className="flex items-center gap-1 bg-muted p-1 rounded-xl w-fit overflow-x-auto">
        {subTabs.map((t) => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              subTab === t.key
                ? "bg-card text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === "overview"  && <OverviewTab    symbol={symbol} visible company={company} />}
      {subTab === "quarterly" && <QuarterlyChart qr={data.quarterlyResults} />}
      {subTab === "income"    && <IncomeChart    pl={data.profitLoss}        />}
      {subTab === "balance"   && <BalanceChart   bs={data.balanceSheet}      />}
      {subTab === "cashflow"  && <CashFlowChart  cf={data.cashFlow}          />}

      {/* Footer — hide on Overview (it has its own footer) */}
      {subTab !== "overview" && (
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <p className="text-2xs text-text-muted">
            Data from <span className="font-medium">Screener.in</span>
            {ageText && <> · {ageText}</>}
          </p>
          <button
            onClick={() => { setFetched(false); setData(null); setError(null); }}
            className="text-2xs text-signal-blue hover:underline"
          >
            ↻ Refresh
          </button>
        </div>
      )}
    </div>
  );
}
