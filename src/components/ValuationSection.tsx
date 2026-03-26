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

const pegVerdict = (peg: number | null, peRange: string): { label: string; cls: string } => {
  if (peg === null) {
    const pe = extractPEMidpoint(peRange);
    if (pe && pe > 50) return { label: "⚪ Pre-profit", cls: "bg-muted text-text-muted border-border" };
    return { label: "⚪ No PEG data", cls: "bg-muted text-text-muted border-border" };
  }
  if (peg < 1)    return { label: "🟢 Undervalued", cls: "bg-signal-green-bg text-signal-green border-signal-green/20" };
  if (peg <= 1.5) return { label: "🟡 Fair value",  cls: "bg-signal-amber-bg text-signal-amber border-signal-amber/20" };
  return           { label: "🔴 Expensive",         cls: "bg-signal-red-bg text-signal-red border-signal-red/20" };
};

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

// ── Extract revenue midpoint in Cr from raw string ───────────────────────
const extractRevenueMidpointCr = (raw: string): number | null => {
  const clean = raw.replace(/[₹,\s]/g, "");
  // Range: "1240-1395Cr" or "1240Cr-1395Cr"
  const range = clean.match(/(\d+(?:\.\d+)?)(?:Cr)?[-–](\d+(?:\.\d+)?)(?:Cr)?/i);
  if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
  // Mn range: "12400-13950Mn"
  const mnRange = clean.match(/(\d+(?:\.\d+)?)(?:Mn)?[-–](\d+(?:\.\d+)?)Mn/i);
  if (mnRange) return ((parseFloat(mnRange[1]) + parseFloat(mnRange[2])) / 2) / 10;
  // Single value
  const single = clean.match(/(\d+(?:\.\d+)?)Cr/i);
  if (single) return parseFloat(single[1]);
  return null;
};

// ── Price/Sales ratio ─────────────────────────────────────────────────────
const calcPS = (marketCap: number, revenueRange: string): string | null => {
  const rev = extractRevenueMidpointCr(revenueRange);
  if (!rev || rev === 0) return null;
  return (marketCap / rev).toFixed(1) + "x";
};

// ── FY labels from quarter ────────────────────────────────────────────────
const getFYLabels = (quarter: string) => {
  const m = quarter.match(/FY(\d+)/);
  if (!m) return { fy1: "FY+1", fy2: "FY+2" };
  const cur = parseInt(m[1]);
  return { fy1: `FY${cur + 1}`, fy2: `FY${cur + 2}` };
};

