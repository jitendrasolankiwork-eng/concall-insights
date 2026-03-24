"use client";
import { useState } from "react";

interface ValuationEstimate {
  mode       : "GUIDED" | "DERIVED" | "BASELINE";
  confidence : "HIGH" | "MEDIUM" | "LOW";
  assumptions: { revenueGrowth: string; patMargin: string; drivers: string | string[] };
  estimates  : {
    fy1: { revenueRange: string; patRange: string };
    fy2: { revenueRange: string; patRange: string };
  };
  valuation  : { peRange: string; peg: number | null };
  calculationSteps: string[];
}

interface Props {
  valuationEstimate : ValuationEstimate | null;
  marketCap         : number | null;
  quarter           : string;
  price             : number;
}

const modeColor = (mode: string) =>
  mode === "GUIDED"  ? "bg-signal-green-bg text-signal-green border-signal-green/20" :
  mode === "DERIVED" ? "bg-signal-amber-bg text-signal-amber border-signal-amber/20" :
                       "bg-signal-red-bg text-signal-red border-signal-red/20";

const confLabel = (conf: string) =>
  conf === "HIGH"   ? "Strong management guidance" :
  conf === "MEDIUM" ? "Based on management commentary" :
                      "Weak or unclear data";

// ── Unit normalisation ──────────────────────────────────────────────────
const normaliseCr = (s: string): string => {
  if (!s || s === "N/A" || s === "—") return s;
  const toMnCr = (n: string) => {
    const v = parseFloat(n.replace(/,/g, ""));
    return isNaN(v) ? n : "₹" + Math.round(v / 10).toLocaleString("en-IN") + " Cr";
  };
  const toCr = (n: string) => {
    const v = parseFloat(n.replace(/,/g, ""));
    return isNaN(v) ? n : "₹" + Math.round(v).toLocaleString("en-IN") + " Cr";
  };
  const NUM = "[\\d][\\d,]*(?:\\.[\\d]+)?";
  let r = s;
  r = r.replace(new RegExp("(" + NUM + ")\\s*[-\u2013]\\s*(" + NUM + ")\\s*(?:INR\\s*)?(?:Mn|mn)"), (_, a, b) => toMnCr(a) + " – " + toMnCr(b));
  r = r.replace(new RegExp("(" + NUM + ")\\s*(?:Mn|mn)\\s*[-\u2013]\\s*(" + NUM + ")\\s*(?:Mn|mn)"), (_, a, b) => toMnCr(a) + " – " + toMnCr(b));
  r = r.replace(new RegExp("(" + NUM + ")\\s*(?:INR\\s*)?(?:Mn|mn)"), (_, n) => toMnCr(n));
  r = r.replace(new RegExp("(" + NUM + ")\\s*[-\u2013]\\s*(" + NUM + ")\\s*(?:INR\\s*)?(?:Crores?|Cr)"), (_, a, b) => toCr(a) + " – " + toCr(b));
  r = r.replace(new RegExp("(" + NUM + ")\\s*(?:INR\\s*)?(?:Crores?|Cr)"), (_, n) => toCr(n));
  return r.replace(/INR\s*/g, "").replace(/₹₹/g, "₹");
};

// ── Split "value (explanation)" ───────────────────────────────────────────
const splitVal = (s: string): { value: string; note: string } => {
  if (!s || s === "N/A" || s === "—") return { value: "—", note: "As per management guidance" };
  const normalised = normaliseCr(s);
  const idx = normalised.indexOf("(");
  if (idx === -1) return { value: normalised.trim(), note: "As per management guidance" };
  return {
    value: normalised.substring(0, idx).trim(),
    note : normalised.substring(idx).replace(/^\(|\)$/g, "").trim() || "As per management guidance",
  };
};

// ── Split FY1/FY2 from assumption strings ─────────────────────────────────
const splitAssumption = (s: string): { fy1: string; fy2: string } => {
  if (!s) return { fy1: "—", fy2: "—" };
  const fy2Match = s.match(/FY[+\d]*2[:\s]+(.+?)(?:;|$)/i) ||
                   s.match(/FY2[:\s]+(.+?)(?:;|$)/i);
  const fy1Match = s.match(/FY[+\d]*1[:\s]+(.+?)(?:;|FY[+\d]*2|$)/i) ||
                   s.match(/FY1[:\s]+(.+?)(?:;|FY2|$)/i);
  return {
    fy1: fy1Match ? fy1Match[1].trim() : s.split(";")[0].trim(),
    fy2: fy2Match ? fy2Match[1].trim() : "—",
  };
};

// ── Extract PE midpoint ───────────────────────────────────────────────────
const extractPEMidpoint = (peRange: string): number | null => {
  const nums = peRange.match(/(\d+(?:\.\d+)?)/g);
  if (!nums) return null;
  if (nums.length === 1) return parseFloat(nums[0]);
  return (parseFloat(nums[0]) + parseFloat(nums[1])) / 2;
};

