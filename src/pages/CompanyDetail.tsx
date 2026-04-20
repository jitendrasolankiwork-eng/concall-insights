import { useParams, Link, useSearchParams } from "react-router-dom";
import { useState, useEffect, useCallback, type ReactNode } from "react";
import { fetchCompany, fetchCompanyByQuarter, fetchAvailableQuarters, fetchRecentAnnouncements, type RecentAnnouncement } from "@/lib/api";
import ValuationSection from "@/components/ValuationSection";
import ThemeToggle from "@/components/ThemeToggle";
import { FundamentalsTab }   from "@/components/FundamentalsTab";
import { KeyRatiosTab }      from "@/components/KeyRatiosTab";
import { ShareholdingTab }   from "@/components/ShareholdingTab";
import { AnnouncementsTab }  from "@/components/AnnouncementsTab";
import { CompanyInsight, Parameter } from "@/types/portfolio";
import { useAuth } from "@/lib/auth";
import { useUserTags } from "@/hooks/useUserTags";
import type { TagCategory } from "@/hooks/useUserTags";

type ActiveTab = "insights" | "fundamentals" | "ratios" | "shareholding" | "announcements";

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

// ── Management tone card with collapsible quote ───────────────────────────────
function ManagementToneCard({ tone, keyQuote, source, tc }: {
  tone: string; keyQuote?: string; source?: string;
  tc: { bg: string; dot: string; text: string };
}) {
  const LIMIT = 120;
  const [expanded, setExpanded] = useState(false);
  const isLong = keyQuote && keyQuote.length > LIMIT;
  const displayQuote = isLong && !expanded
    ? keyQuote!.slice(0, LIMIT).trimEnd() + "…"
    : keyQuote;
  return (
    <div className={`rounded-lg p-3 ${tc.bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${tc.dot}`} />
        <span className={`text-xs font-semibold ${tc.text}`}>
          Management tone: {tone.charAt(0).toUpperCase() + tone.slice(1)}
        </span>
      </div>
      {keyQuote && (
        <div>
          <p className="text-xs italic text-text-secondary">"{displayQuote}"</p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={`text-2xs font-semibold mt-1.5 ${tc.text} hover:opacity-70 transition-opacity`}>
              {expanded ? "Show less ↑" : "Read more ↓"}
            </button>
          )}
        </div>
      )}
      {source && <p className="text-2xs text-text-muted mt-1">Source: {source}</p>}
    </div>
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

