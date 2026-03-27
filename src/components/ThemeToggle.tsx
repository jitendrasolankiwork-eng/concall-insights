import { useTheme } from "@/hooks/useTheme";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="flex items-center rounded-full p-0.5 bg-muted border border-border"
      role="group"
      aria-label="Theme toggle"
    >
      <button
        onClick={() => setTheme("light")}
        title="Cool Light"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
          theme === "light"
            ? "bg-card text-text-primary shadow-sm"
            : "text-text-muted hover:text-text-secondary"
        }`}
      >
        <span>☀️</span>
        <span className="hidden sm:inline">Light</span>
      </button>
      <button
        onClick={() => setTheme("navy")}
        title="Deep Navy"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
          theme === "navy"
            ? "bg-card text-text-primary shadow-sm"
            : "text-text-muted hover:text-text-secondary"
        }`}
      >
        <span>🌙</span>
        <span className="hidden sm:inline">Navy</span>
      </button>
    </div>
  );
}
