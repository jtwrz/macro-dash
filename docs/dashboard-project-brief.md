# Project Brief: Personal Econ & VC Pulse Dashboard

Hand this whole document to Claude Code as your opening prompt. It has enough detail to scaffold the project in one or two sessions — adjust anything that doesn't fit how you actually want to work.

## What this is

A dashboard styled like "The Tape" (dark, editorial, scannable in 10 seconds) that:

1. Shows live economic indicators and rate spreads, pulled from FRED's free API
2. Shows VC metrics pulled from NVCA's Venture Monitor (their Excel data file, not just the PDF) and FT Partners' FinTech Insights reports (PDF only) — refreshed monthly via a scheduled job, archived to disk every quarter
3. Lives on the open web at a free URL (GitHub Pages), so it's reachable from your phone, a work laptop, anywhere — with the refresh job running in the cloud instead of depending on your computer being on
4. Is built so a PitchBook API integration can slot in later as its own source feeding the same data file, without changing anything else, if you end up getting a subscription

## Folder structure

```
econ-dashboard/
├── .github/
│   └── workflows/
│       └── refresh-data.yml       # runs the fetch scripts on a schedule, in the cloud
├── index.html                     # the dashboard — reads data/dashboard-data.json
├── data/
│   └── dashboard-data.json        # current values + "as of" dates for every metric
├── reports/                       # quarterly archive — never overwritten, only added to
│   ├── nvca/
│   │   ├── 2026-Q1.pdf
│   │   └── 2026-Q1.xlsx           # NVCA's structured data file — this is what actually gets parsed
│   └── ftpartners/
│       ├── 2026-Q1-fintech-insights.pdf
│       └── 2025-almanac.pdf
├── scripts/
│   ├── fetch_fred.py              # pulls econ/rate series from FRED
│   ├── fetch_nvca.py              # downloads NVCA's PDF + Excel, parses the Excel directly — no LLM needed
│   ├── fetch_ftpartners.py        # downloads new FT Partners PDFs
│   ├── extract_ftpartners.py      # FT Partners has no structured file, so this is the LLM-assisted extraction step
│   └── fetch_pitchbook.py         # not built yet — placeholder for a future API integration, see note below
├── manifest.json                  # tracks which report files have already been processed
├── logs/
│   └── vc-pull.log
├── .env                           # FRED_API_KEY, ANTHROPIC_API_KEY — local dev only, gitignored
└── README.md
```

## Data flow

**Econ indicators & rate spreads** — fetched fresh every time the dashboard loads (or on a daily cron, your call). FRED's API is free, fast, and doesn't need archiving since the source itself is the permanent record.

**VC metrics** — runs on a monthly cron, but most months it finds nothing new (NVCA and FT Partners both publish quarterly). The two sources are handled differently because of what they actually publish:

*NVCA* — `fetch_nvca.py` checks the Venture Monitor page for a release dated later than what's in `manifest.json`. If there's a new one, it downloads both the PDF (for the archive) and the Excel data file, then parses the Excel directly with `pandas`/`openpyxl` — no LLM involved, since it's already structured cells, not narrative text. Deterministic in, deterministic out.

*FT Partners* — `fetch_ftpartners.py` does the same check-and-download against their research page, but only a PDF exists. `extract_ftpartners.py` pulls the text out (pdfplumber) and sends it to Claude with a prompt asking for the specific named metrics back as strict JSON — this is the one step that's genuinely LLM-assisted, because there's no structured alternative.

Both paths land in the same place: `data/dashboard-data.json`, under a `vc` key, with every metric tagged `source` (`nvca_excel` or `ftpartners_pdf`) and `source_file` pointing at the archived document. One line gets written to `logs/vc-pull.log` either way, so a glance at the log tells you whether anything happened.

**Designing for PitchBook later**: because every VC metric in the JSON carries a `source` tag, adding `fetch_pitchbook.py` down the road is additive, not a rewrite — it would just write into the same `vc` key with `source: "pitchbook_api"`, either alongside or in place of the NVCA/FT Partners numbers. Nothing about the dashboard, the JSON schema, or the other two scripts needs to change for that to slot in.

The dashboard itself should show a small "source: reports/nvca/2026-Q1.xlsx" note on each VC card, so you can always trace a number back to the actual document.

## Hosting: making it reachable from anywhere

The piece that changes when you go from "local file" to "real website" is *where the refresh job runs*. It can't depend on your laptop being on — it needs to run somewhere that's always available. The free, low-maintenance way to do that:

**GitHub Pages** hosts the static site itself (`index.html` + `dashboard-data.json`) at a free URL like `https://yourusername.github.io/econ-dashboard/` — works from your phone, a work computer, anywhere, no server to maintain.

**GitHub Actions** replaces the local cron job. Instead of your computer running the Python scripts on a schedule, GitHub's own servers do it — for free, well within the free tier's monthly minutes for something this small. A workflow file (`.github/workflows/refresh-data.yml`) with a `schedule:` trigger runs `fetch_fred.py` and `fetch_vc_reports.py` on whatever cadence you want, then commits the updated `dashboard-data.json` (and any new PDFs) back to the repo. That commit automatically triggers GitHub Pages to redeploy, so the live site updates itself.

A few practical notes:

