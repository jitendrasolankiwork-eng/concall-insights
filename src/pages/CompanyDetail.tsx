import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { mockCompanies } from "@/data/mockData";
import { CompanyInsight, Parameter } from "@/types/portfolio";

function ScoreColor(score: number) {
  if (score >= 4) return { text: "text-signal-green", bg: "bg-signal-green-bg", border: "border-signal-green" };
  if (score >= 3) return { text: "text-signal-amber", bg: "bg-signal-amber-bg", border: "border-signal-amber" };
  return { text: "text-signal-red", bg: "bg-signal-red-bg", border: "border-signal-red" };
}

function VerdictColor(key: string) {
  if (key === "buy") return { text: "text-signal-green", bg: "bg-signal-green-bg" };
  if (key === "hold") return { text: "text-signal-amber", bg: "bg-signal-amber-bg" };
  return { text: "text-signal-red", bg: "bg-signal-red-bg" };
}

function ToneColor(tone: string) {
  if (tone === "confident") return { text: "text-signal-green", bg: "bg-signal-green-bg" };
  if (tone === "cautious") return { text: "text-signal-amber", bg: "bg-signal-amber-bg" };
  return { text: "text-signal-red", bg: "bg-signal-red-bg" };
}

function ThesisRowColor(answer: string) {
  if (answer === "yes") return "bg-signal-green-bg";
  if (answer === "partial") return "bg-signal-amber-bg";
  if (answer === "no") return "bg-signal-red-bg";
  return "bg-signal-neutral-bg";
}

function ThesisIcon(answer: string) {
  if (answer === "yes") return <span className="text-signal-green font-bold">✓</span>;
  if (answer === "partial") return <span className="text-signal-amber font-bold">~</span>;
  if (answer === "no") return <span className="text-signal-red font-bold">✕</span>;
  return <span className="text-signal-neutral font-bold">?</span>;
}

function SourceBadge({ source, link }: { source: string; link?: string }) {
  const isPPT = source === "PPT" || source.includes("Presentation");
  const cls = isPPT
    ? "bg-signal-blue-bg text-signal-blue"
    : "bg-signal-neutral-bg text-signal-neutral";
  const label = isPPT ? "PPT" : "Concall";
  if (link && link !== "#") {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className={`text-2xs font-medium px-1.5 py-0.5 rounded ${cls} hover:opacity-70`}>
        {label} ↗
      </a>
    );
  }
  return <span className={`text-2xs font-medium px-1.5 py-0.5 rounded ${cls}`}>{label}</span>;
}

