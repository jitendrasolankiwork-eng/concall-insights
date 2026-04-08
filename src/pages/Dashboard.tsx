import { useState, useEffect, useMemo, useCallback } from "react";
import CompanyCard from "@/components/CompanyCard";
import ThemeToggle from "@/components/ThemeToggle";
import AuthButton from "@/components/AuthButton";
import { AnnouncementsSection } from "@/components/AnnouncementsSection";
import { fetchCompany } from "@/lib/api";
import type { CompanyInsight } from "@/types/portfolio";
import { useAuth } from "@/lib/auth";
import { useUserTags } from "@/hooks/useUserTags";
import type { TagCategory, TagAction } from "@/hooks/useUserTags";

// ── Auto-load all processed companies from backend ────────────────────────
const useAllCompanies = () => {
  const [companies,  setCompanies]  = useState<CompanyInsight[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch("/api/admin/insights")
      .then((r) => r.json())
      .then(async (data) => {
        if (!data.success) { setError(true); setLoading(false); return; }
        const tickers: string[] = data.companies
          .filter((c: any) => c.quarters?.length > 0)
          .map((c: any) => c.symbol);
        const results = await Promise.allSettled(
          tickers.map((t) => fetchCompany(t))
        );
        const loaded = results
          .filter((r) => r.status === "fulfilled")
          .map((r) => (r as PromiseFulfilledResult<CompanyInsight>).value);
        setCompanies(loaded);
        setLoading(false);
      })
      .catch(() => { setLoading(false); setError(true); });
  }, [retryCount]);

  const retry = () => setRetryCount((c) => c + 1);
  return { companies, loading, error, retry };
};

// ── Simple toast ──────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: "success" | "info" | "error"; }

function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200
            ${t.type === "success" ? "bg-signal-green text-white" :
              t.type === "error"   ? "bg-signal-red text-white"   :
              "bg-foreground text-card"
            }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: Toast["type"] = "success") => {
    const newId = Date.now() + Math.random();
    setToasts((t) => [...t, { id: newId, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== newId)), 2800);
  }, []);

  return { toasts, show };
}

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

// ── Portfolio strip ───────────────────────────────────────────────────────
function PortfolioStrip({
  companies,
  portfolioSymbols,
}: {
  companies       : CompanyInsight[];
  portfolioSymbols: Set<string> | null;
}) {
  // If user is logged in and has tagged portfolio companies, use those
  // Otherwise fall back to all companies (demo / logged-out view)
  const list = portfolioSymbols && portfolioSymbols.size > 0
    ? companies.filter((c) => portfolioSymbols.has(c.ticker))
    : portfolioSymbols !== null
    ? [] // logged in but nothing tagged yet
    : companies; // logged out — show all

  if (list.length === 0) return null;

  const buy    = list.filter((c) => c.verdict.key === "buy").length;
  const hold   = list.filter((c) => c.verdict.key === "hold").length;
  const weak   = list.filter((c) => c.verdict.key === "weak").length;
  const sorted = [...list].sort((a, b) => b.compositeScore - a.compositeScore);
  const top    = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const showPerf = sorted.length >= 2 && top.ticker !== bottom.ticker;

  const actionLine =
    weak > 0         ? `${weak} stock${weak > 1 ? "s" : ""} need${weak === 1 ? "s" : ""} attention` :
    hold > 0         ? `${hold} stock${hold > 1 ? "s" : ""} to monitor` :
    buy === list.length ? "All stocks looking good" : "";

  return (
    <div className="card-base px-4 py-3 space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-xs font-semibold text-text-secondary">
          {portfolioSymbols && portfolioSymbols.size > 0 ? "My portfolio" : "Your portfolio"}
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-signal-green" />
            <span className="font-bold text-text-primary">{buy}</span>
            <span className="text-text-muted">doing well</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-signal-amber" />
            <span className="font-bold text-text-primary">{hold}</span>
            <span className="text-text-muted">to monitor</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-signal-red" />
            <span className="font-bold text-text-primary">{weak}</span>
            <span className="text-text-muted">in danger</span>
          </span>
        </div>
        {actionLine && (
          <span className={`text-xs font-medium ml-auto ${
            weak > 0 ? "text-signal-red" : hold > 0 ? "text-signal-amber" : "text-signal-green"
          }`}>
            {weak > 0 ? "⚠" : hold > 0 ? "→" : "✓"} {actionLine}
          </span>
        )}
      </div>
      {showPerf && (
        <div className="flex items-center gap-4 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="text-2xs text-text-muted">Top performer</span>
            <span className="text-xs font-semibold text-signal-green">{top.ticker}</span>
            <span className="text-xs text-signal-green">{top.compositeScore.toFixed(1)}/5</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-2xs text-text-muted">Needs attention</span>
            <span className="text-xs font-semibold text-signal-red">{bottom.ticker}</span>
            <span className="text-xs text-signal-red">{bottom.compositeScore.toFixed(1)}/5</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card skeleton ─────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="card-base p-4 space-y-3 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-36 bg-muted rounded" />
          <div className="h-3 w-24 bg-muted rounded" />
        </div>
        <div className="h-7 w-14 bg-muted rounded-md" />
      </div>
      <div className="flex gap-2">
        <div className="h-4 w-20 bg-muted rounded" />
        <div className="h-4 w-16 bg-muted rounded-full" />
      </div>
      <div className="flex gap-4">
        <div className="h-3 w-16 bg-muted rounded" />
        <div className="h-3 w-16 bg-muted rounded" />
        <div className="h-3 w-16 bg-muted rounded" />
      </div>
    </div>
  );
}

// ── Sort + Filter controls ────────────────────────────────────────────────
type SortKey    = "score" | "verdict" | "name" | "updated";
type FilterKey  = "all" | "buy" | "hold" | "weak" | "portfolio" | "watchlist";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "score",   label: "Score"   },
  { key: "verdict", label: "Verdict" },
  { key: "name",    label: "Name"    },
  { key: "updated", label: "Updated" },
];

