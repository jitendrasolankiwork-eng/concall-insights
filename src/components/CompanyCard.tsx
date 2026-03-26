import { CompanyInsight } from "@/types/portfolio";
import { Link } from "react-router-dom";

// ── Logo ──────────────────────────────────────────────────────────────────
function CompanyLogo({ slug, company }: { slug: string; company: string }) {
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
      <img
        src={`https://s3-symbol-logo.tradingview.com/${slug}--big.svg`}
        alt={company}
        className="w-full h-full object-cover"
        onError={(e) => {
          const t = e.target as HTMLImageElement;
          t.style.display = "none";
          const p = t.parentElement;
          if (p) {
            const fb = document.createElement("span");
            fb.className = "text-sm font-bold text-text-muted";
            fb.textContent = company.charAt(0);
            p.appendChild(fb);
          }
        }}
      />
    </div>
  );
}

// ── Score delta ───────────────────────────────────────────────────────────
function ScoreDelta({ current, previous }: { current: number; previous?: number }) {
  if (!previous || Math.abs(current - previous) < 0.05) return null;
  const positive = current > previous;
  return (
    <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded-full ${
      positive ? "bg-signal-green-bg text-signal-green" : "bg-signal-red-bg text-signal-red"
    }`}>
      {positive ? "▲" : "▼"} {Math.abs(current - previous).toFixed(1)}
    </span>
  );
}

// ── Attention tag — computed from data, never crashes ─────────────────────
function AttentionTag({ company }: { company: CompanyInsight }) {
  // 🆕 NEW — processed within 7 days AND no previous quarter
  // (if previous quarter exists, it's not "new" — it's just updated)
  const isNew = (() => {
    try {
      const days = (Date.now() - new Date(company.processedAt).getTime()) / 86400000;
      return days <= 7 && !company.previousQuarter;
    } catch { return false; }
  })();

  // 🔻 DECLINING — score dropped vs previous
  const isDeclining = !!(
    company.previousCompositeScore &&
    company.compositeScore < company.previousCompositeScore - 0.3
  );

  // ⚠ NEEDS ATTENTION — hold/weak verdict OR any parameter score ≤ 2
  const needsAttention =
    company.verdict.key !== "buy" ||
    company.parameters.capex.score <= 2 ||
    company.parameters.revenueGrowth.score <= 2 ||
    company.parameters.marginOutlook.score <= 2;

  if (isDeclining) return (
    <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-signal-red-bg text-signal-red">
      🔻 Declining
    </span>
  );
  if (isNew) return (
    <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-signal-blue-bg text-signal-blue">
      🆕 New update
    </span>
  );
  if (needsAttention) return (
    <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-signal-amber-bg text-signal-amber">
      ⚠ Watch
    </span>
  );
  return null;
}

// ── Main card ─────────────────────────────────────────────────────────────
export default function CompanyCard({ company }: { company: CompanyInsight }) {
  const vc = company.verdict.key === "buy"
    ? { text: "text-signal-green", bg: "bg-signal-green-bg" }
    : company.verdict.key === "hold"
    ? { text: "text-signal-amber", bg: "bg-signal-amber-bg" }
    : { text: "text-signal-red",   bg: "bg-signal-red-bg"   };

  const dotColor = company.managementTone === "confident" ? "bg-signal-green"
    : company.managementTone === "cautious"  ? "bg-signal-amber" : "bg-signal-red";

  const toneLabel = company.managementTone
    ? company.managementTone.charAt(0).toUpperCase() + company.managementTone.slice(1)
    : "";

  // 1-line insight — first sentence of investorTake, capped at 72 chars
  const insight = (() => {
    if (!company.investorTake) return null;
    const first = company.investorTake.split(".")[0].trim();
    return first.length > 10 ? first.slice(0, 72) + (first.length > 72 ? "…" : "") : null;
  })();

  return (
    <Link to={`/company/${company.ticker}`} className="block card-hover p-4 space-y-3">

      {/* Row 1: Logo + name + attention tag + score */}
      <div className="flex items-start gap-3">
        <CompanyLogo slug={company.slug} company={company.company} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-text-primary truncate">{company.company}</h3>
            <AttentionTag company={company} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-text-muted">{company.ticker} · {company.quarter}</span>
            {company.investmentType && (
              <span className="text-2xs font-medium px-1.5 py-0.5 rounded-full bg-signal-blue-bg text-signal-blue border border-signal-blue/20">
                {company.investmentType}
              </span>
            )}
          </div>
        </div>
        {/* Score + delta stacked */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-lg font-bold ${vc.text}`}>
            {company.compositeScore.toFixed(1)}
            <span className="text-xs font-normal text-text-muted"> /5</span>
          </span>
          <ScoreDelta current={company.compositeScore} previous={company.previousCompositeScore} />
        </div>
      </div>

      {/* Row 2: Price + verdict + thesis */}
      <div className="flex items-center gap-2 flex-wrap">
        {company.price > 0 && (
          <span className={`text-xs font-medium ${
            company.priceChange >= 0 ? "text-signal-green" : "text-signal-red"
          }`}>
            ₹{company.price.toLocaleString("en-IN")} {company.priceChange >= 0 ? "▲" : "▼"} {Math.abs(company.priceChange).toFixed(2)}%
          </span>
        )}
        <span className={`text-2xs font-semibold uppercase px-2 py-0.5 rounded-full ${vc.bg} ${vc.text}`}>
          {company.verdict.label}
        </span>
        <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-signal-blue-bg text-signal-blue">
          Thesis {company.thesisPassed}/{company.thesisTotal}
        </span>
      </div>

      {/* Row 3: Signal dots */}
      <div className="flex gap-4">
        {[
          { label: "Capex",   score: company.parameters.capex.score          },
          { label: "Growth",  score: company.parameters.revenueGrowth.score  },
          { label: "Margins", score: company.parameters.marginOutlook.score  },
        ].map(({ label, score }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className={`w-1.5 h-1.5 rounded-full ${
              score >= 4 ? "bg-signal-green" : score >= 3 ? "bg-signal-amber" : "bg-signal-red"
            }`} />
            <span>{label}</span>
            <span className="font-semibold text-text-primary">{score}/5</span>
          </div>
        ))}
      </div>

      {/* Row 4: 1-line insight */}
      {insight && (
        <p className="text-xs text-text-secondary leading-snug">{insight}</p>
      )}

      {/* Row 5: Tone + updated */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-text-secondary">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          {toneLabel}
        </span>
        <span className="text-2xs text-text-muted">Updated {company.processedAt}</span>
      </div>

    </Link>
  );
}
