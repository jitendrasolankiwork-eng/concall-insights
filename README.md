# AI Portfolio Tracker — Frontend

React/Vite frontend for the AI-Based Small & Midcap Portfolio Tracker.

---

## Overview

Decision-first UI for retail investors to track Indian small/midcap stocks. Shows structured AI-extracted insights from quarterly concalls and investor presentations — verdict, score, what changed, thesis, and forward valuation.

---

## Tech Stack

- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **HTTP**: Native fetch (no axios)
- **Port**: 8080 (proxies `/api` to backend on 5000)

---

## Project Structure

```
src/
├── main.tsx                    # Entry point
├── App.tsx                     # Router setup
│
├── pages/
│   ├── Dashboard.tsx           # / — all companies, sort/filter, portfolio strip
│   └── CompanyDetail.tsx       # /company/:ticker — full detail page
│
├── components/
│   ├── CompanyCard.tsx         # Dashboard card — score, verdict, attention tags
│   └── ValuationSection.tsx    # Forward PE/PEG section on detail page
│
├── lib/
│   └── api.ts                  # All API calls + data mapping
│
└── types/
    └── portfolio.ts            # TypeScript interfaces
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start development server

```bash
npm run dev
```

Frontend runs at `http://localhost:8080`
Requires backend running at `http://localhost:5000`

---

## Pages

### Dashboard (`/`)
- Auto-loads all processed companies
- Portfolio strip — BUY/HOLD/WEAK counts, top/bottom performer
- Sort — Score / Verdict / Name / Updated
- Filter — All / BUY / HOLD / WEAK
- "How scores work" modal

### Company Detail (`/company/:ticker`)

Sections in order:
1. Sticky header — verdict, score, delta
2. Action summary — investor take + verified count
3. Red flags (conditional)
4. What changed this quarter
5. If you own this stock
6. Summary strip
7. Investment thesis (6 checks)
8. Management tone
9. Signal section
10. Analyst summary
11. Parameter breakdown (expandable)
12. Forward valuation — PE/PEG
13. Risk factors
14. Footer

---

## Key Components

### CompanyCard
- Attention tags: 🆕 New / 🔻 Declining / ⚠ Watch
- Score delta ▲/▼ vs previous quarter
- 1-line insight from investorTake

**Attention tag logic:**
- 🔻 Declining — score dropped > 0.3 vs previous
- 🆕 New — processed within 7 days AND no previous quarter
- ⚠ Watch — HOLD/WEAK or any parameter ≤ 2

### ValuationSection
- Mode: Management guided / Analyst derived / Baseline
- Verdict: 🟢 Undervalued (PEG<1) / 🟡 Fair (1–1.5) / 🔴 Expensive (>1.5)
- 3-column table: Label | Value | How we got here
- Plain English insight line
- Assumptions split FY+1/FY+2
- Unit normalisation: auto-converts Mn → Cr

---

## Scoring

| Score | Verdict |
|-------|---------|
| ≥ 4.0 | 🟢 BUY |
| 3.0–3.9 | 🟡 HOLD |
| < 3.0 | 🔴 WEAK |

---

## Adding a New Company

1. Add to Google Sheet with status `pending`
2. Run pipeline: `POST /api/admin/process-sheet/sync`
3. Add TradingView logo slug to `SLUG_MAP` in `src/lib/api.ts`
4. Company auto-appears on dashboard

---

## Build for Production

```bash
npm run build
```

Output in `dist/` — deployable to Vercel.
