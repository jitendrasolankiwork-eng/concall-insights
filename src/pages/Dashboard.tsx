import { useState } from "react";
import { mockCompanies } from "@/data/mockData";
import CompanyCard from "@/components/CompanyCard";

export default function Dashboard() {
  const [companies] = useState(mockCompanies);
  const [ticker, setTicker] = useState("");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-text-primary">AI Portfolio Tracker</h1>
              <p className="text-xs text-text-muted">Concall insights, AI-extracted</p>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-text-secondary">
              {companies.length} companies
            </span>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Add Company */}
        <div className="flex gap-2">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="Add processed ticker e.g. HDFCBANK"
            className="flex-1 text-sm px-3 py-2 rounded-lg bg-card border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-text-muted"
          />
          <button className="px-4 py-2 text-sm font-medium rounded-lg bg-foreground text-card transition-opacity hover:opacity-80">
            + Add
          </button>
        </div>

        {/* Company Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {companies.map((c) => (
            <CompanyCard key={c.ticker} company={c} />
          ))}
        </div>

        {/* NSE/BSE Search */}
        <section className="card-base p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Search NSE / BSE</h2>
            <p className="text-xs text-text-muted mt-0.5">
              NSE blocks direct API calls. Use the manual flow below to add transcript URLs.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">Step 1 — Enter ticker</label>
              <input
                type="text"
                placeholder="e.g. MANORAMA"
                className="w-full text-sm px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-text-muted"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">Step 2 — Open exchange sites</label>
              <div className="flex gap-2">
                <a
                  href="https://www.nseindia.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-signal-blue-bg text-signal-blue hover:opacity-80 transition-opacity"
                >
                  Open NSE ↗
                </a>
                <a
                  href="https://www.bseindia.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-signal-blue-bg text-signal-blue hover:opacity-80 transition-opacity"
                >
                  Open BSE ↗
                </a>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">Step 3 — Paste URLs</label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="Concall transcript PDF URL"
                    className="flex-1 text-sm px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-text-muted"
                  />
                  <button className="text-xs font-medium px-3 py-2 rounded-md bg-foreground text-card hover:opacity-80 transition-opacity">
                    Save
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="Investor Presentation PDF URL"
                    className="flex-1 text-sm px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-text-muted"
                  />
                  <button className="text-xs font-medium px-3 py-2 rounded-md bg-foreground text-card hover:opacity-80 transition-opacity">
                    Save
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">Step 4 — Process</label>
              <p className="text-xs text-text-muted">
                Once URLs are saved, click "Process" in the company detail page to extract AI insights.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
