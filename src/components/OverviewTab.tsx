/**
 * OverviewTab.tsx — Sub-tab 1 inside Fundamentals
 * What the company does, key products/services, geographies,
 * revenue model, verticals — sourced from Screener.in + our AI insights.
 */

import { useState, useEffect } from "react";
import { fetchFundamentals } from "@/lib/api";
import type { CompanyInsight } from "@/types/portfolio";

interface Props {
  symbol  : string;
  visible : boolean;
  company?: CompanyInsight | null;   // AI-processed insight (optional enrichment)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v: number | null, prefix = "", suffix = "") {
  if (v === null || v === undefined) return "—";
  return `${prefix}${v.toLocaleString("en-IN")}${suffix}`;
}

function MetricPill({ label, value, color = "bg-muted text-text-secondary" }: {
  label: string; value: string; color?: string;
}) {
  return (
    <div className={`rounded-lg px-3 py-2 flex flex-col gap-0.5 ${color}`}>
      <span className="text-2xs text-text-muted">{label}</span>
      <span className="text-xs font-bold text-text-primary">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-2">{children}</p>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function OverviewTab({ symbol, visible, company }: Props) {
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
        else setError(r.error || "Failed to load overview");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [visible, fetched, symbol]);

  if (!visible) return null;

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="card-base p-5 space-y-3">
        <div className="h-3 bg-muted rounded w-32 mb-3" />
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-5/6" />
        <div className="h-3 bg-muted rounded w-4/6" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg" />)}
      </div>
      <div className="card-base p-4 space-y-2">
        <div className="h-3 bg-muted rounded w-24 mb-2" />
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-4/5" />
      </div>
    </div>
  );

  if (error) return (
    <div className="card-base p-6 text-center">
      <p className="text-sm text-signal-red">⚠ {error}</p>
    </div>
  );

  if (!data) return null;

  const ov      = data.overview || {};
  const pl      = data.profitLoss;
  const bs      = data.balanceSheet;

  // ── AI enrichment from our own pipeline ──────────────────────────────────────
  // investmentType, business model from thesis
  const investmentType = company?.investmentType;
  const bizModel = company?.thesis?.q1_businessModel?.summary;
  const sectorOutlook = company?.thesis?.q2_sectorOutlook?.summary;
  const marketShare = company?.thesis?.q3_marketShare?.summary;
  const growthVisibility = company?.thesis?.q4_growthVisibility?.summary;

  // Latest revenue + PAT
  const latestRevenue = pl?.revenue?.slice(0, -1)?.filter((v: any) => v !== null)?.at(-1) ?? null;
  const latestProfit  = pl?.netProfit?.slice(0, -1)?.filter((v: any) => v !== null)?.at(-1) ?? null;
  const latestRevYear = pl?.years?.slice(0, -1)?.at(-1) ?? null;

  return (
    <div className="space-y-5">

      {/* Company description */}
      <div className="card-base p-5 space-y-4">

        {/* Header: name + investment type badge + website */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {ov.sector && (
              <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-muted text-text-secondary border border-border">
                {ov.sector}
              </span>
            )}
            {ov.industry && ov.industry !== ov.sector && (
              <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-muted text-text-secondary border border-border">
                {ov.industry}
              </span>
            )}
            {investmentType && (
              <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-signal-blue-bg text-signal-blue border border-signal-blue/20">
                {investmentType}
              </span>
            )}
          </div>
          {ov.website && (
            <a href={ov.website} target="_blank" rel="noopener noreferrer"
              className="text-2xs text-signal-blue hover:underline flex-shrink-0">
              🌐 Website ↗
            </a>
          )}
        </div>

        {/* Key description */}
        {ov.keyPoints && (
          <div>
            <SectionTitle>About the company</SectionTitle>
            <p className="text-sm text-text-primary leading-relaxed font-medium">
              {ov.keyPoints}
            </p>
          </div>
        )}
        {!ov.keyPoints && ov.about && (
          <div>
            <SectionTitle>About the company</SectionTitle>
            <p className="text-sm text-text-primary leading-relaxed">{ov.about}</p>
          </div>
        )}
      </div>

      {/* Key financial snapshot */}
      <div>
        <SectionTitle>Financial snapshot</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MetricPill label="Market Cap"    value={data.marketCap != null ? `₹${data.marketCap.toLocaleString("en-IN")} Cr` : "—"} />
          <MetricPill label={`Revenue (${(latestRevYear || "latest").replace("Mar ", "")})`} value={latestRevenue != null ? `₹${latestRevenue.toLocaleString("en-IN")} Cr` : "—"} />
          <MetricPill label={`Net Profit (${(latestRevYear || "latest").replace("Mar ", "")})`} value={latestProfit != null ? `₹${latestProfit.toLocaleString("en-IN")} Cr` : "—"} />
          <MetricPill label="ROE"           value={fmt(data.roe, "", "%")} color={
            data.roe >= 20 ? "bg-signal-green-bg text-signal-green" :
            data.roe >= 12 ? "bg-signal-amber-bg text-signal-amber" :
            "bg-muted text-text-secondary"
          } />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
          <MetricPill label="P/E Ratio"     value={fmt(data.pe, "", "x")} />
          <MetricPill label="3Y Rev CAGR"   value={data.cagr?.revenue3Y != null ? `${data.cagr.revenue3Y}%` : "—"} color={
            (data.cagr?.revenue3Y ?? 0) >= 20 ? "bg-signal-green-bg text-signal-green" :
            (data.cagr?.revenue3Y ?? 0) >= 10 ? "bg-signal-amber-bg text-signal-amber" :
            "bg-muted text-text-secondary"
          } />
          <MetricPill label="3Y PAT CAGR"   value={data.cagr?.profit3Y != null ? `${data.cagr.profit3Y}%` : "—"} color={
            (data.cagr?.profit3Y ?? 0) >= 20 ? "bg-signal-green-bg text-signal-green" :
            (data.cagr?.profit3Y ?? 0) >= 10 ? "bg-signal-amber-bg text-signal-amber" :
            "bg-muted text-text-secondary"
          } />
          <MetricPill label="D/E (latest)"  value={(() => {
            const de = bs?.debtToEquity?.slice(0, -1)?.filter((v: any) => v !== null)?.at(-1);
            return de != null ? `${de}x` : "—";
          })()} color={(() => {
            const de = bs?.debtToEquity?.slice(0, -1)?.filter((v: any) => v !== null)?.at(-1);
            return !de ? "bg-muted text-text-secondary" :
              de <= 1 ? "bg-signal-green-bg text-signal-green" :
              de <= 2 ? "bg-signal-amber-bg text-signal-amber" :
                        "bg-signal-red-bg text-signal-red";
          })()} />
        </div>
      </div>

      {/* AI Insights: Business model + sector + growth thesis */}
      {(bizModel || sectorOutlook || marketShare || growthVisibility) && (
        <div className="card-base p-5 space-y-4">
          <SectionTitle>AI analysis — from latest concall</SectionTitle>

          {bizModel && (
            <div>
              <p className="text-xs font-semibold text-text-primary mb-1">Business model</p>
              <p className="text-xs text-text-secondary leading-relaxed">{bizModel}</p>
            </div>
          )}

          {sectorOutlook && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-semibold text-text-primary mb-1">Sector outlook</p>
              <p className="text-xs text-text-secondary leading-relaxed">{sectorOutlook}</p>
            </div>
          )}

          {marketShare && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-semibold text-text-primary mb-1">Market share & positioning</p>
              <p className="text-xs text-text-secondary leading-relaxed">{marketShare}</p>
            </div>
          )}

          {growthVisibility && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-semibold text-text-primary mb-1">Revenue growth visibility</p>
              <p className="text-xs text-text-secondary leading-relaxed">{growthVisibility}</p>
            </div>
          )}
        </div>
      )}

      {/* Screener Pros / Cons */}
      {(ov.pros?.length > 0 || ov.cons?.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ov.pros?.length > 0 && (
            <div className="card-base p-4">
              <SectionTitle>Pros (Screener)</SectionTitle>
              <ul className="space-y-1.5">
                {ov.pros.map((p: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-signal-green font-bold text-xs flex-shrink-0 mt-0.5">✓</span>
                    <span className="text-xs text-text-secondary leading-relaxed">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ov.cons?.length > 0 && (
            <div className="card-base p-4">
              <SectionTitle>Cons (Screener)</SectionTitle>
              <ul className="space-y-1.5">
                {ov.cons.map((c: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-signal-red font-bold text-xs flex-shrink-0 mt-0.5">✕</span>
                    <span className="text-xs text-text-secondary leading-relaxed">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {data._cachedAt && (
        <p className="text-2xs text-text-muted text-center">
          Screener.in data ·{" "}
          {(() => {
            const h = Math.round((Date.now() - new Date(data._cachedAt).getTime()) / 3_600_000);
            return h < 1 ? "Updated just now" : h < 24 ? `Updated ${h}h ago` : `Updated ${Math.round(h / 24)}d ago`;
          })()}
          {" · AI analysis from latest processed concall"}
        </p>
      )}
    </div>
  );
}
