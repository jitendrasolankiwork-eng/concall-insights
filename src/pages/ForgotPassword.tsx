import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";

export default function ForgotPassword() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const resp = await fetch("/api/auth/reset-password", {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ email: email.trim() }),
      });
      const data = await resp.json();
      if (!data.success) {
        setError(data.error || "Something went wrong");
      } else {
        setDone(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="container py-4 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-text-primary hover:opacity-80 transition-opacity">
            AI Portfolio Tracker
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="card-base w-full max-w-sm p-6 space-y-5">

          {done ? (
            <div className="text-center space-y-4">
              <div className="text-3xl">📧</div>
              <h1 className="text-base font-bold text-text-primary">Reset link sent</h1>
              <p className="text-xs text-text-secondary leading-relaxed">
                Check <span className="font-semibold text-text-primary">{email}</span> for a password reset link.
              </p>
              <Link
                to="/signin"
                className="inline-block text-xs font-semibold px-5 py-2.5 rounded-full
                  bg-foreground text-card hover:opacity-90 transition-opacity"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h1 className="text-base font-bold text-text-primary">Reset your password</h1>
                <p className="text-xs text-text-muted">We'll send a reset link to your email</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2.5
                      text-text-primary placeholder:text-text-muted
                      focus:outline-none focus:ring-2 focus:ring-signal-blue/40 focus:border-signal-blue
                      transition-colors"
                    placeholder="you@email.com"
                  />
                </div>

                {error && (
                  <div className="text-xs text-signal-red bg-signal-red-bg rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-sm font-semibold py-2.5 rounded-lg
                    bg-foreground text-card hover:opacity-90
                    disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <p className="text-xs text-text-muted text-center">
                Remember your password?{" "}
                <Link to="/signin" className="text-signal-blue font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
