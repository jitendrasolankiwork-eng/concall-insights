import { CompanyInsight } from "@/types/portfolio";
import { Link } from "react-router-dom";

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 4
      ? "text-signal-green bg-signal-green-bg"
      : score >= 3
      ? "text-signal-amber bg-signal-amber-bg"
      : "text-signal-red bg-signal-red-bg";
  return (
    <span className={`text-lg font-bold px-2 py-0.5 rounded-md ${color}`}>
      {score.toFixed(1)}
      <span className="text-xs font-normal opacity-70"> / 5</span>
    </span>
  );
}

function VerdictPill({ verdict }: { verdict: CompanyInsight["verdict"] }) {
  const color =
    verdict.key === "buy"
      ? "bg-signal-green-bg text-signal-green"
      : verdict.key === "hold"
      ? "bg-signal-amber-bg text-signal-amber"
      : "bg-signal-red-bg text-signal-red";
  return (
    <span className={`text-2xs font-semibold uppercase px-2 py-0.5 rounded-full ${color}`}>
      {verdict.label}
    </span>
  );
}

function SignalMini({ label, score }: { label: string; score: number }) {
  const dotColor =
    score >= 4
      ? "bg-signal-green"
      : score >= 3
      ? "bg-signal-amber"
      : "bg-signal-red";
  return (
    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{label}</span>
      <span className="font-semibold text-text-primary">{score}/5</span>
    </div>
  );
}

function CompanyLogo({ slug, company }: { slug: string; company: string }) {
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
      <img
        src={`https://s3-symbol-logo.tradingview.com/${slug}--big.svg`}
        alt={company}
        className="w-full h-full object-cover"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
          const parent = target.parentElement;
          if (parent) {
            const fallback = document.createElement("span");
            fallback.className = "text-sm font-bold text-text-muted";
            fallback.textContent = company.charAt(0);
            parent.appendChild(fallback);
          }
        }}
      />
    </div>
  );
}

function PriceDisplay({ price, change }: { price: number; change: number }) {
  const isPositive = change >= 0;
  const color = isPositive ? "text-signal-green" : "text-signal-red";
  return (
    <span className={`text-xs font-medium ${color}`}>
      ₹{price.toLocaleString("en-IN")} {isPositive ? "▲" : "▼"} {Math.abs(change)}%
    </span>
  );
}

function ToneDot({ tone }: { tone: string }) {
  const config: Record<string, { color: string; label: string }> = {
    confident: { color: "bg-signal-green", label: "Confident" },
    cautious: { color: "bg-signal-amber", label: "Cautious" },
    defensive: { color: "bg-signal-red", label: "Defensive" },
  };
  const c = config[tone] || config.cautious;
  return (
    <span className="flex items-center gap-1.5 text-xs text-text-secondary">
      <span className={`w-2 h-2 rounded-full ${c.color}`} />
      {c.label}
    </span>
  );
}

export default function CompanyCard({ company }: { company: CompanyInsight }) {
  const whyItems: string[] = [];
  if (company.parameters.revenueGrowth.score >= 4) whyItems.push("Strong revenue growth");
  if (company.parameters.marginOutlook.score >= 4) whyItems.push("expanding margins");
  else if (company.parameters.marginOutlook.score <= 2) whyItems.push("margin pressure");
  if (company.parameters.capex.score >= 4) whyItems.push("aggressive capex");
  else if (company.parameters.capex.score <= 2) whyItems.push("limited capex");

  return (
    <Link to={`/company/${company.ticker}`} className="block card-hover p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <CompanyLogo slug={company.slug} company={company.company} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">{company.company}</h3>
          <p className="text-xs text-text-muted">
            {company.ticker} · {company.quarter}
          </p>
        </div>
        <ScoreBadge score={company.compositeScore} />
      </div>

      {/* Price + Verdict + Thesis */}
      <div className="flex items-center gap-2 flex-wrap">
        <PriceDisplay price={company.price} change={company.priceChange} />
        <VerdictPill verdict={company.verdict} />
        <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-signal-blue-bg text-signal-blue">
          Thesis {company.thesisPassed}/{company.thesisTotal}
        </span>
      </div>

      {/* Signal mini-cards */}
      <div className="flex gap-4">
        <SignalMini label="Capex" score={company.parameters.capex.score} />
        <SignalMini label="Growth" score={company.parameters.revenueGrowth.score} />
        <SignalMini label="Margins" score={company.parameters.marginOutlook.score} />
      </div>

      {/* Why line */}
      {whyItems.length > 0 && (
        <p className="text-xs text-text-secondary">
          ✔ {whyItems.join(" · ")}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <ToneDot tone={company.managementTone} />
        <span className="text-2xs text-text-muted">Updated {company.processedAt}</span>
      </div>
    </Link>
  );
}
