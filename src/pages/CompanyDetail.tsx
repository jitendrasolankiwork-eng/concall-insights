import { useParams, Link } from "react-router-dom";
import { useState, useEffect, type ReactNode } from "react";
import { fetchCompany, fetchCompanyByQuarter, fetchAvailableQuarters } from "@/lib/api";
import ValuationSection from "@/components/ValuationSection";
import { CompanyInsight, Parameter } from "@/types/portfolio";

// ── Color helpers ──────────────────────────────────────────────────────────────
function ScoreColor(score: number) {
  if (score >= 4) return { text: "text-signal-green", bg: "bg-signal-green-bg", border: "border-signal-green" };
  if (score >= 3) return { text: "text-signal-amber", bg: "bg-signal-amber-bg", border: "border-signal-amber" };
  return { text: "text-signal-red", bg: "bg-signal-red-bg", border: "border-signal-red" };
}
function VerdictColor(key: string) {
  if (key === "buy")  return { text: "text-signal-green", bg: "bg-signal-green-bg" };
  if (key === "hold") return { text: "text-signal-amber", bg: "bg-signal-amber-bg" };
  return { text: "text-signal-red", bg: "bg-signal-red-bg" };
}
function ToneColor(tone: string) {
  if (tone === "confident") return { text: "text-signal-green", bg: "bg-signal-green-bg", dot: "bg-signal-green" };
  if (tone === "cautious")  return { text: "text-signal-amber", bg: "bg-signal-amber-bg", dot: "bg-signal-amber" };
  return { text: "text-signal-red", bg: "bg-signal-red-bg", dot: "bg-signal-red" };
}
function ThesisRowBg(answer: string) {
  if (answer === "yes")     return "bg-signal-green-bg";
  if (answer === "partial") return "bg-signal-amber-bg";
  if (answer === "no")      return "bg-signal-red-bg";
  return "bg-muted/40";
}
function ThesisIcon({ answer }: { answer: string }) {
  if (answer === "yes")     return <span className="text-signal-green font-bold text-sm">✓</span>;
  if (answer === "partial") return <span className="text-signal-amber font-bold text-sm">~</span>;
  if (answer === "no")      return <span className="text-signal-red font-bold text-sm">✕</span>;
  return <span className="text-text-muted font-bold text-sm">?</span>;
}
function ThesisLabel({ answer }: { answer: string }) {
  if (answer === "yes")
    return <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-signal-green text-white">Confirmed</span>;
  if (answer === "partial")
    return <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-signal-amber text-white">Partial</span>;
  if (answer === "no")
    return <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-signal-red text-white">Not passed</span>;
  return null;
}

// ── Red flag detector ────────────────────────────────────────────────────────
function detectRedFlags(company: CompanyInsight): string[] {
  const flags: string[] = [];
  const p    = company.parameters;
  const prev = company.previousCompositeScore;

  // Score drop > 0.5
  if (prev && company.compositeScore < prev - 0.5)
    flags.push(`Overall score dropped ${prev.toFixed(1)} → ${company.compositeScore.toFixed(1)}`);

  // Margin decline
  const m = p.marginOutlook;
  if (m.previousScore !== undefined && m.previousScore > m.score)
    flags.push(`Margin signal weakened (${m.previousScore} → ${m.score})`);

  // Revenue guidance declined
  const g = p.revenueGrowth;
  if (g.previousScore !== undefined && g.previousScore > g.score)
    flags.push(`Revenue growth signal declined (${g.previousScore} → ${g.score})`);

  // Defensive management tone
  if (company.managementTone === "defensive")
    flags.push("Management tone turned defensive in Q&A");

  // Weak signal despite high score (score ≥4 but tag has pressure)
  const mTag = (m.tag || "").toLowerCase();
  if (mTag.includes("pressure") || mTag.includes("risk"))
    flags.push(`Margin outlook: ${m.tag}`);

  return flags;
}

// ── Bullet list from long text ────────────────────────────────────────────────
// Splits on: sentence ends, semicolons, and comma-led contrast/result clauses
const BULLET_SPLIT_RE =
  /\.\s+|;\s+|,\s+(?=but\s|however\s|achieving\s|while\s|although\s|despite\s|with\s+(?=\d)|note\s)/i;

