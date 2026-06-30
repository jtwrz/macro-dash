# Starter Project Brief: Yield Curve & Inflation Dashboard

A focused, shippable weekend project. Two panels, live FRED data, GitHub Pages deploy. This teaches you the full stack — API integration, charting, GitHub Actions, Pages hosting — without the complexity of the full system.

---

## What it is

A single-page dashboard with two side-by-side panels:

1. **Animated yield curve** — Treasury nominal yields, TIPS real yields, and breakeven inflation plotted across maturities (3M → 30Y), with a play button that animates the curve moving through time, a scrubable time slider, speed controls, and series toggles. Stat cards above the chart show 10Y yield, 10Y–2Y spread, 10Y–3M spread, 10Y breakeven, and 10Y real yield — updating live as you move through time.

2. **Inflation panel** — CPI, core CPI, PCE, core PCE, PPI, and wage growth (BLS hourly earnings) plotted together on a shared time axis, so you can see how they move relative to each other. The whole point is that these five measures tell different parts of the same story — seeing them side by side is what makes them useful.

Both panels pull live data from FRED on page load. No hardcoded numbers.

---

## Folder structure

The project lives inside `Macro_Dash/`, which is already scaffolded. The relevant structure for this starter build is:

```
Macro_Dash/
├── .github/
│   └── workflows/
│       └── deploy.yml             # GitHub Pages deploy on push to main
├── .venv/                         # Python virtual environment — already set up, not committed
├── .env                           # API keys — already exists, gitignored
├── .gitignore                     # already exists
├── CLAUDE.md                      # project context for Claude Code
├── index.html                     # single page — loads data, renders both panels
├── data/                          # JSON data files — dashboard reads from here
│   ├── yield-curve.json           # written by fetch scripts (Option B)
│   └── inflation.json             # written by fetch scripts (Option B)
├── docs/
│   ├── design/                    # UI reference screenshots
│   ├── starter-project-brief.md  # this file
│   └── dashboard-project-brief.md
├── notebooks/                     # Jupyter notebooks for exploration
└── src/
    ├── fred.js                    # FRED API client — fetchSeries(id, startDate)
    ├── yieldCurve.js              # yield curve chart + animation logic
    └── inflationPanel.js          # inflation multi-line chart
```

No build step. No React. No bundler. Vanilla JS with Chart.js loaded from CDN. This keeps the project simple and the deploy trivial — GitHub Pages serves `index.html` from the root directly.

---

## Data sources (all FRED, all free)

### Yield curve panel

Treasury nominal yields (daily):
- `DGS3MO` — 3-month
- `DGS6MO` — 6-month
- `DGS1` — 1-year
- `DGS2` — 2-year
- `DGS3` — 3-year
- `DGS5` — 5-year
- `DGS7` — 7-year
- `DGS10` — 10-year
- `DGS20` — 20-year
- `DGS30` — 30-year

TIPS real yields (daily):
- `DFII5` — 5-year
- `DFII7` — 7-year
- `DFII10` — 10-year
- `DFII20` — 20-year
- `DFII30` — 30-year

Breakeven inflation (daily, derived from Treasury – TIPS):
- `T5YIE` — 5-year
- `T10YIE` — 10-year
- `T30YIEM` — 30-year (monthly, interpolate for daily display)

Pull 5 years of history for the slider. Snapshot monthly (first business day of each month) to keep the animation smooth — daily snapshots would be too noisy and too many frames.

### Inflation panel

All monthly series:
- `CPIAUCSL` — CPI, all items, YoY % change
- `CPILFESL` — Core CPI (ex food & energy), YoY % change
- `PCEPI` — PCE, YoY % change
- `PCEPILFE` — Core PCE (ex food & energy), YoY % change
- `PPIACO` — PPI all commodities, YoY % change
- `CES0500000003` — Average hourly earnings, YoY % change

Pull 5 years of history. Display as YoY % change (FRED returns levels for most of these — calculate the YoY transform in `fred.js`).

---

## FRED API basics

Free key, instant signup: https://fred.stlouisfed.org/docs/api/api_key.html

Base URL pattern:
```
https://api.stlouisfed.org/fred/series/observations
  ?series_id=DGS10
  &api_key=YOUR_KEY
  &file_type=json
  &observation_start=2020-01-01
  &units=pc1            ← YoY % change (omit for level series like yields)
```

The key lives in `.env` locally (already set up). For GitHub Pages (a static site), the key will be visible in client-side JS — that's acceptable here since FRED keys are low-sensitivity and rate-limited. Alternatively, the GitHub Action can bake the data into `data/` at build time so the key never ships to the browser. That's the cleaner approach — see build step below.

---

## Architecture: bake vs. live fetch

Two options, with a clear recommendation:

**Option A — Live fetch (simpler to build)**
`fred.js` calls the FRED API directly from the browser on page load. Works immediately, no build step. Downside: your FRED key is in the client bundle and the page takes ~2 seconds to load while it fetches.

**Option B — Bake at build time (recommended)**
A GitHub Action runs `scripts/fetch_data.py` on a schedule (daily), which calls FRED, writes the results to `data/yield-curve.json` and `data/inflation.json`, and commits them. `index.html` just fetches those local JSON files — instant load, no key in browser, data always fresh. This is the same pattern the full system will use.

