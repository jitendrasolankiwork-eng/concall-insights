"use client";
import { useState } from "react";
import type { ValuationEstimate } from "../types/portfolio";

interface Props {
  valuationEstimate : ValuationEstimate | null;
  marketCap         : number | null;
  quarter           : string;
  price             : number;
}

// ── FY labels from quarter ────────────────────────────────────────────────────
const getFYLabels = (quarter: string) => {
  const m = quarter.match(/FY(\d+)/);
  if (!m) return { fy1: "FY+1", fy2: "FY+2" };
  const cur = parseInt(m[1]);
  return { fy1: `FY${cur + 1}`, fy2: `FY${cur + 2}` };
};

// ── Unit normalisation: Mn → Cr ───────────────────────────────────────────────
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

// ── Badge colour helpers ──────────────────────────────────────────────────────
const modeColor = (mode: string) =>
  mode === "GUIDED"  ? "bg-signal-green-bg text-signal-green border-signal-green/20" :
  mode === "DERIVED" ? "bg-signal-amber-bg text-signal-amber border-signal-amber/20" :
                       "bg-signal-red-bg text-signal-red border-signal-red/20";

const verdictColor = (verdict: string) =>
  verdict === "Cheap"     ? "bg-signal-green-bg text-signal-green border-signal-green/20" :
  verdict === "Expensive" ? "bg-signal-red-bg text-signal-red border-signal-red/20"       :
                            "bg-signal-amber-bg text-signal-amber border-signal-amber/20";

const confLabel = (conf: string) =>
  conf === "High"   ? "Strong management guidance" :
  conf === "Medium" ? "Based on management commentary" :
                      "Weak or unclear data";

// ── Archetype pill colour ─────────────────────────────────────────────────────
const archetypeColor = (archetype: string) => {
  if (archetype.includes("Financial"))      return "bg-signal-blue-bg text-signal-blue border-signal-blue/20";
  if (archetype.includes("Asset-Light"))    return "bg-signal-green-bg text-signal-green border-signal-green/20";
  if (archetype.includes("Consumer"))       return "bg-signal-amber-bg text-signal-amber border-signal-amber/20";
  if (archetype.includes("Asset-Heavy") || archetype.includes("Cyclical"))
                                            return "bg-signal-red-bg text-signal-red border-signal-red/20";
  return "bg-muted text-text-muted border-border"; // Early-Stage / Special Situation
};

// ── Format range "12.3x – 15.7x" ─────────────────────────────────────────────
const fmtRange = (low: number | null, high: number | null, suffix = "x"): string => {
  if (low === null && high === null) return "—";
  if (low === null)  return `~${high?.toFixed(1)}${suffix}`;
  if (high === null) return `~${low.toFixed(1)}${suffix}`;
  return `${low.toFixed(1)}${suffix} – ${high.toFixed(1)}${suffix}`;
};

const fmtNum = (n: number | null, suffix = "%"): string =>
  n === null ? "—" : `${n.toFixed(1)}${suffix}`;