function splitIntoBullets(text: string, minLength = 12): string[] {
  const ORPHAN_MIN = 40; // bullets shorter than this get merged into the previous one
  const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  let parts = text
    .split(BULLET_SPLIT_RE)
    .map((s) => capitalise(s.trim().replace(/\.$/, "")))
    .filter((s) => s.length > minLength);

  // Second pass — if any bullet is still very long (>140 chars), try splitting
  // at the first ", " that appears after the 60-char mark
  const result: string[] = [];
  for (const part of parts) {
    if (part.length > 140) {
      const idx = part.indexOf(", ", 60);
      if (idx !== -1) {
        result.push(capitalise(part.substring(0, idx).trim()));
        const rest = capitalise(part.substring(idx + 2).trim());
        if (rest.length > minLength) result.push(rest);
        continue;
      }
    }
    result.push(part);
  }

  // Merge orphans: bullets shorter than ORPHAN_MIN get appended to the previous
  const merged: string[] = [];
  for (const part of result) {
    if (merged.length > 0 && part.length < ORPHAN_MIN) {
      merged[merged.length - 1] += ", " + part.charAt(0).toLowerCase() + part.slice(1);
    } else {
      merged.push(part);
    }
  }
  return merged;
}

function BulletList({
  text,
  textClass = "text-xs text-text-secondary",
}: {
  text: string;
  textClass?: string;
}) {
  const bullets = splitIntoBullets(text);
  if (bullets.length <= 1) {
    return <p className={`${textClass} leading-relaxed`}>{text}</p>;
  }
  return (
    <ul className="space-y-1 mt-1">
      {bullets.map((b, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <span className="text-text-muted mt-0.5 text-xs flex-shrink-0">·</span>
          <span className={`${textClass} leading-relaxed`}>{b}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Section header with left accent bar ──────────────────────────────────────
function SectionHeader({
  title, accent = "blue", right,
}: {
  title  : string;
  accent?: "green" | "amber" | "red" | "blue" | "neutral";
  right? : ReactNode;
}) {
  const bar: Record<string, string> = {
    green  : "bg-signal-green",
    amber  : "bg-signal-amber",
    red    : "bg-signal-red",
    blue   : "bg-signal-blue",
    neutral: "bg-text-muted",
  };
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className={`w-1 h-4 rounded-full flex-shrink-0 ${bar[accent]}`} />
        <h2 className="text-sm font-extrabold text-text-primary tracking-tight">{title}</h2>
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

// ── Source badge ───────────────────────────────────────────────────────────────
function SourceBadge({ source, link }: { source: string; link?: string }) {
  const isPPT = source === "PPT" || source.toLowerCase().includes("presentation");
  const cls   = isPPT
    ? "bg-signal-blue-bg text-signal-blue"
    : "bg-muted text-text-secondary";
  const label = isPPT ? "PPT" : "Concall";
  if (link && link !== "#" && link !== "") {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer"
        className={`text-2xs font-medium px-1.5 py-0.5 rounded ${cls} hover:opacity-70 flex items-center gap-0.5`}
        onClick={(e) => e.stopPropagation()}>
        {label} ↗
      </a>
    );
  }
  return <span className={`text-2xs font-medium px-1.5 py-0.5 rounded ${cls}`}>{label}</span>;
}

// ── Parameter card ─────────────────────────────────────────────────────────────
function ParameterCard({ label, icon, param, prevQ, curQ }: {
  label: string; icon: string; param: Parameter; prevQ?: string; curQ?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const sc      = ScoreColor(param.score);
  const changed = param.previousScore !== undefined && param.previousScore !== param.score;
  const hasKpis = param.kpis && param.kpis.length > 0;

  return (
    <div className={`card-base overflow-hidden border-l-[3px] ${sc.border}`}>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-extrabold text-text-primary tracking-tight">{label}</span>
          <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-lg ${sc.bg} ${sc.text}`}>
            {param.score}/5
          </span>
          {changed && (
            <span className={`text-2xs font-medium px-1.5 py-0.5 rounded ${
              param.previousScore! > param.score
                ? "bg-signal-red-bg text-signal-red"
                : "bg-signal-green-bg text-signal-green"
            }`}>
              {param.previousScore}→{param.score}
            </span>
          )}
          <span className={`text-2xs px-1.5 py-0.5 rounded ${sc.bg} ${sc.text}`}>{param.tag}</span>
        </div>
        {hasKpis && (
          <p className="text-xs text-text-secondary mt-1.5 line-clamp-1">
            → {param.kpis[0].label}: {param.kpis[0].value}
            {param.kpis[0].context ? ` (${param.kpis[0].context})` : ""}
          </p>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">

          {/* Key Metrics from PPT */}
          {hasKpis && (
            <div>
              <h4 className="text-xs font-semibold text-text-secondary mb-2">Key metrics</h4>
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
          )}

          {/* Capital projects */}
          {param.projects && param.projects.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-secondary mb-2">Capital projects</h4>
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

          {/* QoQ comparison */}
          {param.previousScore !== undefined && prevQ && curQ && (
            <div>
              <h4 className="text-xs font-semibold text-text-secondary mb-2">
                How score changed ({prevQ} → {curQ})
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-2xs text-text-muted mb-1">{prevQ}</p>
                  <p className="text-xs font-semibold text-text-primary">{param.previousScore}/5</p>
                </div>
                <div className={`rounded-lg p-3 ${
                  param.score > param.previousScore ? "bg-signal-green-bg" :
                  param.score < param.previousScore ? "bg-signal-red-bg"   : "bg-muted/50"
                }`}>
                  <p className="text-2xs text-text-muted mb-1">{curQ}</p>
                  <p className={`text-xs font-semibold ${ScoreColor(param.score).text}`}>
                    {param.score}/5
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reasoning */}
          <div>
            <h4 className="text-xs font-semibold text-text-secondary mb-1">AI reasoning</h4>
            <p className="text-xs text-text-secondary leading-relaxed">{param.reasoning}</p>
          </div>

          {/* Key quotes */}
          {param.evidence.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-secondary mb-2">Key quotes</h4>
              <div className="space-y-2">
                {param.evidence.map((ev, i) => (
                  <div key={i} className="border-l-2 border-signal-blue bg-signal-blue-bg/30 rounded-r-lg p-3">
                    <p className="text-xs italic text-text-secondary leading-relaxed">"{ev.quote}"</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <SourceBadge source={ev.source} link={ev.link} />
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

// ── Main page ──────────────────────────────────────────────────────────────────
// ── How Scores Work Modal ─────────────────────────────────────────────────
function HowScoresModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 max-w-sm w-full space-y-4 relative"
        style={{ border: "0.5px solid hsl(var(--border))" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-text-primary">How scores work</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg leading-none">✕</button>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          Each company is rated on 3 signals extracted from quarterly concalls and investor presentations.
        </p>
        <div className="space-y-2">
          {[
            { icon: "🏗️", label: "Capex & Expansion",  desc: "Investment in growth" },
            { icon: "📈", label: "Revenue Growth",       desc: "Forward guidance visibility" },
            { icon: "📊", label: "Margin Outlook",       desc: "Profitability direction" },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-base">{s.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-text-primary">{s.label}</p>
                  <p className="text-2xs text-text-muted">{s.desc}</p>
                </div>
              </div>
              <span className="text-xs text-text-muted font-medium">0 – 5</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-secondary">Overall score = average of all 3 signals</p>
        <div className="border-t border-border" />
        <div className="space-y-2">
          {[
            { emoji: "🟢", label: "BUY",  range: "4.0 and above", color: "text-signal-green" },
            { emoji: "🟡", label: "HOLD", range: "3.0 – 3.9",     color: "text-signal-amber" },
            { emoji: "🔴", label: "WEAK", range: "Below 3.0",      color: "text-signal-red"   },
          ].map((v) => (
            <div key={v.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{v.emoji}</span>
                <span className={`text-xs font-bold ${v.color}`}>{v.label}</span>
              </div>
              <span className="text-xs text-text-muted">{v.range}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-border" />
        <p className="text-xs text-text-secondary leading-relaxed">
          Every score is backed by direct quotes from source documents.
          Click any <span className="font-semibold text-signal-blue">PPT ↗</span> or{" "}
          <span className="font-semibold text-text-secondary">Concall ↗</span> badge
          to verify the original statement.
        </p>
      </div>
    </div>
  );
}

export default function CompanyDetail() {
  const { ticker } = useParams<{ ticker: string }>();
  const sym = ticker?.toUpperCase() || "";

  const [company,    setCompany]    = useState<CompanyInsight | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [quarters,   setQuarters]   = useState<string[]>([]);
  const [activeQ,    setActiveQ]    = useState<string>("");
  const [showEvidence, setShowEvidence] = useState(false);
  const [showModal,    setShowModal]    = useState(false);
  const [valuation,          setValuation]          = useState<any>(null);
  const [marketCap,          setMarketCap]          = useState<number | null>(null);
  const [valuationEstimate,  setValuationEstimate]  = useState<any>(null);

  // Load latest on mount
  useEffect(() => {
    if (!sym) return;
    Promise.all([
      fetchCompany(sym),
      fetchAvailableQuarters(sym),
      fetch(`/api/company/${sym.toUpperCase()}`).then(r => r.json()),
    ])
      .then(([res, qtrs, rawResp]) => {
        setCompany(res);
        setQuarters(qtrs);
        setActiveQ(res.quarter);
        // Read valuation + marketCap directly from raw API response
        setValuation(rawResp.valuation || rawResp.latestInsight?.valuation || null);
        setMarketCap(rawResp.marketCap || rawResp.latestInsight?.marketCap || null);
        setValuationEstimate(rawResp.valuationEstimate || rawResp.latestInsight?.valuationEstimate || null);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [sym]);

  // Switch quarter
  const switchQuarter = async (q: string) => {
    if (q === activeQ) return;
    setLoading(true);
    try {
      const data = await fetchCompanyByQuarter(sym, q);
      setCompany(data);
      setActiveQ(q);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="w-7 h-7 border-2 border-foreground border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-text-muted">Loading {sym}…</p>
      </div>
    </div>
  );

  if (error || !company) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-text-primary font-semibold">{sym} not found</p>
        <p className="text-xs text-text-muted">Process this company via the Google Sheet pipeline first</p>
        <Link to="/" className="text-sm text-signal-blue hover:underline">← Back to dashboard</Link>
      </div>
    </div>
  );

  const vc = VerdictColor(company.verdict.key);
  const tc = ToneColor(company.managementTone);
  const scoreDelta = company.previousCompositeScore
    ? company.compositeScore - company.previousCompositeScore
    : 0;

  const params = [
    { key: "capex",   label: "Capex & Expansion", icon: "🏗️",  param: company.parameters.capex },
    { key: "revenue", label: "Revenue Growth",    icon: "📈", param: company.parameters.revenueGrowth },
    { key: "margins", label: "Margin Outlook",    icon: "📊", param: company.parameters.marginOutlook },
  ];

  const changedParams = params.filter(
    (p) => p.param.previousScore !== undefined && p.param.previousScore !== p.param.score
  );
  const stableParams = params.filter(
    (p) => p.param.previousScore === undefined || p.param.previousScore === p.param.score
  );

  const thesisEntries = [
    { key: "q1", label: "Business model clear",       data: company.thesis.q1_businessModel },
    { key: "q2", label: "Favorable sector outlook",   data: company.thesis.q2_sectorOutlook },
    { key: "q3", label: "Growing market share",       data: company.thesis.q3_marketShare },
    { key: "q4", label: "Revenue growth visibility",  data: company.thesis.q4_growthVisibility },
    { key: "q5", label: "Structural capex commitment",data: company.thesis.q5_structuralCapex },
    { key: "q6", label: "Operating leverage visible", data: company.thesis.q6_operatingLeverage },
  ];

  const thesisYes     = thesisEntries.filter((e) => e.data.answer === "yes").length;
  const thesisPartial = thesisEntries.filter((e) => e.data.answer === "partial").length;
  const thesisNo      = thesisEntries.filter((e) => e.data.answer === "no").length;

  const priceColor = company.priceChange >= 0 ? "text-signal-green" : "text-signal-red";

  return (
    <div className="min-h-screen bg-background">

      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
        <div className="container py-3.5">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-text-muted hover:text-text-primary transition-colors text-base leading-none">←</Link>
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted flex items-center justify-center flex-shrink-0 border border-border">
              {["zomato","hdfc-bank","polycab"].includes(company.slug) ? (
                <img
                  src={`https://s3-symbol-logo.tradingview.com/${company.slug}--big.svg`}
                  alt={company.company}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <span className="text-sm font-bold text-text-secondary">
                  {company.company.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-extrabold text-text-primary truncate tracking-tight leading-tight">
                {company.company}
              </h1>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className="text-2xs text-text-muted font-medium">{company.ticker} · {activeQ}</span>
                {company.investmentType && (
                  <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-signal-blue-bg text-signal-blue border border-signal-blue/20">
                    {company.investmentType}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-sm font-bold ${priceColor}`}>
                {company.price > 0 ? `₹${company.price.toLocaleString("en-IN")}` : "—"}
              </p>
            </div>
          </div>

          {/* Score row */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {/* Verdict — filled pill */}
            <span className={`text-sm font-extrabold px-3 py-1.5 rounded-xl border-2 border-current ${vc.bg} ${vc.text}`}>
              {company.verdict.emoji} {company.verdict.label}
            </span>
            {/* Score — display number */}
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-black leading-none ${ScoreColor(company.compositeScore).text}`}>
                {company.compositeScore.toFixed(1)}
              </span>
              <span className="text-xs font-semibold text-text-muted">/5</span>
            </div>
            {/* Score delta */}
            {scoreDelta !== 0 && (
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                scoreDelta > 0 ? "bg-signal-green-bg text-signal-green" : "bg-signal-red-bg text-signal-red"
              }`}>
                {scoreDelta > 0 ? "▲" : "▼"} {Math.abs(scoreDelta).toFixed(1)} vs {company.previousQuarter}
              </span>
            )}
            {/* Confidence — pushed to new line on mobile via flex-wrap */}
            {company.confidence.total > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-2xs font-semibold text-text-secondary hidden sm:inline">
                  ✓ {company.confidence.display}
                </span>
                <span className="text-2xs font-semibold text-text-secondary sm:hidden">
                  ✓ {company.confidence.verified}/{company.confidence.total} verified
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">

        {/* Quarter selector */}
        {quarters.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {quarters.map((q) => (
              <button key={q} onClick={() => switchQuarter(q)}
                className={`text-xs font-bold px-4 py-1.5 rounded-full transition-all ${
                  q === activeQ
                    ? "bg-foreground text-card shadow-sm"
                    : "bg-muted text-text-muted hover:bg-border"
                }`}>
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Section nav — jump to key sections */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {[
            { label: "Thesis",     id: "section-thesis"     },
            { label: "Valuation",  id: "section-valuation"  },
            { label: "Parameters", id: "section-params"     },
            { label: "Risks",      id: "section-risks"      },
          ].map(({ label, id }) => (
            <a key={id} href={`#${id}`}
              className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full bg-muted text-text-secondary hover:bg-border transition-colors">
              {label}
            </a>
          ))}
        </div>

        {/* 1 — Action summary + trust line */}
        {company.investorTake && (
          <div className={`rounded-2xl px-5 py-4 border-l-4 border-current ${vc.bg} ${vc.text}`}>
            <p className={`text-sm font-bold leading-relaxed ${vc.text}`}>
              {company.verdict.emoji} {splitIntoBullets(company.investorTake)[0] || company.investorTake}
            </p>
            {company.confidence.verified > 0 && (
              <p className="text-2xs text-text-muted mt-2.5 font-medium">
                ✓ Based on {company.confidence.verified} verified management statement{company.confidence.verified !== 1 ? "s" : ""} · {company.quarter}
              </p>
            )}
          </div>
        )}

        {/* 2 — Red flags (Change 3, only shown when triggered) */}
        {(() => {
          const flags = detectRedFlags(company);
          if (!flags.length) return null;
          return (
            <div className="rounded-xl px-4 py-3 bg-signal-red-bg border border-signal-red/20 space-y-1.5">
              <p className="text-xs font-semibold text-signal-red">Watch — signals to monitor</p>
              {flags.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-signal-red text-xs mt-0.5">⚠</span>
                  <p className="text-xs text-signal-red">{f}</p>
                </div>
              ))}
            </div>
          );
        })()}


        {/* What changed this quarter */}
        {company.previousQuarter && (changedParams.length > 0 || stableParams.length > 0) && (
          <section className="card-base p-5 space-y-3 border-t-2 border-signal-amber">
            <SectionHeader
              title="What changed this quarter"
              accent="amber"
              right={<span className="text-2xs text-text-muted font-medium">{company.previousQuarter} → {activeQ}</span>}
            />
            {changedParams.length > 0 ? (
              <div className="space-y-2">
                {changedParams.map((p) => {
                  const declined = (p.param.previousScore || 0) > p.param.score;
                  return (
                    <div key={p.key} className={`rounded-lg px-3 py-2.5 flex items-center justify-between ${
                      declined ? "bg-signal-red-bg" : "bg-signal-green-bg"
                    }`}>
                      <div>
                        <span className="text-xs font-semibold text-text-primary">{p.label}</span>
                        <span className={`text-2xs ml-2 ${declined ? "text-signal-red" : "text-signal-green"}`}>
                          {declined ? "Eased" : "Improved"}
                        </span>
                      </div>
                      <span className={`text-xs font-bold ${declined ? "text-signal-red" : "text-signal-green"}`}>
                        {p.param.previousScore} → {p.param.score}
                      </span>
                    </div>
                  );
                })}
                {stableParams.map((p) => (
                  <div key={p.key} className="rounded-lg px-3 py-2 flex items-center justify-between bg-muted/40">
                    <span className="text-xs text-text-secondary">{p.label}</span>
                    <span className="text-xs font-semibold text-text-muted">{p.param.score}/5 — unchanged</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-signal-green">✓ All signals held steady this quarter</p>
            )}
          </section>
        )}

        {/* Valuation section */}
        <div id="section-valuation">
        <ValuationSection
          valuationEstimate={valuationEstimate}
          marketCap={marketCap}
          quarter={activeQ}
          price={company.price}
        />
        </div>

        {/* If you own this stock — actionable bullets only */}
        {company.investorTake && (() => {
          const ACTION_KW = ["accumulate", "hold", "buy", "sell", "monitor", "consider", "avoid", "exit", "reduce", "maintain", "watch", "wait", "chase", "trim", "book", "add", "stay", "invest", "keep"];
          const allBullets   = splitIntoBullets(company.investorTake);
          const actionBullets = allBullets.filter((s) => ACTION_KW.some((kw) => s.toLowerCase().includes(kw)));
          const bullets = actionBullets.length > 0 ? actionBullets : allBullets;
          return (
            <div className="card-base p-5 border-t-2 border-signal-blue">
              <SectionHeader title="If you own this stock" accent="blue" />
              <div className="mt-3 space-y-1.5">
                {bullets.map((s, i) => {
                  const isWarning  = /monitor|watch|risk|decline|avoid|don.t chase/i.test(s);
                  const isPositive = /accumulate|maintain|hold|add|invest|keep/i.test(s);
                  const icon  = isWarning ? "⚠" : isPositive ? "✓" : "→";
                  const color = isWarning ? "text-signal-amber" : isPositive ? "text-signal-green" : "text-text-secondary";
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`text-xs font-semibold mt-0.5 ${color}`}>{icon}</span>
                      <p className={`text-xs leading-relaxed ${color}`}>{s}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* 4 — Summary strip */}
        <div className={`rounded-2xl p-4 space-y-2.5 border border-current/20 ${vc.bg}`}>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`text-sm font-extrabold ${vc.text}`}>{company.verdict.emoji} {company.verdict.label}</span>
            <span className={`text-sm font-extrabold ${vc.text}`}>{company.compositeScore.toFixed(1)}/5</span>
            {company.confidence.total > 0 && (
              <span className="text-2xs font-semibold px-2 py-0.5 rounded-full ml-auto bg-card/60 text-text-secondary border border-border">
                ✓ {company.confidence.display}
              </span>
            )}
          </div>
          <BulletList text={company.overallSummary} textClass="text-xs text-text-secondary" />
        </div>

        {/* 5 — Investment thesis */}
        <section id="section-thesis" className="card-base p-5 space-y-4 border-t-2 border-signal-blue">
          <SectionHeader
            title="Investment thesis"
            accent="blue"
            right={
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-2xs font-bold">
                  <span className="text-signal-green">{thesisYes} Confirmed</span>
                  <span className="text-text-muted">·</span>
                  <span className="text-signal-amber">{thesisPartial} Partial</span>
                  <span className="text-text-muted">·</span>
                  <span className="text-signal-red">{thesisNo} Not Passed</span>
                </div>
                <button onClick={() => setShowEvidence(!showEvidence)}
                  className="text-2xs font-semibold text-signal-blue hover:underline">
                  {showEvidence ? "Hide" : "Show"} sources
                </button>
              </div>
            }
          />

          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-signal-green rounded-full transition-all"
              style={{ width: `${(company.thesisPassed / company.thesisTotal) * 100}%` }} />
          </div>

          <div className="space-y-1">
            {thesisEntries.map((entry) => (
              <div key={entry.key} className={`rounded-lg p-3 ${ThesisRowBg(entry.data.answer)}`}>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5"><ThesisIcon answer={entry.data.answer} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-xs font-semibold text-text-primary">{entry.label}</p>
                      <ThesisLabel answer={entry.data.answer} />
                    </div>
                    <BulletList text={entry.data.summary} textClass="text-xs text-text-secondary" />
                    {showEvidence && (
                      <div className="mt-2 space-y-1">
                        <p className="text-2xs text-text-muted leading-relaxed italic">"{entry.data.evidence}"</p>
                        <span className="text-2xs text-text-muted">Source: {entry.data.source}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Management tone */}
          <div className={`rounded-lg p-3 ${tc.bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${tc.dot}`} />
              <span className={`text-xs font-semibold ${tc.text}`}>
                Management tone: {company.managementTone.charAt(0).toUpperCase() + company.managementTone.slice(1)}
              </span>
            </div>
            {company.thesis.managementTone.keyQuote && (
              <p className="text-xs italic text-text-secondary">"{company.thesis.managementTone.keyQuote}"</p>
            )}
            {company.thesis.managementTone.source && (
              <p className="text-2xs text-text-muted mt-1">Source: {company.thesis.managementTone.source}</p>
            )}
          </div>
        </section>

        {/* Analyst summary — what happened only */}
        <section className="rounded-2xl p-5 bg-signal-blue-bg border border-signal-blue/20">
          <p className="text-2xs font-bold text-signal-blue uppercase tracking-widest mb-1.5">What happened this quarter</p>
          <BulletList text={company.overallSummary} textClass="text-xs text-text-secondary" />
        </section>

        {/* Parameter breakdown */}
        <section id="section-params" className="space-y-3">
          <SectionHeader title="Parameter breakdown" accent="neutral" />
          {params.map((p) => (
            <ParameterCard key={p.key} label={p.label} icon={p.icon} param={p.param}
              prevQ={company.previousQuarter} curQ={activeQ} />
          ))}
        </section>

        {/* Risk factors */}
        {company.riskFactors.length > 0 && (
          <section id="section-risks" className="rounded-2xl p-5 bg-signal-red-bg border border-signal-red/20 space-y-3">
            <SectionHeader title="Risk factors" accent="red" />
            {company.riskFactors.map((risk, i) => {
              const borderColor =
                risk.severity === "HIGH"   ? "border-signal-red" :
                risk.severity === "MEDIUM" ? "border-signal-amber" :
                                             "border-border";
              const sevColor =
                risk.severity === "HIGH"   ? "text-signal-red" :
                risk.severity === "MEDIUM" ? "text-signal-amber" :
                                             "text-text-muted";
              return (
                <div key={i} className={`flex items-start gap-3 pl-3 border-l-2 ${borderColor}`}>
                  <div className="flex-1">
                    <span className={`text-2xs font-bold ${sevColor}`}>{risk.severity}</span>
                    <p className="text-xs text-text-secondary mt-0.5">{risk.description}</p>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Footer */}
        <footer className="text-center py-6 border-t border-border">
          <p className="text-2xs text-text-muted font-medium">
            Processed {company.processedAt} ·{" "}
            <button onClick={() => setShowModal(true)}
              className="text-signal-blue hover:underline font-semibold">
              How scores work ↗
            </button>
          </p>
        </footer>
        {showModal && <HowScoresModal onClose={() => setShowModal(false)} />}

      </main>
    </div>
  );
}
