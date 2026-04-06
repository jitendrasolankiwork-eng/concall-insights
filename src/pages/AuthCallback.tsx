/**
 * pages/AuthCallback.tsx
 *
 * Handles Supabase email confirmation and OAuth redirects.
 *
 * After a user clicks "Confirm email" or "Sign in with Google", Supabase
 * redirects to /auth/callback with tokens in the URL hash:
 *   /auth/callback#access_token=...&refresh_token=...&type=signup
 *
 * This page:
 *   1. Extracts the tokens from the URL hash
 *   2. Saves them to localStorage (via our auth layer)
 *   3. Calls /api/auth/me to get the user profile
 *   4. Redirects to the dashboard
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const ACCESS_KEY  = "apt_access_token";
const REFRESH_KEY = "apt_refresh_token";
const USER_KEY    = "apt_user";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("Confirming your account…");

  useEffect(() => {
    async function handle() {
      try {
        // Supabase puts tokens in the URL hash after redirect
        const hash   = window.location.hash.slice(1); // remove leading #
        const params = new URLSearchParams(hash);

        const accessToken  = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type         = params.get("type"); // "signup" | "recovery" | "magiclink"
        const errorDesc    = params.get("error_description");

        if (errorDesc) {
          setMessage(decodeURIComponent(errorDesc.replace(/\+/g, " ")));
          setStatus("error");
          return;
        }

        if (!accessToken || !refreshToken) {
          setMessage("Invalid confirmation link. Please try signing up again.");
          setStatus("error");
          return;
        }

        // For password recovery, redirect to reset page (future)
        if (type === "recovery") {
          localStorage.setItem(ACCESS_KEY,  accessToken);
          localStorage.setItem(REFRESH_KEY, refreshToken);
          navigate("/");
          return;
        }

        // Fetch user profile using the new token
        const resp = await fetch("/api/auth/me", {
          headers: { "Authorization": `Bearer ${accessToken}` },
        });
        const data = await resp.json();

        if (!data.success || !data.user) {
          setMessage("Confirmation succeeded but we couldn't load your profile. Please sign in.");
          setStatus("error");
          return;
        }

        // Persist tokens + user
        localStorage.setItem(ACCESS_KEY,  accessToken);
        localStorage.setItem(REFRESH_KEY, refreshToken);
        localStorage.setItem(USER_KEY,    JSON.stringify(data.user));

        // Clear the hash from the URL (security hygiene)
        window.history.replaceState(null, "", window.location.pathname);

        // Go to dashboard — page will pick up the stored token
        navigate("/", { replace: true });

      } catch {
        setMessage("Something went wrong. Please try signing in.");
        setStatus("error");
      }
    }

    handle();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="card-base w-full max-w-sm p-8 text-center space-y-4">
        {status === "loading" ? (
          <>
            <div className="w-8 h-8 border-2 border-signal-blue border-t-transparent
              rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-text-primary">{message}</p>
          </>
        ) : (
          <>
            <div className="text-3xl">⚠️</div>
            <p className="text-sm font-semibold text-text-primary">Confirmation failed</p>
            <p className="text-xs text-text-secondary leading-relaxed">{message}</p>
            <a
              href="/signin"
              className="inline-block text-xs font-semibold px-5 py-2.5 rounded-full
                bg-foreground text-card hover:opacity-90 transition-opacity"
            >
              Go to sign in
            </a>
          </>
        )}
      </div>
    </div>
  );
}
