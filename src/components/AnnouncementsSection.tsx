/**
 * AnnouncementsSection.tsx
 *
 * Homepage feed of high-signal BSE announcements across all tracked companies.
 * Shows announcements with priority >= 3, sorted by priority then date.
 * Clicking a card navigates to /company/:symbol?tab=announcements
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRecentAnnouncements, type RecentAnnouncement } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseImpact(impact: string): "🟢" | "🟡" | "🔴" {
  if (impact.startsWith("🟢")) return "🟢";
  if (impact.startsWith("🔴")) return "🔴";
  return "🟡";
}

function impactStyles(impact: string) {
  const i = normaliseImpact(impact);
  if (i === "🟢") return { emoji: "🟢", badge: "bg-signal-green-bg text-signal-green", left: "border-l-signal-green" };
  if (i === "🔴") return { emoji: "🔴", badge: "bg-signal-red-bg text-signal-red",     left: "border-l-signal-red"   };
  return               { emoji: "🟡", badge: "bg-signal-amber-bg text-signal-amber", left: "border-l-signal-amber" };
}

function priorityStyles(p: number) {
  if (p >= 5) return "bg-signal-red-bg text-signal-red";
  if (p >= 4) return "bg-signal-green-bg text-signal-green";
  return             "bg-signal-amber-bg text-signal-amber";
}

function actionStyles(action: string) {
  const a = action.toLowerCase();
  if (a.includes("positive")) return "bg-signal-green-bg text-signal-green";
  if (a.includes("caution") || a.includes("monitor")) return "bg-signal-red-bg text-signal-red";
  return "bg-muted text-text-secondary";
}

function relativeTime(dateStr: string | null, displayDate: string): string {
  if (!dateStr) return displayDate || "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff  <  7) return `${diff}d ago`;
  return displayDate;
}

// ── Legend tooltip ────────────────────────────────────────────────────────────
function Legend() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-2xs px-2 py-1 rounded-full bg-muted text-text-muted hover:bg-border transition-colors"
      >
        ? What do these mean
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-card border border-border rounded-xl shadow-xl p-4 space-y-4">
          {/* Impact */}
          <div>
            <p className="text-2xs font-bold uppercase tracking-widest text-text-muted mb-2">Impact dot</p>
            <p className="text-2xs text-text-muted mb-2 leading-relaxed">
              AI-classified from announcement text. Based on facts only — not management tone.
            </p>
            <div className="space-y-1.5">
              {[
                { emoji: "🟢", label: "Positive", desc: "Improves growth, margins, or thesis" },
                { emoji: "🟡", label: "Neutral",  desc: "No meaningful impact on investment case" },
                { emoji: "🔴", label: "Negative", desc: "Risk to growth, margins, or thesis" },
              ].map((r) => (
                <div key={r.label} className="flex items-start gap-2">
                  <span className="text-sm leading-none mt-0.5">{r.emoji}</span>
                  <div>
                    <span className="text-xs font-semibold text-text-primary">{r.label}</span>
                    <span className="text-2xs text-text-muted ml-1">— {r.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Priority */}
          <div>
            <p className="text-2xs font-bold uppercase tracking-widest text-text-muted mb-2">Priority badge (P1–P5)</p>
            <p className="text-2xs text-text-muted mb-2 leading-relaxed">
              AI-scored significance. Only P3 and above shown in this feed.
            </p>
            <div className="space-y-1.5">
              {[
                { p: "P5", color: "text-signal-red",   desc: "Critical — guidance change, margin collapse, major order" },
                { p: "P4", color: "text-signal-green", desc: "Important — capex, strong numbers, notable trigger" },
                { p: "P3", color: "text-signal-amber", desc: "Moderate — routine business update" },
              ].map((r) => (
                <div key={r.p} className="flex items-start gap-2">
                  <span className={`text-xs font-bold w-5 flex-shrink-0 ${r.color}`}>{r.p}</span>
                  <span className="text-2xs text-text-muted leading-relaxed">{r.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function AnnouncementSkeleton() {
  return (
    <div className="card-base p-3.5 animate-pulse space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-muted" />
        <div className="h-3 w-14 bg-muted rounded" />
        <div className="h-3 w-24 bg-muted rounded-full" />
        <div className="ml-auto h-3 w-10 bg-muted rounded" />
      </div>
      <div className="h-4 w-2/3 bg-muted rounded" />
      <div className="h-3 w-full bg-muted rounded" />
      <div className="flex gap-2">
        <div className="h-5 w-32 bg-muted rounded-full" />
        <div className="h-5 w-20 bg-muted rounded" />
      </div>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function AnnouncementRow({ ann }: { ann: RecentAnnouncement }) {
  const navigate = useNavigate();
  const { signal } = ann;
  const s  = impactStyles(signal.impact);
  const pc = priorityStyles(signal.priority);
  const ac = actionStyles(signal.action);
  const when = relativeTime(ann.date, ann.displayDate);

  return (
    <div
      onClick={() => navigate(`/company/${ann.symbol}?tab=announcements`)}
      className={`card-base border-l-4 ${s.left} p-3.5 cursor-pointer hover:bg-muted/40 transition-colors`}
    >
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="text-sm leading-none">{s.emoji}</span>
        <span className={`text-2xs font-bold px-1.5 py-0.5 rounded ${pc}`}>P{signal.priority}</span>
        <span className="text-xs font-bold text-text-primary">{ann.symbol}</span>
        {ann.isNew && (
          <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-signal-blue text-white">NEW</span>
        )}
        <span className="text-2xs px-2 py-0.5 rounded-full bg-muted text-text-muted">{signal.type}</span>
        <span className="text-2xs text-text-muted ml-auto">{when}</span>
      </div>

      <p className="text-sm font-semibold text-text-primary mb-1 leading-snug">{signal.summary}</p>
      <p className="text-xs text-text-secondary mb-2 leading-relaxed">{signal.impactExplanation}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`text-2xs font-medium px-2.5 py-0.5 rounded-full ${ac}`}>
          {signal.action}
        </span>
        {signal.keyDataPoints.map((dp, i) => (
          <span key={i} className="text-2xs px-1.5 py-0.5 rounded bg-muted text-text-muted">{dp}</span>
        ))}
      </div>
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

type SortKey    = "date" | "priority" | "symbol";
type ImpactFilter = "all" | "positive" | "negative" | "neutral";

const PAGE_SIZE = 10;

interface Props {
  symbols?: string[];
}

export function AnnouncementsSection({ symbols = [] }: Props) {
  const [announcements, setAnnouncements] = useState<RecentAnnouncement[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [page,          setPage]          = useState(1);
  const [impact,        setImpact]        = useState<ImpactFilter>("all");
  const [sort,          setSort]          = useState<SortKey>("date");
  const [company,       setCompany]       = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    fetchRecentAnnouncements(3, 100)
      .then((data) => {
        const filtered = symbols.length > 0
          ? data.filter((a) => symbols.includes(a.symbol))
          : data;
        setAnnouncements(filtered);
      })
      .finally(() => setLoading(false));
  }, []);

  // Unique company list for dropdown
  const companies = Array.from(new Set(announcements.map((a) => a.symbol))).sort();

  // Apply filters
  const filtered = announcements.filter((a) => {
    const imp = normaliseImpact(a.signal.impact);
    if (impact === "positive" && imp !== "🟢") return false;
    if (impact === "negative" && imp !== "🔴") return false;
    if (impact === "neutral"  && imp !== "🟡") return false;
    if (company !== "all" && a.symbol !== company) return false;
    return true;
  });

  // Apply sort
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "priority") return b.signal.priority - a.signal.priority;
    if (sort === "symbol")   return a.symbol.localeCompare(b.symbol);
    // default: date desc
    return (b.date || "").localeCompare(a.date || "");
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const visible    = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const criticals  = announcements.filter((a) => a.signal.priority >= 5).length;

  const resetPage = () => setPage(1);

  if (!loading && announcements.length === 0) return null;

  return (
    <section className="space-y-3">

      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold tracking-widest uppercase text-text-muted">
          Latest Announcements
        </span>
        {criticals > 0 && (
          <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-signal-red-bg text-signal-red">
            {criticals} critical
          </span>
        )}
        {!loading && (
          <span className="text-2xs text-text-muted">{announcements.length} tracked</span>
        )}
        {!loading && <Legend />}
      </div>

      <div className="h-px bg-border" />

      {/* Filter + Sort bar */}
      {!loading && announcements.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">

          {/* Impact filter pills */}
          <div className="flex items-center gap-1">
            {(["all", "positive", "negative", "neutral"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setImpact(f); resetPage(); }}
                className={`text-2xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  impact === f
                    ? "bg-foreground text-card"
                    : "bg-muted text-text-muted hover:bg-border"
                }`}
              >
                {f === "all" ? "All" : f === "positive" ? "🟢 Positive" : f === "negative" ? "🔴 Negative" : "🟡 Neutral"}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Company dropdown */}
            <select
              value={company}
              onChange={(e) => { setCompany(e.target.value); resetPage(); }}
              className="text-2xs bg-card border border-border rounded-lg px-2 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All companies</option>
              {companies.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Sort dropdown */}
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as SortKey); resetPage(); }}
              className="text-2xs bg-card border border-border rounded-lg px-2 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="date">Sort: Newest first</option>
              <option value="priority">Sort: Priority</option>
              <option value="symbol">Sort: A–Z</option>
            </select>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <AnnouncementSkeleton key={i} />)}
        </div>
      )}

      {/* Empty after filter */}
      {!loading && sorted.length === 0 && (
        <div className="card-base p-5 text-center">
          <p className="text-xs text-text-muted">No announcements match your filters.</p>
        </div>
      )}

      {/* Rows */}
      {!loading && visible.length > 0 && (
        <div className="space-y-2">
          {visible.map((ann) => (
            <AnnouncementRow key={`${ann.symbol}-${ann.id}`} ann={ann} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-muted text-text-muted hover:bg-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ←
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            // Always show first, last, current, and neighbours; replace gaps with …
            const show = p === 1 || p === totalPages || Math.abs(p - page) <= 1;
            const gap  = !show && (p === 2 && page > 4 || p === totalPages - 1 && page < totalPages - 3);
            if (!show && !gap) return null;
            if (gap) return <span key={p} className="text-xs text-text-muted px-1">…</span>;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`text-xs w-8 h-7 rounded-lg font-medium transition-colors ${
                  p === page
                    ? "bg-foreground text-card"
                    : "bg-muted text-text-muted hover:bg-border"
                }`}
              >
                {p}
              </button>
            );
          })}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-muted text-text-muted hover:bg-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            →
          </button>

          <span className="text-2xs text-text-muted ml-2">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
        </div>
      )}

    </section>
  );
}
