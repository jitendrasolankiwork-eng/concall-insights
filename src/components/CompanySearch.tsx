/**
 * CompanySearch.tsx
 *
 * Searchable combobox for selecting an NSE-listed company.
 * Searches by company name OR symbol.
 * On selection → calls onSelect({ name, symbol, industry })
 */

import { useState, useRef, useEffect, useCallback } from "react";
import companiesRaw from "@/data/companies.json";

interface Company {
  name    : string;
  symbol  : string;
  industry: string;
}

const COMPANIES: Company[] = companiesRaw as Company[];

interface Props {
  value     : string;                                        // current symbol value
  onChange  : (symbol: string) => void;                     // raw text change
  onSelect  : (company: Company) => void;                   // confirmed selection
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CompanySearch({
  value, onChange, onSelect, placeholder = "Type name or symbol…", className = "", disabled
}: Props) {
  const [query,   setQuery]   = useState(value);
  const [open,    setOpen]    = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Keep query in sync when parent changes value (e.g. reset)
  useEffect(() => { setQuery(value); }, [value]);

  // Filter companies — match name or symbol, limit to 8 results
  const results: Company[] = query.trim().length < 1 ? [] : (() => {
    const q = query.trim().toLowerCase();
    // Exact symbol match first
    const exact    = COMPANIES.filter(c => c.symbol.toLowerCase() === q);
    // Symbol starts-with
    const symStart = COMPANIES.filter(c => c.symbol.toLowerCase().startsWith(q) && c.symbol.toLowerCase() !== q);
    // Name contains
    const nameHit  = COMPANIES.filter(c =>
      c.name.toLowerCase().includes(q) &&
      !c.symbol.toLowerCase().startsWith(q)
    );
    return [...exact, ...symStart, ...nameHit].slice(0, 8);
  })();

  const handleSelect = useCallback((company: Company) => {
    setQuery(company.symbol);
    onChange(company.symbol);
    onSelect(company);
    setOpen(false);
    inputRef.current?.blur();
  }, [onChange, onSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter")     { e.preventDefault(); if (results[activeIdx]) handleSelect(results[activeIdx]); }
    if (e.key === "Escape")    { setOpen(false); }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0); }, [results.length]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        spellCheck={false}
        onChange={e => {
          const v = e.target.value.toUpperCase();
          setQuery(v);
          onChange(v);
          setOpen(true);
        }}
        onFocus={() => { setFocused(true); if (query.length > 0) setOpen(true); }}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
      />

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-[200] top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
          style={{ minWidth: "420px" }}
        >
          {results.map((c, i) => (
            <button
              key={c.symbol}
              type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(c); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                i === activeIdx ? "bg-signal-blue-bg" : "hover:bg-muted"
              }`}
            >
              {/* Symbol badge */}
              <span className={`text-xs font-bold font-mono w-24 flex-shrink-0 ${
                i === activeIdx ? "text-signal-blue" : "text-text-secondary"
              }`}>
                {highlight(c.symbol, query)}
              </span>
              {/* Company name */}
              <span className="text-sm text-text-primary truncate flex-1">
                {highlight(c.name, query)}
              </span>
              {/* Industry tag */}
              <span className="text-xs text-text-muted flex-shrink-0 truncate max-w-[120px]">
                {c.industry}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* No results hint */}
      {open && query.length >= 2 && results.length === 0 && focused && (
        <div className="absolute z-[200] top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-lg px-3 py-2.5" style={{ minWidth: "320px" }}>
          <p className="text-xs text-text-muted">No match — you can still type the ticker manually</p>
        </div>
      )}
    </div>
  );
}

/** Bold-highlight matching substring */
function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const q = query.trim().toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-bold text-signal-blue">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}