function ParameterCard({ label, icon, param }: { label: string; icon: string; param: Parameter }) {
  const [expanded, setExpanded] = useState(false);
  const sc = ScoreColor(param.score);
  const changed = param.previousScore !== undefined && param.previousScore !== param.score;

  return (
    <div className="card-base overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-semibold text-text-primary">{label}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${sc.bg} ${sc.text}`}>
            {param.score}/5
          </span>
          {changed && (
            <span className={`text-2xs font-medium px-1.5 py-0.5 rounded ${param.previousScore! > param.score ? "bg-signal-red-bg text-signal-red" : "bg-signal-green-bg text-signal-green"}`}>
              {param.previousScore}→{param.score}
            </span>
          )}
          <span className={`text-2xs px-1.5 py-0.5 rounded ${sc.bg} ${sc.text}`}>{param.tag}</span>
        </div>
        <p className="text-xs text-text-secondary mt-1.5 line-clamp-1">
          {param.kpis[0] && `→ ${param.kpis[0].value}${param.kpis[0].context ? ` (${param.kpis[0].context})` : ""}`}
        </p>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          {/* KPIs */}
          <div>
            <h4 className="text-xs font-semibold text-text-secondary mb-2">Key Metrics</h4>
            <div className="space-y-1.5">
              {param.kpis.map((kpi, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary">{kpi.label}</span>
                    {kpi.context && <span className="text-text-muted">({kpi.context})</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-text-primary">{kpi.value}</span>
                    <SourceBadge source={kpi.source} link={kpi.link} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Projects */}
          {param.projects && param.projects.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-secondary mb-2">Capital Projects</h4>
              <div className="space-y-2">
                {param.projects.map((proj, i) => (
                  <div key={i} className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-text-primary mb-1.5">{proj.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {proj.kpis.map((k, j) => (
                        <span key={j} className="text-2xs px-2 py-0.5 rounded-full bg-card border border-border text-text-secondary">
                          {k.label}: <span className="font-semibold text-text-primary">{k.value}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning */}
          <div>
            <h4 className="text-xs font-semibold text-text-secondary mb-1">AI Reasoning</h4>
            <p className="text-xs text-text-secondary leading-relaxed">{param.reasoning}</p>
          </div>

          {/* Quotes */}
          {param.evidence.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-secondary mb-2">Key Quotes</h4>
              <div className="space-y-2">
                {param.evidence.map((ev, i) => (
                  <div key={i} className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs italic text-text-secondary leading-relaxed">"{ev.quote}"</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-2xs text-text-muted">{ev.source}</span>
                      {ev.link && ev.link !== "#" && (
                        <a href={ev.link} target="_blank" rel="noopener noreferrer" className="text-2xs text-signal-blue hover:underline">
                          View source ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CompanyDetail() {
  const { ticker } = useParams<{ ticker: string }>();
  const company = mockCompanies.find((c) => c.ticker === ticker);
  const [showEvidence, setShowEvidence] = useState(false);

  if (!company) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-text-primary font-semibold">Company not found</p>
          <Link to="/" className="text-sm text-signal-blue hover:underline">← Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const vc = VerdictColor(company.verdict.key);
  const tc = ToneColor(company.managementTone);
  const scoreDelta = company.previousCompositeScore
    ? company.compositeScore - company.previousCompositeScore
    : 0;

  const thesisEntries = [
    { key: "q1", label: "Differentiated business model", data: company.thesis.q1_businessModel },
    { key: "q2", label: "Favorable sector outlook", data: company.thesis.q2_sectorOutlook },
    { key: "q3", label: "Growing market share", data: company.thesis.q3_marketShare },
    { key: "q4", label: "Revenue growth visibility", data: company.thesis.q4_growthVisibility },
    { key: "q5", label: "Structural capex commitment", data: company.thesis.q5_structuralCapex },
    { key: "q6", label: "Operating leverage potential", data: company.thesis.q6_operatingLeverage },
  ];

  const params = [
    { key: "capex", label: "Capex & Expansion", icon: "🏗️", param: company.parameters.capex },
    { key: "revenue", label: "Revenue Growth", icon: "📈", param: company.parameters.revenueGrowth },
    { key: "margins", label: "Margin Outlook", icon: "📊", param: company.parameters.marginOutlook },
  ];

  // Trends
  const changedParams = params.filter(
    (p) => p.param.previousScore !== undefined && p.param.previousScore !== p.param.score
  );
  const stableParams = params.filter(
    (p) => p.param.previousScore === undefined || p.param.previousScore === p.param.score
  );

  const priceColor = company.priceChange >= 0 ? "text-signal-green" : "text-signal-red";

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="container py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-text-muted hover:text-text-primary transition-colors text-sm">
              ←
            </Link>
            <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
              <img
                src={`https://s3-symbol-logo.tradingview.com/${company.slug}--big.svg`}
                alt={company.company}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-text-primary truncate">{company.company}</h1>
              <p className="text-2xs text-text-muted">{company.ticker} · {company.quarter}</p>
            </div>
            <span className={`text-xs font-medium ${priceColor}`}>
              ₹{company.price.toLocaleString("en-IN")}
            </span>
          </div>
          {/* Score row */}
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-2xl font-bold ${ScoreColor(company.compositeScore).text}`}>
              {company.compositeScore.toFixed(1)}<span className="text-sm font-normal text-text-muted">/5</span>
            </span>
            <span className="text-2xs text-text-muted">
              Capex({company.parameters.capex.score}) + Growth({company.parameters.revenueGrowth.score}) + Margin({company.parameters.marginOutlook.score})
            </span>
            <span className="text-2xs font-medium px-1.5 py-0.5 rounded bg-signal-green-bg text-signal-green ml-auto">
              ✓ {company.confidence.display}
            </span>
          </div>
        </div>
      </header>

      <main className="container py-5 space-y-5">
        {/* Quarter tabs placeholder */}
        <div className="flex gap-2">
          <span className="text-xs font-medium px-3 py-1.5 rounded-md bg-foreground text-card">
            {company.quarter}
          </span>
          {company.previousQuarter && (
            <span className="text-xs font-medium px-3 py-1.5 rounded-md bg-muted text-text-muted cursor-pointer hover:bg-border transition-colors">
              {company.previousQuarter}
            </span>
          )}
        </div>

        {/* Section 1 — Summary Strip */}
        <div className={`rounded-xl p-3 flex items-center gap-3 flex-wrap ${vc.bg}`}>
          <span className={`text-sm font-bold ${vc.text}`}>{company.verdict.emoji} {company.verdict.label}</span>
          <span className={`text-sm font-bold ${vc.text}`}>{company.compositeScore.toFixed(1)}/5</span>
          <span className="text-xs text-text-secondary">|</span>
          <span className="text-xs text-text-secondary">{company.overallSummary.slice(0, 80)}…</span>
          <span className="text-2xs font-medium px-1.5 py-0.5 rounded bg-signal-green-bg text-signal-green ml-auto">
            ✓ {company.confidence.display}
          </span>
        </div>

        {/* Section 2 — Investment Thesis */}
        <section className="card-base p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-text-primary">Investment thesis</h2>
              <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-signal-blue-bg text-signal-blue">
                {company.thesisPassed}/{company.thesisTotal} passed
              </span>
            </div>
            <button
              onClick={() => setShowEvidence(!showEvidence)}
              className="text-2xs text-signal-blue hover:underline"
            >
              {showEvidence ? "Hide" : "Show"} evidence & sources
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-signal-green rounded-full transition-all"
              style={{ width: `${(company.thesisPassed / company.thesisTotal) * 100}%` }}
            />
          </div>

          {/* Thesis rows */}
          <div className="space-y-1">
            {thesisEntries.map((entry) => (
              <div key={entry.key} className={`rounded-lg p-3 ${ThesisRowColor(entry.data.answer)}`}>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5">{ThesisIcon(entry.data.answer)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-text-primary">{entry.label}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{entry.data.summary}</p>
                    {showEvidence && (
                      <div className="mt-2 space-y-1">
                        <p className="text-2xs text-text-muted leading-relaxed">{entry.data.evidence}</p>
                        <span className="text-2xs text-text-muted italic">Source: {entry.data.source}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Management Tone */}
          <div className={`rounded-lg p-3 ${tc.bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${tc.text === "text-signal-green" ? "bg-signal-green" : tc.text === "text-signal-amber" ? "bg-signal-amber" : "bg-signal-red"}`} />
              <span className={`text-xs font-semibold ${tc.text}`}>
                Management Tone: {company.managementTone.charAt(0).toUpperCase() + company.managementTone.slice(1)}
              </span>
            </div>
            <p className="text-xs italic text-text-secondary">"{company.thesis.managementTone.keyQuote}"</p>
            <p className="text-2xs text-text-muted mt-1">Source: {company.thesis.managementTone.source}</p>
          </div>
        </section>

        {/* Section 3 — Buy/Hold/Weak Signal */}
        <section className="card-base p-4 space-y-3">
          <h2 className={`text-sm font-bold ${vc.text}`}>
            {company.verdict.key === "buy"
              ? "STRONG BUY SIGNAL"
              : company.verdict.key === "hold"
              ? "HOLD — MONITOR"
              : "WEAK — CAUTION"}
          </h2>

          {scoreDelta !== 0 ? (
            <span className={`text-2xs font-medium px-2 py-0.5 rounded-full ${scoreDelta < 0 ? "bg-signal-red-bg text-signal-red" : "bg-signal-green-bg text-signal-green"}`}>
              {scoreDelta > 0 ? "▲" : "▼"} {Math.abs(scoreDelta).toFixed(1)} vs {company.previousQuarter} — {Math.abs(scoreDelta) <= 0.5 ? "minor change" : "significant change"}
            </span>
          ) : (
            company.previousQuarter && (
              <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-signal-neutral-bg text-signal-neutral">
                Unchanged vs {company.previousQuarter}
              </span>
            )
          )}

          <div className="flex flex-wrap gap-2">
            {params.map((p) => {
              const icon = p.param.score >= 4 ? "✅" : p.param.score >= 3 ? "⚠️" : "❌";
              return (
                <span key={p.key} className="text-xs text-text-secondary">
                  {icon} {p.label.split(" ")[0]} {p.param.score}/5
                </span>
              );
            })}
          </div>

          {changedParams.length > 0 && (
            <div className="space-y-1">
              {changedParams.map((p) => {
                const declined = (p.param.previousScore || 0) > p.param.score;
                return (
                  <p key={p.key} className={`text-xs ${declined ? "text-signal-red" : "text-signal-green"}`}>
                    {declined ? "▼" : "▲"} {p.label} {declined ? "declined" : "improved"} ({p.param.previousScore}→{p.param.score})
                  </p>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 4 — QoQ Trends */}
        {company.previousQuarter && (
          <section className="card-base p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary">Quarter-on-quarter</h2>
              <span className="text-2xs text-text-muted">{company.previousQuarter} → {company.quarter}</span>
            </div>

            {changedParams.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-secondary mb-2">What changed ({changedParams.length})</p>
                <div className="space-y-2">
                  {changedParams.map((p) => {
                    const declined = (p.param.previousScore || 0) > p.param.score;
                    const bg = declined ? "bg-signal-red-bg" : "bg-signal-green-bg";
                    const text = declined ? "text-signal-red" : "text-signal-green";
                    return (
                      <div key={p.key} className={`rounded-lg p-3 ${bg}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-text-primary">{p.label}</span>
                          <span className={`text-xs font-bold ${text}`}>
                            {p.param.previousScore}→{p.param.score}
                          </span>
                        </div>
                        <span className={`text-2xs font-medium ${text}`}>
                          {declined ? "Eased" : "Improved"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {stableParams.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-secondary mb-2">What stayed the same ({stableParams.length})</p>
                <div className="space-y-1">
                  {stableParams.map((p) => (
                    <div key={p.key} className="rounded-lg p-3 bg-signal-neutral-bg flex items-center justify-between">
                      <span className="text-xs text-text-secondary">{p.label}</span>
                      <span className="text-xs font-semibold text-text-primary">{p.param.score}/5</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={`text-xs p-2 rounded-lg ${changedParams.some((p) => (p.param.previousScore || 0) > p.param.score) ? "bg-signal-amber-bg text-signal-amber" : "bg-signal-green-bg text-signal-green"}`}>
              {changedParams.some((p) => (p.param.previousScore || 0) > p.param.score)
                ? `⚠ Watch: ${changedParams.filter((p) => (p.param.previousScore || 0) > p.param.score).map((p) => p.label).join(", ")} declining`
                : "✓ All signals held steady"}
            </div>
          </section>
        )}

        {/* Section 5 — Analyst Summary */}
        <section className="rounded-xl p-4 space-y-3 bg-signal-blue-bg">
          <div>
            <h3 className="text-xs font-semibold text-signal-blue mb-1">What happened this quarter</h3>
            <p className="text-xs text-text-secondary leading-relaxed">{company.overallSummary}</p>
          </div>
          <div className="border-t border-signal-blue/20 pt-3">
            <h3 className="text-xs font-semibold text-signal-blue mb-1">What it means for your investment</h3>
            <p className="text-xs font-semibold text-text-primary leading-relaxed">{company.investorTake}</p>
          </div>
        </section>

        {/* Section 6 — Parameter Breakdown */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-text-primary">Parameter Breakdown</h2>
          {params.map((p) => (
            <ParameterCard key={p.key} label={p.label} icon={p.icon} param={p.param} />
          ))}
        </section>

        {/* Section 7 — Risk Factors */}
        <section className="rounded-xl p-4 bg-signal-red-bg space-y-2">
          <h2 className="text-sm font-bold text-signal-red">Risk Factors</h2>
          {company.riskFactors.map((risk, i) => {
            const sevColor =
              risk.severity === "HIGH"
                ? "bg-signal-red text-card"
                : risk.severity === "MEDIUM"
                ? "bg-signal-amber text-card"
                : "bg-signal-neutral text-card";
            return (
              <div key={i} className="flex items-start gap-2">
                <span className={`text-2xs font-bold px-1.5 py-0.5 rounded ${sevColor} flex-shrink-0 mt-0.5`}>
                  {risk.severity}
                </span>
                <p className="text-xs text-text-secondary">{risk.description}</p>
              </div>
            );
          })}
        </section>

        {/* Footer */}
        <footer className="text-center py-4 border-t border-border">
          <p className="text-2xs text-text-muted">Processed {company.processedAt} · Claude Haiku</p>
        </footer>
      </main>
    </div>
  );
}
