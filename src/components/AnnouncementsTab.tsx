/**
 * AnnouncementsTab.tsx — Tab 5
 *
 * Two sections:
 *  1. BSE Announcements — Company Update, Financial Results, Investor Presentation,
 *     Board Meeting — fetched daily from BSE API via our backend.
 *  2. Concalls & Presentations — transcripts + PPTs from Screener.in (existing).
 *
 * "New" items (first seen within 7 days) are shown with a green badge.
 */

import { useState, useEffect, useCallback } from "react";
import { fetchAnnouncements, fetchFundamentals } from "@/lib/api";

interface Props {
  symbol : string;
  visible: boolean;
}

// ── Category badge config ──────────────────────────────────────────────────────
const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Company Update"        : { bg: "bg-signal-amber-bg",  text: "text-signal-amber", border: "border-signal-amber/30" },
  "Financial Results"     : { bg: "bg-signal-green-bg",  text: "text-signal-green", border: "border-signal-green/30" },
  "Investor Presentation" : { bg: "bg-signal-blue-bg",   text: "text-signal-blue",  border: "border-signal-blue/30"  },
  "Board Meeting"         : { bg: "bg-muted",             text: "text-text-secondary", border: "border-border"        },
};

function CategoryBadge({ category }: { category: string }) {
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES["Board Meeting"];
  return (
    <span className={`text-2xs font-bold px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
      {category}
    </span>
  );
}

function ConcallTypeBadge({ type }: { type: "concall" | "ppt" }) {
  if (type === "concall")
    return <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-muted text-text-secondary border border-border">Transcript</span>;
  return <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-signal-blue-bg text-signal-blue border border-signal-blue/20">PPT</span>;
}

// ── Quarter inference for concall dates ────────────────────────────────────────
function inferQuarter(date: string): string {
  const m = date.match(/(\w{3})\s+(\d{4})/);
  if (!m) return date;
  const mon  = m[1].toLowerCase();
  const year = parseInt(m[2]);
  const fyMap: Record<string, string> = {
    jan: "Q3", feb: "Q3", mar: "Q4",
    apr: "Q4", may: "Q4", jun: "Q4",
    jul: "Q1", aug: "Q1", sep: "Q2",
    oct: "Q2", nov: "Q2", dec: "Q2",
  };
  const q  = fyMap[mon] || "Q?";
  const fy = (mon === "apr" || mon === "may" || mon === "jun")
    ? `FY${(year + 1).toString().slice(-2)}`
    : `FY${year.toString().slice(-2)}`;
  return `${q} ${fy}`;
}

// ── Time-ago helper ────────────────────────────────────────────────────────────
function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1)  return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// ── AI Summary — comparison table + detail bullets ───────────────────────────
type RowSentiment = "positive" | "negative" | "neutral";

interface TableRow { sentiment: RowSentiment; metric: string; values: string[] }
interface Bullet   { sentiment: RowSentiment; text: string }

const ROW_COLOR: Record<RowSentiment, string> = {
  positive: "text-signal-green",
  negative: "text-signal-red",
  neutral : "text-text-muted",
};

function sentimentOf(prefix: string): RowSentiment {
  return prefix === "+" ? "positive" : prefix === "-" ? "negative" : "neutral";
}

/** Parse two-section format.
 *  Uses "---" to split table section from bullet section — critical to prevent
 *  bullet lines (which AI may write as "+|text") being confused with table rows. */
function parseSummary(raw: string): { columns: string[]; rows: TableRow[]; bullets: Bullet[] } {
  const allLines = raw.split("\n").map((l) => l.trim());

  // Split on "---" separator — everything before is the table, everything after is bullets
  const sepIdx = allLines.findIndex((l) => l === "---");
  const tableLines  = sepIdx >= 0 ? allLines.slice(0, sepIdx)      : allLines;
  const bulletLines = sepIdx >= 0 ? allLines.slice(sepIdx + 1)     : [];

  // Detect COLUMNS: header in table section
  const columnsLine = tableLines.find((l) => l.startsWith("COLUMNS:"));
  const columns: string[] = columnsLine
    ? columnsLine.slice("COLUMNS:".length).split("|").map((c) => c.trim())
    : [];

  // Table rows: pipe-delimited lines with at least 2 pipes (sentiment|metric|value...)
  const rows: TableRow[] = tableLines
    .filter((l) => /^[+\-~]\|/.test(l) && (l.match(/\|/g) || []).length >= 2)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      const [s, metric, ...values] = parts;
      return {
        sentiment: sentimentOf(s),
        metric: metric || "",
        values: values.map((v) => v || "—"),
      };
    })
    .filter((r) => r.metric.length > 0 && ["positive","negative","neutral"].includes(r.sentiment));

  // Prose bullets — strip any leading +|- /~ with or without pipe, then take the text
  const parseBullet = (line: string): Bullet => {
    const s = line[0] === "+" ? "positive" : line[0] === "-" ? "negative" : "neutral";
    // Strip prefix: "+ ", "- ", "~ ", "+|", "-|", "~|"
    const text = line.replace(/^[+\-~][| ]/, "").trim();
    return { sentiment: s as RowSentiment, text };
  };

  const bullets: Bullet[] = bulletLines
    .filter((l) => l.length > 8 && /^[+\-~]/.test(l))
    .map(parseBullet)
    .filter((b) => b.text.length > 8);

  return { columns, rows, bullets };
}

// Returns true if the AI response is a refusal/error rather than structured output
function isInvalidSummary(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("cannot provide") ||
    t.includes("i cannot") ||
    t.includes("does not contain") ||
    t.includes("no financial data") ||
    t.includes("please provide") ||
    t.includes("not yet been disclosed")
  );
}

// Returns true for columns that represent a change/growth figure — these get sentiment color
const isChangeCol = (col: string) =>
  /yoy|%|change|growth|chg/i.test(col);

function AiSummary({ text }: { text: string }) {
  if (isInvalidSummary(text)) return null;
  const { columns, rows, bullets } = parseSummary(text);
  if (rows.length === 0 && bullets.length === 0) return null;

  // columns[0] is "Metric" label — display columns are the rest
  const hasColumns  = columns.length > 1;
  const displayCols = hasColumns ? columns.slice(1) : ["Now", "Prev (YoY)"];

  return (
    <div className="mt-2.5 pt-2.5 border-t border-border/50 space-y-2">
      <span className="text-xs font-bold text-signal-blue">✦ AI Summary</span>

      {/* KPI table — scrolls horizontally on narrow screens */}
      {rows.length > 0 && (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-xs text-text-muted font-medium pb-1 pr-3 whitespace-nowrap">
                  {columns[0] || "Metric"}
                </th>
                {displayCols.map((col, i) => (
                  <th key={i} className="text-right text-xs text-text-muted font-medium pb-1 pl-2 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-border/30">
                  <td className={`py-1 pr-3 text-xs font-semibold leading-snug whitespace-nowrap ${ROW_COLOR[row.sentiment]}`}>
                    {row.metric}
                  </td>
                  {displayCols.map((col, j) => {
                    // Current value cols (index 0, or any col that is a change/%) get sentiment color
                    const colored = j === 0 || isChangeCol(col);
                    return (
                      <td
                        key={j}
                        className={`py-1 pl-2 text-right text-xs whitespace-nowrap ${
                          colored ? ROW_COLOR[row.sentiment] : "text-text-muted"
                        } ${j === 0 ? "font-bold" : ""}`}
                      >
                        {row.values[j] ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail bullets */}
      {bullets.length > 0 && (
        <ul className="space-y-1.5 pt-1 border-t border-border/30">
          {bullets.map((b, i) => {
            const labelMatch = b.text.match(/^\[([^\]]+)\]\s*/);
            const label      = labelMatch ? labelMatch[1] : null;
            const bodyText   = labelMatch ? b.text.slice(labelMatch[0].length) : b.text;
            return (
              <li key={i} className={`text-xs leading-relaxed ${ROW_COLOR[b.sentiment]}`}>
                {label && (
                  <span className="inline-block text-xs font-bold px-1.5 py-0.5 rounded bg-muted text-text-muted mr-1.5 mb-0.5">
                    {label}
                  </span>
                )}
                {bodyText}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── BSE Announcements section ──────────────────────────────────────────────────
function BseSection({ symbol }: { symbol: string }) {
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAnnouncements(symbol)
      .then((r) => {
        if (r.success) setData(r);
        else setError("Could not load BSE announcements");
      })
      .catch(() => setError("Could not load BSE announcements"))
      .finally(() => setLoading(false));
  }, [symbol]);

  function handleRefresh() {
    setLoading(true);
    fetch(`/api/bse/announcements/${symbol}/refresh`, { method: "POST" })
      .then(() => fetchAnnouncements(symbol))
      .then((r) => { if (r.success) setData(r); })
      .finally(() => setLoading(false));
  }

  const items: any[] = data?.announcements || [];
  const newCount: number = data?.newCount ?? 0;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-text-primary">BSE Announcements</h3>
          {newCount > 0 && (
            <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-signal-green-bg text-signal-green border border-signal-green/30">
              {newCount} New
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data?.lastCheckedAt && (
            <span className="text-2xs text-text-muted">
              Updated {timeAgo(data.lastCheckedAt)}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="text-2xs text-signal-blue hover:underline disabled:opacity-40"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card-base p-3 animate-pulse space-y-2">
              <div className="h-2.5 bg-muted rounded w-24" />
              <div className="h-3.5 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="card-base p-4 text-center">
          <p className="text-xs text-signal-amber">⚠ {error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <div className="card-base p-4 text-center">
          <p className="text-xs text-text-muted">No announcements found yet. Check back after the next daily poll.</p>
        </div>
      )}

      {/* Announcement list */}
      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((ann) => (
            <div key={ann.id} className="card-base p-3 flex items-start gap-3">
              {/* New dot */}
              <div className="mt-1 flex-shrink-0">
                {ann.isNew
                  ? <span className="w-2 h-2 rounded-full bg-signal-green block" title="New" />
                  : <span className="w-2 h-2 rounded-full bg-transparent block" />
                }
              </div>
              <div className="flex-1 min-w-0">
                {/* Date + category + new badge */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-2xs text-text-muted font-medium">{ann.displayDate}</span>
                  <CategoryBadge category={ann.category} />
                  {ann.isNew && (
                    <span className="text-2xs font-bold text-signal-green">New</span>
                  )}
                </div>
                {/* Title */}
                <p className="text-sm font-semibold text-text-primary leading-snug">
                  {ann.title}
                </p>
                {/* AI Summary — Phase 2 */}
                {ann.aiSummary && (
                  <AiSummary text={ann.aiSummary} />
                )}
              </div>
              {/* PDF link */}
              {ann.pdfUrl && (
                <a
                  href={ann.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-2xs font-bold px-2 py-1 rounded bg-muted text-text-secondary hover:text-signal-blue hover:bg-signal-blue-bg border border-border transition-colors"
                >
                  PDF ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Concalls section (existing Screener data) ─────────────────────────────────
function ConcallsSection({ symbol }: { symbol: string }) {
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (fetched) return;
    setFetched(true);
    fetchFundamentals(symbol)
      .then((r) => { if (r.success && r.data) setData(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [symbol, fetched]);

  const concalls: any[] = data?.concalls || [];
  const rows: { date: string; quarter: string; type: "concall" | "ppt"; url: string }[] = [];
  concalls.forEach((c) => {
    if (c.transcriptUrl) rows.push({ date: c.date, quarter: inferQuarter(c.date), type: "concall", url: c.transcriptUrl });
    if (c.pptUrl)        rows.push({ date: c.date, quarter: inferQuarter(c.date), type: "ppt",     url: c.pptUrl });
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-bold text-text-primary">Concalls &amp; Presentations</h3>
        <span className="text-2xs text-text-muted">via Screener.in</span>
      </div>

      {loading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card-base p-3 animate-pulse space-y-2">
              <div className="h-2.5 bg-muted rounded w-24" />
              <div className="h-3.5 bg-muted rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="card-base p-4 text-center">
          <p className="text-xs text-text-muted">No concall documents found.</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <a
              key={i}
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card-base p-3 flex items-start gap-3 hover:bg-muted/30 transition-colors group block"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-2xs text-text-muted font-medium">{row.date}</span>
                  <ConcallTypeBadge type={row.type} />
                  <span className="text-2xs font-semibold text-text-secondary">{row.quarter}</span>
                </div>
                <p className="text-xs font-semibold text-text-primary group-hover:text-signal-blue transition-colors">
                  {row.type === "concall"
                    ? `${row.quarter} Earnings Call Transcript`
                    : `${row.quarter} Investor Presentation`}{" "}↗
                </p>
              </div>
            </a>
          ))}
        </div>
      )}

      {data?.bseCode && (
        <div className="text-center pt-2">
          <a
            href={`https://www.bseindia.com/stock-share-price/x/${symbol}/${data.bseCode}/corp-announcements/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-signal-blue hover:underline font-medium"
          >
            View all on BSE ↗
          </a>
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
type SubTab = "bse" | "concalls";

export function AnnouncementsTab({ symbol, visible }: Props) {
  const [activeTab, setActiveTab] = useState<SubTab>("bse");
  if (!visible) return null;

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {([ ["bse", "BSE Announcements"], ["concalls", "Concall / PPT"] ] as [SubTab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-3 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === id
                ? "border-signal-blue text-signal-blue"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "bse"      && <BseSection      symbol={symbol} />}
      {activeTab === "concalls" && <ConcallsSection symbol={symbol} />}
    </div>
  );
}
