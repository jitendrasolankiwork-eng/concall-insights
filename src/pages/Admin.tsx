import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  fetchAllPrompts, savePrompt, resetPrompt,
  fetchSheetRows, addSheetRow, updateSheetRow, deleteSheetRow, processSymbol,
  fetchWriterSetup, bseLookup, bseFilings, fetchChangelog,
  processAdminCompanyStream,
  fetchHealth, runHealthCheck, fetchHealthHistory,
  type SheetRowInput, type HealthPayload, type HealthCheckResult,
} from "@/lib/api";
import { CompanySearch } from "@/components/CompanySearch";

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
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
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
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${cls}`}>
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

  // BSE / Screener auto-discovery state
  const [bseLooking,       setBseLooking]       = useState(false);
  const [bseCode,          setBseCode]          = useState<string | null>(null);
  const [bseMsg,           setBseMsg]           = useState<string | null>(null);
  // Multi-quarter selection
  const [quarterSelections, setQuarterSelections] = useState<{
    quarter: string; date: string;
    concallUrl: string; pptUrl: string;
    selected: boolean;
  }[]>([]);

  const handleBseLookup = async () => {
    if (!form.symbol) return;
    setBseLooking(true);
    setBseMsg(null);
    setQuarterSelections([]);
    setBseCode(null);
    try {
      const [lookup, filingsResp] = await Promise.all([
        bseLookup(form.symbol),
        bseFilings(form.symbol),
      ]);

      // Fill company name + market cap
      if (lookup.companyName && !form.companyName) set("companyName", lookup.companyName);
      if (lookup.marketCap   && !form.marketCap)   set("marketCap",   String(lookup.marketCap));

      // Build quarter selection list — one entry per concall date (each has transcript + PPT)
      const concallEntries = (filingsResp.filings || []).filter((f: any) => f.type === "concall");
      const selections = concallEntries.map((f: any, i: number) => ({
        quarter   : f.quarter || "",
        date      : f.date,
        concallUrl: f.transcriptUrl || f.url || "",
        pptUrl    : f.pptUrl || "",
        selected  : i < 2,  // default: latest 2 selected
      }));
      setQuarterSelections(selections);

      if (selections.length > 0) {
        setBseMsg(`Found ${selections.length} quarters on Screener — select which to add`);
      } else if (lookup.companyName) {
        setBseMsg("Company found — no concall/PPT links on Screener, enter URLs manually");
      } else {
        setBseMsg("Company not found on Screener. Check ticker and try again.");
      }

      if (lookup.screenerOk) setBseCode("screener.in");

    } catch (e: any) {
      setBseMsg("Lookup failed — enter details manually");
    } finally {
      setBseLooking(false);
    }
  };

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
    setSaving(true);
    setMsg(null);
    try {
      // ── Multi-quarter add (Screener mode) ──────────────────────────────────
      const selectedQs = quarterSelections.filter(q => q.selected);
      if (mode === "add" && selectedQs.length > 0) {
        if (!form.symbol) { setSaving(false); return; }
        let saved = 0;
        const errors: string[] = [];
        for (const q of selectedQs) {
          try {
            const rowData: SheetRowInput = {
              ...form,
              quarter   : q.quarter,
              concallUrl: q.concallUrl,
              pptUrl    : q.pptUrl,
            };
            const resp = await addSheetRow(pin, rowData);
            if (resp.success) saved++;
            else errors.push(`${q.quarter}: ${resp.error}`);
          } catch (e: any) {
            errors.push(`${q.quarter}: ${e.message}`);
          }
        }
        if (errors.length === 0) {
          setMsg({ type: "ok", text: `Added ${saved} quarter${saved > 1 ? "s" : ""} to sheet ✓` });
          setSaved(true);
          onSaved();
        } else {
          setMsg({ type: "err", text: errors.join(" · ") });
        }
        setSaving(false);
        return;
      }

      // ── Single row add / edit (manual mode) ────────────────────────────────
      if (!form.symbol || !form.quarter) { setSaving(false); return; }
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
      const resp = await processSymbol(pin, form.symbol.toUpperCase(), form.quarter || undefined);
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

  const inputCls = "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-signal-blue/30 focus:border-signal-blue/40 transition-all";
  const labelCls = "block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5";

  return (
    <div className="w-[500px] flex-shrink-0 border-l border-border bg-card flex flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div>
          <h3 className="text-base font-bold text-text-primary">
            {mode === "add" ? "Add Company" : `Edit — ${row?.symbol}`}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
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
        {/* Symbol + Auto-fill */}
        <div>
          <label className={labelCls}>NSE Ticker *</label>
          <div className="flex gap-2">
            <CompanySearch
              value={form.symbol}
              onChange={(v) => { set("symbol", v); setBseMsg(null); setQuarterSelections([]); }}
              onSelect={(company) => {
                set("symbol",      company.symbol);
                set("companyName", company.name);
                setBseMsg(null);
                setQuarterSelections([]);
                // Auto-trigger Screener lookup after a brief tick
                setTimeout(() => {
                  setBseLooking(true);
                  Promise.all([
                    bseLookup(company.symbol),
                    bseFilings(company.symbol),
                  ]).then(([lookup, filingsResp]) => {
                    if (lookup.marketCap) set("marketCap", String(lookup.marketCap));
                    const concallEntries = (filingsResp.filings || []).filter((f: any) => f.type === "concall");
                    const selections = concallEntries.map((f: any, i: number) => ({
                      quarter: f.quarter || "", date: f.date,
                      concallUrl: f.transcriptUrl || f.url || "",
                      pptUrl: f.pptUrl || "", selected: i < 2,
                    }));
                    setQuarterSelections(selections);
                    setBseCode(lookup.screenerOk ? "screener.in" : null);
                    setBseMsg(selections.length > 0
                      ? `Found ${selections.length} quarters on Screener — select which to add`
                      : "Company found — enter PDF URLs manually"
                    );
                  }).catch(() => setBseMsg("Screener lookup failed — enter details manually"))
                    .finally(() => setBseLooking(false));
                }, 50);
              }}
              placeholder="Search name or symbol…"
              className={`${inputCls} flex-1`}
              disabled={mode === "edit"}
            />
            <button type="button" onClick={handleBseLookup}
              disabled={!form.symbol || bseLooking}
              title="Auto-fill from Screener.in"
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-signal-blue-bg text-signal-blue border border-signal-blue/30 hover:bg-signal-blue hover:text-card transition-all disabled:opacity-40 flex-shrink-0 flex items-center gap-1">
              {bseLooking
                ? <span className="w-3 h-3 border-2 border-signal-blue/40 border-t-signal-blue rounded-full animate-spin" />
                : "🔍"}
            </button>
          </div>
          {/* BSE lookup feedback */}
          {bseMsg && (
            <p className={`text-xs mt-1.5 ${quarterSelections.length > 0 ? "text-signal-green" : "text-text-muted"}`}>
              {bseCode && <span className="font-semibold">📊 {bseCode} · </span>}{bseMsg}
            </p>
          )}
        </div>
        <div>
          <label className={labelCls}>Company Name</label>
          <input value={form.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            placeholder="Auto-filled or enter manually"
            className={inputCls}
          />
        </div>

        {/* Quarter */}
        {/* ── Quarter picker (Screener mode) OR manual fields ── */}
        {quarterSelections.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls}>Select Quarters to Add</label>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setQuarterSelections(prev => prev.map(q => ({ ...q, selected: true })))}
                  className="text-2xs text-signal-blue hover:underline">all</button>
                <button type="button"
                  onClick={() => setQuarterSelections(prev => prev.map(q => ({ ...q, selected: false })))}
                  className="text-2xs text-text-muted hover:underline">none</button>
              </div>
            </div>
            <div className="space-y-1">
              {quarterSelections.map((q, i) => (
                <button key={i} type="button"
                  onClick={() => setQuarterSelections(prev =>
                    prev.map((p, j) => j === i ? { ...p, selected: !p.selected } : p)
                  )}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all ${
                    q.selected
                      ? "bg-signal-blue-bg border-signal-blue/40"
                      : "bg-muted border-border hover:border-border/80"
                  }`}>
                  {/* Checkbox */}
                  <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all ${
                    q.selected ? "bg-signal-blue border-signal-blue text-card" : "border-text-muted"
                  }`}>{q.selected ? "✓" : ""}</span>
                  {/* Quarter label */}
                  <span className={`text-xs font-bold w-20 flex-shrink-0 ${q.selected ? "text-signal-blue" : "text-text-secondary"}`}>
                    {q.quarter}
                  </span>
                  {/* Date */}
                  <span className="text-xs text-text-muted">{q.date}</span>
                  {/* Link indicators */}
                  <div className="ml-auto flex gap-1.5 flex-shrink-0">
                    {q.concallUrl && <span className="text-sm text-signal-green" title="Transcript">📄</span>}
                    {q.pptUrl     && <span className="text-sm text-signal-blue"  title="PPT">📊</span>}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-1.5">
              {quarterSelections.filter(q => q.selected).length} quarter{quarterSelections.filter(q => q.selected).length !== 1 ? "s" : ""} selected · URLs auto-filled from Screener
            </p>
          </div>
        ) : (
          /* Manual entry — shown when no screener data */
          <>
            <div>
              <label className={labelCls}>Quarter * <span className="font-normal normal-case text-text-muted">(e.g. FY26-Q3)</span></label>
              <input value={form.quarter}
                onChange={(e) => set("quarter", e.target.value)}
                placeholder="FY26-Q3"
                className={inputCls}
                required
              />
            </div>
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
          </>
        )}

        {/* Market Cap — auto-filled from Yahoo */}
        <div>
          <label className={labelCls}>Market Cap <span className="font-normal normal-case text-text-muted">(₹ Crores — auto-filled)</span></label>
          <input value={form.marketCap}
            onChange={(e) => set("marketCap", e.target.value)}
            placeholder="Auto-filled on 🔍 lookup"
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
          <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${
            msg.type === "ok"
              ? "bg-signal-green-bg text-signal-green"
              : "bg-signal-red-bg text-signal-red"
          }`}>
            {msg.type === "ok" ? "✓" : "✕"} {msg.text}
          </div>
        )}

        {/* Process result */}
        {processMsg && (
          <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${
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
        {(() => {
          const selectedCount = quarterSelections.filter(q => q.selected).length;
          const canSave = form.symbol && (selectedCount > 0 || form.quarter);
          const label = saving ? null
            : selectedCount > 1 ? `Add ${selectedCount} quarters to Sheet`
            : mode === "add" ? "Add to Sheet"
            : "Save to Sheet";
          return (
            <button onClick={handleSave} disabled={saving || !canSave}
              className="w-full flex items-center justify-center gap-2 bg-signal-blue text-card text-sm font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-all disabled:opacity-40">
              {saving
                ? <><span className="w-3 h-3 border-2 border-card/40 border-t-card rounded-full animate-spin" /> Saving…</>
                : label
              }
            </button>
          );
        })()}

        {/* Process button — only enabled after save */}
        <button onClick={handleProcess}
          disabled={processing || !saved || !form.symbol}
          title={!saved ? "Save to sheet first" : "Run AI extraction pipeline (2–5 min)"}
          className={`w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg border transition-all ${
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

// ── Reprocess Modal ───────────────────────────────────────────────────────────
type SymbolResult = { symbol: string; quarter: string; status: "pending" | "processing" | "done" | "error"; detail: string };

function ReprocessModal({
  rows, pin, onClose, onDone,
}: { rows: SheetRow[]; pin: string; onClose: () => void; onDone: () => void }) {

  const rowKey = (r: SheetRow) => `${r.symbol}__${r.quarterRaw || r.quarter}`;

  const [selected, setSelected] = useState<Set<string>>(() =>
    new Set(rows.filter(r => r.status !== "processed").map(rowKey))
  );

  const [phase,    setPhase]    = useState<"confirm" | "running" | "done">("confirm");
  const [results,  setResults]  = useState<SymbolResult[]>([]);
  const [current,  setCurrent]  = useState(0);
  const [logs,     setLogs]     = useState<string[]>([]);
  const logBoxRef  = useRef<HTMLDivElement>(null);
  const cancelled  = useRef(false);

  const toggle        = (key: string) => setSelected(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  const selectAll     = () => setSelected(new Set(rows.map(rowKey)));
  const selectNone    = () => setSelected(new Set());
  const selectPending = () => setSelected(new Set(rows.filter(r => r.status !== "processed").map(rowKey)));

  // All selected rows (one entry per quarter — no deduplication)
  const selectedRows = rows.filter(r => selected.has(rowKey(r)));

  const done   = results.filter(r => r.status === "done").length;
  const errors = results.filter(r => r.status === "error").length;

  // Auto-scroll log box to bottom
  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [logs]);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const start = async () => {
    const rowsToProcess = selectedRows; // snapshot before state changes
    setResults(rowsToProcess.map(r => ({
      symbol : r.symbol,
      quarter: r.quarterRaw || r.quarter,
      status : "pending" as const,
      detail : "",
    })));
    setLogs([]);
    setPhase("running");

    for (let i = 0; i < rowsToProcess.length; i++) {
      if (cancelled.current) break;
      const row = rowsToProcess[i];
      const sym = row.symbol;
      const quarter = row.quarterRaw || row.quarter;
      setCurrent(i);
      setResults(prev => prev.map(r =>
        r.symbol === sym && r.quarter === quarter ? { ...r, status: "processing" } : r
      ));

      if (row.concallUrl || row.pptUrl) {
        try {
          addLog(`\n── ${sym} ${quarter} ──`);
          const resp = await processAdminCompanyStream(pin, {
            symbol     : sym,
            companyName: row.companyName,
            quarter    : quarter,
            concallUrl : row.concallUrl || "",
            pptUrl     : row.pptUrl     || undefined,
            marketCap  : row.marketCap  || undefined,
          }, addLog);

          const detail = resp.result
            ? `score: ${resp.result.score ?? "—"}`
            : resp.error || "failed";
          const finalStatus = resp.success ? "done" : "error";
          setResults(prev => prev.map(r =>
            r.symbol === sym && r.quarter === quarter ? { ...r, status: finalStatus, detail } : r
          ));

          try {
            await updateSheetRow(pin, row.rowIndex, {
              ...row,
              status          : resp.success ? "processed" : "error",
              forceRefresh    : false,
              lastProcessedAt : resp.success ? new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : row.lastProcessedAt,
            });
          } catch { /* non-critical */ }
        } catch (err: any) {
          addLog(`❌ ${err.message}`);
          setResults(prev => prev.map(r =>
            r.symbol === sym && r.quarter === quarter ? { ...r, status: "error", detail: err.message } : r
          ));
        }
      } else {
        // Fallback: sheet-based processing (no live logs)
        try {
          addLog(`\n── ${sym} ${quarter} (sheet mode) ──`);
          const resp = await processSymbol(pin, sym);
          const detail = resp.result?.details?.map((d: any) =>
            `${d.quarter ?? ""} → ${d.status}${d.score != null ? ` (${d.score})` : ""}`
          ).join(" · ") || (resp.success ? "done" : resp.error || "error");
          addLog(detail);
          setResults(prev => prev.map(r =>
            r.symbol === sym && r.quarter === quarter
              ? { ...r, status: resp.success ? "done" : "error", detail }
              : r
          ));
        } catch (err: any) {
          addLog(`❌ ${err.message}`);
          setResults(prev => prev.map(r =>
            r.symbol === sym && r.quarter === quarter ? { ...r, status: "error", detail: err.message } : r
          ));
        }
      }
    }
    setPhase("done");
    onDone();
  };

  const cancel = () => { cancelled.current = true; onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-text-primary">
              {phase === "confirm" ? "Select Rows to Process" : phase === "running" ? "Processing…" : "Done"}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {phase === "confirm"
                ? `${selected.size} row${selected.size !== 1 ? "s" : ""} selected`
                : phase === "running"
                ? `${done}/${selectedRows.length} done${errors > 0 ? ` · ${errors} errors` : ""}`
                : `Complete — ${done} processed, ${errors} failed`}
            </p>
          </div>
          {phase !== "running" && (
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl px-1">×</button>
          )}
        </div>

        {/* ── Confirm: row picker ── */}
        {phase === "confirm" && (
          <div className="px-5 py-4 space-y-3">

            {/* Quick select buttons */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted mr-1">Select:</span>
              {[
                { label: "All",     fn: selectAll },
                { label: "Pending", fn: selectPending },
                { label: "None",    fn: selectNone },
              ].map(({ label, fn }) => (
                <button key={label} type="button" onClick={fn}
                  className="text-xs font-semibold px-3 py-1 rounded-lg bg-muted text-text-secondary hover:bg-border transition-all">
                  {label}
                </button>
              ))}
              <span className="ml-auto text-xs text-text-muted">{selected.size} selected</span>
            </div>

            {/* Row list */}
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {rows.map((row) => {
                const key = rowKey(row);
                const sel = selected.has(key);
                const isProcessed = row.status === "processed";
                return (
                  <button key={key} type="button" onClick={() => toggle(key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      sel
                        ? "bg-signal-blue-bg border-signal-blue/40"
                        : "bg-muted border-border hover:border-signal-blue/20"
                    }`}>
                    {/* Checkbox */}
                    <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all ${
                      sel ? "bg-signal-blue border-signal-blue text-card" : "border-text-muted bg-background"
                    }`}>{sel ? "✓" : ""}</span>

                    {/* Symbol */}
                    <span className={`text-sm font-bold font-mono w-28 flex-shrink-0 ${sel ? "text-signal-blue" : "text-text-primary"}`}>
                      {row.symbol}
                    </span>

                    {/* Quarter badge */}
                    <span className="text-xs px-2 py-0.5 rounded bg-muted border border-border text-text-secondary flex-shrink-0">
                      {row.quarter}
                    </span>

                    {/* Status */}
                    <div className="ml-auto flex-shrink-0">
                      {isProcessed
                        ? <span className="text-xs text-signal-green font-semibold">✓ processed</span>
                        : <span className="text-xs text-signal-amber font-semibold">○ pending</span>
                      }
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Cost estimate */}
            <p className="text-xs text-text-muted">
              ~₹{(selectedRows.length * 2.7).toFixed(0)} estimated cost for {selectedRows.length} row{selectedRows.length !== 1 ? "s" : ""} · ~{selectedRows.length * 3}–{selectedRows.length * 4} min
            </p>

            <div className="flex gap-2 pt-1">
              <button onClick={onClose}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-muted text-text-secondary hover:bg-border transition-all">
                Cancel
              </button>
              <button onClick={start} disabled={selectedRows.length === 0}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-signal-blue text-card hover:opacity-90 transition-all disabled:opacity-40">
                Process {selectedRows.length > 0 ? `${selectedRows.length} Row${selectedRows.length !== 1 ? "s" : ""}` : ""} →
              </button>
            </div>
          </div>
        )}

        {/* ── Running / Done ── */}
        {(phase === "running" || phase === "done") && (
          <div className="px-5 py-4 space-y-3">

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{phase === "running" ? `Processing ${results[current]?.symbol ?? "…"} ${results[current]?.quarter ?? ""}` : "All done"}</span>
                <span>{done + errors} / {results.length}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-signal-blue rounded-full transition-all duration-500"
                  style={{ width: `${((done + errors) / Math.max(results.length, 1)) * 100}%` }} />
              </div>
            </div>

            {/* Per-company status pills */}
            <div className="flex flex-wrap gap-2">
              {results.map((r, i) => {
                const icon  = r.status === "done" ? "✓" : r.status === "error" ? "✕" : r.status === "processing" ? "⟳" : "○";
                const cls   = r.status === "done"
                  ? "bg-signal-green-bg text-signal-green border-signal-green/20"
                  : r.status === "error"
                  ? "bg-signal-red-bg text-signal-red border-signal-red/20"
                  : r.status === "processing"
                  ? "bg-signal-blue-bg text-signal-blue border-signal-blue/20"
                  : "bg-muted text-text-muted border-border";
                return (
                  <span key={`${r.symbol}__${r.quarter}__${i}`}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cls} ${r.status === "processing" ? "animate-pulse" : ""}`}>
                    <span>{icon}</span>{r.symbol} <span className="font-normal">{r.quarter}</span>
                    {r.detail && r.status !== "processing" && (
                      <span className="font-normal opacity-70">· {r.detail}</span>
                    )}
                  </span>
                );
              })}
            </div>

            {/* Live log terminal */}
            <div
              ref={logBoxRef}
              className="bg-black/90 rounded-xl p-3 h-52 overflow-y-auto font-mono text-2xs leading-relaxed"
            >
              {logs.length === 0 ? (
                <span className="text-text-muted">Waiting for pipeline…</span>
              ) : (
                logs.map((line, i) => {
                  const color = line.startsWith("✅") || line.startsWith("✓")
                    ? "text-green-400"
                    : line.startsWith("❌") || line.startsWith("✕") || line.startsWith("⚠")
                    ? "text-red-400"
                    : line.startsWith("▶") || line.startsWith("──")
                    ? "text-signal-blue"
                    : "text-gray-300";
                  return (
                    <div key={i} className={color}>{line || "\u00A0"}</div>
                  );
                })
              )}
              {phase === "running" && (
                <div className="text-signal-blue animate-pulse">▌</div>
              )}
            </div>

            {phase === "done" && (
              <button onClick={onClose}
                className="w-full py-2.5 text-sm font-semibold rounded-xl bg-signal-green text-card hover:opacity-90 transition-all">
                Done ✓
              </button>
            )}
            {phase === "running" && (
              <button onClick={cancel}
                className="w-full py-2.5 text-sm font-semibold rounded-xl bg-muted text-text-secondary hover:bg-border transition-all">
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
          rows={rows}
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
            <div className="sticky top-0 z-10 bg-muted border-b border-border grid grid-cols-[110px_160px_80px_110px_72px_80px_130px_auto] gap-3 px-5 py-2.5 items-center">
              {["Symbol", "Company", "Quarter", "Status", "Priority", "MCap ₹Cr", "Processed", ""].map((h) => (
                <span key={h} className="text-xs font-bold text-text-muted uppercase tracking-wider truncate">{h}</span>
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
                  className={`grid grid-cols-[110px_160px_80px_110px_72px_80px_130px_auto] gap-3 items-center px-5 py-2.5 transition-colors ${
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
                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-text-muted border border-border">
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
                    <span className="text-xs text-text-muted">{row.lastProcessedAt || "—"}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(row)}
                      title="Edit"
                      className={`text-xs px-2 py-1 rounded-md border transition-all ${
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
            <p className="text-xs text-text-muted">
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
      <aside className="w-72 flex-shrink-0 border-r border-border overflow-y-auto bg-card">
        <div className="px-4 pt-4 pb-2">
          <p className="text-xs text-text-muted">{prompts.length} prompts · {customCount} overridden</p>
        </div>
        {CATEGORY_ORDER.map(cat => {
          const items = grouped[cat] || [];
          if (items.length === 0) return null;
          const meta = CATEGORY_META[cat] || { icon: "·", color: "text-text-muted" };
          return (
            <div key={cat} className="mb-1">
              <div className="flex items-center gap-1.5 px-4 pt-3 pb-1.5">
                <span className="text-sm">{meta.icon}</span>
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider">{cat}</span>
              </div>
              {items.map(p => (
                <button key={p.id} onClick={() => selectPrompt(p)}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 transition-all border-l-[3px] ${
                    selected === p.id
                      ? "bg-signal-blue-bg border-signal-blue"
                      : "border-transparent hover:bg-muted/60 hover:border-border"
                  }`}>
                  <span className={`text-sm leading-snug truncate ${
                    selected === p.id ? "font-semibold text-signal-blue" : "text-text-secondary"
                  }`}>
                    {p.name}
                  </span>
                  {p.isCustom && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-signal-amber-bg text-signal-amber flex-shrink-0">
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
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-signal-amber-bg text-signal-amber border border-signal-amber/30">
                  ✎ Custom override
                </span>
              ) : (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-text-muted border border-border">
                  Default
                </span>
              )}
              {isDirty && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-signal-blue-bg text-signal-blue border border-signal-blue/30 animate-pulse">
                  ● Unsaved
                </span>
              )}
            </div>
            <p className="text-sm text-text-muted leading-relaxed max-w-2xl">{activePrompt.description}</p>
            {activePrompt.variables.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-medium text-text-muted">Variables:</span>
                {activePrompt.variables.map(v => (
                  <code key={v} className="text-xs px-2 py-0.5 rounded-md bg-signal-blue-bg text-signal-blue font-mono border border-signal-blue/20">
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
              className="w-full h-full bg-card border border-border rounded-xl p-4 text-sm font-mono text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-signal-blue/30 focus:border-signal-blue/40 leading-[1.7] transition-all"
              spellCheck={false}
              placeholder="Prompt content…"
            />
          </div>

          <div className="bg-card border-t border-border px-5 py-2.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {saveMsg ? (
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${saveMsg.type === "ok" ? "text-signal-green" : "text-signal-red"}`}>
                  <span>{saveMsg.type === "ok" ? "✓" : "✕"}</span>
                  <span>{saveMsg.text}</span>
                </div>
              ) : (
                <span className="text-xs text-text-muted">{editContent.length.toLocaleString()} chars</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(activePrompt.isCustom || isDirty) && (
                <button onClick={handleRestoreDefault}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-muted transition-all">
                  View default
                </button>
              )}
              {activePrompt.isCustom && (
                <button onClick={handleReset} disabled={saving}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-signal-red-bg text-signal-red border border-signal-red/20 hover:bg-signal-red hover:text-card transition-all disabled:opacity-40">
                  ↺ Reset
                </button>
              )}
              <button onClick={handleSave} disabled={saving || !isDirty}
                className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
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
  const [activeTab, setActiveTab] = useState<"companies" | "prompts" | "how-thesis" | "changelog" | "health">("companies");
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
          <span className="text-xs font-bold text-text-primary">Admin</span>
        </div>
        <button
          onClick={() => { sessionStorage.removeItem("adminPin"); setPin(null); }}
          className="text-2xs text-text-muted hover:text-signal-red transition-colors px-2 py-1 rounded-md hover:bg-signal-red-bg">
          Sign out
        </button>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar nav */}
        <nav className="w-44 flex-shrink-0 bg-card border-r border-border flex flex-col py-3 gap-0.5 px-2">
          {([
            { key: "companies",  label: "Companies",        icon: "⊞" },
            { key: "prompts",    label: "Prompts",          icon: "✎", badge: promptCustomCount > 0 ? promptCustomCount : null },
            { key: "health",     label: "Health Check",     icon: "♥" },
            { key: "how-thesis", label: "How Thesis Works", icon: "?" },
            { key: "changelog",  label: "Changelog",        icon: "⏱" },
          ] as const).map(({ key, label, icon, badge }) => (
            <button key={key}
              onClick={() => setActiveTab(key)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all text-xs font-semibold ${
                activeTab === key
                  ? "bg-signal-blue-bg text-signal-blue"
                  : "text-text-muted hover:text-text-primary hover:bg-muted"
              }`}>
              <span className="text-sm leading-none">{icon}</span>
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-signal-amber-bg text-signal-amber border border-signal-amber/20">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === "companies"  && <CompaniesTab pin={pin} />}
          {activeTab === "prompts"    && <PromptsTab   pin={pin} />}
          {activeTab === "health"     && <HealthTab    pin={pin} />}
          {activeTab === "how-thesis" && <HowThesisWorksTab />}
          {activeTab === "changelog"  && <ChangelogTab />}
        </div>
      </div>
    </div>
  );
}

// ── Health Check Tab ──────────────────────────────────────────────────────────
function HealthTab({ pin }: { pin: string }) {
  const [data,    setData]    = useState<HealthPayload | null>(null);
  const [history, setHistory] = useState<(HealthPayload & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const todayIST = () =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // "2026-04-09"

  const isStale = (d: HealthPayload | null) => {
    if (!d) return true;
    const checkedDate = new Date(d.checkedAt)
      .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return checkedDate !== todayIST();
  };

  const doRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await runHealthCheck(pin);
      setData(result);
      const hist = await fetchHealthHistory();
      setHistory(hist);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const load = async () => {
    setLoading(true);
    const [latest, hist] = await Promise.all([fetchHealth(), fetchHealthHistory()]);
    setData(latest);
    setHistory(hist);
    setLoading(false);
    // Auto-run if no result for today
    if (isStale(latest)) {
      doRun();
    }
  };

  const runNow = () => doRun();

  useEffect(() => { load(); }, []);

  const statusColor = (s: string) =>
    s === "ok"    ? "text-signal-green bg-signal-green-bg border-signal-green/20" :
    s === "warn"  ? "text-signal-amber bg-signal-amber-bg border-signal-amber/20" :
                    "text-signal-red   bg-signal-red-bg   border-signal-red/20";

  const statusIcon = (s: string) => s === "ok" ? "✓" : s === "warn" ? "⚠" : "✕";

  const overallBg = (s: string) =>
    s === "ok"   ? "bg-signal-green-bg border-signal-green/30" :
    s === "warn" ? "bg-signal-amber-bg border-signal-amber/30" :
                   "bg-signal-red-bg   border-signal-red/30";

  const formatCheckedAt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    } catch { return iso; }
  };

  const minutesAgo = (iso: string) => {
    const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (diff < 1)   return "just now";
    if (diff < 60)  return `${diff}m ago`;
    if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
    return `${Math.round(diff / 1440)}d ago`;
  };

  return (
    <div className="flex-1 overflow-auto p-5 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-bold text-text-primary">Health Check</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Auto-runs on tab open if not checked today · {data ? `Last checked ${minutesAgo(data.checkedAt)}` : "Running…"}
          </p>
        </div>
        <button onClick={runNow} disabled={running}
          className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-signal-blue text-card hover:opacity-90 transition-all disabled:opacity-50">
          {running ? <span className="animate-spin">↻</span> : "▶"} {running ? "Running…" : "Run Now"}
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-signal-red-bg border border-signal-red/20 text-xs text-signal-red">{error}</div>
      )}

      {loading && !data && (
        <div className="space-y-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!loading && !data && (
        <div className="text-center py-16">
          <p className="text-sm text-text-muted">No health check run yet</p>
          <p className="text-xs text-text-muted mt-1">Click "Run Now" to check all services</p>
        </div>
      )}

      {data && (
        <>
          {/* Overall status banner */}
          {(() => {
            const failing = data.results.filter(r => r.status === "error").map(r => r.label);
            const warning = data.results.filter(r => r.status === "warn").map(r => r.label);
            const summary = data.overallStatus === "ok"
              ? "All systems operational"
              : data.overallStatus === "error"
              ? `Down: ${failing.join(", ")}`
              : `Slow / misconfigured: ${warning.join(", ")}`;
            return (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-4 ${overallBg(data.overallStatus)}`}>
                <span className={`text-lg font-bold ${statusColor(data.overallStatus).split(" ")[0]}`}>
                  {statusIcon(data.overallStatus)}
                </span>
                <div>
                  <p className={`text-sm font-bold ${statusColor(data.overallStatus).split(" ")[0]}`}>{summary}</p>
                  <p className="text-xs text-text-muted">{formatCheckedAt(data.checkedAt)}</p>
                </div>
              </div>
            );
          })()}

          {/* Individual checks */}
          <div className="space-y-2">
            {data.results.map((r: HealthCheckResult) => (
              <div key={r.key}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border">
                <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${statusColor(r.status)}`}>
                  {statusIcon(r.status)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text-primary">{r.label}</p>
                  <p className="text-2xs text-text-muted truncate">{r.detail}</p>
                </div>
                {r.latencyMs > 0 && (
                  <span className={`flex-shrink-0 text-2xs font-semibold px-2 py-0.5 rounded-full border ${statusColor(r.status)}`}>
                    {r.latencyMs}ms
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* History table */}
          {history.length > 1 && (
            <div className="mt-6">
              <h3 className="text-xs font-bold text-text-primary mb-2">History</h3>
              <div className="rounded-xl border border-border overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[100px_1fr_80px] gap-3 px-4 py-2 bg-muted border-b border-border">
                  {["Date", "Services", "Overall"].map(h => (
                    <span key={h} className="text-2xs font-bold text-text-muted uppercase tracking-wider">{h}</span>
                  ))}
                </div>
                {history.map((row, i) => {
                  const failing = row.results?.filter((r: HealthCheckResult) => r.status === "error").map((r: HealthCheckResult) => r.label) || [];
                  const warning = row.results?.filter((r: HealthCheckResult) => r.status === "warn").map((r: HealthCheckResult) => r.label) || [];
                  const summary = failing.length > 0 ? failing.join(", ") : warning.length > 0 ? warning.join(", ") : "All OK";
                  return (
                    <div key={row.id}
                      className={`grid grid-cols-[100px_1fr_80px] gap-3 px-4 py-2.5 items-center ${i < history.length - 1 ? "border-b border-border" : ""}`}>
                      <span className="text-xs font-semibold text-text-primary">{row.id}</span>
                      <span className="text-xs text-text-muted truncate">{summary}</span>
                      <span className={`text-2xs font-bold px-2 py-0.5 rounded-full border w-fit ${statusColor(row.overallStatus)}`}>
                        {statusIcon(row.overallStatus)} {row.overallStatus}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Changelog Tab ─────────────────────────────────────────────────────────────
function ChangelogTab() {
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChangelog()
      .then(setData)
      .catch(() => setData({ success: false }))
      .finally(() => setLoading(false));
  }, []);

  const REPO_COLOR: Record<string, string> = {
    Backend : "bg-signal-blue-bg text-signal-blue border-signal-blue/20",
    Frontend: "bg-signal-amber-bg text-signal-amber border-signal-amber/20",
  };

  // Strip conventional commit prefixes for cleaner display
  const cleanMsg = (msg: string) =>
    msg.replace(/^(feat|fix|chore|docs|refactor|style|test|perf)(\([^)]+\))?:\s*/i, "");

  return (
    <div className="flex-1 overflow-auto p-5 max-w-3xl mx-auto w-full">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-text-primary">Changelog</h2>
        <p className="text-xs text-text-muted mt-0.5">Auto-generated from git history — Backend + Frontend</p>
      </div>

      {loading && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-3 bg-muted rounded w-24" />
              <div className="card-base p-3 space-y-2">
                <div className="h-2.5 bg-muted rounded w-full" />
                <div className="h-2.5 bg-muted rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !data?.success && (
        <div className="card-base p-4 text-center">
          <p className="text-xs text-signal-amber">⚠ Could not load changelog — git may not be available</p>
        </div>
      )}

      {!loading && data?.success && (
        <div className="space-y-5">
          {Object.entries(data.grouped as Record<string, any[]>).map(([date, entries]) => (
            <div key={date}>
              <p className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-2">{date}</p>
              <div className="card-base divide-y divide-border/50">
                {entries.map((e: any) => (
                  <div key={e.hash} className="px-3 py-2 flex items-start gap-2.5">
                    <span className={`flex-shrink-0 text-2xs font-bold px-1.5 py-0.5 rounded border mt-0.5 ${REPO_COLOR[e.repo] || "bg-muted text-text-muted border-border"}`}>
                      {e.repo}
                    </span>
                    <span className="text-xs text-text-primary leading-snug">{cleanMsg(e.message)}</span>
                    <span className="ml-auto flex-shrink-0 text-2xs text-text-muted font-mono">{e.hash.slice(0, 7)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-2xs text-text-muted text-center pt-2">Showing last {data.total} commits across both repos</p>
        </div>
      )}
    </div>
  );
}

// ── How Thesis Works Tab ──────────────────────────────────────────────────────
function HowThesisWorksTab() {
  return (
    <div className="flex-1 overflow-auto p-5 space-y-6 max-w-3xl mx-auto w-full">

      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-text-primary">How the Thesis System Works</h2>
        <p className="text-xs text-text-muted mt-1">
          End-to-end pipeline — from Google Sheet entry to the BUY/HOLD/WEAK verdict.
          Uses <strong className="text-text-secondary">Manorama Q3 FY26</strong> as a live worked example throughout.
        </p>
      </div>

      {/* ── Step 1: Data Sources ── */}
      <section className="card-base p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-signal-blue-bg text-signal-blue text-xs font-black flex items-center justify-center border border-signal-blue/20">1</div>
          <h3 className="text-sm font-bold text-text-primary">Where does the data come from?</h3>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          Every insight is built from exactly <strong className="text-text-primary">two PDFs</strong> filed with BSE — nothing else. No web scraping, no financial databases, no news.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              icon: "📄",
              label: "Investor Presentation (PPT)",
              color: "bg-signal-blue-bg border-signal-blue/20 text-signal-blue",
              points: ["Capex plans with project names & MTPA capacities", "Revenue guidance numbers", "Margin KPIs (EBITDA %, PAT %)", "Volume vs pricing split"],
              example: "Manorama PPT: ₹460 Cr capex, FY26 guidance ₹1,300 Cr, EBITDA 27.2%"
            },
            {
              icon: "🎙️",
              label: "Earnings Call Transcript",
              color: "bg-signal-green-bg border-signal-green/20 text-signal-green",
              points: ["Management tone — confident / cautious / defensive", "Q&A reveals what management avoided saying", "Verbatim quotes used as evidence", "Funding clarity (internal vs debt)"],
              example: "Manorama Concall: \u201cWe rely primarily on internal cash accruals\u2026 already spent \u20b952 Cr\u201d"
            },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-4 border space-y-2 ${s.color}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{s.icon}</span>
                <span className="text-xs font-bold text-text-primary">{s.label}</span>
              </div>
              <ul className="space-y-1">
                {s.points.map((p, i) => (
                  <li key={i} className="text-2xs text-text-secondary flex items-start gap-1.5">
                    <span className="text-text-muted mt-0.5">·</span>{p}
                  </li>
                ))}
              </ul>
              <div className="rounded-lg bg-card/60 px-3 py-2 border border-border">
                <p className="text-2xs text-text-muted font-semibold uppercase tracking-wider mb-0.5">Example from Manorama</p>
                <p className="text-2xs text-text-secondary italic">"{s.example}"</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-muted/60 px-4 py-3 border border-border space-y-1.5">
          <p className="text-2xs font-bold text-text-secondary uppercase tracking-wider">Also required (from Google Sheet)</p>
          <div className="flex flex-wrap gap-3">
            {["NSE Symbol (e.g. MANORAMA)", "Quarter (e.g. Q3 FY26)", "Market Cap in ₹ Cr (e.g. 7,523)", "BSE PDF URLs for both documents"].map((item) => (
              <span key={item} className="text-2xs text-text-secondary bg-card border border-border rounded-lg px-2.5 py-1">{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Step 2: AI Extraction ── */}
      <section className="card-base p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-signal-blue-bg text-signal-blue text-xs font-black flex items-center justify-center border border-signal-blue/20">2</div>
          <h3 className="text-sm font-bold text-text-primary">What does the AI extract?</h3>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          Three separate Claude API calls run on the PDF text. Each has a specific job.
        </p>
        <div className="space-y-3">
          {[
            {
              call: "Call 1",
              title: "3 Parameters — scored 0–5 each",
              icon: "⚡",
              color: "border-signal-amber/30 bg-signal-amber-bg/20",
              badge: "text-signal-amber",
              desc: "Extracts Capex, Revenue Growth, and Margin Outlook with KPIs, evidence quotes, and a score.",
              manorama: "Capex 5/5 (₹460 Cr, 4 projects), Revenue 5/5 (guidance raised to ₹1,300 Cr), Margins 4/5 (EBITDA 27.2%, stable)"
            },
            {
              call: "Call 2",
              title: "6 Thesis Checks + Management Tone",
              icon: "🎯",
              color: "border-signal-blue/30 bg-signal-blue-bg/20",
              badge: "text-signal-blue",
              desc: "Answers 6 investment thesis questions (YES/PARTIAL/NO) and classifies management tone.",
              manorama: "5 YES + 1 PARTIAL (market share has no peer data). Tone: CONFIDENT"
            },
            {
              call: "Call 3",
              title: "Forward Valuation Estimate",
              icon: "📊",
              color: "border-signal-green/30 bg-signal-green-bg/20",
              badge: "text-signal-green",
              desc: "Builds FY+1 and FY+2 revenue/PAT estimates, computes PE range and PEG.",
              manorama: "FY27: ₹1,625–1,755 Cr revenue, ₹285–325 Cr PAT. PE 18.4–26.4x. PEG 0.78x → Undervalued"
            },
          ].map((c) => (
            <div key={c.call} className={`rounded-xl border p-4 space-y-2 ${c.color}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{c.icon}</span>
                <span className={`text-2xs font-bold px-2 py-0.5 rounded-full bg-card ${c.badge}`}>{c.call}</span>
                <span className="text-xs font-bold text-text-primary">{c.title}</span>
              </div>
              <p className="text-2xs text-text-secondary leading-relaxed">{c.desc}</p>
              <div className="rounded-lg bg-card/70 px-3 py-2 border border-border">
                <p className="text-2xs text-text-muted font-semibold uppercase tracking-wider mb-0.5">Manorama Q3 FY26 output</p>
                <p className="text-2xs text-text-primary font-medium">{c.manorama}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-muted/50 border border-border px-4 py-3">
          <p className="text-2xs text-text-muted">
            <strong className="text-text-secondary">Model:</strong> Claude Haiku ·
            <strong className="text-text-secondary ml-2">Cost:</strong> ~₹2 per company per quarter ·
            <strong className="text-text-secondary ml-2">Input:</strong> First 12,000 chars of each PDF
          </p>
        </div>
      </section>

      {/* ── Step 3: Scoring ── */}
      <section className="card-base p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-signal-blue-bg text-signal-blue text-xs font-black flex items-center justify-center border border-signal-blue/20">3</div>
          <h3 className="text-sm font-bold text-text-primary">How is the composite score calculated?</h3>
        </div>

        <div className="rounded-xl bg-muted/50 border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/80">
                <th className="text-left px-4 py-2.5 font-bold text-text-primary">Signal</th>
                <th className="text-center px-4 py-2.5 font-bold text-text-primary">Weight</th>
                <th className="text-center px-4 py-2.5 font-bold text-text-primary">Manorama Score</th>
                <th className="text-right px-4 py-2.5 font-bold text-text-primary">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {[
                { icon: "📈", label: "Revenue Growth", weight: "40%", score: "5/5", contrib: "2.00", color: "text-signal-green" },
                { icon: "📊", label: "Margin Outlook",  weight: "30%", score: "4/5", contrib: "1.20", color: "text-signal-amber" },
                { icon: "🏗️", label: "Capex & Expansion", weight: "30%", score: "5/5", contrib: "1.50", color: "text-signal-green" },
              ].map((r) => (
                <tr key={r.label} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span>{r.icon}</span>
                      <span className="font-medium text-text-primary">{r.label}</span>
                    </div>
                  </td>
                  <td className="text-center px-4 py-2.5 text-text-secondary">{r.weight}</td>
                  <td className={`text-center px-4 py-2.5 font-bold ${r.color}`}>{r.score}</td>
                  <td className={`text-right px-4 py-2.5 font-bold ${r.color}`}>{r.contrib}</td>
                </tr>
              ))}
              <tr className="bg-signal-green-bg border-t-2 border-signal-green/30">
                <td colSpan={3} className="px-4 py-3 text-xs font-extrabold text-text-primary">Composite Score</td>
                <td className="text-right px-4 py-3 text-lg font-black text-signal-green">4.7 / 5</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-text-secondary leading-relaxed">
          Revenue growth is weighted highest (40%) because forward guidance is the strongest predictor of near-term re-rating.
          Margins (30%) and Capex (30%) determine whether the growth is sustainable and being invested back into the business.
        </p>

        {/* Score tags */}
        <div>
          <p className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-2">Score tags (what Claude uses to grade each signal)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                label: "Capex tags",
                items: [
                  { tag: "Aggressive Expansion", score: "5", color: "text-signal-green" },
                  { tag: "Moderate Expansion",   score: "4", color: "text-signal-green" },
                  { tag: "Maintenance Only",     score: "2", color: "text-signal-amber" },
                  { tag: "Capex Pause",          score: "1", color: "text-signal-red"   },
                  { tag: "Capex Reduction",      score: "0", color: "text-signal-red"   },
                ],
              },
              {
                label: "Revenue tags",
                items: [
                  { tag: "Strong Growth Guidance", score: "5", color: "text-signal-green" },
                  { tag: "Moderate Growth",        score: "4", color: "text-signal-green" },
                  { tag: "Flat Outlook",           score: "2", color: "text-signal-amber" },
                  { tag: "Mixed Signals",          score: "2", color: "text-signal-amber" },
                  { tag: "Negative Guidance",      score: "0", color: "text-signal-red"   },
                ],
              },
              {
                label: "Margin tags",
                items: [
                  { tag: "Margin Expansion Expected", score: "5", color: "text-signal-green" },
                  { tag: "Stable Margins",            score: "4", color: "text-signal-green" },
                  { tag: "Recovery in Margins",       score: "4", color: "text-signal-green" },
                  { tag: "Margin Pressure",           score: "2", color: "text-signal-amber" },
                  { tag: "Significant Margin Risk",   score: "0", color: "text-signal-red"   },
                ],
              },
            ].map((col) => (
              <div key={col.label} className="space-y-1">
                <p className="text-2xs font-semibold text-text-muted">{col.label}</p>
                {col.items.map((item) => (
                  <div key={item.tag} className="flex items-center justify-between bg-muted/40 rounded-lg px-2.5 py-1.5">
                    <span className="text-2xs text-text-secondary">{item.tag}</span>
                    <span className={`text-2xs font-bold ${item.color}`}>{item.score}/5</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Verdict thresholds */}
        <div>
          <p className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-2">Verdict thresholds</p>
          <div className="flex gap-3">
            {[
              { emoji: "🟢", label: "BUY",  range: "4.0 and above", color: "bg-signal-green-bg border-signal-green/20 text-signal-green" },
              { emoji: "🟡", label: "HOLD", range: "3.0 – 3.9",     color: "bg-signal-amber-bg border-signal-amber/20 text-signal-amber" },
              { emoji: "🔴", label: "WEAK", range: "Below 3.0",      color: "bg-signal-red-bg   border-signal-red/20   text-signal-red"   },
            ].map((v) => (
              <div key={v.label} className={`flex-1 rounded-xl border px-3 py-2.5 text-center ${v.color}`}>
                <p className="text-sm font-black">{v.emoji} {v.label}</p>
                <p className="text-2xs mt-0.5 opacity-80">{v.range}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Step 4: The 6 Thesis Questions ── */}
      <section className="card-base p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-signal-blue-bg text-signal-blue text-xs font-black flex items-center justify-center border border-signal-blue/20">4</div>
          <h3 className="text-sm font-bold text-text-primary">The 6 Investment Thesis Questions</h3>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          Beyond the score, Claude answers 6 structured questions. Each answer is <span className="font-semibold text-signal-green">YES</span> / <span className="font-semibold text-signal-amber">PARTIAL</span> / <span className="font-semibold text-signal-red">NO</span> — backed by a direct quote from the source document.
        </p>
        <div className="space-y-2">
          {[
            { q: "q1", label: "Business model clear & defensible?",    manorama: { ans: "yes",     text: "Integrated specialty fats — backward sourcing + supercritical fractionation tech + CBA forward integration. B2B moat with developed formulations." } },
            { q: "q2", label: "Sector outlook positive?",               manorama: { ans: "yes",     text: "Structurally undersupplied CBE/exotic fats market. Multi-sector demand: chocolate, cosmetics, HoReCa, pharma." } },
            { q: "q3", label: "Company gaining market share?",          manorama: { ans: "partial", text: "40% revenue CAGR FY21–25, capacity 15K→40K MTPA. But NO explicit peer data or absolute market share % shared." } },
            { q: "q4", label: "2–3 year revenue visibility?",           manorama: { ans: "yes",     text: "₹1,300 Cr FY26 guidance raised. Debottlenecking adds 30% by FY26. New capex gives 4–5 year runway." } },
            { q: "q5", label: "Committed structural capex?",            manorama: { ans: "yes",     text: "₹460 Cr over 2–3 yrs: CBA 75K MTPA, Fractionation 75K MTPA, Refinery 90K MTPA, Burkina Faso 90K MTPA." } },
            { q: "q6", label: "Operating leverage visible?",            manorama: { ans: "yes",     text: "EBITDA +72 bps Q3, +352 bps 9M. PAT +471 bps Q3, +480 bps 9M. Value-added mix 75% → targeting 85–90%." } },
          ].map((entry, i) => {
            const ansColor = entry.manorama.ans === "yes" ? "text-signal-green bg-signal-green-bg border-signal-green/20"
              : entry.manorama.ans === "partial" ? "text-signal-amber bg-signal-amber-bg border-signal-amber/20"
              : "text-signal-red bg-signal-red-bg border-signal-red/20";
            const icon = entry.manorama.ans === "yes" ? "✓" : entry.manorama.ans === "partial" ? "~" : "✕";
            return (
              <div key={entry.q} className="rounded-xl border border-border overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30">
                  <span className="text-2xs font-bold text-text-muted w-6">{entry.q}</span>
                  <span className="text-xs font-semibold text-text-primary flex-1">{entry.label}</span>
                  <span className={`text-2xs font-bold px-2 py-0.5 rounded-full border ${ansColor}`}>
                    {icon} {entry.manorama.ans.charAt(0).toUpperCase() + entry.manorama.ans.slice(1)}
                  </span>
                </div>
                <div className="px-4 py-2.5 border-t border-border/50 bg-card">
                  <p className="text-2xs text-text-secondary leading-relaxed">{entry.manorama.text}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
          <p className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Management tone (separate classification)</p>
          <div className="flex items-center gap-3">
            <span className="text-2xs font-bold px-3 py-1 rounded-full bg-signal-green-bg text-signal-green border border-signal-green/20">● CONFIDENT</span>
            <p className="text-2xs text-text-secondary italic flex-1">"This revision underscores our confidence in our growth trajectory and the strength of our business model."</p>
          </div>
        </div>
      </section>

      {/* ── Step 5: Evidence Verification ── */}
      <section className="card-base p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-signal-blue-bg text-signal-blue text-xs font-black flex items-center justify-center border border-signal-blue/20">5</div>
          <h3 className="text-sm font-bold text-text-primary">How is evidence verified?</h3>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          Every quote extracted by Claude is automatically checked against the original PDF text.
          This gives the confidence % shown on each company page.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Exact match",      weight: "100%", desc: "Quote found verbatim in the PDF text",           color: "bg-signal-green-bg border-signal-green/20 text-signal-green" },
            { label: "Fuzzy match",      weight: "85%",  desc: "Minor wording differences but same meaning",     color: "bg-signal-amber-bg border-signal-amber/20 text-signal-amber" },
            { label: "Source confirmed", weight: "70%",  desc: "PPT source file confirmed, text hard to match",  color: "bg-muted border-border text-text-secondary" },
          ].map((v) => (
            <div key={v.label} className={`rounded-xl border p-4 space-y-1.5 ${v.color}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary">{v.label}</span>
                <span className="text-sm font-black">{v.weight}</span>
              </div>
              <p className="text-2xs text-text-secondary">{v.desc}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-signal-green-bg border border-signal-green/20 px-4 py-3">
          <p className="text-xs font-bold text-signal-green">Manorama Q3 FY26: High — 87% (9/9 verified)</p>
          <p className="text-2xs text-text-secondary mt-1">6 concall quotes text-matched · 3 PPT quotes source-confirmed. No quote was invented or inferred.</p>
        </div>
      </section>

      {/* ── Step 6: Same for all companies ── */}
      <section className="card-base p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-signal-blue-bg text-signal-blue text-xs font-black flex items-center justify-center border border-signal-blue/20">6</div>
          <h3 className="text-sm font-bold text-text-primary">Does this work the same for every company?</h3>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          Yes — the exact same 3 API calls, same scoring weights, same 6 thesis questions, same evidence verification. The only variables are the two PDFs and market cap from the Google Sheet.
        </p>
        <div className="space-y-2">
          {[
            { icon: "✓", text: "Same prompts for every company — no hand-tuning per sector", color: "text-signal-green" },
            { icon: "✓", text: "Score is fully deterministic — given same PDFs, you get the same score", color: "text-signal-green" },
            { icon: "✓", text: "Valuation only computed when market cap is provided in the sheet", color: "text-signal-green" },
            { icon: "~", text: "Confidence % varies — depends on how much verbatim text is in the PDF", color: "text-signal-amber" },
            { icon: "~", text: "q3 (market share) is often PARTIAL — most companies don't share peer comparisons", color: "text-signal-amber" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className={`text-xs font-bold mt-0.5 flex-shrink-0 ${item.color}`}>{item.icon}</span>
              <p className="text-xs text-text-secondary">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 space-y-1">
          <p className="text-2xs font-bold text-text-muted uppercase tracking-wider">Full pipeline summary</p>
          <p className="text-2xs text-text-secondary leading-relaxed">
            Google Sheet row → Download 2 BSE PDFs → Extract text → 3 Claude API calls →
            Score (weighted avg) → Verify evidence → Save to cache →
            Display verdict + 6 thesis checks + forward valuation
          </p>
        </div>
      </section>

    </div>
  );
}