// ── Inline tag button for detail page header ─────────────────────────────────
function DetailTagButton({
  symbol, name, category, inFlight, onTag, onUntag,
}: {
  symbol   : string;
  name     : string;
  category : TagCategory | null;
  inFlight : boolean;
  onTag    : (cat: TagCategory) => void;
  onUntag  : () => void;
}) {
  const [open, setOpen] = useState(false);

  const label =
    inFlight   ? "…" :
    category === "portfolio" ? "📁 Portfolio" :
    category === "watchlist" ? "👁 Watchlist"  :
    "＋ Add to list";

  const btnCls =
    category === "portfolio" ? "bg-signal-green-bg text-signal-green border-signal-green/30" :
    category === "watchlist" ? "bg-signal-blue-bg text-signal-blue border-signal-blue/30"    :
    "bg-muted text-text-muted border-border hover:bg-border";

  return (
    <div className="relative ml-auto">
      <button
        disabled={inFlight}
        onClick={() => setOpen((v) => !v)}
        className={`text-2xs font-semibold px-2.5 py-1 rounded-full border transition-colors
          ${btnCls} ${inFlight ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-50 card-base rounded-xl py-1 shadow-lg w-44"
            style={{ border: "0.5px solid hsl(var(--border))" }}>
            <div className="px-3 py-1.5 border-b border-border mb-1">
              <p className="text-2xs font-semibold text-text-muted truncate">{name}</p>
            </div>
            <button
              onClick={() => { onTag("portfolio"); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center gap-2"
            >
              <span>📁</span><span>My Portfolio</span>
              {category === "portfolio" && <span className="ml-auto text-signal-green font-bold text-2xs">✓</span>}
            </button>
            <button
              onClick={() => { onTag("watchlist"); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center gap-2"
            >
              <span>👁</span><span>Watchlist</span>
              {category === "watchlist" && <span className="ml-auto text-signal-blue font-bold text-2xs">✓</span>}
            </button>
            {category && (
              <>
                <div className="border-t border-border mx-2 my-1" />
                <button
                  onClick={() => { onUntag(); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-signal-red hover:bg-signal-red-bg transition-colors flex items-center gap-2"
                >
                  <span>✕</span><span>Remove</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function CompanyDetail() {
  const { ticker } = useParams<{ ticker: string }>();
  const sym = ticker?.toUpperCase() || "";
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") || "insights") as ActiveTab;
  const setTab = (tab: ActiveTab) =>
    setSearchParams(tab === "insights" ? {} : { tab }, { replace: true });

  const [company,    setCompany]    = useState<CompanyInsight | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [quarters,   setQuarters]   = useState<string[]>([]);
  const [activeQ,    setActiveQ]    = useState<string>("");
  const [showEvidence,   setShowEvidence]   = useState(false);
  const [showModal,      setShowModal]      = useState(false);
  const [audience,       setAudience]       = useState<"own"|"considering"|"tracking">("own");
  const [valuation,          setValuation]          = useState<any>(null);
  const [marketCap,          setMarketCap]          = useState<number | null>(null);
  const [valuationEstimate,  setValuationEstimate]  = useState<any>(null);

  // ── Portfolio / Watchlist tagging ──────────────────────────────────────────
  const { user } = useAuth();
  const [tagToast, setTagToast] = useState<string | null>(null);
  const onTagSuccess = useCallback((
    symbol: string,
    action: "tagged" | "moved" | "removed",
    category?: TagCategory,
  ) => {
    if (action === "tagged")  setTagToast(`Added to ${category === "portfolio" ? "Portfolio 📁" : "Watchlist 👁"}`);
    if (action === "moved")   setTagToast(`Moved to ${category === "portfolio" ? "Portfolio 📁" : "Watchlist 👁"}`);
    if (action === "removed") setTagToast("Removed from list");
    setTimeout(() => setTagToast(null), 2500);
  }, []);
  const { tags, inFlight, tag: tagCompany, untag } = useUserTags(onTagSuccess);
  const tagCategory: TagCategory | null = sym ? (tags[sym] ?? null) : null;
  const tagInFlight = inFlight.has(sym);

  // Critical announcements (P5) for this company — shown as alert banner
  const [criticalAnns, setCriticalAnns] = useState<RecentAnnouncement[]>([]);

  useEffect(() => {
    if (!sym) return;
    fetchRecentAnnouncements(5, 10)
      .then((data) => setCriticalAnns(data.filter((a) => a.symbol === sym.toUpperCase())));
  }, [sym]);

  // Live price state — polled independently every 60s
  const [livePrice,      setLivePrice]      = useState<number | null>(null);
  const [livePricePct,   setLivePricePct]   = useState<number | null>(null);
  const [priceStale,     setPriceStale]     = useState(false);

  useEffect(() => {
    if (!sym) return;
    const poll = async () => {
      try {
        const resp = await fetch(`/api/price/${sym.toUpperCase()}`);
        const data = await resp.json();
        if (data.success && data.price) {
          setLivePrice(data.price);
          setLivePricePct(data.changePct ?? 0);
          setPriceStale(false);
        }
      } catch {
        setPriceStale(true);
      }
    };
    poll();
    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, [sym]);

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

  // Prefer live price over stale company.price
  const displayPrice    = livePrice  ?? company.price;
  const displayPricePct = livePricePct ?? company.priceChange;
  const priceColor      = displayPricePct >= 0 ? "text-signal-green" : "text-signal-red";

  return (
    <div className="min-h-screen bg-background">

      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
        <div className="container py-3">

          {/* Row 1: Back + name + price */}
          <div className="flex items-start gap-3">
            <Link to="/" className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none mt-0.5 flex-shrink-0">←</Link>

            {/* Logo */}
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-muted flex items-center justify-center flex-shrink-0 border border-border">
              <img
                src={`https://s3-symbol-logo.tradingview.com/${company.slug}--big.svg`}
                alt={company.company}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  el.style.display = "none";
                  el.nextElementSibling?.removeAttribute("style");
                }}
              />
              <span className="text-sm font-bold text-text-secondary" style={{ display: "none" }}>
                {company.company.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-extrabold text-text-primary truncate tracking-tight leading-snug">
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

            {/* Price */}
            <div className="text-right flex-shrink-0">
              <div className="flex items-center justify-end gap-1">
                {livePrice && !priceStale && (
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal-green opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal-green" />
                  </span>
                )}
                <p className={`text-base font-extrabold ${priceColor}`}>
                  {displayPrice > 0 ? `₹${displayPrice.toLocaleString("en-IN")}` : "—"}
                </p>
              </div>
              {displayPrice > 0 && (
                <p className={`text-xs font-semibold ${priceColor}`}>
                  {displayPricePct >= 0 ? "+" : ""}{displayPricePct.toFixed(2)}%
                </p>
              )}
              <div className="mt-0.5"><ThemeToggle /></div>
            </div>
          </div>

          {/* Row 2: Verdict + score + delta + confidence + tag button */}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border border-current ${vc.bg} ${vc.text}`}>
              {company.verdict.emoji} {company.verdict.label}
            </span>
            <div className="flex items-baseline gap-0.5">
              <span className={`text-2xl font-black leading-none ${ScoreColor(company.compositeScore).text}`}>
                {company.compositeScore.toFixed(1)}
              </span>
              <span className="text-xs font-semibold text-text-muted">/5</span>
            </div>
            {scoreDelta !== 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                scoreDelta > 0 ? "bg-signal-green-bg text-signal-green" : "bg-signal-red-bg text-signal-red"
              }`}>
                {scoreDelta > 0 ? "▲" : "▼"} {Math.abs(scoreDelta).toFixed(1)} vs {company.previousQuarter}
              </span>
            )}
            {company.confidence.total > 0 && (
              <span className="text-2xs font-semibold text-text-secondary">
                ✓ {company.confidence.display}
              </span>
            )}

            {/* Tag button — only when user is logged in */}
            {user && (
              <DetailTagButton
                symbol={sym}
                name={company.company}
                category={tagCategory}
                inFlight={tagInFlight}
                onTag={(cat) => tagCompany(sym, company.company, cat)}
                onUntag={() => untag(sym)}
              />
            )}
          </div>
        </div>
      </header>

      {/* Tag toast */}
      {tagToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
          <div className="text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg bg-foreground text-card animate-in fade-in slide-in-from-bottom-2 duration-200">
            {tagToast}
          </div>
        </div>
      )}

      <main className="container py-4 space-y-4">

        {/* Critical announcement alert banners (P5 only) */}
        {criticalAnns.map((ann) => (
          <div key={ann.id}
            className="flex items-start gap-3 p-3 rounded-xl"
            style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.3)" }}>
            <span className="text-lg flex-shrink-0 mt-0.5">🔴</span>
            <div className="flex-1 min-w-0">
              <p className="text-2xs font-bold text-signal-red uppercase tracking-wide mb-0.5">
                Critical Update · {ann.signal.type}
              </p>
              <p className="text-sm font-semibold text-text-primary leading-snug">{ann.signal.summary}</p>
              <p className="text-xs text-text-secondary mt-0.5">{ann.signal.impactExplanation}</p>
            </div>
            <span className="text-2xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 bg-signal-red-bg text-signal-red whitespace-nowrap">
              {ann.signal.action}
            </span>
          </div>
        ))}

        {/* Quarter selector — only show on Insights tab */}
        {quarters.length > 1 && activeTab === "insights" && (
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

        {/* ── Tab strip ── */}
        <div className="flex gap-0.5 border-b border-border overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {([
            { key: "insights",      label: "Insights"      },
            { key: "fundamentals",  label: "Fundamentals"  },
            { key: "ratios",        label: "Key ratios"    },
            { key: "shareholding",  label: "Shareholding"  },
            { key: "announcements", label: "Announcements" },
          ] as { key: ActiveTab; label: string }[]).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-px ${
                activeTab === t.key
                  ? "border-foreground text-text-primary"
                  : "border-transparent text-text-muted hover:text-text-secondary"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Non-Insights tabs ── */}
        {activeTab === "fundamentals"  && <FundamentalsTab  symbol={sym} visible company={company} />}
        {activeTab === "ratios"        && <KeyRatiosTab     symbol={sym} visible valuationEstimate={valuationEstimate} currentPrice={livePrice ?? company.price} />}
        {activeTab === "shareholding"  && <ShareholdingTab  symbol={sym} visible />}
        {activeTab === "announcements" && <AnnouncementsTab symbol={sym} visible />}

        {/* ── Insights tab content — Section nav + all existing sections ── */}
        {activeTab === "insights" && <>

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

        {/* 1 — All three signals */}
        {company.investorTake && (
          <div className={`rounded-2xl px-5 py-4 border-l-4 border-current ${vc.bg} ${vc.text}`}>
            <p className={`text-sm font-bold leading-relaxed ${vc.text}`}>
              {company.verdict.emoji} {splitIntoBullets(company.investorTake)[0] || company.investorTake}
            </p>
            {/* 3 signal pills + management tone */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {[
                { icon: "🏗️", label: "Capex",   score: company.parameters.capex.score },
                { icon: "📈", label: "Revenue",  score: company.parameters.revenueGrowth.score },
                { icon: "📊", label: "Margins",  score: company.parameters.marginOutlook.score },
              ].map((sig) => (
                <div key={sig.label} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-card/70 border border-current/20 text-xs">
                  <span>{sig.icon}</span>
                  <span className="font-semibold text-text-primary">{sig.label}</span>
                  <span className={`font-extrabold ${ScoreColor(sig.score).text}`}>{sig.score}/5</span>
                </div>
              ))}
              {/* Management tone pill */}
              {company.managementTone && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-card/70 border border-current/20 text-xs">
                  <span className="font-semibold text-text-primary">Management Tone —</span>
                  <span className={`font-extrabold ${
                    company.managementTone === "confident" ? "text-signal-green"
                    : company.managementTone === "cautious" ? "text-signal-amber"
                    : "text-signal-red"
                  }`}>
                    {company.managementTone.charAt(0).toUpperCase() + company.managementTone.slice(1)}
                  </span>
                </div>
              )}
            </div>
            {company.confidence.verified > 0 && (
              <p className="text-2xs text-text-muted mt-2.5 font-medium">
                ✓ Based on {company.confidence.verified} verified management statement{company.confidence.verified !== 1 ? "s" : ""} · {company.quarter}
              </p>
            )}
          </div>
        )}

        {/* Red flags — only shown when triggered */}
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

        {/* 2 — BUY / score card */}
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

        {/* 3 — How score has changed with previous quarter */}
        {company.previousQuarter && (changedParams.length > 0 || stableParams.length > 0) && (
          <section className="card-base p-5 space-y-3 border-t-2 border-signal-amber">
            <SectionHeader
              title="How score has changed with previous quarter"
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

        {/* 4 — Investment thesis */}
        <section id="section-thesis" className="card-base p-5 space-y-4 border-t-2 border-signal-blue">
          <SectionHeader
            title="Investment thesis"
            accent="blue"
            right={
              <div className="flex items-center gap-2">
                {/* Desktop: full labels */}
                <div className="hidden sm:flex items-center gap-2 text-2xs font-bold">
                  <span className="text-signal-green">{thesisYes} Confirmed</span>
                  <span className="text-text-muted">·</span>
                  <span className="text-signal-amber">{thesisPartial} Partial</span>
                  <span className="text-text-muted">·</span>
                  <span className="text-signal-red">{thesisNo} Not Passed</span>
                </div>
                {/* Mobile: compact icons */}
                <div className="flex sm:hidden items-center gap-1.5 text-2xs font-bold">
                  <span className="text-signal-green">{thesisYes}✓</span>
                  <span className="text-signal-amber">{thesisPartial}~</span>
                  <span className="text-signal-red">{thesisNo}✕</span>
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
          <ManagementToneCard
            tone={company.managementTone}
            keyQuote={company.thesis.managementTone.keyQuote}
            source={company.thesis.managementTone.source}
            tc={tc}
          />
        </section>

        {/* 5 — What happened this quarter */}
        <section className="rounded-2xl p-5 bg-signal-blue-bg border border-signal-blue/20">
          <p className="text-2xs font-bold text-signal-blue uppercase tracking-widest mb-1.5">What happened this quarter</p>
          <BulletList text={company.overallSummary} textClass="text-xs text-text-secondary" />
        </section>

        {/* Action box — 3 audiences */}
        <div className="card-base border-t-2 border-signal-blue overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-border">
            {(["own","considering","tracking"] as const).map((tab) => {
              const labels = { own: "I Own It", considering: "Considering", tracking: "Tracking" };
              return (
                <button key={tab} onClick={() => setAudience(tab)}
                  className={`flex-1 text-xs font-bold py-3 transition-colors ${
                    audience === tab
                      ? "text-signal-blue border-b-2 border-signal-blue bg-signal-blue-bg/40"
                      : "text-text-muted hover:text-text-secondary"
                  }`}>
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          <div className="p-5 space-y-2">

            {/* TAB 1 — I Own It */}
            {audience === "own" && (() => {
              const ACTION_KW = ["accumulate","hold","buy","sell","monitor","consider","avoid","exit","reduce","maintain","watch","wait","chase","trim","book","add","stay","invest","keep"];
              const allBullets    = splitIntoBullets(company.investorTake || "");
              const actionBullets = allBullets.filter((s) => ACTION_KW.some((kw) => s.toLowerCase().includes(kw)));
              const bullets = actionBullets.length > 0 ? actionBullets : allBullets;
              return bullets.map((s, i) => {
                const isWarning  = /monitor|watch|risk|decline|avoid|don.t chase/i.test(s);
                const isPositive = /accumulate|maintain|hold|add|invest|keep/i.test(s);
                const icon  = isWarning ? "⚠" : isPositive ? "✓" : "▸";
                const color = isWarning ? "text-signal-amber" : isPositive ? "text-signal-green" : "text-text-secondary";
                return (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`text-xs font-bold mt-0.5 flex-shrink-0 ${color}`}>{icon}</span>
                    <p className={`text-xs leading-relaxed ${color}`}>{s}</p>
                  </div>
                );
              });
            })()}

            {/* TAB 2 — Considering */}
            {audience === "considering" && (
              <>
                {/* Thesis summary */}
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <span className="text-xs font-semibold text-text-secondary">Thesis check:</span>
                  <span className="text-xs font-bold text-signal-green">{thesisYes} confirmed</span>
                  {thesisPartial > 0 && <span className="text-xs font-bold text-signal-amber">{thesisPartial} partial</span>}
                  {thesisNo > 0 && <span className="text-xs font-bold text-signal-red">{thesisNo} not passed</span>}
                  <span className="text-xs text-text-muted ml-auto">out of 6</span>
                </div>

                {/* What's confirmed */}
                {thesisEntries.filter(e => e.data.answer === "yes").map((e) => (
                  <div key={e.key} className="flex items-start gap-2">
                    <span className="text-xs font-bold text-signal-green flex-shrink-0 mt-0.5">✓</span>
                    <p className="text-xs text-signal-green">{e.label}</p>
                  </div>
                ))}

                {/* What's still partial/missing */}
                {thesisEntries.filter(e => e.data.answer === "partial" || e.data.answer === "no").map((e) => (
                  <div key={e.key} className="flex items-start gap-2">
                    <span className={`text-xs font-bold flex-shrink-0 mt-0.5 ${e.data.answer === "no" ? "text-signal-red" : "text-signal-amber"}`}>
                      {e.data.answer === "no" ? "✕" : "~"}
                    </span>
                    <div>
                      <p className={`text-xs font-semibold ${e.data.answer === "no" ? "text-signal-red" : "text-signal-amber"}`}>{e.label}</p>
                      {e.data.summary && (
                        <p className="text-2xs text-text-muted mt-0.5 leading-relaxed">
                          {splitIntoBullets(e.data.summary)[0]}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Top risk to know before buying */}
                {company.riskFactors.filter((r: any) => r.severity === "HIGH").slice(0,1).map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 mt-1 pt-2 border-t border-border">
                    <span className="text-xs font-bold text-signal-red flex-shrink-0 mt-0.5">⚠</span>
                    <p className="text-xs text-signal-red leading-relaxed">{r.description}</p>
                  </div>
                ))}
              </>
            )}

            {/* TAB 3 — Tracking */}
            {audience === "tracking" && (
              <>
                {/* Score trend */}
                {company.previousQuarter && (
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <span className="text-xs text-text-secondary font-semibold">Score trend:</span>
                    <span className={`text-xs font-bold ${scoreDelta > 0 ? "text-signal-green" : scoreDelta < 0 ? "text-signal-red" : "text-text-muted"}`}>
                      {scoreDelta > 0 ? `▲ +${scoreDelta.toFixed(1)}` : scoreDelta < 0 ? `▼ ${scoreDelta.toFixed(1)}` : "→ Unchanged"}
                    </span>
                    <span className="text-2xs text-text-muted">vs {company.previousQuarter}</span>
                  </div>
                )}

                {/* Parameters that changed */}
                {changedParams.length > 0 && changedParams.map((p) => {
                  const improved = p.param.score > (p.param.previousScore || 0);
                  return (
                    <div key={p.key} className="flex items-start gap-2">
                      <span className={`text-xs font-bold mt-0.5 flex-shrink-0 ${improved ? "text-signal-green" : "text-signal-red"}`}>
                        {improved ? "▲" : "▼"}
                      </span>
                      <p className={`text-xs ${improved ? "text-signal-green" : "text-signal-red"}`}>
                        {p.label} {improved ? "improved" : "eased"} ({p.param.previousScore}→{p.param.score})
                      </p>
                    </div>
                  );
                })}

                {/* Partial thesis — what to watch for */}
                {thesisEntries.filter(e => e.data.answer === "partial").length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Watch for these to confirm</p>
                    {thesisEntries.filter(e => e.data.answer === "partial").map((e) => (
                      <div key={e.key} className="flex items-start gap-2 mb-1">
                        <span className="text-xs text-signal-amber font-bold flex-shrink-0 mt-0.5">~</span>
                        <p className="text-xs text-text-secondary">{e.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Key risks to monitor */}
                {company.riskFactors.filter((r: any) => r.severity === "HIGH" || r.severity === "MEDIUM").slice(0,3).map((r: any, i: number) => (
                  <div key={i} className={`flex items-start gap-2 ${i === 0 ? "pt-2 border-t border-border" : ""}`}>
                    <span className={`text-2xs font-bold px-1 py-0.5 rounded flex-shrink-0 mt-0.5 ${
                      r.severity === "HIGH" ? "bg-signal-red text-card" : "bg-signal-amber text-card"
                    }`}>{r.severity}</span>
                    <p className="text-xs text-text-secondary leading-relaxed">{r.description}</p>
                  </div>
                ))}
              </>
            )}

          </div>
        </div>

        {/* 6 — Parameter breakdown */}
        <section id="section-params" className="space-y-3">
          <SectionHeader title="Parameter breakdown" accent="neutral" />
          {params.map((p) => (
            <ParameterCard key={p.key} label={p.label} icon={p.icon} param={p.param}
              prevQ={company.previousQuarter} curQ={activeQ} />
          ))}
        </section>

        {/* Valuation section */}
        <div id="section-valuation">
        <ValuationSection
          valuationEstimate={valuationEstimate}
          marketCap={marketCap}
          quarter={activeQ}
          price={company.price}
        />
        </div>

        {/* 7 — Risk factors */}
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

        {/* Close Insights tab wrapper */}
        </>}

        {/* Footer */}
        <footer className="text-center py-6 border-t border-border">
          <p className="text-2xs text-text-muted font-medium">
            Processed {company.processedAt ? new Date(company.processedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"} ·{" "}
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
