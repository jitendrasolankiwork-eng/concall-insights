import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  fetchAllPrompts, savePrompt, resetPrompt,
  fetchSheetRows, addSheetRow, updateSheetRow, deleteSheetRow, processSymbol,
  fetchWriterSetup,
  type SheetRowInput,
} from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PromptMeta {
  id            : string;
  name          : string;
  description   : string;
  category      : string;
  variables     : string[];
  defaultContent: string;
  customContent : string | null;
  isCustom      : boolean;
}

interface SheetRow {
  id             : string;
  symbol         : string;
  companyName    : string;
  quarter        : string;
  quarterRaw     : string;
  concallUrl     : string | null;
  pptUrl         : string | null;
  status         : string;
  lastProcessedAt: string | null;
  forceRefresh   : boolean;
  priority       : string;
  marketCap      : number | null;
  rowIndex       : number;
}

const EMPTY_FORM: SheetRowInput = {
  symbol      : "",
  companyName : "",
  quarter     : "",
  concallUrl  : "",
  pptUrl      : "",
  status      : "pending",
  forceRefresh: false,
  priority    : "medium",
  marketCap   : "",
};

const CATEGORY_ORDER = ["Core", "Thesis", "Valuation", "Individual Mode", "Trend Analysis"];

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  "Core"           : { icon: "⚡", color: "text-signal-amber" },
  "Thesis"         : { icon: "🎯", color: "text-signal-blue"  },
  "Valuation"      : { icon: "📊", color: "text-signal-green" },
  "Individual Mode": { icon: "🔍", color: "text-text-muted"   },
  "Trend Analysis" : { icon: "📈", color: "text-signal-green" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const cls =
    s === "processed" ? "bg-signal-green-bg text-signal-green border-signal-green/20" :
    s === "error"     ? "bg-signal-red-bg   text-signal-red   border-signal-red/20"   :
                        "bg-signal-amber-bg text-signal-amber border-signal-amber/20";
  const label = s === "processed" ? "✓ processed" : s === "error" ? "✕ error" : "○ pending";
  return (
    <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const p = (priority || "").toLowerCase();
  const cls =
    p === "high"   ? "bg-signal-blue-bg text-signal-blue border-signal-blue/20" :
    p === "low"    ? "bg-muted text-text-muted border-border" :
                     "bg-muted text-text-secondary border-border";
  return (
    <span className={`text-2xs font-medium px-1.5 py-0.5 rounded border ${cls}`}>
      {p}
    </span>
  );
}

// ── PIN gate ──────────────────────────────────────────────────────────────────
function PinGate({ onAuthenticated }: { onAuthenticated: (pin: string) => void }) {
  const [pin,     setPin]     = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoading(true);
    try {
      const resp = await fetchAllPrompts(pin.trim());
      if (resp.success) {
        sessionStorage.setItem("adminPin", pin.trim());
        onAuthenticated(pin.trim());
      } else {
        setError("Incorrect PIN. Try again.");
      }
    } catch (err: any) {
      setError(err.message || "Incorrect PIN. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-signal-blue-bg border border-signal-blue/20 flex items-center justify-center mx-auto text-2xl">
            🔐
          </div>
          <div>
            <h1 className="text-base font-bold text-text-primary">Admin Portal</h1>
            <p className="text-xs text-text-muted mt-0.5">Company management & prompt configuration</p>
          </div>
        </div>
        <div className="card-base p-6 space-y-4">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">
                Access PIN
              </label>
              <input
                type="password"
                placeholder="• • • • • •"
                value={pin}
                onChange={(e) => { setPin(e.target.value); setError(""); }}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-signal-blue/40 focus:border-signal-blue/50 text-center tracking-[0.4em] transition-all"
                maxLength={6}
                autoFocus
              />
              {error && (
                <div className="flex items-center gap-1.5 bg-signal-red-bg rounded-lg px-3 py-2">
                  <span className="text-signal-red text-xs">✕</span>
                  <p className="text-2xs text-signal-red">{error}</p>
                </div>
              )}
            </div>
            <button type="submit" disabled={loading || !pin.trim()}
              className="w-full bg-signal-blue-bg border border-signal-blue/30 text-signal-blue text-xs font-semibold py-2.5 rounded-xl hover:bg-signal-blue hover:text-card transition-all duration-150 disabled:opacity-40 flex items-center justify-center gap-2">
              {loading
                ? <><span className="w-3.5 h-3.5 border-2 border-signal-blue/40 border-t-signal-blue rounded-full animate-spin" /> Verifying…</>
                : "Unlock →"
              }
            </button>
          </form>
        </div>
        <Link to="/" className="block text-center text-2xs text-text-muted hover:text-text-primary transition-colors">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}

// ── Edit / Add Panel ──────────────────────────────────────────────────────────
function EditPanel({
  pin,
  mode,
  row,
  onSaved,
  onProcessed,
  onClose,
}: {
  pin        : string;
  mode       : "add" | "edit";
  row        : SheetRow | null;   // null when adding
  onSaved    : () => void;
  onProcessed: (result: any) => void;
  onClose    : () => void;
}) {
  const rowToForm = (r: SheetRow): SheetRowInput => ({
    symbol      : r.symbol,
    companyName : r.companyName,
    quarter     : r.quarterRaw || r.quarter,
    concallUrl  : r.concallUrl  || "",
    pptUrl      : r.pptUrl      || "",
    status      : r.status,
    forceRefresh: r.forceRefresh,
    priority    : r.priority,
    marketCap   : r.marketCap !== null ? String(r.marketCap) : "",
  });

  const [form,       setForm]       = useState<SheetRowInput>(row ? rowToForm(row) : EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saved,      setSaved]      = useState(mode === "edit"); // edit rows are already saved
  const [msg,        setMsg]        = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [processMsg, setProcessMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Reset when row/mode changes
  useEffect(() => {
    setForm(row ? rowToForm(row) : EMPTY_FORM);
    setSaved(mode === "edit");
    setMsg(null);
    setProcessMsg(null);
  }, [row?.rowIndex, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field: keyof SheetRowInput, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.symbol || !form.quarter) return;
    setSaving(true);
    setMsg(null);
    try {
      let resp;
      if (mode === "add") {
        resp = await addSheetRow(pin, form);
      } else {
        resp = await updateSheetRow(pin, row!.rowIndex, form);
      }
      if (resp.success) {
        setMsg({ type: "ok", text: mode === "add" ? "Row added to sheet ✓" : "Saved to sheet ✓" });
        setSaved(true);
        onSaved();
      } else {
        setMsg({ type: "err", text: resp.error || "Save failed" });
      }
    } catch (err: any) {
      setMsg({ type: "err", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleProcess = async () => {
    if (!form.symbol) return;
    setProcessing(true);
    setProcessMsg(null);
    try {
      const resp = await processSymbol(pin, form.symbol.toUpperCase());
      if (resp.success) {
        const detail = resp.result?.details?.[0];
        const text = detail
          ? `Processed — score: ${detail.score ?? "—"} · ${detail.status}`
          : "Processing complete";
        setProcessMsg({ type: "ok", text });
        onProcessed(resp.result);
        onSaved(); // refresh table
      } else {
        setProcessMsg({ type: "err", text: resp.error || "Processing failed" });
      }
    } catch (err: any) {
      setProcessMsg({ type: "err", text: err.message });
    } finally {
      setProcessing(false);
    }
  };

  const inputCls = "w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-signal-blue/30 focus:border-signal-blue/40 transition-all";
  const labelCls = "block text-2xs font-semibold text-text-secondary uppercase tracking-wider mb-1";

  return (
    <div className="w-80 flex-shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div>
          <h3 className="text-xs font-bold text-text-primary">
            {mode === "add" ? "Add Company" : `Edit — ${row?.symbol}`}
          </h3>
          <p className="text-2xs text-text-muted mt-0.5">
            {mode === "add" ? "New row in Google Sheet" : `Row ${row?.rowIndex}`}
          </p>
        </div>
        <button onClick={onClose}
          className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none px-1">
          ×
        </button>
      </div>

      {/* Fields — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Symbol + Company Name */}
        <div>
          <label className={labelCls}>NSE Ticker *</label>
          <input value={form.symbol}
            onChange={(e) => set("symbol", e.target.value.toUpperCase())}
            placeholder="e.g. MANORAMA"
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className={labelCls}>Company Name</label>
          <input value={form.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            placeholder="e.g. Manorama Industries Limited"
            className={inputCls}
          />
        </div>

        {/* Quarter */}
        <div>
          <label className={labelCls}>Quarter * <span className="font-normal normal-case text-text-muted">(e.g. FY26-Q3)</span></label>
          <input value={form.quarter}
            onChange={(e) => set("quarter", e.target.value)}
            placeholder="FY26-Q3"
            className={inputCls}
            required
          />
        </div>

        {/* URLs */}
        <div>
          <label className={labelCls}>Concall PDF URL <span className="font-normal normal-case text-text-muted">(BSE)</span></label>
          <input value={form.concallUrl}
            onChange={(e) => set("concallUrl", e.target.value)}
            placeholder="https://www.bseindia.com/..."
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Investor PPT URL <span className="font-normal normal-case text-text-muted">(optional)</span></label>
          <input value={form.pptUrl}
            onChange={(e) => set("pptUrl", e.target.value)}
            placeholder="https://www.bseindia.com/..."
            className={inputCls}
          />
        </div>

        {/* Market Cap */}
        <div>
          <label className={labelCls}>Market Cap <span className="font-normal normal-case text-text-muted">(₹ Crores)</span></label>
          <input value={form.marketCap}
            onChange={(e) => set("marketCap", e.target.value)}
            placeholder="e.g. 7203"
            type="number"
            className={inputCls}
          />
        </div>

        {/* Status + Priority row */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value)}
              className={`${inputCls} cursor-pointer`}>
              <option value="pending">pending</option>
              <option value="processed">processed</option>
              <option value="error">error</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Priority</label>
            <select value={form.priority} onChange={(e) => set("priority", e.target.value)}
              className={`${inputCls} cursor-pointer`}>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </div>
        </div>

        {/* Force Refresh toggle */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-2xs font-semibold text-text-secondary uppercase tracking-wider">Force Refresh</p>
            <p className="text-2xs text-text-muted">Reprocess even if already done</p>
          </div>
          <button
            type="button"
            onClick={() => set("forceRefresh", !form.forceRefresh)}
            className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${
              form.forceRefresh ? "bg-signal-blue" : "bg-muted border border-border"
            }`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-card shadow transition-all ${
              form.forceRefresh ? "left-5" : "left-0.5"
            }`} />
          </button>
        </div>

        {/* Save message */}
        {msg && (
          <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-2xs font-semibold ${
            msg.type === "ok"
              ? "bg-signal-green-bg text-signal-green"
              : "bg-signal-red-bg text-signal-red"
          }`}>
            {msg.type === "ok" ? "✓" : "✕"} {msg.text}
          </div>
        )}

        {/* Process result */}
        {processMsg && (
          <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-2xs font-semibold ${
            processMsg.type === "ok"
              ? "bg-signal-green-bg text-signal-green"
              : "bg-signal-red-bg text-signal-red"
          }`}>
            {processMsg.type === "ok" ? "✓" : "✕"} {processMsg.text}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-border px-4 py-3 flex-shrink-0 space-y-2">
        {/* Save button */}
        <button onClick={handleSave} disabled={saving || !form.symbol || !form.quarter}
          className="w-full flex items-center justify-center gap-2 bg-signal-blue text-card text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-all disabled:opacity-40">
          {saving
            ? <><span className="w-3 h-3 border-2 border-card/40 border-t-card rounded-full animate-spin" /> Saving…</>
            : mode === "add" ? "Add to Sheet" : "Save to Sheet"
          }
        </button>

        {/* Process button — only enabled after save */}
        <button onClick={handleProcess}
          disabled={processing || !saved || !form.symbol}
          title={!saved ? "Save to sheet first" : "Run AI extraction pipeline (2–5 min)"}
          className={`w-full flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg border transition-all ${
            saved && !processing
              ? "bg-signal-green-bg border-signal-green/30 text-signal-green hover:bg-signal-green hover:text-card"
              : "bg-muted border-border text-text-muted cursor-not-allowed opacity-50"
          }`}>
          {processing
            ? <><span className="w-3 h-3 border-2 border-signal-green/40 border-t-signal-green rounded-full animate-spin" /> Processing… (2–5 min)</>
            : "▶ Process with AI"
          }
        </button>

        <button onClick={onClose}
          className="w-full text-2xs text-text-muted hover:text-text-primary transition-colors py-1">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Setup Banner ──────────────────────────────────────────────────────────────
function SetupBanner() {
  const [expanded, setExpanded] = useState(false);
  const [setup,    setSetup]    = useState<{ appsScriptCode?: string; instructions?: string[] } | null>(null);
  const [copied,   setCopied]   = useState(false);

  const load = async () => {
    if (!expanded) {
      const data = await fetchWriterSetup();
      setSetup(data);
    }
    setExpanded((v) => !v);
  };

  const copy = () => {
    if (setup?.appsScriptCode) {
      navigator.clipboard.writeText(setup.appsScriptCode.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-signal-amber-bg border border-signal-amber/30 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="text-signal-amber text-sm mt-0.5">⚠</span>
          <div>
            <p className="text-xs font-semibold text-signal-amber">Apps Script not configured</p>
            <p className="text-2xs text-text-secondary mt-0.5">
              Add/Edit/Delete actions need <code className="bg-muted px-1 rounded text-text-primary">SHEET_WRITER_URL</code> in your <code className="bg-muted px-1 rounded text-text-primary">.env</code> file.
            </p>
          </div>
        </div>
        <button onClick={load}
          className="text-2xs font-semibold text-signal-amber hover:text-text-primary transition-colors flex-shrink-0">
          {expanded ? "Hide ▲" : "Setup ▼"}
        </button>
      </div>

      {expanded && setup && (
        <div className="mt-4 space-y-3">
          <ol className="space-y-1">
            {setup.instructions?.map((step, i) => (
              <li key={i} className="text-2xs text-text-secondary flex gap-2">
                <span className="text-text-muted flex-shrink-0">{i + 1}.</span>
                <span>{step.replace(/^\d+\.\s*/, "")}</span>
              </li>
            ))}
          </ol>
          <div className="relative">
            <pre className="bg-background border border-border rounded-lg p-3 text-2xs font-mono text-text-secondary overflow-x-auto max-h-40">
              {setup.appsScriptCode?.trim()}
            </pre>
            <button onClick={copy}
              className="absolute top-2 right-2 text-2xs font-semibold px-2 py-1 rounded bg-signal-blue-bg text-signal-blue border border-signal-blue/20 hover:bg-signal-blue hover:text-card transition-all">
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reprocess All Modal ───────────────────────────────────────────────────────
type SymbolResult = { symbol: string; status: "pending" | "processing" | "done" | "error"; detail: string };

function ReprocessModal({
  symbols, pin, onClose, onDone,
}: { symbols: string[]; pin: string; onClose: () => void; onDone: () => void }) {
  const [phase,    setPhase]    = useState<"confirm" | "running" | "done">("confirm");
  const [results,  setResults]  = useState<SymbolResult[]>(
    symbols.map((s) => ({ symbol: s, status: "pending", detail: "" }))
  );
  const [current,  setCurrent]  = useState(0);
  const cancelled = useRef(false);

  const start = async () => {
    setPhase("running");
    for (let i = 0; i < symbols.length; i++) {
      if (cancelled.current) break;
      const sym = symbols[i];
      setCurrent(i);
      setResults((prev) => prev.map((r) => r.symbol === sym ? { ...r, status: "processing" } : r));
      try {
        const resp = await processSymbol(pin, sym);
        const detail = resp.result?.details?.map((d: any) =>
          `${d.quarter ?? ""} → ${d.status}${d.score != null ? ` (${d.score})` : ""}`
        ).join(", ") || (resp.success ? "done" : resp.error || "error");
        setResults((prev) => prev.map((r) => r.symbol === sym
          ? { ...r, status: resp.success ? "done" : "error", detail }
          : r
        ));
      } catch (err: any) {
        setResults((prev) => prev.map((r) => r.symbol === sym
          ? { ...r, status: "error", detail: err.message }
          : r
        ));
      }
    }
    setPhase("done");
    onDone();
  };

  const cancel = () => { cancelled.current = true; onClose(); };

  const done   = results.filter((r) => r.status === "done").length;
  const errors = results.filter((r) => r.status === "error").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-text-primary">Reprocess All Companies</h3>
            <p className="text-2xs text-text-muted mt-0.5">
              {phase === "confirm" ? `${symbols.length} unique companies · ~₹35 estimated cost`
               : phase === "running" ? `${done}/${symbols.length} done${errors > 0 ? ` · ${errors} errors` : ""}`
               : `Complete — ${done} processed, ${errors} failed`}
            </p>
          </div>
          {phase !== "running" && (
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg px-1">×</button>
          )}
        </div>

        {/* Confirm screen */}
        {phase === "confirm" && (
          <div className="px-5 py-4 space-y-4">
            <div className="bg-signal-amber-bg border border-signal-amber/30 rounded-xl px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-signal-amber">What this will do</p>
              <ul className="space-y-1">
                {["Process all {n} companies sequentially (one at a time)".replace("{n}", String(symbols.length)),
                  "Force re-extract even already-processed companies",
                  "Update Google Sheet status after each one",
                  "Takes ~2–4 min per company (30–90 min total)"
                ].map((t, i) => (
                  <li key={i} className="text-2xs text-text-secondary flex gap-2">
                    <span className="text-signal-amber flex-shrink-0">·</span>{t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {symbols.map((s) => (
                <div key={s} className="flex items-center gap-2 text-2xs text-text-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-border flex-shrink-0" />
                  {s}
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={onClose}
                className="flex-1 py-2 text-xs font-semibold rounded-xl bg-muted text-text-secondary hover:bg-border transition-all">
                Cancel
              </button>
              <button onClick={start}
                className="flex-1 py-2 text-xs font-semibold rounded-xl bg-signal-blue text-card hover:opacity-90 transition-all">
                Start Reprocessing →
              </button>
            </div>
          </div>
        )}

        {/* Running / Done screen */}
        {(phase === "running" || phase === "done") && (
          <div className="px-5 py-4 space-y-3">
            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-2xs text-text-muted">
                <span>{phase === "running" ? `Processing ${symbols[current] ?? "…"}` : "All done"}</span>
                <span>{done + errors}/{symbols.length}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-signal-blue rounded-full transition-all duration-500"
                  style={{ width: `${((done + errors) / symbols.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Per-company list */}
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {results.map((r) => {
                const icon  = r.status === "done" ? "✓" : r.status === "error" ? "✕" : r.status === "processing" ? "⟳" : "○";
                const color = r.status === "done" ? "text-signal-green" : r.status === "error" ? "text-signal-red" : r.status === "processing" ? "text-signal-blue animate-pulse" : "text-text-muted";
                return (
                  <div key={r.symbol} className="flex items-start gap-2 py-1">
                    <span className={`text-xs font-bold flex-shrink-0 mt-0.5 ${color}`}>{icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs font-semibold ${color}`}>{r.symbol}</span>
                      {r.detail && (
                        <p className="text-2xs text-text-muted truncate">{r.detail}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {phase === "done" && (
              <button onClick={onClose}
                className="w-full py-2 text-xs font-semibold rounded-xl bg-signal-green text-card hover:opacity-90 transition-all">
                Done ✓
              </button>
            )}
            {phase === "running" && (
              <button onClick={cancel}
                className="w-full py-2 text-xs font-semibold rounded-xl bg-muted text-text-secondary hover:bg-border transition-all">
                Cancel (finishes current company)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Companies Tab ──────────────────────────────────────────────────────────────
function CompaniesTab({ pin }: { pin: string }) {
  const [rows,           setRows]           = useState<SheetRow[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [writerReady,    setWriterReady]    = useState(true);
  const [panelMode,      setPanelMode]      = useState<"add" | "edit" | null>(null);
  const [selectedRow,    setSelectedRow]    = useState<SheetRow | null>(null);
  const [deletingIndex,  setDeletingIndex]  = useState<number | null>(null);
  const [flashMsg,       setFlashMsg]       = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showReprocess,  setShowReprocess]  = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (type: "ok" | "err", text: string) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashMsg({ type, text });
    flashTimer.current = setTimeout(() => setFlashMsg(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSheetRows();
      if (data.success) {
        setRows(data.rows || []);
        setWriterReady(data.writerConfigured ?? true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (row: SheetRow) => {
    setSelectedRow(row);
    setPanelMode("edit");
  };

  const openAdd = () => {
    setSelectedRow(null);
    setPanelMode("add");
  };

  const closePanel = () => {
    setPanelMode(null);
    setSelectedRow(null);
  };

  const handleDelete = async (row: SheetRow) => {
    if (!confirm(`Delete row for ${row.symbol} ${row.quarter}?\n\nThis removes it from Google Sheet permanently.`)) return;
    setDeletingIndex(row.rowIndex);
    try {
      const resp = await deleteSheetRow(pin, row.rowIndex);
      if (resp.success) {
        flash("ok", `Deleted ${row.symbol} ${row.quarter}`);
        if (selectedRow?.rowIndex === row.rowIndex) closePanel();
        await load();
      } else {
        flash("err", resp.error || "Delete failed");
      }
    } catch (err: any) {
      flash("err", err.message);
    } finally {
      setDeletingIndex(null);
    }
  };

  // Group rows by symbol for display
  const symbols = Array.from(new Set(rows.map((r) => r.symbol)));

  return (
    <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 48px)" }}>

      {/* Reprocess All modal */}
      {showReprocess && (
        <ReprocessModal
          symbols={symbols}
          pin={pin}
          onClose={() => setShowReprocess(false)}
          onDone={() => { setShowReprocess(false); load(); flash("ok", "Reprocessing complete — sheet updated"); }}
        />
      )}

      {/* ── Left: table ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-text-primary">Google Sheet</h2>
            <span className="text-2xs text-text-muted px-2 py-0.5 bg-muted rounded-full">
              {rows.length} rows · {symbols.length} companies
            </span>
            {flashMsg && (
              <span className={`text-2xs font-semibold ${flashMsg.type === "ok" ? "text-signal-green" : "text-signal-red"}`}>
                {flashMsg.type === "ok" ? "✓" : "✕"} {flashMsg.text}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load}
              className="text-2xs text-text-muted hover:text-text-primary transition-colors px-2 py-1 rounded hover:bg-muted">
              ↻ Refresh
            </button>
            <button
              onClick={() => setShowReprocess(true)}
              disabled={rows.length === 0}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-signal-amber-bg text-signal-amber border border-signal-amber/30 hover:bg-signal-amber hover:text-card transition-all disabled:opacity-40">
              ⟳ Reprocess All
            </button>
            <button onClick={openAdd}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-signal-blue text-card hover:opacity-90 transition-all">
              + Add Row
            </button>
          </div>
        </div>

        {/* Setup banner */}
        {!writerReady && (
          <div className="px-5 pt-4">
            <SetupBanner />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-signal-blue/30 border-t-signal-blue rounded-full animate-spin" />
            <span className="text-xs text-text-muted">Reading sheet…</span>
          </div>
        )}

        {/* Table */}
        {!loading && (
          <div className="flex-1 overflow-y-auto">
            {/* Column headers */}
            <div className="sticky top-0 z-10 bg-muted border-b border-border grid grid-cols-[80px_1fr_90px_100px_80px_80px_100px_auto] gap-3 px-5 py-2">
              {["Symbol", "Company", "Quarter", "Status", "Priority", "MCap ₹Cr", "Processed", ""].map((h) => (
                <span key={h} className="text-2xs font-bold text-text-muted uppercase tracking-wider truncate">{h}</span>
              ))}
            </div>

            {rows.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-xs text-text-muted">No rows in sheet</p>
                <p className="text-2xs text-text-muted mt-1">Click "+ Add Row" to add your first company</p>
              </div>
            ) : (
              rows.map((row, i) => (
                <div
                  key={`${row.rowIndex}-${row.symbol}-${row.quarter}`}
                  className={`grid grid-cols-[80px_1fr_90px_100px_80px_80px_100px_auto] gap-3 items-center px-5 py-2.5 transition-colors ${
                    selectedRow?.rowIndex === row.rowIndex ? "bg-signal-blue-bg/30" : "hover:bg-muted/40"
                  } ${i < rows.length - 1 ? "border-b border-border" : ""}`}
                >
                  {/* Symbol */}
                  <div className="truncate">
                    <span className="text-xs font-bold text-signal-blue">{row.symbol}</span>
                  </div>

                  {/* Company name */}
                  <div className="truncate">
                    <span className="text-xs text-text-secondary truncate" title={row.companyName}>
                      {row.companyName}
                    </span>
                  </div>

                  {/* Quarter */}
                  <div>
                    <span className="text-2xs px-1.5 py-0.5 rounded bg-muted text-text-muted border border-border">
                      {row.quarter}
                    </span>
                  </div>

                  {/* Status */}
                  <div>
                    <StatusBadge status={row.status} />
                  </div>

                  {/* Priority */}
                  <div>
                    <PriorityBadge priority={row.priority} />
                  </div>

                  {/* Market Cap */}
                  <div className="text-right">
                    <span className="text-xs text-text-secondary">
                      {row.marketCap ? row.marketCap.toLocaleString("en-IN") : "—"}
                    </span>
                  </div>

                  {/* Last processed */}
                  <div>
                    <span className="text-2xs text-text-muted">{row.lastProcessedAt || "—"}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(row)}
                      title="Edit"
                      className={`text-2xs px-2 py-1 rounded-md border transition-all ${
                        selectedRow?.rowIndex === row.rowIndex
                          ? "bg-signal-blue text-card border-signal-blue"
                          : "text-text-muted border-border hover:text-signal-blue hover:border-signal-blue/30 hover:bg-signal-blue-bg"
                      }`}>
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(row)}
                      disabled={deletingIndex === row.rowIndex}
                      title="Delete row from sheet"
                      className="text-2xs px-2 py-1 rounded-md border border-transparent text-text-muted hover:text-signal-red hover:border-signal-red/20 hover:bg-signal-red-bg transition-all disabled:opacity-40">
                      {deletingIndex === row.rowIndex ? "…" : "×"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer note */}
        {!loading && (
          <div className="px-5 py-2 border-t border-border flex-shrink-0">
            <p className="text-2xs text-text-muted">
              Sheet ID: <code className="bg-muted px-1 rounded">1WYKg2WQ...0_E</code>
              · Reads live from Google Sheet CSV export
              · Write operations require Apps Script setup
            </p>
          </div>
        )}
      </div>

      {/* ── Right: edit panel ─────────────────────────────────────────────── */}
      {panelMode && (
        <EditPanel
          pin={pin}
          mode={panelMode}
          row={selectedRow}
          onSaved={() => load()}
          onProcessed={() => {}}
          onClose={closePanel}
        />
      )}
    </div>
  );
}

// ── Prompts Tab ───────────────────────────────────────────────────────────────
function PromptsTab({ pin }: { pin: string }) {
  const [prompts,     setPrompts]     = useState<PromptMeta[]>([]);
  const [selected,    setSelected]    = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving,      setSaving]      = useState(false);
  const [saveMsg,     setSaveMsg]     = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading,     setLoading]     = useState(true);

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllPrompts(pin);
      if (data.success) {
        setPrompts(data.prompts);
        if (!selected && data.prompts.length > 0) {
          const first = data.prompts[0];
          setSelected(first.id);
          setEditContent(first.customContent ?? first.defaultContent);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [pin, selected]);

  useEffect(() => { loadPrompts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectPrompt = (p: PromptMeta) => {
    setSelected(p.id);
    setEditContent(p.customContent ?? p.defaultContent);
    setSaveMsg(null);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await savePrompt(pin, selected, editContent);
      setSaveMsg({ type: "ok", text: "Saved — takes effect on next processing run." });
      await loadPrompts();
    } catch (err: any) {
      setSaveMsg({ type: "err", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selected) return;
    if (!confirm("Reset to default? Your custom version will be permanently deleted.")) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await resetPrompt(pin, selected);
      const refreshed = prompts.find(p => p.id === selected);
      if (refreshed) setEditContent(refreshed.defaultContent);
      setSaveMsg({ type: "ok", text: "Reset to default." });
      await loadPrompts();
    } catch (err: any) {
      setSaveMsg({ type: "err", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefault = () => {
    const p = prompts.find(x => x.id === selected);
    if (p) { setEditContent(p.defaultContent); setSaveMsg(null); }
  };

  const activePrompt = prompts.find(p => p.id === selected) || null;
  const customCount  = prompts.filter(p => p.isCustom).length;

  const grouped = CATEGORY_ORDER.reduce<Record<string, PromptMeta[]>>((acc, cat) => {
    acc[cat] = prompts.filter(p => p.category === cat);
    return acc;
  }, {});

  const isDirty = activePrompt
    ? editContent !== (activePrompt.customContent ?? activePrompt.defaultContent)
    : false;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2">
        <div className="w-4 h-4 border-2 border-signal-blue/30 border-t-signal-blue rounded-full animate-spin" />
        <span className="text-xs text-text-muted">Loading prompts…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 48px)" }}>

      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-border overflow-y-auto bg-card">
        <div className="px-3 pt-3 pb-2">
          <p className="text-2xs text-text-muted">{prompts.length} prompts · {customCount} overridden</p>
        </div>
        {CATEGORY_ORDER.map(cat => {
          const items = grouped[cat] || [];
          if (items.length === 0) return null;
          const meta = CATEGORY_META[cat] || { icon: "·", color: "text-text-muted" };
          return (
            <div key={cat} className="mb-1">
              <div className="flex items-center gap-1.5 px-3 pt-3 pb-1.5">
                <span className="text-xs">{meta.icon}</span>
                <span className="text-2xs font-bold text-text-muted uppercase tracking-wider">{cat}</span>
              </div>
              {items.map(p => (
                <button key={p.id} onClick={() => selectPrompt(p)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-all border-l-[3px] ${
                    selected === p.id
                      ? "bg-signal-blue-bg border-signal-blue"
                      : "border-transparent hover:bg-muted/60 hover:border-border"
                  }`}>
                  <span className={`text-xs leading-snug truncate ${
                    selected === p.id ? "font-semibold text-signal-blue" : "text-text-secondary"
                  }`}>
                    {p.name}
                  </span>
                  {p.isCustom && (
                    <span className="text-2xs font-bold px-1.5 py-0.5 rounded-md bg-signal-amber-bg text-signal-amber flex-shrink-0">
                      ✎
                    </span>
                  )}
                </button>
              ))}
            </div>
          );
        })}
        <div className="h-4" />
      </aside>

      {/* Editor */}
      {activePrompt ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          <div className="bg-card border-b border-border px-5 py-3 flex-shrink-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-text-primary">{activePrompt.name}</h2>
              {activePrompt.isCustom ? (
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-signal-amber-bg text-signal-amber border border-signal-amber/30">
                  ✎ Custom override
                </span>
              ) : (
                <span className="text-2xs font-medium px-2 py-0.5 rounded-full bg-muted text-text-muted border border-border">
                  Default
                </span>
              )}
              {isDirty && (
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-signal-blue-bg text-signal-blue border border-signal-blue/30 animate-pulse">
                  ● Unsaved
                </span>
              )}
            </div>
            <p className="text-2xs text-text-muted leading-relaxed max-w-2xl">{activePrompt.description}</p>
            {activePrompt.variables.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-2xs font-medium text-text-muted">Variables:</span>
                {activePrompt.variables.map(v => (
                  <code key={v} className="text-2xs px-2 py-0.5 rounded-md bg-signal-blue-bg text-signal-blue font-mono border border-signal-blue/20">
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-hidden p-4">
            <textarea
              value={editContent}
              onChange={(e) => { setEditContent(e.target.value); setSaveMsg(null); }}
              className="w-full h-full bg-card border border-border rounded-xl p-4 text-xs font-mono text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-signal-blue/30 focus:border-signal-blue/40 leading-[1.7] transition-all"
              spellCheck={false}
              placeholder="Prompt content…"
            />
          </div>

          <div className="bg-card border-t border-border px-5 py-2.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {saveMsg ? (
                <div className={`flex items-center gap-1.5 text-2xs font-semibold ${saveMsg.type === "ok" ? "text-signal-green" : "text-signal-red"}`}>
                  <span>{saveMsg.type === "ok" ? "✓" : "✕"}</span>
                  <span>{saveMsg.text}</span>
                </div>
              ) : (
                <span className="text-2xs text-text-muted">{editContent.length.toLocaleString()} chars</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(activePrompt.isCustom || isDirty) && (
                <button onClick={handleRestoreDefault}
                  className="text-2xs font-medium px-3 py-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-muted transition-all">
                  View default
                </button>
              )}
              {activePrompt.isCustom && (
                <button onClick={handleReset} disabled={saving}
                  className="text-2xs font-semibold px-3 py-1.5 rounded-lg bg-signal-red-bg text-signal-red border border-signal-red/20 hover:bg-signal-red hover:text-card transition-all disabled:opacity-40">
                  ↺ Reset
                </button>
              )}
              <button onClick={handleSave} disabled={saving || !isDirty}
                className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  isDirty && !saving
                    ? "bg-signal-blue text-card hover:opacity-90 shadow-sm"
                    : "bg-muted text-text-muted cursor-not-allowed opacity-50"
                }`}>
                {saving
                  ? <><span className="w-3 h-3 border-2 border-card/40 border-t-card rounded-full animate-spin" /> Saving…</>
                  : "Save changes"
                }
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <span className="text-3xl opacity-30">✏️</span>
          <p className="text-xs text-text-muted">Select a prompt from the sidebar to edit</p>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────
export default function Admin() {
  const [pin,       setPin]       = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"companies" | "prompts">("companies");
  const [promptCustomCount, setPromptCustomCount] = useState(0);

  useEffect(() => {
    const stored = sessionStorage.getItem("adminPin");
    if (stored) setPin(stored);
  }, []);

  // Load custom prompt count for tab badge (non-blocking)
  useEffect(() => {
    if (!pin) return;
    fetchAllPrompts(pin)
      .then((d) => { if (d.success) setPromptCustomCount(d.prompts.filter((p: any) => p.isCustom).length); })
      .catch(() => {});
  }, [pin]);

  if (!pin) return <PinGate onAuthenticated={(p) => setPin(p)} />;

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Top bar */}
      <header className="bg-card border-b border-border px-5 py-0 flex items-center justify-between flex-shrink-0 h-12">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-text-muted hover:text-text-primary transition-colors text-sm leading-none">←</Link>
          <div className="w-px h-4 bg-border" />
          <span className="text-2xs text-text-muted">Admin</span>
          <span className="text-2xs text-text-muted">/</span>

          {/* Tab switcher */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("companies")}
              className={`text-xs font-semibold px-3 py-1 rounded-lg transition-all ${
                activeTab === "companies"
                  ? "bg-signal-blue-bg text-signal-blue"
                  : "text-text-muted hover:text-text-primary hover:bg-muted"
              }`}>
              Companies
            </button>
            <button
              onClick={() => setActiveTab("prompts")}
              className={`text-xs font-semibold px-3 py-1 rounded-lg transition-all ${
                activeTab === "prompts"
                  ? "bg-signal-blue-bg text-signal-blue"
                  : "text-text-muted hover:text-text-primary hover:bg-muted"
              }`}>
              Prompts
              {promptCustomCount > 0 && (
                <span className="ml-1.5 text-2xs font-bold px-1.5 py-0.5 rounded-full bg-signal-amber-bg text-signal-amber border border-signal-amber/20">
                  {promptCustomCount}
                </span>
              )}
            </button>
          </div>
        </div>
        <button
          onClick={() => { sessionStorage.removeItem("adminPin"); setPin(null); }}
          className="text-2xs text-text-muted hover:text-signal-red transition-colors px-2 py-1 rounded-md hover:bg-signal-red-bg">
          Sign out
        </button>
      </header>

      {activeTab === "companies" && <CompaniesTab pin={pin} />}
      {activeTab === "prompts"   && <PromptsTab   pin={pin} />}
    </div>
  );
}