const TAG_GROUP: Record<TagCategory, number> = { portfolio: 0, watchlist: 1 };

function sortCompanies(
  companies: CompanyInsight[],
  sort: SortKey,
  tags: Record<string, TagCategory>,
  tagFilter: FilterKey,
): CompanyInsight[] {
  return [...companies].sort((a, b) => {
    // When viewing "all" companies: portfolio → watchlist → untagged (primary key)
    if (tagFilter === "all") {
      const aGroup = TAG_GROUP[tags[a.ticker]] ?? 2;
      const bGroup = TAG_GROUP[tags[b.ticker]] ?? 2;
      if (aGroup !== bGroup) return aGroup - bGroup;
    }
    // Secondary: selected sort
    if (sort === "score")   return b.compositeScore - a.compositeScore;
    if (sort === "verdict") {
      const order = { buy: 0, hold: 1, weak: 2 };
      return (order[a.verdict.key] ?? 3) - (order[b.verdict.key] ?? 3);
    }
    if (sort === "name")    return a.company.localeCompare(b.company);
    if (sort === "updated") return (b.processedAt || "").localeCompare(a.processedAt || "");
    return 0;
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { companies, loading, error, retry } = useAllCompanies();
  const { user } = useAuth();
  const [sort,      setSort]      = useState<SortKey>("updated");
  const [filter,    setFilter]    = useState<FilterKey>("all");
  const [search,    setSearch]    = useState("");
  const [showModal, setShowModal] = useState(false);
  const { toasts, show: showToast } = useToasts();

  // ── Tag callbacks with toast ─────────────────────────────────────────────
  const onTagSuccess = useCallback((
    symbol: string,
    action: TagAction,
    category?: TagCategory,
  ) => {
    if (action === "tagged") {
      showToast(`${symbol} added to ${category === "portfolio" ? "Portfolio 📁" : "Watchlist 👁"}`);
    } else if (action === "moved") {
      showToast(`${symbol} moved to ${category === "portfolio" ? "Portfolio 📁" : "Watchlist 👁"}`, "info");
    } else {
      showToast(`${symbol} removed`, "info");
    }
  }, [showToast]);

  const { tags, inFlight, tag, untag } = useUserTags(onTagSuccess);

  // Portfolio symbols set (null = logged out = no tag state)
  const portfolioSymbols = useMemo((): Set<string> | null => {
    if (!user) return null;
    return new Set(
      Object.entries(tags)
        .filter(([, cat]) => cat === "portfolio")
        .map(([sym]) => sym),
    );
  }, [user, tags]);

  // ── Filtering & sorting ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let f = companies;

    // Verdict filter
    if (filter === "buy" || filter === "hold" || filter === "weak") {
      f = f.filter((c) => c.verdict.key === filter);
    }

    // Tag filter (portfolio / watchlist)
    if (filter === "portfolio") f = f.filter((c) => tags[c.ticker] === "portfolio");
    if (filter === "watchlist") f = f.filter((c) => tags[c.ticker] === "watchlist");

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      f = f.filter((c) =>
        c.ticker.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q)
      );
    }

    return sortCompanies(f, sort, tags, filter);
  }, [companies, sort, filter, search, tags]);

  // When user logs out, reset tag filter
  useEffect(() => {
    if (!user && (filter === "portfolio" || filter === "watchlist")) {
      setFilter("all");
    }
  }, [user, filter]);

  // Counts for pills
  const portfolioCount = useMemo(
    () => companies.filter((c) => tags[c.ticker] === "portfolio").length,
    [companies, tags],
  );
  const watchlistCount = useMemo(
    () => companies.filter((c) => tags[c.ticker] === "watchlist").length,
    [companies, tags],
  );

  const FILTER_OPTIONS: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all",  label: "All" },
    { key: "buy",  label: "BUY" },
    { key: "hold", label: "HOLD" },
    { key: "weak", label: "WEAK" },
    ...(user ? [
      { key: "portfolio" as FilterKey, label: "📁 Portfolio", count: portfolioCount },
      { key: "watchlist" as FilterKey, label: "👁 Watchlist",  count: watchlistCount },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="container py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary">AI Portfolio Tracker</h1>
            <p className="text-xs text-text-muted">
              Concall insights, AI-extracted ·{" "}
              <button onClick={() => setShowModal(true)}
                className="text-signal-blue hover:underline">
                How scores work ↗
              </button>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-text-secondary">
              {loading ? "…" : `${filtered.length} companies`}
            </span>
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-5">

        {/* Portfolio strip */}
        {!loading && (
          <PortfolioStrip
            companies={companies}
            portfolioSymbols={portfolioSymbols}
          />
        )}

        {/* Announcements feed — tracked companies only */}
        {!loading && companies.length > 0 && (
          <AnnouncementsSection symbols={companies.map((c) => c.ticker)} />
        )}

        {/* Sort + Filter bar */}
        {!loading && companies.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs pointer-events-none">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company…"
                className="text-xs bg-card border border-border rounded-lg pl-7 pr-3 py-1.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring w-40"
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs">
                  ✕
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {FILTER_OPTIONS.map((f) => {
                const isActive = filter === f.key;
                const isTagFilter = f.key === "portfolio" || f.key === "watchlist";
                return (
                  <button key={f.key} onClick={() => setFilter(f.key)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                      isActive
                        ? isTagFilter && f.key === "portfolio"
                          ? "bg-signal-green text-white"
                          : isTagFilter && f.key === "watchlist"
                          ? "bg-signal-blue text-white"
                          : "bg-foreground text-card"
                        : isTagFilter
                        ? "bg-muted text-text-muted hover:bg-border border border-dashed border-border"
                        : "bg-muted text-text-muted hover:bg-border"
                    }`}>
                    {f.label}
                    {f.key !== "all" && f.count === undefined && (
                      <span className="ml-1 opacity-70">
                        {companies.filter((c) => c.verdict.key === f.key).length}
                      </span>
                    )}
                    {f.count !== undefined && (
                      <span className="ml-1 opacity-80">{f.count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sort dropdown */}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-text-muted">Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
                className="text-xs bg-card border border-border rounded-lg px-2 py-1.5
                  text-text-primary focus:outline-none focus:ring-1 focus:ring-ring">
                {SORT_OPTIONS.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Sign-in nudge for untagged users (shown once they have companies) */}
        {!loading && !user && companies.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-signal-blue-bg border border-signal-blue/20 text-xs text-signal-blue">
            <span>💡</span>
            <span>Sign in to tag companies as <strong>Portfolio</strong> or <strong>Watchlist</strong></span>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map((i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {/* Empty / error state */}
        {!loading && (error || companies.length === 0) && (
          <div className="card-base p-8 text-center space-y-3">
            <p className="text-sm font-semibold text-text-primary">
              {error ? "Couldn't load companies" : "No companies processed yet"}
            </p>
            <p className="text-xs text-text-muted">
              {error ? "Check your connection and try again" : "Add companies to your Google Sheet and run the pipeline"}
            </p>
            {error && (
              <button onClick={retry}
                className="mt-1 text-xs font-semibold px-5 py-2 rounded-full bg-signal-blue text-white hover:opacity-90 transition-opacity">
                Retry
              </button>
            )}
          </div>
        )}

        {/* No results after filter */}
        {!loading && companies.length > 0 && filtered.length === 0 && (
          <div className="card-base p-6 text-center">
            <p className="text-xs text-text-muted">
              {filter === "portfolio" ? "No companies tagged as Portfolio yet" :
               filter === "watchlist" ? "No companies tagged as Watchlist yet" :
               `No ${filter.toUpperCase()} stocks in your portfolio`}
            </p>
            {(filter === "portfolio" || filter === "watchlist") && (
              <p className="text-2xs text-text-muted mt-1">
                Click the <strong>＋</strong> button on any card to add it
              </p>
            )}
          </div>
        )}

        {/* Company grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <CompanyCard
                key={c.ticker}
                company={c}
                tagCategory={user ? (tags[c.ticker] ?? null) : undefined}
                tagInFlight={inFlight.has(c.ticker)}
                onTag={user ? (cat) => tag(c.ticker, c.company, cat) : undefined}
                onUntag={user ? () => untag(c.ticker) : undefined}
              />
            ))}
          </div>
        )}

      </main>

      {showModal && <HowScoresModal onClose={() => setShowModal(false)} />}
      <ToastStack toasts={toasts} />
    </div>
  );
}