// ── FY labels from quarter ────────────────────────────────────────────────
const getFYLabels = (quarter: string) => {
  const m = quarter.match(/FY(\d+)/);
  if (!m) return { fy1: "FY+1", fy2: "FY+2" };
  const cur = parseInt(m[1]);
  return { fy1: `FY${cur + 1}`, fy2: `FY${cur + 2}` };
};

// ── Plain English insight ─────────────────────────────────────────────────
const buildInsight = (
  peRange: string,
  peg: number | null,
  price: number,
  growthAssumption: string
): string => {
  const pe = extractPEMidpoint(peRange);
  if (!pe) return "";
  const growthMatch = growthAssumption.match(/(\d+)[\s–-]+(\d+)%/);
  const growthMid = growthMatch
    ? ((parseInt(growthMatch[1]) + parseInt(growthMatch[2])) / 2).toFixed(0)
    : null;
  const priceStr = price > 0 ? `At ₹${price.toLocaleString("en-IN")}, ` : "";
  const peStr = `you are paying ~${pe.toFixed(0)}x next year's estimated earnings`;
  const growthStr = growthMid ? ` for a business growing ~${growthMid}% annually` : "";
  const pegStr = peg !== null
    ? peg < 1   ? ` — PEG of ${peg.toFixed(1)} suggests the stock looks attractively valued for its growth.`
    : peg < 1.5 ? ` — PEG of ${peg.toFixed(1)} suggests fair valuation for the growth trajectory.`
                : ` — PEG of ${peg.toFixed(1)} suggests the stock may be pricing in high expectations.`
    : ".";
  return `${priceStr}${peStr}${growthStr}${pegStr}`;
};