- **Secrets**: your FRED and Anthropic API keys move from the local `.env` file into the repo's *Settings → Secrets and variables → Actions*, where the workflow can use them without ever exposing them in code.
- **Public vs. private repo**: a public repo is what makes GitHub Pages free. That means the PDF archive and JSON data are visible to anyone who finds the URL — fine here, since it's all sourced from free public reports anyway, but worth knowing. If you'd rather keep it private later, GitHub Pages from a private repo requires GitHub Pro (~$4/month); a free alternative is putting Cloudflare Access in front of the page for a login prompt while keeping everything else as-is.
- **You still develop locally first** — run the scripts and open the dashboard on your own machine the way we discussed earlier, get it working, then push to GitHub once it's solid. The Actions workflow is what takes over the recurring part once it's live.

## Schedule

The workflow's `schedule:` trigger, runs the 20th of each month at 9am UTC (a few weeks after quarter-end, when reports are usually out):

```yaml
on:
  schedule:
    - cron: '0 9 20 * *'
  workflow_dispatch:        # lets you also trigger it manually from GitHub's UI
```

## Build order (the actual prompt for Claude Code)

> Build a dashboard project per the structure below. Use Python for the scripts (requests, pandas, openpyxl, pdfplumber, python-dotenv). Keep the dashboard itself as a single static HTML file that fetches `data/dashboard-data.json` on load — no frontend framework needed. The end goal is GitHub Pages hosting with GitHub Actions running the scheduled refresh, so structure everything with that in mind.
>
> 1. Scaffold the folder structure exactly as specified.
> 2. Write `fetch_fred.py`: pulls CPI, Fed funds rate, unemployment, UMich consumer sentiment, real GDP growth, and the 10Y-2Y / 10Y-3M / HY-IG / SOFR-vs-Fed-funds spreads from the FRED API, writes them into `dashboard-data.json` under an `econ` and `spreads` key with `value`, `as_of`, and `series_id` for each.
> 3. Design the `vc` key in `dashboard-data.json` so every metric is an object with `value`, `as_of_quarter`, `source` (e.g. `"nvca_excel"`, `"ftpartners_pdf"`, `"pitchbook_api"`), and `source_file` — this needs to be settled before writing the NVCA/FT Partners scripts, since both write into it and a future PitchBook script should be able to write into it the same way without changes elsewhere.
> 4. Write `fetch_nvca.py`: checks the NVCA Venture Monitor page (nvca.org/pitchbook-nvca-venture-monitor) for a release newer than what's in `manifest.json`. Downloads both the PDF and the Excel data file into `reports/nvca/`. Parses the Excel directly with pandas/openpyxl (no LLM) for seed/Series C median pre-money valuation, exit value, and dry powder. Updates `manifest.json` and `dashboard-data.json`.
> 5. Write `fetch_ftpartners.py`: same check-and-download pattern against FT Partners' research page (ftpartners.com/fintech-research), but PDF only, into `reports/ftpartners/`.
> 6. Write `extract_ftpartners.py`: for any newly downloaded FT Partners PDF, extract text with pdfplumber, send it to Claude (Anthropic API, `ANTHROPIC_API_KEY` from `.env` locally / from a GitHub secret in CI) with a prompt requesting fintech deal volume and any other named metrics as strict JSON. Merge into `dashboard-data.json` following the schema from step 3.
> 7. Create `fetch_pitchbook.py` as an empty stub with a docstring describing the intended shape (same schema, `source: "pitchbook_api"`) — not implemented, just scaffolded for later.
> 8. Build `index.html` styled as a dark, editorial "at a glance" dashboard — masthead, a top status strip summarizing the headline signals, then three sections (Economic Indicators, Rate Spreads, Venture Capital) as card grids with sparklines where there's a time series. Each card shows its source and as-of date.
> 9. Write `.github/workflows/refresh-data.yml`: on the schedule below, checks out the repo, installs Python deps, runs `fetch_fred.py`, `fetch_nvca.py`, `fetch_ftpartners.py`, then `extract_ftpartners.py` (using repo secrets for the API keys), and commits/pushes any changes to `data/`, `reports/`, and `manifest.json` back to the repo.
> 10. Write a README covering: local setup (.env keys, how to get a free FRED key, how to run scripts manually), how to enable GitHub Pages for this repo, how to add the two API keys as repo secrets, and a short note on where `fetch_pitchbook.py` would plug in if a subscription gets added later.
>
> Ask me for my FRED API key and Anthropic API key once the scaffolding is in place — don't hardcode them anywhere that could get committed to git. Don't push to GitHub until I've confirmed the dashboard works locally first.

## Notes for you

- **Getting a FRED key**: free, instant, no approval wait — sign up at fred.stlouisfed.org/docs/api/api_key.html
- **New to GitHub?** You only need four things: create a repo, push this project to it, add your two API keys under *Settings → Secrets and variables → Actions*, then turn on Pages under *Settings → Pages*. Claude Code can walk you through each step, including the actual git commands, when you get there — you don't need to know git going in.
- **On PitchBook**: you weren't sure yet whether you'll get access, so v1 doesn't depend on it — NVCA's Excel and FT Partners' PDF cover the VC section on their own. If a subscription happens later, `fetch_pitchbook.py` already has a slot to fill and a schema to write into; it's an addition, not a redo.
- **Respect the source**: NVCA and FT Partners publish these reports as free marketing/research material, so archiving them locally and pulling headline stats into a personal dashboard is well within how they're meant to be used. Just don't have the script republish or redistribute the PDFs anywhere public beyond this repo.
- **If a report's layout changes** (it happens — these aren't structured data feeds), the extraction step might miss a metric some quarter. That's a "check the log, glance at the PDF" problem, not a "rebuild the pipeline" problem — worth a quick manual look each quarter rather than assuming it's always right.
