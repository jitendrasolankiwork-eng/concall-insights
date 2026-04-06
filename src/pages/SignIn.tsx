import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";

export default function SignIn() {
  const { signIn } = useAuth();
  const navigate   = useNavigate();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn(email.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      navigate("/");
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="container py-4 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-text-primary hover:opacity-80 transition-opacity">
            AI Portfolio Tracker
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Form */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="card-base w-full max-w-sm p-6 space-y-5">

          <div className="space-y-1">
            <h1 className="text-base font-bold text-text-primary">Welcome back</h1>
            <p className="text-xs text-text-muted">Sign in to view your portfolio</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
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

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text-secondary" htmlFor="password">
                  Password
                </label>
                <Link to="/forgot-password" className="text-2xs text-signal-blue hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2.5
                  text-text-primary placeholder:text-text-muted
                  focus:outline-none focus:ring-2 focus:ring-signal-blue/40 focus:border-signal-blue
                  transition-colors"
                placeholder="••••••••"
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
                bg-foreground text-card
                hover:opacity-90 active:opacity-80
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-opacity"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>

          </form>

          <p className="text-xs text-text-muted text-center">
            Don't have an account?{" "}
            <Link to="/signup" className="text-signal-blue font-medium hover:underline">
              Sign up free
            </Link>
          </p>

        </div>
      </main>

    </div>
  );
}