// ── Plain English insight — returns bullet array ──────────────────────────
const buildInsight = (
  peRange: string,
  peg: number | null,
  price: number,
  growthAssumption: string,
  marketCap: number | null,
  fy1RevenueRange: string,
  fy1Label: string,
): string[] => {
  const pe = extractPEMidpoint(peRange);
  if (!pe) return [];
  const growthMatch = growthAssumption.match(/(\d+)[\s–-]+(\d+)%/);
  const growthMid = growthMatch
    ? ((parseInt(growthMatch[1]) + parseInt(growthMatch[2])) / 2).toFixed(0)
    : null;

  // Pre-profit company (PE > 100x and no PEG) — use P/Sales framing
  if (peg === null && pe > 100 && marketCap) {
    const ps = calcPS(marketCap, fy1RevenueRange);
    const bullets: string[] = [];
    if (price > 0) bullets.push(`Current price: ₹${price.toLocaleString("en-IN")}`);
    bullets.push(`PE ~${pe.toFixed(0)}x reflects near-zero earnings (pre-profit company)`);
    if (ps) bullets.push(`Price/Sales: ~${ps} ${fy1Label} revenue — more useful metric at this stage`);
    if (growthMid) bullets.push(`Revenue growing ~${growthMid}% annually`);
    bullets.push(`Market is pricing in a successful path to profitability`);
    return bullets;
  }

  // Profitable company
  const bullets: string[] = [];
  if (price > 0) bullets.push(`Current price: ₹${price.toLocaleString("en-IN")}`);
  bullets.push(`Paying ~${pe.toFixed(0)}x next year's estimated earnings`);
  if (growthMid) bullets.push(`Revenue growing ~${growthMid}% annually`);
  if (peg !== null) {
    if (peg < 1)    bullets.push(`PEG ${peg.toFixed(1)} — stock looks attractively valued for its growth`);
    else if (peg < 1.5) bullets.push(`PEG ${peg.toFixed(1)} — fair valuation for the growth trajectory`);
    else            bullets.push(`PEG ${peg.toFixed(1)} — stock may be pricing in high expectations`);
  }
  return bullets;
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

  // Coerce peg to number — API may return it as a string
  const rawPeg = ve.valuation.peg;
  const peg    = rawPeg === null || rawPeg === undefined ? null : Number(rawPeg);

  const peMidpoint   = extractPEMidpoint(ve.valuation.peRange);
  const isPreProfit  = peg === null && peMidpoint !== null && peMidpoint > 50;
  const psRatio      = isPreProfit && marketCap ? calcPS(marketCap, ve.estimates.fy1.revenueRange) : null;
  const verdict      = pegVerdict(peg, ve.valuation.peRange);

  const insight = buildInsight(
    ve.valuation.peRange, peg, price,
    ve.assumptions.revenueGrowth, marketCap,
    ve.estimates.fy1.revenueRange, fy1,
  );

  return (
    <section className="card-base p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-text-primary">Forward valuation</h2>
          <span className={`text-2xs font-medium px-2 py-0.5 rounded-full border ${modeColor(ve.mode)}`}>
            {ve.mode === "GUIDED" ? "Management guided" : ve.mode === "DERIVED" ? "Analyst derived" : "Baseline estimate"}
          </span>
          <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full border ${verdict.cls}`}>
            {verdict.label}
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
          <div className="text-xs font-semibold text-text-primary pt-0.5">
            {isPreProfit ? `${fy2} Forward PE` : "Forward PE"}
          </div>
          <div className="text-xs font-bold text-signal-amber">{pe.value}</div>
          <div className="text-2xs text-text-muted leading-relaxed">
            {isPreProfit ? `Based on ${fy2} PAT (${fy1} earnings near zero)` : pe.note}
          </div>
        </div>

        {/* P/Sales — shown for pre-profit companies */}
        {isPreProfit && psRatio && (
          <div className="grid gap-3 py-2 border-b border-border/50"
            style={{ gridTemplateColumns: "130px minmax(0,1fr) minmax(0,1.4fr)" }}>
            <div className="text-xs font-semibold text-text-primary pt-0.5">{fy1} Price/Sales</div>
            <div className="text-xs font-bold text-signal-blue">{psRatio}</div>
            <div className="text-2xs text-text-muted leading-relaxed">
              Mcap ÷ {fy1} revenue midpoint — more reliable metric for pre-profit companies
            </div>
          </div>
        )}

        {/* PEG */}
        <div className="grid gap-3 py-2"
          style={{ gridTemplateColumns: "130px minmax(0,1fr) minmax(0,1.4fr)" }}>
          <div className="text-xs font-semibold text-text-primary">PEG</div>
          {peg !== null ? (
            <>
              <div className={`text-xs font-bold ${peg < 1 ? "text-signal-green" : peg < 1.5 ? "text-signal-amber" : "text-signal-red"}`}>
                {peg.toFixed(1)}
              </div>
              <div className="text-2xs text-text-muted">PE midpoint ÷ growth %</div>
            </>
          ) : (
            <>
              <div className="text-xs text-text-muted">N/A</div>
              <div className="text-2xs text-text-muted">
                {isPreProfit
                  ? "Not meaningful — earnings near zero. Use Price/Sales instead."
                  : "Insufficient data to calculate PEG."}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Plain English insight — bullet list */}
      {insight.length > 0 && (
        <div className="bg-muted/40 rounded-lg px-3 py-2.5 space-y-1">
          {insight.map((bullet, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-text-muted text-xs mt-0.5 flex-shrink-0">·</span>
              <p className="text-xs text-text-primary leading-relaxed">{bullet}</p>
            </div>
          ))}
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
