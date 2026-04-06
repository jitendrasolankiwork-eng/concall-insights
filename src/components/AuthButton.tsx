/**
 * AuthButton.tsx
 *
 * Shows "Sign in" if logged out, or avatar + name + "Sign out" if logged in.
 * Placed in the Dashboard header (and other page headers).
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function AuthButton() {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [signingOut,  setSigningOut]  = useState(false);

  if (loading) {
    return <div className="w-20 h-7 bg-muted rounded-full animate-pulse" />;
  }

  // ── Signed out ─────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/signin")}
          className="text-xs font-semibold px-3 py-1.5 rounded-full
            border border-border text-text-secondary
            hover:bg-muted transition-colors"
        >
          Sign in
        </button>
        <button
          onClick={() => navigate("/signup")}
          className="text-xs font-semibold px-3 py-1.5 rounded-full
            bg-foreground text-card
            hover:opacity-90 transition-opacity"
        >
          Sign up
        </button>
      </div>
    );
  }

  // ── Signed in ──────────────────────────────────────────────────────────────
  const initials = (user.name || user.email)
    .split(/\s+|@/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

  async function handleSignOut() {
    setSigningOut(true);
    setMenuOpen(false);
    await signOut();
    setSigningOut(false);
    navigate("/");
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1 rounded-full
          hover:bg-muted transition-colors"
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name || user.email}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <span className="w-6 h-6 rounded-full bg-signal-blue text-white
            text-2xs font-bold flex items-center justify-center">
            {initials}
          </span>
        )}
        <span className="text-xs font-medium text-text-primary hidden sm:block max-w-[100px] truncate">
          {user.name || user.email.split("@")[0]}
        </span>
        <span className="text-text-muted text-2xs">▾</span>
      </button>

      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1.5 z-50 w-44
            card-base rounded-xl py-1 shadow-lg"
            style={{ border: "0.5px solid hsl(var(--border))" }}
          >
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-semibold text-text-primary truncate">
                {user.name || "My account"}
              </p>
              <p className="text-2xs text-text-muted truncate">{user.email}</p>
            </div>

            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full text-left px-3 py-2 text-xs text-signal-red
                hover:bg-signal-red-bg transition-colors
                disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
