# CLAUDE.md — AI Portfolio Tracker Frontend

This file gives Claude Code full context for every session. Read this before making any changes.

---

## What this project is

Decision-first UI for Indian retail investors tracking small/midcap stocks. Shows AI-extracted insights from quarterly concalls and investor presentations. The product answers "What should I do?" within 5 seconds.

**Core principle**: Decision → Change → Reason → Details (in that order, always)

**Backend**: Node.js/Express on port 5000
**Frontend**: React/Vite on port 8080 (proxies /api to 5000)

---

## Current state (as of March 2026)

- 10 companies tracked: MANORAMA, ETERNAL, HDFCBANK, KALYANKJIL, POLYCAB, MCX, YATHARTH, ARMANFIN, NETWEB, SAGILITY
- Dashboard: auto-load, sort/filter, portfolio strip, attention tags
- Detail page: full decision-first layout with forward valuation
- Forward valuation working for: MANORAMA, YATHARTH, KALYANKJIL

---

## Tech stack

- React 18 + TypeScript + Vite
- Tailwind CSS (custom design tokens — use existing classes)
- React Router v6
- No external UI library for main components (custom built)
- shadcn/ui components in `src/components/ui/` (don't modify)

---

## Key design tokens (Tailwind classes)

```
Backgrounds:  bg-background, bg-card, bg-muted
Text:         text-text-primary, text-text-secondary, text-text-muted
Signals:      text-signal-green, text-signal-amber, text-signal-red, text-signal-blue
Signal BGs:   bg-signal-green-bg, bg-signal-amber-bg, bg-signal-red-bg, bg-signal-blue-bg
Cards:        card-base (use this for all cards), card-hover (for clickable cards)
Font sizes:   text-2xs (10px), text-xs (12px), text-sm (14px)
```

**Never** use hardcoded colors. Always use the token classes above.

---

## File structure

```
src/
├── pages/
│   ├── Dashboard.tsx       # Main dashboard — auto-loads all companies
│   └── CompanyDetail.tsx   # Company detail page
├── components/
│   ├── CompanyCard.tsx     # Dashboard card
│   └── ValuationSection.tsx # Forward PE/PEG section
├── lib/
│   └── api.ts              # ALL API calls — never fetch directly in components
└── types/
    └── portfolio.ts        # All TypeScript interfaces
```

---

## api.ts — critical functions

```typescript
fetchCompany(ticker)           // Returns CompanyInsight + valuation + valuationEstimate + marketCap
fetchCompanyByQuarter(ticker, quarter)  // Specific quarter
fetchAvailableQuarters(ticker) // ["Q3 FY26", "Q2 FY26"]
fetchAllCompanies()            // All processed companies in parallel
```

**Important**: `fetchCompany` returns `CompanyInsight & { valuation, valuationEstimate, marketCap }`. These extra fields must be read from the raw API response in useEffect — TypeScript strips them otherwise. See CompanyDetail.tsx useEffect for the pattern.

---

## Company logo slugs

TradingView slugs in `SLUG_MAP` in `api.ts`. Add new companies here:

```typescript
MANORAMA   : "manorama-industries",
ETERNAL    : "zomato",
HDFCBANK   : "hdfc-bank",
KALYANKJIL : "kalyan-jewellers-india",
POLYCAB    : "polycab-india",
MCX        : "multi-commodity-exchange-of-india",
YATHARTH   : "yatharth-hospital-and-trauma-care",
ARMANFIN   : "arman-financial-services",
NETWEB     : "netweb-technologies-india",
SAGILITY   : "sagility-india",
```

---

## Scoring display

| Score | Color class | Verdict |
|-------|-------------|---------|
| ≥ 4.0 | text-signal-green | 🟢 BUY |
| 3.0–3.9 | text-signal-amber | 🟡 HOLD |
| < 3.0 | text-signal-red | 🔴 WEAK |

---

## CompanyCard — attention tag logic

```
🔻 Declining  — compositeScore < previousCompositeScore - 0.3  (checked FIRST)
🆕 New update — processedAt within 7 days AND no previousQuarter
⚠ Watch      — verdict !== "buy" OR any parameter score ≤ 2
```

Only one tag shown per card, in priority order above.

---

## CompanyDetail page — section order

1. Sticky header (verdict, score, delta)
2. Action summary (investorTake + verified count)
3. Red flags (conditional — only if triggered)
4. What changed this quarter (QoQ)
5. If you own this stock (action bullets)
6. Summary strip
7. Investment thesis (6 checks)
8. Management tone
9. Signal section
10. Analyst summary
11. Parameter breakdown (expandable)
12. **Forward valuation** (ValuationSection)
13. Risk factors
14. Footer (How scores work link)

**Do not reorder sections without explicit instruction.**

---

## ValuationSection component

Props: `{ valuationEstimate, marketCap, quarter, price }`

Key features:
- **PEG verdict**: PEG<1 = 🟢 Undervalued, 1–1.5 = 🟡 Fair, >1.5 = 🔴 Expensive
- **3-column table**: Label | Value | How we got here
- **Unit normalisation**: `normaliseCr()` converts all Mn → Cr automatically
- **Plain English insight**: "At ₹X, paying ~Yx earnings for ~Z% growth"
- **Assumptions split**: FY+1 and FY+2 on separate rows
- **Driver bullets**: array or semicolon-separated string, both handled

**Critical**: `valuationEstimate` state must be set via raw API fetch in useEffect:
```typescript
setValuationEstimate(rawResp.valuationEstimate || rawResp.latestInsight?.valuationEstimate || null);
```

---

## Dashboard features

- **Auto-load**: fetches all companies from `/api/admin/insights` on mount
- **Sort options**: score, verdict, name, updated
- **Filter options**: all, buy, hold, weak
- **Portfolio strip**: counts + top/bottom performer + action line
- **HowScoresModal**: explains scoring, shown via link in header subtitle
- **No manual add box**: NSE/BSE section removed (admin only)

---

## How scores work modal

Located in both Dashboard.tsx and CompanyDetail.tsx (same component, defined in each file).
Shows: 3 parameters, scoring 0-5, BUY/HOLD/WEAK thresholds, evidence note.

---

## Known issues / watch out for

1. **TypeScript stripping extra fields**: `fetchCompany` return type `Promise<CompanyInsight>` strips `valuation`/`valuationEstimate`. Always read these from raw API response in useEffect.

2. **Vite caching**: If changes don't appear, try hard refresh (Ctrl+Shift+R) or restart Vite (`npm run dev`).

3. **Logo fallback**: TradingView logos fail silently — letter avatar shown if slug wrong. Test new slugs manually.

4. **Quarter selector**: Uses `fetchCompanyByQuarter` which rebuilds a fakeResp — ensure `valuation`/`valuationEstimate` are passed through fakeResp in api.ts.

---

## What NOT to do

- Don't add stock price predictions or buy/sell recommendations
- Don't add the NSE/BSE URL input back to the dashboard (admin only)
- Don't use inline styles — always use Tailwind classes
- Don't hardcode colors — always use signal/text/bg token classes
- Don't add `display: none` or tabs that hide content (Vite streaming issue)
- Don't modify files in `src/components/ui/` (shadcn components)

---

## Roadmap (next priorities)

### Immediate (ChatGPT feedback)
1. **Valuation verdict badge** — PEG-based 🟢/🟡/🔴 already partially implemented in ValuationSection header
2. **Investment type label** — Growth Compounder/Cyclical/Turnaround badge on detail page
3. **Action box improvement** — 3 explicit actions: "If you own / considering / tracking"
4. **Risk impact** — rewrite risks with quantified impact (e.g. "could impact earnings 10-15%")

### Soon
5. **Admin module** — add companies from UI without touching sheet
   - NseBseSection snippet saved in `src/backup/NseBseSection.tsx.snippet`
   - Backend endpoints already exist
6. **More companies** — V2 Retail, Jeena Sikho, Blackbuck, Vintage Coffee etc.

### Future (after first users)
7. **Alerts engine** — score changes, upgrades/downgrades
8. **Portfolio vs Watchlist** — paid feature
9. **Custom ordering** — paid feature

---

## Competitive context

Main competitor: ArthaLens (arthalens.com)

Our differentiators:
- Evidence-backed scores with source quotes
- QoQ trend tracking with score delta
- Forward PE/PEG valuation (unique in retail tools)
- Decision-first layout — verdict prominent
- Attention tags (Declining/New/Watch)
- "How scores work" transparency

---

## Business context

- Target pricing: ₹199/month (early), ₹499/month (after trust builds)
- Free tier: 3 companies, basic insights
- Paid tier: unlimited companies, forward valuation, alerts
- First goal: 10 real users before monetising
