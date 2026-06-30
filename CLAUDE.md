# Macro_Dash — Project Context for Claude Code

## What this project is

A personal macro & VC pulse dashboard, dark and editorial in style ("scannable in 10 seconds"), hosted on GitHub Pages with data refreshed automatically via GitHub Actions. Built in two phases:

- **Phase 1 (starter)**: A static single-page dashboard with two panels — an animated yield curve and an inflation comparison panel. Vanilla JS, Chart.js from CDN, live FRED data. No framework, no bundler. See `docs/starter-project-brief.md` for full spec.
- **Phase 2 (full system)**: Expands to include VC metrics from NVCA and FT Partners, Python fetch scripts, a scheduled GitHub Actions refresh job, and a JSON data layer that decouples the dashboard from the API calls. See `docs/dashboard-project-brief.md` for full spec.

## Folder structure

```
Macro_Dash/
├── .venv/                  # Python virtual environment — not committed
├── .env                    # API keys — not committed (gitignored)
├── .gitignore
├── CLAUDE.md               # this file
├── data/                   # generated JSON data files (dashboard reads from here)
├── docs/
│   ├── design/             # UI reference screenshots
│   ├── starter-project-brief.md
│   └── dashboard-project-brief.md
├── notebooks/              # Jupyter notebooks for exploration
└── src/                    # all code lives here
```

As the project builds out, `src/` will gain subfolders for scripts, JS modules, and the HTML dashboard. The full target structure for each phase is in the brief files linked above.

## Key conventions

- **No hardcoded API keys** — keys live in `.env` locally and in GitHub Actions secrets in CI. Never commit them.
- **No framework, no bundler** for the frontend — vanilla JS with Chart.js from CDN only.
- **Python for data scripts** — requests, pandas, openpyxl, pdfplumber, python-dotenv.
- **Data layer pattern**: Python scripts write to `data/*.json`; the dashboard reads those files. This keeps the FRED key out of the browser and makes the page load instant.
- **`manifest.json`** tracks which reports have already been processed — always check it before re-downloading.

## Data sources

- **FRED API** (free key) — all econ indicators, yield curve series, inflation measures. See brief for full list of series IDs.
- **NVCA Venture Monitor** — Excel data file parsed directly with pandas (no LLM needed).
- **FT Partners FinTech Insights** — PDF only, extracted with pdfplumber and Claude API.
- **PitchBook** — stubbed for later, not yet implemented.

## API keys needed

- `ANTHROPIC_API_KEY` — used by `extract_ftpartners.py` for PDF extraction (Phase 2)

## Current status

Project is set up and scaffolded. Phase 1 (starter dashboard) has not been built yet — start there before moving to Phase 2.

## Design reference

Dark background (`#0B1220`), thin grid lines, muted axis labels. Reference screenshots in `docs/design/`. Visual references: StreetStats TIPS yield curve (streetstats.finance/rates/tips) and inflation panel (streetstats.finance/cycle/inflation).