**Recommendation: start with Option A to get something working, then migrate to Option B once you're happy with how it looks.** Claude Code can do the migration in one session.

---

## Build order (the prompt for Claude Code)

> The project folder `Macro_Dash/` is already set up with `.env`, `.gitignore`, `CLAUDE.md`, and the following folders in place: `data/`, `docs/`, `notebooks/`, `src/`. Work within this existing structure — do not recreate or rename the root folder.
>
> Build a static single-page dashboard for the yield curve and inflation panels. No framework, no bundler — vanilla JS with Chart.js from CDN.
>
> 1. Write `src/fred.js`: a module that exports `fetchSeries(seriesId, startDate, units)` — calls the FRED API, handles the JSON response, returns an array of `{date, value}` objects with nulls removed. Include a `fetchMultiple(seriesIds, startDate, units)` helper that batches calls and returns a keyed object. Read the API key from a `FRED_API_KEY` constant at the top of the file (we'll wire this properly in a later step).
>
> 2. Write `src/yieldCurve.js`: fetches all Treasury, TIPS, and breakeven series, groups them into monthly snapshots (first business day of each month), then renders a Chart.js line chart with three datasets (Treasury nominal, TIPS real, breakeven). Implements play/pause animation that steps through snapshots at a configurable speed, a scrubable range slider, speed controls (0.5×/1×/2×/4×), and series toggle buttons. Stat cards above the chart show 10Y yield, 10Y–2Y spread, 10Y–3M spread, 10Y breakeven, and 10Y real yield — updating as the slider moves.
>
> 3. Write `src/inflationPanel.js`: fetches CPI, core CPI, PCE, core PCE, PPI, and hourly earnings from FRED with `units=pc1` (YoY % change), then renders a Chart.js multi-line chart. Each series gets a distinct color and dash pattern so they're distinguishable without relying on color alone. Add a horizontal dashed line at 2% (Fed target). Include a custom HTML legend above the chart with series names and current values.
>
> 4. Build `index.html` at the project root: dark background (#0B1220), two-panel layout (yield curve left, inflation right, stacking to single column below 900px). Header with title "Yield curve & inflation" and last-updated timestamp. Load Chart.js from cdnjs CDN. Import and initialize both modules on DOMContentLoaded. Show a loading skeleton while data fetches.
>
> 5. Write `.github/workflows/deploy.yml`: on push to `main`, deploy to GitHub Pages using `actions/deploy-pages`. No build step needed — just deploy the repo root.
>
> 6. Write a README.md at the project root covering: getting a FRED key, where to put it, how to run locally (just open a terminal in the `Macro_Dash/` root and run `python3 -m http.server 8000`, then open `http://localhost:8000` in your browser), and how to enable GitHub Pages in repo settings.
>
> Ask me for my FRED API key before writing any code that references it. Don't push anything to GitHub — I'll do that once it's working locally.

---

## Visual reference

The StreetStats TIPS yield curve screen (streetstats.finance/rates/tips) is the closest reference for the yield curve panel — three overlaid series (Treasury nominal, TIPS real, breakeven), plotted across maturities rather than over time, with the animation making the time dimension visible. The stat table below the chart (basis point change z-scores) is a later addition — skip it for v1.

The StreetStats inflation screen (streetstats.finance/cycle/inflation) is the reference for the inflation panel — CPI, PCE, and PPI on a shared axis, showing how they diverge and converge over time.

Key design choices matching that aesthetic:
- Dark background, thin grid lines, muted axis labels
- Teal/cyan for Treasury nominal, gold/amber for breakeven, light blue for TIPS real
- Current-value labels pinned to the right edge of each line
- "As of [date]" shown clearly so the data is never ambiguous

Reference screenshots are in `docs/design/`.

---

## What this teaches you (why this order)

- **FRED API** — authentication, series IDs, the `units=pc1` transform, handling missing observations
- **Chart.js** — multi-dataset line charts, animation, custom legends, responsive layout
- **Vanilla JS modules** — no framework complexity, just clean ES module imports
- **GitHub Pages** — the deploy workflow, how static hosting works, why the bake-at-build-time pattern matters
- **The full data flow** — from a live API call to a rendered chart — which is the foundation for everything in the full system brief

Once this is live, the next step is adding the Sahm Rule / unemployment card and the ISM panel, which slots in as a third panel without changing anything about the architecture.

---

## Notes

- **FRED rate limits**: 120 requests per minute per key — more than enough for this. The multi-series fetcher should still add a small delay between calls to be a good citizen.
- **TIPS maturity mismatch**: FRED's daily TIPS series only go to 30Y via `DFII30`, and only at 5/7/10/20/30-year maturities — there's no 2Y or 3Y TIPS series. So the TIPS real yield curve will have fewer points than the Treasury curve. That's accurate, not a bug.
- **Breakeven calculation**: FRED provides pre-computed breakevens (`T5YIE`, `T10YIE`) which are the cleanest to use. They're derived from TIPS auctions, not just Treasury minus TIPS on the same day, so they're slightly different from a naive subtraction — and more correct.
- **Mobile**: the two-panel layout stacks to single column below 900px. The yield curve animation still works on mobile; the slider is touch-friendly natively.
