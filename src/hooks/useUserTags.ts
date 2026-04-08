/**
 * src/hooks/useUserTags.ts
 *
 * Manages Portfolio / Watchlist tag state for the logged-in user.
 * - Loads all tags on mount (or when user changes)
 * - Optimistic updates: UI reflects change instantly, reverts on error
 * - `inFlight` set tracks symbols whose tag is being updated (disables button)
 */

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { fetchUserTags, tagCompany, untagCompany } from "@/lib/api";
import type { TagCategory } from "@/lib/api";

export type { TagCategory };

export interface UseUserTagsResult {
  /** Map of symbol → category for all tagged companies */
  tags       : Record<string, TagCategory>;
  /** True while initial load is in progress */
  loading    : boolean;
  /** Set of symbols whose request is currently in-flight */
  inFlight   : Set<string>;
  /** Tag (or move) a company. Optimistic update included. */
  tag        : (symbol: string, name: string, category: TagCategory) => Promise<void>;
  /** Remove a company from portfolio/watchlist. Optimistic update included. */
  untag      : (symbol: string) => Promise<void>;
  /** Returns the tag category for a symbol, or null if untagged */
  getCategory: (symbol: string) => TagCategory | null;
}

export type TagAction = "tagged" | "moved" | "removed";

export function useUserTags(
  onSuccess?: (symbol: string, action: TagAction, category?: TagCategory) => void,
): UseUserTagsResult {
  const { user, getToken } = useAuth();
  const [tags,     setTags]     = useState<Record<string, TagCategory>>({});
  const [loading,  setLoading]  = useState(false);
  const [inFlight, setInFlight] = useState<Set<string>>(new Set());

  // ── Load tags when user logs in / out ──────────────────────────────────────
  useEffect(() => {
    if (!user) { setTags({}); return; }
    const token = getToken();
    if (!token) return;

    setLoading(true);
    fetchUserTags(token)
      .then((list) => {
        const map: Record<string, TagCategory> = {};
        list.forEach((t) => { map[t.symbol] = t.category; });
        setTags(map);
      })
      .catch(() => { /* ignore — tags simply won't show */ })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Tag (add or move) ──────────────────────────────────────────────────────
  const tag = useCallback(async (symbol: string, name: string, category: TagCategory) => {
    const token = getToken();
    if (!token) return;

    const prev = tags[symbol];
    if (prev === category) return; // already tagged with this category — no-op

    // Optimistic update
    setTags((t) => ({ ...t, [symbol]: category }));
    setInFlight((s) => { const n = new Set(s); n.add(symbol); return n; });

    try {
      const result = await tagCompany(token, symbol, name, category);
      if (result.success) {
        onSuccess?.(symbol, prev ? "moved" : "tagged", category);
      } else {
        // Revert
        setTags((t) => {
          const n = { ...t };
          if (prev) n[symbol] = prev; else delete n[symbol];
          return n;
        });
      }
    } catch {
      // Revert on network error
      setTags((t) => {
        const n = { ...t };
        if (prev) n[symbol] = prev; else delete n[symbol];
        return n;
      });
    } finally {
      setInFlight((s) => { const n = new Set(s); n.delete(symbol); return n; });
    }
  }, [tags, getToken, onSuccess]);

  // ── Untag (remove) ─────────────────────────────────────────────────────────
  const untag = useCallback(async (symbol: string) => {
    const token = getToken();
    if (!token) return;

    const prev = tags[symbol];
    if (!prev) return; // not tagged — no-op

    // Optimistic update
    setTags((t) => { const n = { ...t }; delete n[symbol]; return n; });
    setInFlight((s) => { const n = new Set(s); n.add(symbol); return n; });

    try {
      const result = await untagCompany(token, symbol);
      if (result.success) {
        onSuccess?.(symbol, "removed");
      } else {
        setTags((t) => ({ ...t, [symbol]: prev }));
      }
    } catch {
      setTags((t) => ({ ...t, [symbol]: prev }));
    } finally {
      setInFlight((s) => { const n = new Set(s); n.delete(symbol); return n; });
    }
  }, [tags, getToken, onSuccess]);

  const getCategory = useCallback(
    (symbol: string): TagCategory | null => tags[symbol] ?? null,
    [tags],
  );

  return { tags, loading, inFlight, tag, untag, getCategory };
}