export default function ValuationSection({ valuationEstimate, marketCap, quarter, price }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!valuationEstimate || !marketCap) return null;
  if (valuationEstimate.mode === "BASELINE" && valuationEstimate.confidence === "LOW") {
    return (
      <section className="card-base p-4">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-sm font-bold text-text-primary">Forward valuation</h2>
          <span className="text-2xs font-medium px-2 py-0.5 rounded-full border bg-signal-red-bg text-signal-red border-signal-red/20">
            Insufficient data
          </span>
        </div>
        <p className="text-xs text-text-secondary">
          Management has not provided sufficient forward guidance to calculate reliable PE/PEG estimates.
        </p>
      </section>
    );
  }

  const ve = valuationEstimate;
  const { fy1, fy2 } = getFYLabels(quarter);
  const rev1 = splitVal(ve.estimates.fy1.revenueRange);
  const rev2 = splitVal(ve.estimates.fy2.revenueRange);
  const pat1 = splitVal(ve.estimates.fy1.patRange);
  const pe   = splitVal(ve.valuation.peRange);
  const revAssm = splitAssumption(ve.assumptions.revenueGrowth);
  const patAssm = splitAssumption(ve.assumptions.patMargin);
  const insight = buildInsight(ve.valuation.peRange, ve.valuation.peg, price, ve.assumptions.revenueGrowth);

  return (
    <section className="card-base p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-text-primary">Forward valuation</h2>
          <span className={`text-2xs font-medium px-2 py-0.5 rounded-full border ${modeColor(ve.mode)}`}>
            {ve.mode === "GUIDED" ? "Management guided" : ve.mode === "DERIVED" ? "Analyst derived" : "Baseline estimate"}
          </span>
          <span className="text-2xs text-text-muted">{confLabel(ve.confidence)}</span>
        </div>
        <span className="text-2xs text-text-muted">Mcap ₹{marketCap.toLocaleString("en-IN")} Cr</span>
      </div>

      {/* 3-column table */}
      <div>
        {/* Header row */}
        <div className="grid gap-3 pb-2 border-b border-border"
          style={{ gridTemplateColumns: "130px minmax(0,1fr) minmax(0,1.4fr)" }}>
          <div />
          <div className="text-2xs text-text-muted font-medium">Value</div>
          <div className="text-2xs text-text-muted font-medium">How we got here</div>
        </div>

        {/* Revenue FY1 */}
        <div className="grid gap-3 py-2 border-b border-border/50"
          style={{ gridTemplateColumns: "130px minmax(0,1fr) minmax(0,1.4fr)" }}>
          <div className="text-xs text-text-secondary pt-0.5">{fy1} Revenue</div>
          <div className="text-xs font-semibold text-text-primary">{rev1.value}</div>
          <div className="text-2xs text-text-muted leading-relaxed">{rev1.note}</div>
        </div>

        {/* Revenue FY2 — only show if available */}
        {rev2.value !== "—" && rev2.value !== "N/A" && (
          <div className="grid gap-3 py-2 border-b border-border/50"
            style={{ gridTemplateColumns: "130px minmax(0,1fr) minmax(0,1.4fr)" }}>
            <div className="text-xs text-text-secondary pt-0.5">{fy2} Revenue</div>
            <div className="text-xs font-semibold text-text-primary">{rev2.value}</div>
            <div className="text-2xs text-text-muted leading-relaxed">{rev2.note}</div>
          </div>
        )}

        {/* PAT FY1 */}
        <div className="grid gap-3 py-2 border-b border-border/50"
          style={{ gridTemplateColumns: "130px minmax(0,1fr) minmax(0,1.4fr)" }}>
          <div className="text-xs text-text-secondary pt-0.5">{fy1} PAT</div>
          <div className="text-xs font-semibold text-text-primary">{pat1.value}</div>
          <div className="text-2xs text-text-muted leading-relaxed">{pat1.note}</div>
        </div>

        {/* Forward PE */}
        <div className="grid gap-3 py-2 border-b border-border/50"
          style={{ gridTemplateColumns: "130px minmax(0,1fr) minmax(0,1.4fr)" }}>
          <div className="text-xs font-semibold text-text-primary pt-0.5">Forward PE</div>
          <div className="text-xs font-bold text-signal-amber">{pe.value}</div>
          <div className="text-2xs text-text-muted leading-relaxed">{pe.note}</div>
        </div>

        {/* PEG */}
        {ve.valuation.peg !== null && (
          <div className="grid gap-3 py-2"
            style={{ gridTemplateColumns: "130px minmax(0,1fr) minmax(0,1.4fr)" }}>
            <div className="text-xs font-semibold text-text-primary">PEG</div>
            <div className={`text-xs font-bold ${ve.valuation.peg < 1 ? "text-signal-green" : ve.valuation.peg < 1.5 ? "text-signal-amber" : "text-signal-red"}`}>
              {typeof ve.valuation.peg === "number" ? ve.valuation.peg.toFixed(1) : ve.valuation.peg}
            </div>
            <div className="text-2xs text-text-muted">PE midpoint ÷ growth %</div>
          </div>
        )}
      </div>

      {/* Plain English insight */}
      {insight && (
        <div className="bg-muted/40 rounded-lg px-3 py-2.5">
          <p className="text-xs text-text-primary leading-relaxed">{insight}</p>
        </div>
      )}

      {/* Assumptions — split FY1/FY2 */}
      <div className="bg-muted/40 rounded-lg px-3 py-2.5 space-y-2">
        <p className="text-2xs font-semibold text-text-primary">Assumptions</p>
        <div className="grid gap-2" style={{ gridTemplateColumns: "100px 1fr" }}>
          <span className="text-2xs text-text-muted">Revenue growth</span>
          <div className="space-y-0.5">
            <p className="text-2xs text-text-primary">{fy1}: {revAssm.fy1}</p>
            {revAssm.fy2 !== "—" && <p className="text-2xs text-text-secondary">{fy2}: {revAssm.fy2}</p>}
          </div>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: "100px 1fr" }}>
          <span className="text-2xs text-text-muted">PAT margin</span>
          <div className="space-y-0.5">
            <p className="text-2xs text-text-primary">{fy1}: {patAssm.fy1}</p>
            {patAssm.fy2 !== "—" && <p className="text-2xs text-text-secondary">{fy2}: {patAssm.fy2}</p>}
          </div>
        </div>
        {ve.assumptions.drivers && (
          <div className="space-y-0.5 mt-1">
            {(Array.isArray(ve.assumptions.drivers)
              ? ve.assumptions.drivers
              : ve.assumptions.drivers.split(/[;·]/).map((s: string) => s.trim()).filter(Boolean)
            ).map((driver: string, i: number) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-2xs text-text-muted mt-0.5">·</span>
                <p className="text-2xs text-text-muted leading-relaxed">{driver}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calculation steps toggle */}
      <button onClick={() => setExpanded(!expanded)}
        className="text-2xs text-signal-blue hover:underline">
        {expanded ? "Hide calculation steps ↑" : "Show calculation steps ↓"}
      </button>

      {expanded && (
        <div className="bg-muted/40 rounded-lg px-3 py-2.5 space-y-1.5">
          {ve.calculationSteps.map((step, i) => (
            <p key={i} className="text-2xs text-text-secondary leading-relaxed">
              {i + 1}. {step}
            </p>
          ))}
        </div>
      )}

      {ve.mode !== "GUIDED" && (
        <p className="text-2xs text-text-muted leading-relaxed">
          Estimates derived from management commentary and historical trends. Verify against actual financials before making investment decisions.
        </p>
      )}

    </section>
  );
}