// ── Table row component ───────────────────────────────────────────────────────
const TR = ({
  label, value, note, highlight = false,
}: { label: string; value: string; note?: string; highlight?: boolean }) => (
  <div className="grid gap-3 py-2 border-b border-border/50"
    style={{ gridTemplateColumns: "clamp(110px,38%,140px) minmax(0,1fr) minmax(0,1.4fr)" }}>
    <div className={`text-xs pt-0.5 ${highlight ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
      {label}
    </div>
    <div className={`text-xs font-bold ${highlight ? "text-signal-amber" : "text-text-primary"}`}>
      {value}
    </div>
    {note && <div className="text-2xs text-text-muted leading-relaxed">{note}</div>}
  </div>
);

// ── Secondary metric row — only renders if value non-null ─────────────────────
const SecondaryRow = ({ label, value, note }: { label: string; value: number | null; note?: string }) => {
  if (value === null) return null;
  return (
    <div className="grid gap-3 py-2 border-b border-border/50"
      style={{ gridTemplateColumns: "clamp(110px,38%,140px) minmax(0,1fr) minmax(0,1.4fr)" }}>
      <div className="text-xs text-text-secondary pt-0.5">{label}</div>
      <div className="text-xs font-semibold text-text-primary">{value.toFixed(1)}x</div>
      {note && <div className="text-2xs text-text-muted leading-relaxed">{note}</div>}
    </div>
  );
};

// ── Operating metric chip ─────────────────────────────────────────────────────
const OpChip = ({ label, value, suffix = "%" }: { label: string; value: number | null; suffix?: string }) => {
  if (value === null) return null;
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2 bg-muted/60 rounded-lg min-w-[72px]">
      <span className="text-2xs text-text-muted">{label}</span>
      <span className="text-xs font-bold text-text-primary">{value.toFixed(1)}{suffix}</span>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export default function ValuationSection({ valuationEstimate, marketCap, quarter, price }: Props) {
  const [showRisks, setShowRisks] = useState(false);

  if (!valuationEstimate || !marketCap) return null;

  // Handle legacy v1 format that still has old fields
  const ve = valuationEstimate as any; // eslint-disable-line

  // Detect if this is the new schema (has archetype field)
  const isNewSchema = "archetype" in valuationEstimate && "forwardEstimates" in valuationEstimate;

  // ── Legacy v1 fallback — render old minimal view ─────────────────────────
  if (!isNewSchema) {
    const legacyPE     = ve.valuation?.peRange   || "—";
    const legacyPEG    = ve.valuation?.peg        != null ? Number(ve.valuation.peg) : null;
    const legacyRev1   = normaliseCr(ve.estimates?.fy1?.revenueRange || "—");
    const legacyPAT1   = normaliseCr(ve.estimates?.fy1?.patRange     || "—");
    const { fy1 } = getFYLabels(quarter);
    return (
      <section className="card-base p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-text-primary">Forward valuation</h2>
          <span className="text-2xs font-medium px-2 py-0.5 rounded-full border bg-muted text-text-muted border-border">
            Legacy P/E
          </span>
          <span className="text-2xs text-text-muted">
            Reprocess this company to get the new archetype-based valuation.
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { l: `${fy1} Revenue`, v: legacyRev1 },
            { l: `${fy1} PAT`,     v: legacyPAT1 },
            { l: "Forward PE",     v: legacyPE   },
          ].map(({ l, v }) => (
            <div key={l} className="bg-muted/40 rounded-lg p-2">
              <p className="text-2xs text-text-muted">{l}</p>
              <p className="text-xs font-bold text-text-primary mt-0.5">{v}</p>
            </div>
          ))}
        </div>
        {legacyPEG !== null && (
          <p className="text-2xs text-text-muted">PEG: {legacyPEG.toFixed(1)}</p>
        )}
      </section>
    );
  }

  // ── New schema ────────────────────────────────────────────────────────────
  const { fy1, fy2 } = getFYLabels(quarter);
  const fe = valuationEstimate.forwardEstimates;
  const val = valuationEstimate.valuation;
  const ops = valuationEstimate.operatingMetrics;
  const sm  = val.secondaryMetrics;

  // Is this a Financials archetype?
  const isFinancial = valuationEstimate.archetype.includes("Financial");
  // Is this an Asset-Heavy / Manufacturing company?
  const isManufacturing = valuationEstimate.archetype.includes("Asset-Heavy") ||
                          valuationEstimate.archetype.includes("Cyclical");
  // Is this early-stage / pre-profit?
  const isEarlyStage = valuationEstimate.archetype.includes("Early-Stage") ||
                       valuationEstimate.archetype.includes("Special Situation");

  // Formatted primary range string
  const primaryRangeStr = fmtRange(val.primaryRange.low, val.primaryRange.high);

  // Operating metrics exist?
  const hasOpsMetrics = ops.roe !== null || ops.roa !== null || ops.nim !== null || ops.growth !== null;

  return (
    <section className="card-base p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-text-primary">Forward valuation</h2>
          <span className={`text-2xs font-medium px-2 py-0.5 rounded-full border ${archetypeColor(valuationEstimate.archetype)}`}>
            {valuationEstimate.archetype}
          </span>
          <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full border ${verdictColor(valuationEstimate.verdict)}`}>
            {valuationEstimate.verdict === "Cheap"     ? "🟢 Cheap"     :
             valuationEstimate.verdict === "Expensive" ? "🔴 Expensive" : "🟡 Fair value"}
          </span>
          <span className={`text-2xs font-medium px-2 py-0.5 rounded-full border ${modeColor(valuationEstimate.mode)}`}>
            {valuationEstimate.mode === "GUIDED" ? "Management guided" :
             valuationEstimate.mode === "MIXED"  ? "Partially guided"  : "Analyst derived"}
          </span>
          <span className="text-2xs text-text-muted">{confLabel(valuationEstimate.confidence)}</span>
        </div>
        <span className="text-2xs text-text-muted">Mcap ₹{marketCap.toLocaleString("en-IN")} Cr</span>
      </div>

      {/* Classification reason */}
      {valuationEstimate.classificationReason && (
        <p className="text-2xs text-text-muted italic leading-relaxed border-l-2 border-border pl-2">
          {valuationEstimate.classificationReason}
        </p>
      )}

      {/* ── 3-column table ── */}
      <div>
        {/* Header row */}
        <div className="grid gap-3 pb-2 border-b border-border"
          style={{ gridTemplateColumns: "clamp(110px,38%,140px) minmax(0,1fr) minmax(0,1.4fr)" }}>
          <div />
          <div className="text-2xs text-text-muted font-medium">Value</div>
          <div className="text-2xs text-text-muted font-medium">How we got here</div>
        </div>

        {/* Revenue FY+1 */}
        {fe.revenue.fy1 && (
          <TR label={`${fy1} Revenue`} value={normaliseCr(fe.revenue.fy1)} note="Forward revenue estimate" />
        )}

        {/* Revenue FY+2 */}
        {fe.revenue.fy2 && (
          <TR label={`${fy2} Revenue`} value={normaliseCr(fe.revenue.fy2)} note="FY+2 revenue estimate" />
        )}

        {/* PAT FY+1 — shown for all except early-stage where it may be null */}
        {fe.pat.fy1 && (
          <TR label={`${fy1} PAT`} value={normaliseCr(fe.pat.fy1)} note="Forward earnings estimate" />
        )}

        {/* AUM FY+1 — Financials (AMCs, wealth) */}
        {fe.aum.fy1 && (
          <TR label={`${fy1} AUM`} value={normaliseCr(fe.aum.fy1)} note="Assets under management estimate" />
        )}
        {fe.aum.fy2 && (
          <TR label={`${fy2} AUM`} value={normaliseCr(fe.aum.fy2)} note="FY+2 AUM estimate" />
        )}

        {/* Book Value FY+1 — Financials */}
        {fe.bookValue.fy1 && (
          <TR label={`${fy1} Book Value`} value={normaliseCr(fe.bookValue.fy1)} note="Net worth per share × shares" />
        )}

        {/* Primary metric — the headline number */}
        <TR
          label={`${val.primaryMetric}`}
          value={primaryRangeStr}
          note={
            val.primaryMetric === "P/B"       ? "Price to Book — primary metric for financial companies" :
            val.primaryMetric === "EV/EBITDA" ? "Enterprise Value to EBITDA — standard for manufacturing" :
            val.primaryMetric === "P/Sales"   ? "Market Cap ÷ revenue — used when earnings are near zero" :
                                                "Market Cap ÷ estimated earnings"
          }
          highlight
        />

        {/* Secondary metrics — render only non-null */}
        {isFinancial && (
          <>
            <SecondaryRow label="P/E (secondary)"       value={sm.pe}       note="Supplementary earnings multiple" />
            <SecondaryRow label="P/B (cross-check)"     value={sm.pb}       note="Book value cross-check" />
          </>
        )}
        {isManufacturing && (
          <>
            <SecondaryRow label="P/E (secondary)"       value={sm.pe}       note="Supplementary earnings multiple" />
            <SecondaryRow label="EV/EBITDA (check)"     value={sm.evEbitda} note="Operating cash flow multiple" />
          </>
        )}
        {!isFinancial && !isManufacturing && !isEarlyStage && (
          <SecondaryRow label="EV/EBITDA"               value={sm.evEbitda} note="Cross-check with operating cash flow" />
        )}

        {/* PEG — last row */}
        <div className="grid gap-3 py-2"
          style={{ gridTemplateColumns: "clamp(110px,38%,140px) minmax(0,1fr) minmax(0,1.4fr)" }}>
          <div className="text-xs font-semibold text-text-primary pt-0.5">PEG</div>
          {sm.peg !== null ? (
            <>
              <div className={`text-xs font-bold ${
                sm.peg < 1 ? "text-signal-green" : sm.peg < 1.5 ? "text-signal-amber" : "text-signal-red"
              }`}>
                {sm.peg.toFixed(1)}
              </div>
              <div className="text-2xs text-text-muted">
                {sm.peg < 1    ? "Below 1 — attractively valued for growth" :
                 sm.peg < 1.5  ? "Fair valuation relative to growth trajectory" :
                                  "Above 1.5 — market pricing in high expectations"}
              </div>
            </>
          ) : (
            <>
              <div className="text-xs text-text-muted">N/A</div>
              <div className="text-2xs text-text-muted">
                {isEarlyStage  ? "Not meaningful — pre-profit stage. Use P/Sales instead." :
                 isFinancial   ? "PEG not applicable for financial companies." :
                                 "Insufficient data to calculate PEG."}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Operating metrics chips — ROE, ROA, NIM, Growth */}
      {hasOpsMetrics && (
        <div className="space-y-1.5">
          <p className="text-2xs font-semibold text-text-primary">Operating metrics</p>
          <div className="flex flex-wrap gap-2">
            <OpChip label="ROE"    value={ops.roe}    />
            <OpChip label="ROA"    value={ops.roa}    />
            {ops.nim !== null && <OpChip label="NIM"    value={ops.nim}    />}
            <OpChip label="Growth" value={ops.growth} />
          </div>
        </div>
      )}

      {/* Plain English insight */}
      {price > 0 && (
        <div className="bg-muted/40 rounded-lg px-3 py-2.5 space-y-1">
          {price > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-text-muted text-xs mt-0.5 flex-shrink-0">·</span>
              <p className="text-xs text-text-primary leading-relaxed">
                Current price: ₹{price.toLocaleString("en-IN")}
              </p>
            </div>
          )}
          {val.primaryRange.low !== null && val.primaryRange.high !== null && (
            <div className="flex items-start gap-2">
              <span className="text-text-muted text-xs mt-0.5 flex-shrink-0">·</span>
              <p className="text-xs text-text-primary leading-relaxed">
                At current market cap, paying {primaryRangeStr} on {val.primaryMetric} basis
                — {valuationEstimate.verdict === "Cheap" ? "below" :
                   valuationEstimate.verdict === "Expensive" ? "above" : "at"} India sector fair value
              </p>
            </div>
          )}
          {ops.growth !== null && (
            <div className="flex items-start gap-2">
              <span className="text-text-muted text-xs mt-0.5 flex-shrink-0">·</span>
              <p className="text-xs text-text-primary leading-relaxed">
                Revenue growing ~{ops.growth.toFixed(0)}% annually (analyst estimate)
              </p>
            </div>
          )}
          {sm.peg !== null && (
            <div className="flex items-start gap-2">
              <span className="text-text-muted text-xs mt-0.5 flex-shrink-0">·</span>
              <p className="text-xs text-text-primary leading-relaxed">
                PEG {sm.peg.toFixed(1)} — {
                  sm.peg < 1 ? "stock looks attractively valued for its growth rate" :
                  sm.peg < 1.5 ? "fair valuation for the expected growth trajectory" :
                                 "stock may be pricing in optimistic future expectations"
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* Assumptions */}
      {valuationEstimate.assumptions.length > 0 && (
        <div className="bg-muted/40 rounded-lg px-3 py-2.5 space-y-1.5">
          <p className="text-2xs font-semibold text-text-primary">Assumptions</p>
          {valuationEstimate.assumptions.map((a, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-2xs text-text-muted mt-0.5">·</span>
              <p className="text-2xs text-text-muted leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      )}

      {/* Risks toggle */}
      {valuationEstimate.risks.length > 0 && (
        <>
          <button onClick={() => setShowRisks(!showRisks)}
            className="text-2xs text-signal-blue hover:underline">
            {showRisks ? "Hide estimate risks ↑" : "Show estimate risks ↓"}
          </button>
          {showRisks && (
            <div className="bg-signal-red-bg/40 rounded-lg px-3 py-2.5 space-y-1.5">
              <p className="text-2xs font-semibold text-signal-red">What could invalidate these estimates</p>
              {valuationEstimate.risks.map((r, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-2xs text-signal-red/70 mt-0.5">⚠</span>
                  <p className="text-2xs text-text-secondary leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {valuationEstimate.mode !== "GUIDED" && (
        <p className="text-2xs text-text-muted leading-relaxed">
          Estimates derived from management commentary and historical trends. Verify against actual financials before making investment decisions.
        </p>
      )}

    </section>
  );
}
