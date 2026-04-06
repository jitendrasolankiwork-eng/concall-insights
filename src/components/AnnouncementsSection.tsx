/**
 * AnnouncementsSection.tsx
 *
 * Homepage feed of high-signal BSE announcements across all tracked companies.
 * Shows announcements with priority >= 3, sorted by priority then date.
 * Each row: impact emoji · P-badge · symbol · type · summary · action pill · data chips.
 */

import { useState, useEffect } from "react";
import { fetchRecentAnnouncements, type RecentAnnouncement } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function impactColor(impact: string) {
  if (impact === "🟢") return { badge: "bg-signal-green-bg text-signal-green", border: "border-signal-green/20" };
  if (impact === "🔴") return { badge: "bg-signal-red-bg text-signal-red",   border: "border-signal-red/20"   };
  return                       { badge: "bg-signal-amber-bg text-signal-amber", border: "border-signal-amber/20" };
}

function priorityColor(p: number) {
  if (p >= 5) return "bg-signal-red-bg text-signal-red";
  if (p >= 4) return "bg-signal-green-bg text-signal-green";
  return             "bg-signal-amber-bg text-signal-amber";
}

function actionColor(action: string) {
  const a = action.toLowerCase();
  if (a.includes("positive") || a.includes("hold"))    return "bg-signal-green-bg text-signal-green";
  if (a.includes("caution")  || a.includes("monitor")) return "bg-signal-red-bg text-signal-red";
  return                                                        "bg-muted text-text-secondary";
}

function relativeTime(dateStr: string | null, displayDate: string): string {
  if (!dateStr) return displayDate || "";
  const d    = new Date(dateStr);
  const now  = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff  <  7) return `${diff}d ago`;
  return displayDate;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function AnnouncementSkeleton() {
  return (
    <div className="card-base flex items-start gap-3 p-3.5 animate-pulse">
      <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
        <div className="w-5 h-5 rounded bg-muted" />
        <div className="w-5 h-3 rounded bg-muted" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <div className="h-3 w-16 bg-muted rounded" />
          <div className="h-3 w-24 bg-muted rounded-full" />
        </div>
        <div className="h-3.5 w-56 bg-muted rounded" />
        <div className="h-3 w-40 bg-muted rounded" />
        <div className="flex gap-2">
          <div className="h-5 w-28 bg-muted rounded-full" />
          <div className="h-5 w-20 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function AnnouncementRow({ ann }: { ann: RecentAnnouncement }) {
  const { signal } = ann;
  const ic = impactColor(signal.impact);
  const pc = priorityColor(signal.priority);
  const ac = actionColor(signal.action);
  const when = relativeTime(ann.date, ann.displayDate);

  return (
    <div className={`card-base flex items-start gap-3 p-3.5 hover:border-signal-blue/40 transition-colors cursor-default border ${ic.border}`}>
      {/* Left: impact emoji + priority badge */}
      <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0 w-8">
        <span className="text-base leading-none">{signal.impact}</span>
        <span className={`text-2xs font-bold px-1 py-0.5 rounded ${pc}`}>P{signal.priority}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: symbol + type + time */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-bold text-text-primary">{ann.symbol}</span>
          {ann.isNew && (
            <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-signal-blue text-white">NEW</span>
          )}
          <span className="text-2xs px-1.5 py-0.5 rounded-full bg-muted text-text-muted">{signal.type}</span>
          <span className="text-2xs text-text-muted ml-auto">{when}</span>
        </div>

        {/* Summary */}
        <p className="text-sm font-semibold text-text-primary mb-0.5 leading-snug">{signal.summary}</p>

        {/* Impact explanation */}
        <p className="text-xs text-text-secondary mb-2 leading-relaxed">{signal.impactExplanation}</p>

        {/* Action pill + data chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-2xs font-medium px-2 py-0.5 rounded-full ${ac}`}>
            {signal.action}
          </span>
          {signal.keyDataPoints.map((dp, i) => (
            <span key={i} className="text-2xs px-1.5 py-0.5 rounded bg-muted text-text-muted">
              {dp}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

const INITIAL_SHOW = 5;

interface Props {
  /** Optional: filter to only these symbols (e.g. portfolio symbols). Pass [] to show all. */
  symbols?: string[];
}

export function AnnouncementsSection({ symbols = [] }: Props) {
  const [announcements, setAnnouncements] = useState<RecentAnnouncement[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showAll,       setShowAll]       = useState(false);
  const [filter,        setFilter]        = useState<"all" | "positive" | "negative" | "neutral">("all");

  useEffect(() => {
    setLoading(true);
    fetchRecentAnnouncements(3, 50)
      .then((data) => {
        // Filter to tracked symbols if a list was passed
        const filtered = symbols.length > 0
          ? data.filter((a) => symbols.includes(a.symbol))
          : data;
        setAnnouncements(filtered);
      })
      .finally(() => setLoading(false));
  }, []);  // intentionally stable — refresh on mount only

  // Impact filter
  const filtered = announcements.filter((a) => {
    if (filter === "positive") return a.signal.impact === "🟢";
    if (filter === "negative") return a.signal.impact === "🔴";
    if (filter === "neutral")  return a.signal.impact === "🟡";
    return true;
  });

  const visible   = showAll ? filtered : filtered.slice(0, INITIAL_SHOW);
  const hasMore   = filtered.length > INITIAL_SHOW;
  const criticals = filtered.filter((a) => a.signal.priority >= 5).length;

  if (!loading && announcements.length === 0) return null;

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold tracking-widest uppercase text-text-muted">
            Latest Announcements
          </h2>
          {criticals > 0 && (
            <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-signal-red-bg text-signal-red">
              {criticals} critical
            </span>
          )}
          {!loading && (
            <span className="text-2xs text-text-muted">{announcements.length} tracked</span>
          )}
        </div>

        {/* Impact filter pills */}
        {!loading && announcements.length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            {(["all", "positive", "negative", "neutral"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setShowAll(false); }}
                className={`text-2xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  filter === f
                    ? "bg-foreground text-card"
                    : "bg-muted text-text-muted hover:bg-border"
                }`}
              >
                {f === "all"      ? "All"
                 : f === "positive" ? "🟢"
                 : f === "negative" ? "🔴"
                 : "🟡"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <AnnouncementSkeleton key={i} />)}
        </div>
      )}

      {/* Empty after filter */}
      {!loading && filtered.length === 0 && (
        <div className="card-base p-5 text-center">
          <p className="text-xs text-text-muted">No announcements yet — check back after the next poll.</p>
        </div>
      )}

      {/* Announcement rows */}
      {!loading && visible.length > 0 && (
        <div className="space-y-2">
          {visible.map((ann) => (
            <AnnouncementRow key={`${ann.symbol}-${ann.id}`} ann={ann} />
          ))}
        </div>
      )}

      {/* Show more / less */}
      {!loading && hasMore && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full text-xs py-2.5 rounded-xl bg-muted text-text-muted hover:bg-border transition-colors"
        >
          {showAll ? "Show fewer ↑" : `Show ${filtered.length - INITIAL_SHOW} more ↓`}
        </button>
      )}
    </section>
  );
}
